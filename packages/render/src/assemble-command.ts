import type {
  KavioAudioAsset,
  KavioAudioTrack,
  KavioDocument,
  KavioExportPreset,
  KavioVideoAsset,
  KavioVideoLayer
} from "@kitsra/kavio-schema";
import { extensionForFormat } from "@kitsra/kavio-schema";
import type {
  FfmpegAudioTrackPlanOptions,
  FfmpegBaseVideoPlanOptions,
  FfmpegFilterChain,
  FfmpegPlan
} from "@kitsra/kavio-ffmpeg";
import { buildFilterComplexArgs, planAudioMix, planBaseVideoSequence, planOverlayCompositing } from "@kitsra/kavio-ffmpeg";
import { renderError } from "./errors.js";
import { audioEncoder, defaultAudioCodec, defaultVideoCodec, pixelFormat, videoEncoder } from "./encoding.js";

export interface AssembleRenderCommandOptions {
  /** Composition with props resolved and the export preset already applied. */
  view: KavioDocument;
  preset: KavioExportPreset;
  /** printf-style path to the captured transparent overlay frames, e.g. work/overlay-%05d.png */
  framePattern: string;
  /** Output file path. Defaults to `<preset.name>.<ext>`. */
  outputPath?: string;
}

const VIDEO_OUT_LABEL = "video_out";
const AUDIO_OUT_LABEL = "audio_out";
const BASE_LABEL = "base_video";

/**
 * Fuse the FFmpeg planner's base-video, overlay, and audio-mix pieces into a single
 * runnable `ffmpeg` argument list. Pure: no IO, no process spawning.
 *
 * Hybrid (source-video base) and graphics-only (generated color base) differ only
 * in how the base stream is produced; everything downstream is identical.
 */
export function assembleRenderCommand(options: AssembleRenderCommandOptions): string[] {
  const { view, preset, framePattern } = options;
  const fps = preset.fps ?? view.composition.fps;
  const width = preset.width;
  const height = preset.height;
  const background = preset.background ?? view.composition.background ?? "black";
  const outputPath = options.outputPath ?? `${preset.name}.${extensionForFormat(preset.format)}`;
  const durationSeconds = view.composition.durationFrames / fps;

  const inputArgs: string[] = [];
  const chains: FfmpegFilterChain[] = [];
  let inputIndex = 0;

  // --- Base video: source clips, or a synthesized color background --------
  const videoLayers = view.layers.filter((layer): layer is KavioVideoLayer => layer.type === "video");
  let baseLabel: string;

  if (videoLayers.length > 0) {
    const segments = videoLayers.map((layer, index) =>
      baseSegment(view, layer, { width, height }, fps, inputIndex + index, background)
    );
    const basePlan = planBaseVideoSequence({ segments, outputLabel: BASE_LABEL });
    inputArgs.push(...planInputArgs(basePlan));
    chains.push(...planFilterChains(basePlan));
    inputIndex += segments.length;
    baseLabel = BASE_LABEL;
  } else {
    inputArgs.push(
      "-f",
      "lavfi",
      "-i",
      `color=c=${escapeLavfi(background)}:s=${width}x${height}:r=${fps}:d=${formatSeconds(durationSeconds)}`
    );
    baseLabel = `${inputIndex}:v`;
    inputIndex += 1;
  }

  // --- Transparent overlay frame sequence ---------------------------------
  const overlayPlan = planOverlayCompositing({
    baseLabel,
    frames: { framePattern, fps, inputIndex, startNumber: 0, outputLabel: "overlay_frames" },
    outputLabel: VIDEO_OUT_LABEL,
    shortest: true
  });
  inputArgs.push(...planInputArgs(overlayPlan));
  chains.push(...planFilterChains(overlayPlan));
  inputIndex += 1;

  // --- Audio: mix declared tracks, or synthesize silence ------------------
  const audioTracks = view.audio ?? [];
  if (audioTracks.length > 0) {
    const trackOptions = audioTracks.map((track, index) => audioOption(view, track, inputIndex + index));
    const audioPlan = planAudioMix({ tracks: trackOptions, fps, outputLabel: AUDIO_OUT_LABEL, normalizeLoudness: true });
    inputArgs.push(...planInputArgs(audioPlan));
    chains.push(...planFilterChains(audioPlan));
    inputIndex += trackOptions.length;
  } else {
    inputArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    chains.push(silentAudioChain(inputIndex));
    inputIndex += 1;
  }

  return [
    "-y",
    ...inputArgs,
    ...buildFilterComplexArgs(chains),
    "-map",
    `[${VIDEO_OUT_LABEL}]`,
    "-map",
    `[${AUDIO_OUT_LABEL}]`,
    ...encodeArgs(preset, fps),
    "-t",
    formatSeconds(durationSeconds),
    outputPath
  ];
}

function baseSegment(
  view: KavioDocument,
  layer: KavioVideoLayer,
  output: { width: number; height: number },
  fps: number,
  inputIndex: number,
  background: string
): FfmpegBaseVideoPlanOptions {
  const asset = videoAsset(view, layer.asset, layer.id);
  const segment: FfmpegBaseVideoPlanOptions = {
    asset: {
      src: asset.src,
      trimStartFrames: asset.trimStartFrames ?? 0,
      trimEndFrames: asset.trimEndFrames ?? null,
      loop: asset.loop ?? false
    },
    layer: {
      id: layer.id,
      asset: layer.asset,
      durationFrames: layer.durationFrames,
      fit: layer.fit ?? "cover",
      ...(layer.crop === undefined ? {} : { crop: layer.crop }),
      playbackRate: layer.playbackRate ?? 1
    },
    output,
    fps,
    inputIndex,
    background
  };
  return segment;
}

function audioOption(view: KavioDocument, track: KavioAudioTrack, inputIndex: number): FfmpegAudioTrackPlanOptions {
  const asset = audioAsset(view, track.asset);
  return {
    asset: {
      src: asset.src,
      trimStartFrames: asset.trimStartFrames ?? 0,
      trimEndFrames: asset.trimEndFrames ?? null,
      loop: asset.loop ?? false
    },
    track,
    inputIndex
  };
}

function silentAudioChain(inputIndex: number): FfmpegFilterChain {
  return {
    inputLabels: [`${inputIndex}:a`],
    filters: ["anull"],
    outputLabel: AUDIO_OUT_LABEL,
    expression: `[${inputIndex}:a]anull[${AUDIO_OUT_LABEL}]`
  };
}

function encodeArgs(preset: KavioExportPreset, fps: number): string[] {
  const codec = preset.codec ?? defaultVideoCodec(preset.format);
  const args = [
    "-c:v",
    videoEncoder(codec),
    "-crf",
    String(preset.crf ?? 18),
    "-pix_fmt",
    pixelFormat(codec),
    "-r",
    String(fps),
    "-c:a",
    audioEncoder(preset.audioCodec ?? defaultAudioCodec(preset.format)),
    "-b:a",
    preset.audioBitrate ?? "192k"
  ];
  if (preset.format === "mp4" || preset.format === "mov") {
    args.push("-movflags", "+faststart");
  }
  return args;
}

function planInputArgs(plan: FfmpegPlan): string[] {
  return plan.steps.filter((step) => step.kind === "input").flatMap((step) => step.args);
}

function planFilterChains(plan: FfmpegPlan): FfmpegFilterChain[] {
  const chains: FfmpegFilterChain[] = [];
  for (const step of plan.steps) {
    if (step.kind === "filter") {
      chains.push(...step.chains);
    }
  }
  return chains;
}

function videoAsset(view: KavioDocument, id: string, layerId: string): KavioVideoAsset {
  const asset = view.assets[id];
  if (asset === undefined || asset.type !== "video") {
    throw renderError({
      code: "ASSET_UNSUPPORTED",
      stage: "render",
      message: `Video layer "${layerId}" references missing or non-video asset "${id}".`,
      path: `assets.${id}`
    });
  }
  return asset;
}

function audioAsset(view: KavioDocument, id: string): KavioAudioAsset {
  const asset = view.assets[id];
  if (asset === undefined || asset.type !== "audio") {
    throw renderError({
      code: "ASSET_UNSUPPORTED",
      stage: "render",
      message: `Audio track references missing or non-audio asset "${id}".`,
      path: `assets.${id}`
    });
  }
  return asset;
}

function escapeLavfi(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatSeconds(seconds: number): string {
  if (Number.isInteger(seconds)) {
    return String(seconds);
  }
  return seconds.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
