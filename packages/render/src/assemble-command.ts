import { evaluateLayer, getCanvasDimensions, isLayerActive } from "@kitsra/kavio-core";
import type { CanvasDimensions } from "@kitsra/kavio-core";
import type {
  KavioAudioAsset,
  KavioAudioTrack,
  KavioDocument,
  KavioExportPreset,
  KavioLayer,
  KavioShapeLayer,
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
import {
  buildFilterComplexArgs,
  planAudioMix,
  planBaseVideoSequence,
  planOverlayCompositing,
  planVideoPipOverlay
} from "@kitsra/kavio-ffmpeg";
import { renderError } from "./errors.js";
import { audioEncoder, defaultAudioCodec, defaultVideoCodec, pixelFormat, videoEncoder } from "./encoding.js";

export interface AssembleRenderCommandOptions {
  /** Composition with props resolved and the export preset already applied. */
  view: KavioDocument;
  preset: KavioExportPreset;
  /**
   * printf-style path to the captured transparent overlay frames, e.g.
   * work/overlay-%05d.png. When omitted, the command reads overlay frames from
   * stdin as an image2pipe PNG stream so capture and encode can overlap.
   */
  framePattern?: string;
  /** Output file path. Defaults to `<preset.name>.<ext>`. */
  outputPath?: string;
}

export interface AssembleDirectRenderCommandOptions {
  /** Composition with props resolved and the export preset already applied. */
  view: KavioDocument;
  preset: KavioExportPreset;
  /** Output file path. Defaults to `<preset.name>.<ext>`. */
  outputPath?: string;
}

export type DirectRenderSupport =
  | { ok: true }
  | { ok: false; reason: string; layerId?: string };

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
  const transparentOutput = background === "transparent";
  const audioOutput = preset.format !== "gif" && preset.format !== "png-sequence";

  const inputArgs: string[] = [];
  const chains: FfmpegFilterChain[] = [];
  let inputIndex = 0;

  if (transparentOutput) {
    if (framePattern === undefined) {
      inputArgs.push("-f", "image2pipe", "-framerate", String(fps), "-i", "-");
    } else {
      inputArgs.push("-framerate", String(fps), "-start_number", "0", "-i", framePattern);
    }
    chains.push({
      inputLabels: [`${inputIndex}:v`],
      filters: ["format=rgba"],
      outputLabel: VIDEO_OUT_LABEL,
      expression: `[${inputIndex}:v]format=rgba[${VIDEO_OUT_LABEL}]`
    });
    inputIndex += 1;
  } else {
    // --- Base video: source clips, or a synthesized color background --------
    // Video layers that don't overlap in time form the sequential base
    // timeline; layers overlapping the base become picture-in-picture planes
    // stacked over it in document order, under the graphics overlay.
    const videoLayers = view.layers.filter((layer): layer is KavioVideoLayer => layer.type === "video");
    const { baseVideoLayers, pipVideoLayers } = partitionVideoLayers(videoLayers);
    let baseLabel: string;

    if (baseVideoLayers.length > 0) {
      const segments = baseVideoLayers.map((layer, index) =>
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

    pipVideoLayers.forEach((layer, pipIndex) => {
      // Evaluate layout mid-window so transition offsets at the edges don't
      // skew the static pip position; animated pip position is not supported.
      const midFrame = layer.startFrame + Math.floor(layer.durationFrames / 2);
      const layout = evaluateLayer(layer, midFrame, getCanvasDimensions(view.composition));
      const pipWidth = Math.max(1, Math.round(layout.size.width ?? width));
      const pipHeight = Math.max(1, Math.round(layout.size.height ?? height));
      const outputLabel = `pip_stage_${pipIndex}`;
      const pipPlan = planVideoPipOverlay({
        segment: baseSegment(view, layer, { width: pipWidth, height: pipHeight }, fps, inputIndex, background),
        baseLabel,
        x: Math.round(layout.topLeft.x ?? 0),
        y: Math.round(layout.topLeft.y ?? 0),
        startFrame: layer.startFrame,
        durationFrames: layer.durationFrames,
        fps,
        outputLabel
      });
      inputArgs.push(...planInputArgs(pipPlan));
      chains.push(...planFilterChains(pipPlan));
      inputIndex += 1;
      baseLabel = outputLabel;
    });

    // --- Transparent overlay frame sequence (files or stdin pipe) -----------
    const overlayPlan = planOverlayCompositing({
      baseLabel,
      frames: { framePattern: framePattern ?? "-", fps, inputIndex, startNumber: 0, outputLabel: "overlay_frames" },
      outputLabel: VIDEO_OUT_LABEL,
      shortest: true
    });
    if (framePattern === undefined) {
      inputArgs.push("-f", "image2pipe", "-framerate", String(fps), "-i", "-");
    } else {
      inputArgs.push(...planInputArgs(overlayPlan));
    }
    chains.push(...planFilterChains(overlayPlan));
    inputIndex += 1;
  }

  // --- Audio: mix declared tracks, or synthesize silence ------------------
  const audioTracks = view.audio ?? [];
  if (!audioOutput) {
    // Static image outputs carry video frames only.
  } else if (audioTracks.length > 0) {
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
    ...(audioOutput ? ["-map", `[${AUDIO_OUT_LABEL}]`] : []),
    ...encodeArgs(preset, fps, transparentOutput),
    "-t",
    formatSeconds(durationSeconds),
    outputPath
  ];
}

/**
 * Experimental FFmpeg-direct renderer for filtergraph-safe templates. This path
 * deliberately avoids the browser/PNG overlay loop and compiles supported shape
 * layers into drawbox filters over the normal base video/audio plan.
 */
export function assembleDirectRenderCommand(options: AssembleDirectRenderCommandOptions): string[] {
  const support = getDirectRenderSupport(options.view);
  if (!support.ok) {
    throw renderError({
      code: "RENDER_FAILED",
      stage: "render",
      path: support.layerId === undefined ? "layers" : `layers.${support.layerId}`,
      message: `FFmpeg-direct render does not support this composition yet: ${support.reason}`
    });
  }

  const { view, preset } = options;
  const fps = preset.fps ?? view.composition.fps;
  const width = preset.width;
  const height = preset.height;
  const background = preset.background ?? view.composition.background ?? "black";
  const outputPath = options.outputPath ?? `${preset.name}.${extensionForFormat(preset.format)}`;
  const durationSeconds = view.composition.durationFrames / fps;

  const inputArgs: string[] = [];
  const chains: FfmpegFilterChain[] = [];
  let inputIndex = 0;

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

  chains.push(buildDirectShapeFilterChain(view, baseLabel, VIDEO_OUT_LABEL));

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

export function getDirectRenderSupport(view: KavioDocument): DirectRenderSupport {
  for (const layer of view.layers) {
    if (layer.type === "video") {
      continue;
    }

    if (layer.type !== "shape") {
      return unsupported(layer, `layer type "${layer.type}" requires browser rendering`);
    }

    const unsupportedShape = getUnsupportedDirectShapeReason(layer);
    if (unsupportedShape !== null) {
      return unsupported(layer, unsupportedShape);
    }
  }

  return { ok: true };
}

function framesOverlap(
  a: Pick<KavioLayer, "startFrame" | "durationFrames">,
  b: Pick<KavioLayer, "startFrame" | "durationFrames">
): boolean {
  return a.startFrame < b.startFrame + b.durationFrames && b.startFrame < a.startFrame + a.durationFrames;
}

function partitionVideoLayers(videoLayers: readonly KavioVideoLayer[]): {
  baseVideoLayers: KavioVideoLayer[];
  pipVideoLayers: KavioVideoLayer[];
} {
  const baseVideoLayers: KavioVideoLayer[] = [];
  const pipVideoLayers: KavioVideoLayer[] = [];
  for (const layer of videoLayers) {
    if (baseVideoLayers.some((existing) => framesOverlap(existing, layer))) {
      pipVideoLayers.push(layer);
    } else {
      baseVideoLayers.push(layer);
    }
  }
  return { baseVideoLayers, pipVideoLayers };
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

function buildDirectShapeFilterChain(view: KavioDocument, inputLabel: string, outputLabel: string): FfmpegFilterChain {
  const dimensions = getCanvasDimensions(view.composition);
  const filters = view.layers
    .map((layer, index) => ({ layer, order: layer.z ?? index }))
    .sort((a, b) => a.order - b.order)
    .flatMap(({ layer }) => (layer.type === "shape" ? directShapeFilters(layer, dimensions) : []));
  const effectiveFilters = filters.length === 0 ? ["null"] : filters;

  return {
    inputLabels: [inputLabel],
    filters: effectiveFilters,
    outputLabel,
    expression: `[${inputLabel}]${effectiveFilters.join(",")}[${outputLabel}]`
  };
}

function directShapeFilters(layer: KavioShapeLayer, dimensions: CanvasDimensions): string[] {
  const evaluation = evaluateLayer(layer, layer.startFrame, dimensions);
  const width = evaluation.size.width ?? 0;
  const height = evaluation.size.height ?? 0;
  if (!isLayerActive(layer, layer.startFrame) || width <= 0 || height <= 0 || evaluation.opacity <= 0) {
    return [];
  }

  const x = evaluation.topLeft.x ?? evaluation.position.x;
  const y = evaluation.topLeft.y ?? evaluation.position.y;
  const start = layer.startFrame;
  const end = layer.startFrame + layer.durationFrames - 1;
  const enable = `enable='between(n,${start},${end})'`;
  const filters: string[] = [];

  if (layer.fill !== undefined && layer.fill !== "transparent") {
    filters.push(
      `drawbox=x=${formatFfmpegNumber(x)}:y=${formatFfmpegNumber(y)}:w=${formatFfmpegNumber(width)}:h=${formatFfmpegNumber(height)}:color=${formatDrawboxColor(layer.fill, evaluation.opacity)}:t=fill:${enable}`
    );
  }

  if (layer.stroke !== undefined && layer.stroke !== null && layer.stroke.width > 0) {
    filters.push(
      `drawbox=x=${formatFfmpegNumber(x)}:y=${formatFfmpegNumber(y)}:w=${formatFfmpegNumber(width)}:h=${formatFfmpegNumber(height)}:color=${formatDrawboxColor(layer.stroke.color, evaluation.opacity)}:t=${formatFfmpegNumber(layer.stroke.width)}:${enable}`
    );
  }

  return filters;
}

function getUnsupportedDirectShapeReason(layer: KavioShapeLayer): string | null {
  if (layer.shape !== "rect") {
    return `shape "${layer.shape}" is not supported`;
  }
  if (layer.radius !== undefined && layer.radius > 0) {
    return "rounded shape corners are not supported";
  }
  if (layer.keyframes !== undefined && Object.keys(layer.keyframes).length > 0) {
    return "animated shape keyframes are not supported";
  }
  if (layer.rotation !== undefined && layer.rotation !== 0) {
    return "rotated shapes are not supported";
  }
  if (layer.scale !== undefined && layer.scale !== 1) {
    return "scaled shapes are not supported";
  }
  if (layer.effects !== undefined && layer.effects.length > 0) {
    return "shape effects are not supported";
  }
  if (layer.mask !== undefined && layer.mask !== null) {
    return "shape masks are not supported";
  }
  if (layer.transitionIn !== undefined && layer.transitionIn !== null) {
    return "shape transitions are not supported";
  }
  if (layer.transitionOut !== undefined && layer.transitionOut !== null) {
    return "shape transitions are not supported";
  }
  if (layer.fill !== undefined && layer.fill !== "transparent" && !isDirectColorSupported(layer.fill)) {
    return `fill color "${layer.fill}" is not supported`;
  }
  if (layer.stroke !== undefined && layer.stroke !== null && !isDirectColorSupported(layer.stroke.color)) {
    return `stroke color "${layer.stroke.color}" is not supported`;
  }
  return null;
}

function unsupported(layer: KavioLayer, reason: string): DirectRenderSupport {
  return { ok: false, reason, layerId: layer.id };
}

function silentAudioChain(inputIndex: number): FfmpegFilterChain {
  return {
    inputLabels: [`${inputIndex}:a`],
    filters: ["anull"],
    outputLabel: AUDIO_OUT_LABEL,
    expression: `[${inputIndex}:a]anull[${AUDIO_OUT_LABEL}]`
  };
}

function encodeArgs(preset: KavioExportPreset, fps: number, alpha = false): string[] {
  if (preset.format === "gif") {
    return ["-r", String(fps), "-f", "gif"];
  }
  const codec = preset.codec ?? defaultVideoCodec(preset.format);
  const args = [
    "-c:v",
    videoEncoder(codec),
    "-crf",
    String(preset.crf ?? 18),
    "-pix_fmt",
    pixelFormat(codec, alpha),
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

function isDirectColorSupported(value: string): boolean {
  return value === "transparent" || /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
}

function formatDrawboxColor(value: string, opacity: number): string {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (match === null) {
    throw renderError({
      code: "RENDER_FAILED",
      stage: "render",
      message: `FFmpeg-direct render only supports hex colors; received "${value}".`
    });
  }

  const base = match[1]!;
  const alpha = match[2] === undefined ? 1 : Number.parseInt(match[2], 16) / 255;
  return `${escapeLavfi(`0x${base}`)}@${formatFfmpegNumber(alpha * opacity)}`;
}

function formatFfmpegNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw renderError({
      code: "RENDER_FAILED",
      stage: "render",
      message: "FFmpeg-direct render encountered a non-finite numeric value."
    });
  }

  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatSeconds(seconds: number): string {
  if (Number.isInteger(seconds)) {
    return String(seconds);
  }
  return seconds.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
