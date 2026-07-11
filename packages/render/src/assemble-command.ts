import { compileTransitionOverlapWindows, evaluateLayer, getCanvasDimensions, isLayerActive, resolveLayout } from "@kitsra/kavio-core";
import type { CanvasDimensions, TransitionOverlapWindow } from "@kitsra/kavio-core";
import type {
  KavioAudioAsset,
  KavioAudioTrack,
  KavioDocument,
  KavioExportPreset,
  KavioImageAsset,
  KavioImageLayer,
  KavioLayer,
  KavioShapeLayer,
  KavioTrackClip,
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
  buildConcatFilterChain,
  buildFilterComplexArgs,
  buildFitVideoFilters,
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
  /** Captured frames already include the effective opaque background. */
  flattenedBrowserFrames?: boolean;
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
  } else if (options.flattenedBrowserFrames === true) {
    if (framePattern === undefined) {
      inputArgs.push("-f", "image2pipe", "-framerate", String(fps), "-i", "-");
    } else {
      inputArgs.push("-framerate", String(fps), "-start_number", "0", "-i", framePattern);
    }
    chains.push({
      inputLabels: [`${inputIndex}:v`],
      filters: ["format=yuv420p"],
      outputLabel: VIDEO_OUT_LABEL,
      expression: `[${inputIndex}:v]format=yuv420p[${VIDEO_OUT_LABEL}]`
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
      shortest: false
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
 * deliberately avoids the browser/PNG overlay loop and compiles supported image
 * slideshows or shape layers into FFmpeg filters.
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
  const imageLayers = view.layers.filter((layer): layer is KavioImageLayer => layer.type === "image");
  let baseLabel: string;

  if (imageLayers.length > 0) {
    const imageSequence = directImageSequence(view, imageLayers, { width, height }, fps, inputIndex, background, VIDEO_OUT_LABEL);
    inputArgs.push(...imageSequence.inputArgs);
    chains.push(...imageSequence.chains);
    inputIndex += imageLayers.length;
    baseLabel = VIDEO_OUT_LABEL;
  } else if (videoLayers.length > 0) {
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

  if (imageLayers.length === 0) {
    chains.push(buildDirectShapeFilterChain(view, baseLabel, VIDEO_OUT_LABEL));
  }

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
  const imageLayers = view.layers.filter((layer): layer is KavioImageLayer => layer.type === "image");
  if (imageLayers.length > 0) {
    return getDirectImageSequenceSupport(view, imageLayers);
  }

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

function directImageSequence(
  view: KavioDocument,
  layers: KavioImageLayer[],
  output: { width: number; height: number },
  fps: number,
  firstInputIndex: number,
  background: string,
  outputLabel: string
): { inputArgs: string[]; chains: FfmpegFilterChain[] } {
  const ordered = directImageLayerOrder(view, layers);
  const transitionWindows = compileTransitionOverlapWindows(view.tracks);
  const inputArgs: string[] = [];
  const chains: FfmpegFilterChain[] = [];
  const labels: string[] = [];

  ordered.forEach((layer, index) => {
    const asset = imageAsset(view, layer.asset, layer.id);
    const inputIndex = firstInputIndex + index;
    if (directImageZoomSpec(layer) === null) {
      inputArgs.push("-loop", "1", "-framerate", String(fps), "-t", formatSeconds(layer.durationFrames / fps), "-i", asset.src);
    } else {
      inputArgs.push("-i", asset.src);
    }

    const label = ordered.length === 1 ? outputLabel : `direct_image_${index}`;
    const filters = directImageFilters(layer, output, fps, background);
    labels.push(label);
    chains.push({
      inputLabels: [`${inputIndex}:v`],
      filters,
      outputLabel: label,
      expression: `[${inputIndex}:v]${filters.join(",")}[${label}]`
    });
  });

  if (transitionWindows.length > 0) {
    let leftLabel = labels[0]!;
    transitionWindows.forEach((window, index) => {
      const rightLabel = labels[index + 1]!;
      const label = index === transitionWindows.length - 1 ? outputLabel : `direct_xfade_${index}`;
      const transition = directImageTrackXfadeName(window);
      if (transition === null) {
        throw renderError({
          code: "RENDER_FAILED",
          stage: "ffmpeg",
          message: `Unsupported FFmpeg-direct transition "${window.transition.type}".`
        });
      }
      const filters = [
        `xfade=transition=${transition}:duration=${formatSeconds(window.durationFrames / fps)}:offset=${formatSeconds(window.startFrame / fps)}`,
        "format=yuv420p"
      ];
      chains.push({
        inputLabels: [leftLabel, rightLabel],
        filters,
        outputLabel: label,
        expression: `[${leftLabel}][${rightLabel}]${filters.join(",")}[${label}]`
      });
      leftLabel = label;
    });
  } else if (labels.length > 1) {
    chains.push(buildConcatFilterChain({ segmentLabels: labels, outputLabel }));
  }
  return { inputArgs, chains };
}

function getDirectImageSequenceSupport(view: KavioDocument, imageLayers: KavioImageLayer[]): DirectRenderSupport {
  if (view.layers.some((layer) => layer.type !== "image")) {
    return { ok: false, reason: "image sequence direct render only supports image layers" };
  }

  const dimensions = getCanvasDimensions(view.composition);
  for (const layer of imageLayers) {
    const reason = getUnsupportedDirectImageReason(layer, dimensions);
    if (reason !== null) {
      return unsupported(layer, reason);
    }
  }

  if ((view.tracks ?? []).length > 0) {
    return getDirectImageTrackSupport(view, imageLayers);
  }

  const ordered = directImageLayerOrder(view, imageLayers);
  let cursor = 0;
  for (const layer of ordered) {
    if (layer.startFrame !== cursor) {
      return unsupported(layer, "image sequence layers must be contiguous and non-overlapping");
    }
    cursor += layer.durationFrames;
  }

  if (cursor !== view.composition.durationFrames) {
    return { ok: false, reason: "image sequence layers must cover the full composition duration" };
  }

  return { ok: true };
}

function getDirectImageTrackSupport(view: KavioDocument, imageLayers: KavioImageLayer[]): DirectRenderSupport {
  const tracks = view.tracks ?? [];
  if (tracks.length !== 1) {
    return { ok: false, reason: "image sequence direct render supports one transition track" };
  }

  const track = tracks[0];
  if (track === undefined || track.clips.length === 0) {
    return { ok: false, reason: "image sequence transition track requires clips" };
  }
  if (track.clips.length !== imageLayers.length) {
    return { ok: false, reason: "image sequence transition track must reference every image layer exactly once" };
  }

  const layersById = new Map(imageLayers.map((layer) => [layer.id, layer]));
  const windowsByNextClipId = new Map(compileTransitionOverlapWindows(view.tracks).map((window) => [window.nextClipId, window]));
  const seenLayerIds = new Set<string>();

  for (let index = 0; index < track.clips.length; index += 1) {
    const clip = track.clips[index]!;
    const layer = layersById.get(clip.layerId);
    if (layer === undefined || seenLayerIds.has(layer.id)) {
      return { ok: false, reason: "image sequence transition track must reference every image layer exactly once" };
    }
    seenLayerIds.add(layer.id);

    if (clip.startFrame !== layer.startFrame || clip.durationFrames !== layer.durationFrames) {
      return unsupported(layer, "image transition track clip timing must match its image layer timing");
    }
    if (layer.transitionIn !== undefined || layer.transitionOut !== undefined) {
      return unsupported(layer, "image transition tracks cannot be combined with layer transitions");
    }

    if (index === 0) {
      if (clip.startFrame !== 0) {
        return unsupported(layer, "image transition track must start at frame 0");
      }
      continue;
    }

    if (clip.transitionFromPrevious === undefined) {
      return unsupported(layer, "image transition track requires transitionFromPrevious on every handoff");
    }

    const previousClip = track.clips[index - 1]!;
    const window = windowsByNextClipId.get(clip.id);
    if (window === undefined) {
      return unsupported(layer, "image transition track timing is invalid");
    }

    const transitionReason = getUnsupportedDirectImageTrackTransitionReason(window);
    if (transitionReason !== null) {
      return unsupported(layer, transitionReason);
    }
    if (clip.startFrame !== previousClip.startFrame + previousClip.durationFrames - window.durationFrames) {
      return unsupported(layer, "image transition overlap must exactly match transition duration");
    }
  }

  const lastClip = track.clips.at(-1)!;
  if (lastClip.startFrame + lastClip.durationFrames !== view.composition.durationFrames) {
    return { ok: false, reason: "image transition track must cover the full composition duration" };
  }

  return { ok: true };
}

function getUnsupportedDirectImageTrackTransitionReason(window: TransitionOverlapWindow): string | null {
  if (window.transition.easing !== undefined && window.transition.easing !== "linear") {
    return "image transition tracks only support linear FFmpeg-direct timing";
  }
  if (directImageTrackXfadeName(window) !== null) {
    return null;
  }
  if ((window.transition.type === "iris" || window.transition.type === "expandMask") && window.transition.shape === "diamond") {
    return "image transition tracks only support circular iris/expandMask in FFmpeg-direct mode";
  }
  if (window.transition.type === "clockWipe" && window.transition.direction !== undefined && window.transition.direction !== "right") {
    return "image transition tracks only support the default clockwise clockWipe in FFmpeg-direct mode";
  }
  if (window.transition.type === "filmFlash") {
    return "image transition tracks require an explicit white filmFlash color in FFmpeg-direct mode";
  }
  if (window.transition.type === "dip" || window.transition.type === "colorDissolve") {
    return "image transition tracks only support black or white dip/colorDissolve in FFmpeg-direct mode";
  }
  if (window.transition.type === "zoom" || window.transition.type === "blurDissolve") {
    return `image transition type "${window.transition.type}" only supports its default strength in FFmpeg-direct mode`;
  }
  return `image transition type "${window.transition.type}" requires browser rendering`;
}

function directImageTrackXfadeName(window: TransitionOverlapWindow): string | null {
  const transition = window.transition;
  switch (transition.type) {
    case "fade":
    case "crossfade":
      return "fade";
    case "wipe":
      return `wipe${oppositeDirection(transition.direction ?? "up")}`;
    case "slide":
      return `slide${transition.direction ?? "up"}`;
    case "push":
      return `slide${transition.direction ?? "left"}`;
    case "iris":
    case "expandMask":
      return transition.shape === undefined || transition.shape === "circle" ? "circleopen" : null;
    case "clockWipe":
      return transition.direction === undefined || transition.direction === "right" ? "radial" : null;
    case "zoom":
      return hasDefaultTransitionStrength(transition) ? "zoomin" : null;
    case "blurDissolve":
      return hasDefaultTransitionStrength(transition) ? "hblur" : null;
    case "dip":
      return hasDefaultTransitionStrength(transition) ? directFadeColorName(transition.color ?? "#000000") : null;
    case "colorDissolve":
      return hasDefaultTransitionStrength(transition) ? directFadeColorName(transition.color ?? "#ffffff") : null;
    case "filmFlash":
      return hasDefaultTransitionStrength(transition) && isWhite(transition.color) ? "fadewhite" : null;
    case "squeeze":
      return hasDefaultTransitionStrength(transition) ? (transition.axis === "y" ? "squeezev" : "squeezeh") : null;
    case "letterboxReveal":
      return transition.axis === "x" ? "horzopen" : "vertopen";
    default:
      return null;
  }
}

function hasDefaultTransitionStrength(transition: TransitionOverlapWindow["transition"]): boolean {
  return transition.amount === undefined && transition.intensity === undefined;
}

function directFadeColorName(color: string): "fadeblack" | "fadewhite" | null {
  if (isBlack(color)) {
    return "fadeblack";
  }
  return isWhite(color) ? "fadewhite" : null;
}

function isBlack(color: string | undefined): boolean {
  return color !== undefined && ["#000", "#000000", "black"].includes(color.toLowerCase());
}

function isWhite(color: string | undefined): boolean {
  return color !== undefined && ["#fff", "#ffffff", "white"].includes(color.toLowerCase());
}

function oppositeDirection(direction: "up" | "down" | "left" | "right"): "up" | "down" | "left" | "right" {
  switch (direction) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function directImageLayerOrder(view: KavioDocument, layers: KavioImageLayer[]): KavioImageLayer[] {
  const track = view.tracks?.[0];
  if (track === undefined) {
    return [...layers].sort((left, right) => left.startFrame - right.startFrame);
  }

  const layersById = new Map(layers.map((layer) => [layer.id, layer]));
  return track.clips.map((clip: KavioTrackClip) => layersById.get(clip.layerId)).filter((layer) => layer !== undefined);
}

function getUnsupportedDirectImageReason(layer: KavioImageLayer, dimensions: CanvasDimensions): string | null {
  if (!isFullFrameImage(layer, dimensions)) {
    return "image layers must be full-frame with center anchor and canvas-sized output";
  }
  if (layer.opacity !== undefined && layer.opacity !== 1) {
    return "image opacity is not supported";
  }
  if (layer.rotation !== undefined && layer.rotation !== 0) {
    return "rotated image layers are not supported";
  }
  if (layer.scale !== undefined && layer.scale !== 1) {
    return "scaled image layers are not supported";
  }
  if (layer.fit === "none") {
    return "image fit none is not supported";
  }
  if (layer.keyframes !== undefined && Object.keys(layer.keyframes).length > 0) {
    const keyframes = Object.keys(layer.keyframes);
    if (keyframes.length !== 1 || keyframes[0] !== "scale" || directImageZoomSpec(layer) === null) {
      return "image keyframes only support a monotonic scale push-in from 1";
    }
  }
  if (layer.effects !== undefined && layer.effects.length > 0) {
    return "image effects are not supported";
  }
  if (layer.mask !== undefined && layer.mask !== null) {
    return "image masks are not supported";
  }
  if (layer.transitionIn !== undefined && layer.transitionIn !== null) {
    const reason = getUnsupportedDirectImageFadeReason(layer.transitionIn);
    if (reason !== null) {
      return reason;
    }
  }
  if (layer.transitionOut !== undefined && layer.transitionOut !== null) {
    const reason = getUnsupportedDirectImageFadeReason(layer.transitionOut);
    if (reason !== null) {
      return reason;
    }
  }
  return null;
}

function directImageFilters(
  layer: KavioImageLayer,
  output: { width: number; height: number },
  fps: number,
  background: string
): string[] {
  const filters = [...buildFitVideoFilters({ dimensions: output, fit: layer.fit ?? "cover", background })];
  const zoom = directImageZoomSpec(layer);
  if (zoom !== null) {
    filters.push(
      `zoompan=z='min(1+on*${formatFfmpegNumber(zoom.perFrame)},${formatFfmpegNumber(zoom.to)})':d=${layer.durationFrames}:s=${output.width}x${output.height}:fps=${fps}`
    );
  }
  filters.push(...directImageFadeFilters(layer, fps, background), "format=yuv420p");
  return filters;
}

function directImageFadeFilters(layer: KavioImageLayer, fps: number, background: string): string[] {
  const filters: string[] = [];
  const color = formatFilterColor(background);
  const transitionInFrames = directFadeDurationFrames(layer.transitionIn);
  if (transitionInFrames !== null) {
    filters.push(`fade=t=in:st=0:d=${formatSeconds(transitionInFrames / fps)}:color=${color}`);
  }
  const transitionOutFrames = directFadeDurationFrames(layer.transitionOut);
  if (transitionOutFrames !== null) {
    filters.push(
      `fade=t=out:st=${formatSeconds((layer.durationFrames - transitionOutFrames) / fps)}:d=${formatSeconds(transitionOutFrames / fps)}:color=${color}`
    );
  }
  return filters;
}

function directFadeDurationFrames(transition: KavioImageLayer["transitionIn"]): number | null {
  if (transition === undefined || transition === null) {
    return null;
  }
  if (transition.durationFrames !== undefined) {
    return transition.durationFrames;
  }
  if (transition.timing !== undefined && "durationFrames" in transition.timing) {
    return transition.timing.durationFrames;
  }
  return null;
}

function getUnsupportedDirectImageFadeReason(transition: NonNullable<KavioImageLayer["transitionIn"]>): string | null {
  if (transition.type !== "fade") {
    return "image direct render only supports fade transitions";
  }
  if (transition.easing !== undefined && transition.easing !== "linear") {
    return "image direct render only supports linear fade transitions";
  }
  if (
    transition.timing !== undefined &&
    (transition.timing.type !== "tween" || (transition.timing.easing !== undefined && transition.timing.easing !== "linear"))
  ) {
    return "image direct render only supports linear fade timing";
  }
  if (directFadeDurationFrames(transition) === null) {
    return "image direct render fade transitions require durationFrames";
  }
  return null;
}

function directImageZoomSpec(layer: KavioImageLayer): { to: number; perFrame: number } | null {
  const scale = layer.keyframes?.scale;
  if (scale === undefined || scale.length < 2) {
    return null;
  }
  if (
    scale.some((keyframe) => (keyframe.easing !== undefined && keyframe.easing !== "linear") || keyframe.timing !== undefined)
  ) {
    return null;
  }
  const first = scale[0];
  const second = scale[1];
  if (
    first === undefined ||
    second === undefined ||
    first.frame !== 0 ||
    !almostEqual(first.value, 1) ||
    second.frame <= 0 ||
    second.value <= first.value
  ) {
    return null;
  }
  if (scale.slice(2).some((keyframe) => !almostEqual(keyframe.value, second.value))) {
    return null;
  }
  return { to: second.value, perFrame: (second.value - first.value) / second.frame };
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000001;
}

function isFullFrameImage(layer: KavioImageLayer, dimensions: CanvasDimensions): boolean {
  const layout = resolveLayout(layer, dimensions);
  return (
    almostEqual(layout.topLeft.x ?? Number.NaN, 0) &&
    almostEqual(layout.topLeft.y ?? Number.NaN, 0) &&
    almostEqual(layout.size.width ?? Number.NaN, dimensions.width) &&
    almostEqual(layout.size.height ?? Number.NaN, dimensions.height)
  );
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
    ...(preset.bitrate === undefined ? ["-crf", String(preset.crf ?? 18)] : ["-b:v", preset.bitrate]),
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

function imageAsset(view: KavioDocument, id: string, layerId: string): KavioImageAsset {
  const asset = view.assets[id];
  if (asset === undefined || asset.type !== "image") {
    throw renderError({
      code: "ASSET_UNSUPPORTED",
      stage: "render",
      message: `Image layer "${layerId}" references missing or non-image asset "${id}".`,
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

function formatFilterColor(value: string): string {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (match !== null) {
    return escapeLavfi(`0x${match[1]}${match[2] ?? ""}`);
  }
  return escapeLavfi(value);
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
