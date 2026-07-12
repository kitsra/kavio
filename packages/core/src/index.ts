import type {
  CompositionTiming,
  KavioCaptionCue,
  KavioCaptionHighlight,
  KavioCaptionLayer,
  KavioCaptionSource,
  KavioCaptionWord,
  KavioDocument,
  KavioError,
  KavioExportPreset,
  KavioLayer,
  KavioLayerMask,
  KavioLayerOverride,
  KavioTiming,
  KavioTrack,
  KavioTrackClip,
  KavioTransitionCorner,
  KavioTransitionSeriesDefinition,
  KavioTransition
} from "@kitsra/kavio-schema";

export type UnitValue = number | `${number}%` | `${number}%w` | `${number}%h`;
export type Axis = "x" | "y" | "width" | "height";
export type AnimatableProperty = "opacity" | "x" | "y" | "scale" | "rotation";
export type EasingName =
  | "linear"
  | "inQuad"
  | "outQuad"
  | "inOutQuad"
  | "inCubic"
  | "outCubic"
  | "inOutCubic"
  | "inCirc"
  | "outCirc"
  | "inOutCirc"
  | "inExpo"
  | "outExpo"
  | "inOutExpo"
  | "anticipate"
  | "back"
  | "inBack"
  | "outBack"
  | "inOutBack"
  | "inElastic"
  | "outElastic"
  | "inOutElastic"
  | "inBounce"
  | "outBounce"
  | "inOutBounce";
export type EasingValue = EasingName | `cubic-bezier(${string})`;
export type TimingDefinition = KavioTiming;
export type AnchorKeyword =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";
export type AnchorValue = AnchorKeyword | Point;
export type CaptionHighlightMode = KavioCaptionHighlight["mode"];
export type CaptionSourceKind = KavioCaptionSource["kind"];
export type CaptionWordState = "pending" | "active" | "completed";
export type ResourceLimitName = keyof ResourceLimits;
export type ResourceLimitCode =
  | "LIMIT_MAX_FRAMES"
  | "LIMIT_MAX_WIDTH"
  | "LIMIT_MAX_HEIGHT"
  | "LIMIT_MAX_LAYERS"
  | "LIMIT_MAX_ASSETS"
  | "LIMIT_MAX_PROP_STRING_LENGTH"
  | "LIMIT_MAX_ASSET_BYTES"
  | "LIMIT_MAX_SOURCE_WIDTH"
  | "LIMIT_MAX_SOURCE_HEIGHT"
  | "LIMIT_MAX_BLUR_RADIUS"
  | "LIMIT_MAX_FILTERED_LAYERS"
  | "LIMIT_MAX_MASKED_LAYERS"
  | "LIMIT_MAX_MASK_SOURCE_WIDTH"
  | "LIMIT_MAX_MASK_SOURCE_HEIGHT"
  | "LIMIT_MAX_TEXT_MOTION_FRAGMENTS"
  | "LIMIT_MAX_PROCEDURAL_MASK_PIXELS"
  | "LIMIT_MAX_TRANSITION_DURATION";

export const MAX_COMPOSITION_FRAMES = 216_000;
export const MAX_CANVAS_WIDTH = 3_840;
export const MAX_CANVAS_HEIGHT = 2_160;
export const MAX_LAYERS = 512;
export const MAX_ASSETS = 64;
export const MAX_PROP_STRING_LENGTH = 4_096;
export const MAX_ASSET_BYTES = 500 * 1024 * 1024;
export const MAX_SOURCE_WIDTH = 3_840;
export const MAX_SOURCE_HEIGHT = 2_160;
export const MAX_BLUR_RADIUS = 48;
export const MAX_FILTERED_LAYERS = 16;
export const MAX_MASKED_LAYERS = 32;
export const MAX_MASK_SOURCE_WIDTH = 2_048;
export const MAX_MASK_SOURCE_HEIGHT = 2_048;
export const MAX_TEXT_MOTION_FRAGMENTS = 1_000;
export const MAX_PROCEDURAL_MASK_PIXELS = 2_073_600;
export const MAX_TRANSITION_DURATION_FRAMES = 180;

export const DEFAULT_RESOURCE_LIMITS = {
  maxFrames: MAX_COMPOSITION_FRAMES,
  maxWidth: MAX_CANVAS_WIDTH,
  maxHeight: MAX_CANVAS_HEIGHT,
  maxLayers: MAX_LAYERS,
  maxAssets: MAX_ASSETS,
  maxPropStringLength: MAX_PROP_STRING_LENGTH,
  maxAssetBytes: MAX_ASSET_BYTES,
  maxSourceWidth: MAX_SOURCE_WIDTH,
  maxSourceHeight: MAX_SOURCE_HEIGHT,
  maxBlurRadius: MAX_BLUR_RADIUS,
  maxFilteredLayers: MAX_FILTERED_LAYERS,
  maxMaskedLayers: MAX_MASKED_LAYERS,
  maxMaskSourceWidth: MAX_MASK_SOURCE_WIDTH,
  maxMaskSourceHeight: MAX_MASK_SOURCE_HEIGHT,
  maxTextMotionFragments: MAX_TEXT_MOTION_FRAGMENTS,
  maxProceduralMaskPixels: MAX_PROCEDURAL_MASK_PIXELS,
  maxTransitionDurationFrames: MAX_TRANSITION_DURATION_FRAMES
} as const satisfies ResourceLimits;

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface LayerPoint {
  x?: UnitValue;
  y?: UnitValue;
}

export interface LayerSize {
  width?: UnitValue;
  height?: UnitValue;
}

export interface NumericKeyframe {
  frame: number;
  value: number;
  easing?: EasingValue;
  timing?: TimingDefinition;
}

export type TransitionDirection = "up" | "down" | "left" | "right";

export interface RevealInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RevealShape {
  shape: "circle" | "diamond";
  progress: number;
}

export type RevealPatternKind = "clock" | "bars" | "grid" | "tiles" | "diagonal";

export interface RevealPattern {
  kind: RevealPatternKind;
  progress: number;
  direction: TransitionDirection;
  rows: number;
  columns: number;
  corner?: KavioTransitionCorner;
}

export interface TransitionWash {
  color: string;
  opacity: number;
}

export interface TransitionFilter {
  blur?: number;
  grayscale?: number;
}

export interface TransitionTransform {
  rotateX: number;
  rotateY: number;
  skewX: number;
  skewY: number;
  scaleX: number;
  scaleY: number;
}

export interface TimelineLayer {
  id: string;
  type: string;
  startFrame: number;
  durationFrames: number;
  position?: LayerPoint;
  anchor?: AnchorValue;
  size?: LayerSize;
  opacity?: number;
  rotation?: number;
  scale?: number;
  keyframes?: Partial<Record<AnimatableProperty, NumericKeyframe[]>>;
  mask?: KavioLayerMask | null;
  transitionIn?: KavioTransition | null;
  transitionOut?: KavioTransition | null;
}

export type TransitionSeriesTransition = KavioTransition & { durationFrames: number };

export interface TransitionOverlapWindow {
  trackId: string;
  previousClipId: string;
  previousLayerId: string;
  nextClipId: string;
  nextLayerId: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  transition: TransitionSeriesTransition;
}

export interface EvaluatedTransitionClipState {
  clipId: string;
  layerId: string;
  localFrame: number;
  layer: EvaluatedLayer;
}

export interface EvaluatedTransitionOverlap {
  trackId: string;
  previous: EvaluatedTransitionClipState;
  next: EvaluatedTransitionClipState;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  progress: number;
  easedProgress: number;
  transition: TransitionSeriesTransition;
}

export interface CaptionTimelineLayer extends TimelineLayer {
  type: "caption";
  source: KavioCaptionSource;
  style?: KavioCaptionLayer["style"];
  safeArea?: KavioCaptionLayer["safeArea"];
}

export interface ResolvedLayout {
  position: Point;
  anchor: Point;
  size: {
    width: number | null;
    height: number | null;
  };
  anchorOffset: {
    x: number | null;
    y: number | null;
  };
  topLeft: {
    x: number | null;
    y: number | null;
  };
}

export interface EvaluatedLayer extends ResolvedLayout {
  id: string;
  type: string;
  localFrame: number;
  visible: boolean;
  opacity: number;
  rotation: number;
  scale: number;
  reveal?: RevealInset;
  revealShape?: RevealShape;
  revealPattern?: RevealPattern;
  wash?: TransitionWash;
  filter?: TransitionFilter;
  transform?: TransitionTransform;
  mask?: KavioLayerMask;
  caption?: EvaluatedCaptionState;
}

export interface EvaluatedCaptionWord {
  index: number;
  text: string;
  startFrame: number;
  endFrame: number;
  state: CaptionWordState;
  active: boolean;
}

export interface EvaluatedCaptionState {
  sourceKind: CaptionSourceKind;
  localFrame: number;
  visible: boolean;
  cueIndex: number | null;
  cue: KavioCaptionCue | null;
  lineText: string;
  lines: string[];
  words: EvaluatedCaptionWord[];
  activeWord: EvaluatedCaptionWord | null;
  activeWordIndex: number | null;
  highlightMode: CaptionHighlightMode;
  highlightedWordIndex: number | null;
  highlightedLineText: string | null;
}

export interface EvaluateCaptionOptions {
  highlightMode?: CaptionHighlightMode | undefined;
}

export interface ResourceLimits {
  maxFrames: number;
  maxWidth: number;
  maxHeight: number;
  maxLayers: number;
  maxAssets: number;
  maxPropStringLength: number;
  maxAssetBytes: number;
  maxSourceWidth: number;
  maxSourceHeight: number;
  maxBlurRadius: number;
  maxFilteredLayers: number;
  maxMaskedLayers: number;
  maxMaskSourceWidth: number;
  maxMaskSourceHeight: number;
  maxTextMotionFragments: number;
  maxProceduralMaskPixels: number;
  maxTransitionDurationFrames: number;
}

export interface ResourceLimitInputs {
  frames?: number;
  width?: number;
  height?: number;
  layerCount?: number;
  assetCount?: number;
  propStringLength?: number;
  assetBytes?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  blurRadius?: number;
  filteredLayerCount?: number;
  maskedLayerCount?: number;
  maskSourceWidth?: number;
  maskSourceHeight?: number;
  textMotionFragments?: number;
  proceduralMaskPixels?: number;
  transitionDurationFrames?: number;
}

export interface ResourceLimitViolation extends KavioError {
  code: ResourceLimitCode;
  resource: ResourceLimitName;
  actual: number;
  limit: number;
}

export interface PropResolutionError extends KavioError {
  code: "PROP_UNRESOLVED";
  prop: string;
}

export interface PropResolutionResult<T> {
  ok: boolean;
  value: T;
  errors: PropResolutionError[];
}

export type ExportPresetInput = string | KavioExportPreset;

type PropValues = Record<string, unknown>;

const TEMPLATE_PATTERN = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;
const WHOLE_TEMPLATE_PATTERN = /^{{\s*([A-Za-z0-9_.-]+)\s*}}$/;
const PERCENT_PATTERN = /^\s*(-?(?:\d+|\d*\.\d+))%(w|h)?\s*$/;
const CUBIC_BEZIER_PATTERN =
  /^cubic-bezier\(\s*(-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?)\s*,\s*(-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?)\s*,\s*(-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?)\s*,\s*(-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?)\s*\)$/i;
const BACK_OVERSHOOT = 1.70158;
const ELASTIC_PERIOD = (2 * Math.PI) / 3;

export function resolveDocumentProps<T extends { props?: PropValues }>(
  document: T,
  values: PropValues = {}
): PropResolutionResult<T> {
  const declarations = isRecord(document.props) ? document.props : {};
  const propValues = mergePropValues(declarations, values);
  return resolveTemplateProps(document, propValues, { skipRootProps: true });
}

export function applyExportPreset(document: KavioDocument, presetInput: ExportPresetInput): KavioDocument {
  const preset = resolveExportPreset(document, presetInput);
  const layerOverrides = preset.layerOverrides ?? {};
  const exportDocument = cloneJsonValue(document);

  return {
    ...exportDocument,
    composition: {
      ...exportDocument.composition,
      width: preset.width,
      height: preset.height
    },
    layers: exportDocument.layers.map((layer) => applyLayerOverride(layer, layerOverrides[layer.id])),
    exports: [cloneJsonValue(preset)]
  };
}

export const createExportView = applyExportPreset;

export function resolveExportPreset(document: KavioDocument, presetInput: ExportPresetInput): KavioExportPreset {
  if (typeof presetInput !== "string") {
    return presetInput;
  }

  const preset = document.exports.find((candidate) => candidate.name === presetInput);
  if (!preset) {
    throw new Error(`Unknown export preset "${presetInput}".`);
  }

  return preset;
}

export function resolveTemplateProps<T>(
  value: T,
  values: PropValues,
  options: { skipRootProps?: boolean } = {}
): PropResolutionResult<T> {
  const errors: PropResolutionError[] = [];
  const resolved = resolveUnknown(value, values, errors, "", options.skipRootProps === true, true);

  return {
    ok: errors.length === 0,
    value: resolved as T,
    errors
  };
}

export function isLayerActive(layer: { startFrame: number; durationFrames: number }, frame: number): boolean {
  return frame >= layer.startFrame && frame < layer.startFrame + layer.durationFrames;
}

export function getLocalFrame(layer: { startFrame: number }, frame: number): number {
  return frame - layer.startFrame;
}

export function evaluateLayer(layer: TimelineLayer, frame: number, dimensions: CanvasDimensions): EvaluatedLayer {
  const localFrame = getLocalFrame(layer, frame);
  const visible = isLayerActive(layer, frame);
  const position = resolvePoint(layer.position, dimensions);
  const keyframes = layer.keyframes ?? {};
  const transition = evaluateLayerTransitions(layer, localFrame, dimensions);
  const x = evaluateKeyframes(keyframes.x, localFrame, position.x) + transition.offset.x;
  const y = evaluateKeyframes(keyframes.y, localFrame, position.y) + transition.offset.y;
  const size = resolveSize(layer.size, dimensions);
  const anchor = resolveAnchor(layer.anchor);
  const anchorOffset = {
    x: size.width === null ? null : size.width * anchor.x,
    y: size.height === null ? null : size.height * anchor.y
  };

  const evaluated: EvaluatedLayer = {
    id: layer.id,
    type: layer.type,
    localFrame,
    visible,
    position: { x, y },
    anchor,
    size,
    anchorOffset,
    topLeft: {
      x: anchorOffset.x === null ? null : x - anchorOffset.x,
      y: anchorOffset.y === null ? null : y - anchorOffset.y
    },
    opacity: clamp01(evaluateKeyframes(keyframes.opacity, localFrame, layer.opacity ?? 1) * transition.opacity),
    rotation: evaluateKeyframes(keyframes.rotation, localFrame, layer.rotation ?? 0) + transition.rotation,
    scale: evaluateKeyframes(keyframes.scale, localFrame, layer.scale ?? 1) * transition.scale
  };

  if (transition.reveal) {
    evaluated.reveal = transition.reveal;
  }
  if (transition.revealShape) {
    evaluated.revealShape = transition.revealShape;
  }
  if (transition.revealPattern) {
    evaluated.revealPattern = transition.revealPattern;
  }
  if (transition.wash && transition.wash.opacity > 0) {
    evaluated.wash = transition.wash;
  }
  if (transition.filter && ((transition.filter.blur ?? 0) > 0 || (transition.filter.grayscale ?? 0) > 0)) {
    evaluated.filter = transition.filter;
  }
  if (!isIdentityTransitionTransform(transition.transform)) {
    evaluated.transform = transition.transform;
  }
  if (layer.mask) {
    evaluated.mask = cloneJsonValue(layer.mask);
  }

  if (isCaptionTimelineLayer(layer)) {
    evaluated.caption = visible
      ? evaluateCaptionState(layer.source, localFrame, { highlightMode: layer.style?.highlight?.mode })
      : emptyCaptionState(layer.source.kind, localFrame, layer.style?.highlight?.mode ?? "none");
  }

  return evaluated;
}

export function evaluateActiveLayers(
  layers: readonly TimelineLayer[],
  frame: number,
  dimensions: CanvasDimensions
): EvaluatedLayer[] {
  return layers
    .filter((layer) => isLayerActive(layer, frame))
    .map((layer) => evaluateLayer(layer, frame, dimensions));
}

export function compileTransitionOverlapWindows(tracks: readonly KavioTrack[] | undefined): TransitionOverlapWindow[] {
  if (tracks === undefined) {
    return [];
  }

  const windows: TransitionOverlapWindow[] = [];

  for (const track of tracks) {
    for (let index = 1; index < track.clips.length; index += 1) {
      const nextClip = track.clips[index];
      const previousClip = track.clips[index - 1];
      if (!nextClip || !previousClip || nextClip.transitionFromPrevious === undefined) {
        continue;
      }

      const transition = normalizeTransitionSeriesDefinition(nextClip.transitionFromPrevious);
      const startFrame = nextClip.startFrame;
      const endFrame = startFrame + transition.durationFrames;
      const previousEndFrame = previousClip.startFrame + previousClip.durationFrames;
      const nextEndFrame = nextClip.startFrame + nextClip.durationFrames;
      if (endFrame > previousEndFrame || endFrame > nextEndFrame) {
        continue;
      }

      windows.push({
        trackId: track.id,
        previousClipId: previousClip.id,
        previousLayerId: previousClip.layerId,
        nextClipId: nextClip.id,
        nextLayerId: nextClip.layerId,
        startFrame,
        endFrame,
        durationFrames: transition.durationFrames,
        transition
      });
    }
  }

  return windows.sort((left, right) => left.startFrame - right.startFrame || left.endFrame - right.endFrame);
}

export function evaluateTransitionSeries(
  document: Pick<KavioDocument, "composition" | "layers" | "tracks">,
  frame: number,
  dimensions: CanvasDimensions = getCanvasDimensions(document.composition)
): EvaluatedTransitionOverlap[] {
  const windows = compileTransitionOverlapWindows(document.tracks);
  const activeWindows = windows.filter((window) => frame >= window.startFrame && frame < window.endFrame);
  if (activeWindows.length === 0) {
    return [];
  }

  const layersById = new Map(document.layers.map((layer) => [layer.id, layer]));
  const clipsByWindowKey = transitionSeriesClipIndex(document.tracks);
  const evaluated: EvaluatedTransitionOverlap[] = [];

  for (const window of activeWindows) {
    const key = transitionWindowKey(window.trackId, window.nextClipId);
    const clips = clipsByWindowKey.get(key);
    const previousLayer = layersById.get(window.previousLayerId);
    const nextLayer = layersById.get(window.nextLayerId);
    if (clips === undefined || previousLayer === undefined || nextLayer === undefined) {
      continue;
    }

    const previous = evaluateTransitionSeriesClip(previousLayer, clips.previous, frame, dimensions, window, "previous");
    const next = evaluateTransitionSeriesClip(nextLayer, clips.next, frame, dimensions, window, "next");
    const progress = window.durationFrames === 1 ? 1 : (frame - window.startFrame) / (window.durationFrames - 1);

    evaluated.push({
      trackId: window.trackId,
      previous,
      next,
      startFrame: window.startFrame,
      endFrame: window.endFrame,
      durationFrames: window.durationFrames,
      progress,
      easedProgress:
        window.transition.timing === undefined
          ? evaluateEasing(window.transition.easing ?? "linear", progress)
          : evaluateTiming(window.transition.timing, frame - window.startFrame, window.durationFrames),
      transition: window.transition
    });
  }

  return evaluated;
}

export function normalizeTransitionSeriesDefinition(definition: KavioTransitionSeriesDefinition): TransitionSeriesTransition {
  const transition: TransitionSeriesTransition = {
    type: definition.presentation.type,
    durationFrames: definition.timing.durationFrames,
    timing: definition.timing
  };

  if (definition.presentation.direction !== undefined) {
    transition.direction = definition.presentation.direction;
  }
  if (definition.presentation.axis !== undefined) {
    transition.axis = definition.presentation.axis;
  }
  if (definition.presentation.shape !== undefined) {
    transition.shape = definition.presentation.shape;
  }
  if (definition.presentation.corner !== undefined) {
    transition.corner = definition.presentation.corner;
  }
  if (definition.presentation.color !== undefined) {
    transition.color = definition.presentation.color;
  }
  if (definition.presentation.amount !== undefined) {
    transition.amount = definition.presentation.amount;
  }
  if (definition.presentation.intensity !== undefined) {
    transition.intensity = definition.presentation.intensity;
  }
  if (definition.presentation.rows !== undefined) {
    transition.rows = definition.presentation.rows;
  }
  if (definition.presentation.columns !== undefined) {
    transition.columns = definition.presentation.columns;
  }
  if (definition.timing.easing !== undefined) {
    transition.easing = definition.timing.easing;
  }

  return transition;
}

function transitionSeriesClipIndex(
  tracks: readonly KavioTrack[] | undefined
): Map<string, { previous: KavioTrackClip; next: KavioTrackClip }> {
  const index = new Map<string, { previous: KavioTrackClip; next: KavioTrackClip }>();
  if (tracks === undefined) {
    return index;
  }

  for (const track of tracks) {
    for (let clipIndex = 1; clipIndex < track.clips.length; clipIndex += 1) {
      const next = track.clips[clipIndex];
      const previous = track.clips[clipIndex - 1];
      if (previous !== undefined && next !== undefined && next.transitionFromPrevious !== undefined) {
        index.set(transitionWindowKey(track.id, next.id), { previous, next });
      }
    }
  }

  return index;
}

function transitionWindowKey(trackId: string, nextClipId: string): string {
  return `${trackId}\u0000${nextClipId}`;
}

function evaluateTransitionSeriesClip(
  layer: KavioLayer,
  clip: KavioTrackClip,
  frame: number,
  dimensions: CanvasDimensions,
  window: TransitionOverlapWindow,
  role: "previous" | "next"
): EvaluatedTransitionClipState {
  const timelineLayer = transitionSeriesTimelineLayer(layer, clip, window, role);
  const evaluated = evaluateLayer(timelineLayer, frame, dimensions);

  return {
    clipId: clip.id,
    layerId: clip.layerId,
    localFrame: frame - clip.startFrame,
    layer: evaluated
  };
}

function transitionSeriesTimelineLayer(
  layer: KavioLayer,
  clip: KavioTrackClip,
  window: TransitionOverlapWindow,
  role: "previous" | "next"
): TimelineLayer {
  const timelineLayer = {
    ...(layer as TimelineLayer),
    startFrame: clip.startFrame,
    durationFrames: role === "previous" ? window.endFrame - clip.startFrame : clip.durationFrames
  };

  if (role === "previous") {
    if (window.transition.type !== "cover") {
      timelineLayer.transitionOut = window.transition;
    }
  } else {
    if (window.transition.type !== "reveal") {
      timelineLayer.transitionIn = window.transition;
    }
  }

  return timelineLayer;
}

export function getCanvasDimensions(
  composition: CompositionTiming,
  exportDimensions?: Partial<CanvasDimensions>
): CanvasDimensions {
  return {
    width: exportDimensions?.width ?? composition.width,
    height: exportDimensions?.height ?? composition.height
  };
}

export function evaluateCaptionLayer(layer: CaptionTimelineLayer, frame: number): EvaluatedCaptionState {
  const localFrame = getLocalFrame(layer, frame);
  if (!isLayerActive(layer, frame)) {
    return emptyCaptionState(layer.source.kind, localFrame, layer.style?.highlight?.mode ?? "none");
  }

  return evaluateCaptionState(layer.source, localFrame, { highlightMode: layer.style?.highlight?.mode });
}

export function evaluateCaptionState(
  source: KavioCaptionSource,
  localFrame: number,
  options: EvaluateCaptionOptions = {}
): EvaluatedCaptionState {
  const highlightMode = options.highlightMode ?? "word";

  if (source.kind !== "inline") {
    return emptyCaptionState(source.kind, localFrame, highlightMode);
  }

  const cueIndex = source.cues.findIndex((cue) => isFrameInRange(localFrame, cue.startFrame, cue.endFrame));
  const cue = cueIndex === -1 ? null : source.cues[cueIndex] ?? null;
  if (!cue) {
    return emptyCaptionState(source.kind, localFrame, highlightMode);
  }

  const words = evaluateCaptionWords(cue.words ?? [], localFrame);
  const activeWord = words.find((word) => word.active) ?? null;
  const activeWordIndex = activeWord?.index ?? null;
  const lineText = cue.text;

  return {
    sourceKind: source.kind,
    localFrame,
    visible: true,
    cueIndex,
    cue,
    lineText,
    lines: splitCaptionLines(lineText),
    words,
    activeWord,
    activeWordIndex,
    highlightMode,
    highlightedWordIndex: highlightMode === "word" ? activeWordIndex : null,
    highlightedLineText: highlightMode === "line" ? lineText : null
  };
}

export function evaluateCaptionWords(
  words: readonly KavioCaptionWord[],
  localFrame: number
): EvaluatedCaptionWord[] {
  return words.map((word, index) => {
    const active = isFrameInRange(localFrame, word.startFrame, word.endFrame);
    const state: CaptionWordState = active ? "active" : localFrame < word.startFrame ? "pending" : "completed";

    return {
      index,
      text: word.text,
      startFrame: word.startFrame,
      endFrame: word.endFrame,
      state,
      active
    };
  });
}

export function collectResourceLimitViolations(
  inputs: ResourceLimitInputs,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
): ResourceLimitViolation[] {
  const violations: ResourceLimitViolation[] = [];
  addResourceViolation(violations, "maxFrames", inputs.frames, limits.maxFrames, "composition.durationFrames");
  addResourceViolation(violations, "maxWidth", inputs.width, limits.maxWidth, "composition.width");
  addResourceViolation(violations, "maxHeight", inputs.height, limits.maxHeight, "composition.height");
  addResourceViolation(violations, "maxLayers", inputs.layerCount, limits.maxLayers, "layers");
  addResourceViolation(violations, "maxAssets", inputs.assetCount, limits.maxAssets, "assets");
  addResourceViolation(
    violations,
    "maxPropStringLength",
    inputs.propStringLength,
    limits.maxPropStringLength,
    "props"
  );
  addResourceViolation(violations, "maxAssetBytes", inputs.assetBytes, limits.maxAssetBytes, "assets");
  addResourceViolation(violations, "maxSourceWidth", inputs.sourceWidth, limits.maxSourceWidth, "assets");
  addResourceViolation(violations, "maxSourceHeight", inputs.sourceHeight, limits.maxSourceHeight, "assets");
  addResourceViolation(violations, "maxBlurRadius", inputs.blurRadius, limits.maxBlurRadius, "layers");
  addResourceViolation(violations, "maxFilteredLayers", inputs.filteredLayerCount, limits.maxFilteredLayers, "layers");
  addResourceViolation(violations, "maxMaskedLayers", inputs.maskedLayerCount, limits.maxMaskedLayers, "layers");
  addResourceViolation(violations, "maxMaskSourceWidth", inputs.maskSourceWidth, limits.maxMaskSourceWidth, "layers");
  addResourceViolation(violations, "maxMaskSourceHeight", inputs.maskSourceHeight, limits.maxMaskSourceHeight, "layers");
  addResourceViolation(
    violations,
    "maxTextMotionFragments",
    inputs.textMotionFragments,
    limits.maxTextMotionFragments,
    "layers"
  );
  addResourceViolation(
    violations,
    "maxProceduralMaskPixels",
    inputs.proceduralMaskPixels,
    limits.maxProceduralMaskPixels,
    "layers"
  );
  addResourceViolation(
    violations,
    "maxTransitionDurationFrames",
    inputs.transitionDurationFrames,
    limits.maxTransitionDurationFrames,
    "layers"
  );
  return violations;
}

export function collectCompositionResourceLimitInputs(document: KavioDocument): ResourceLimitInputs {
  const inputs: ResourceLimitInputs = {
    frames: document.composition.durationFrames,
    width: document.composition.width,
    height: document.composition.height,
    layerCount: document.layers.length,
    assetCount: Object.keys(document.assets).length
  };

  let blurRadius = 0;
  let transitionDurationFrames = 0;
  let textMotionFragments = 0;
  let proceduralMaskPixels = 0;
  const filteredLayerEvents: Array<{ frame: number; delta: number }> = [];
  const maskedLayerEvents: Array<{ frame: number; delta: number }> = [];

  for (const layer of document.layers) {
    const layerHasFilter = hasFilterEffect(layer) || hasTransitionBlur(layer.transitionIn) || hasTransitionBlur(layer.transitionOut);
    if (layerHasFilter) {
      filteredLayerEvents.push(
        { frame: layer.startFrame, delta: 1 },
        { frame: layer.startFrame + layer.durationFrames, delta: -1 }
      );
    }

    blurRadius = Math.max(blurRadius, maxLayerBlurRadius(layer));
    if (layer.mask) {
      maskedLayerEvents.push(
        { frame: layer.startFrame, delta: 1 },
        { frame: layer.startFrame + layer.durationFrames, delta: -1 }
      );
      const maskResolution = layer.mask.source.kind === "shape" ? undefined : layer.mask.source.resolution;
      inputs.maskSourceWidth = Math.max(inputs.maskSourceWidth ?? 0, maskResolution?.width ?? 0);
      inputs.maskSourceHeight = Math.max(inputs.maskSourceHeight ?? 0, maskResolution?.height ?? 0);
      if (layer.mask.source.kind === "procedural" && maskResolution !== undefined) {
        proceduralMaskPixels = Math.max(proceduralMaskPixels, maskResolution.width * maskResolution.height);
      }
    }
    if (layer.type === "text" && layer.textMotion !== undefined) {
      textMotionFragments = Math.max(textMotionFragments, estimateTextMotionFragments(layer.text, layer.textMotion.split));
    }
    transitionDurationFrames = Math.max(
      transitionDurationFrames,
      transitionDuration(layer.transitionIn),
      transitionDuration(layer.transitionOut)
    );
  }

  for (const window of compileTransitionOverlapWindows(document.tracks)) {
    transitionDurationFrames = Math.max(transitionDurationFrames, window.durationFrames);
    blurRadius = Math.max(blurRadius, window.transition.type === "blurDissolve" ? transitionAmount(window.transition, 16) : 0);
  }

  inputs.blurRadius = blurRadius;
  inputs.filteredLayerCount = maxSimultaneousLayerCount(filteredLayerEvents);
  inputs.maskedLayerCount = maxSimultaneousLayerCount(maskedLayerEvents);
  inputs.textMotionFragments = textMotionFragments;
  inputs.proceduralMaskPixels = proceduralMaskPixels;
  inputs.transitionDurationFrames = transitionDurationFrames;
  return inputs;
}

export function resolveLayout(
  layer: Pick<TimelineLayer, "position" | "anchor" | "size">,
  dimensions: CanvasDimensions
): ResolvedLayout {
  const position = resolvePoint(layer.position, dimensions);
  const size = resolveSize(layer.size, dimensions);
  const anchor = resolveAnchor(layer.anchor);
  const anchorOffset = {
    x: size.width === null ? null : size.width * anchor.x,
    y: size.height === null ? null : size.height * anchor.y
  };

  return {
    position,
    anchor,
    size,
    anchorOffset,
    topLeft: {
      x: anchorOffset.x === null ? null : position.x - anchorOffset.x,
      y: anchorOffset.y === null ? null : position.y - anchorOffset.y
    }
  };
}

export function resolvePoint(point: LayerPoint | undefined, dimensions: CanvasDimensions): Point {
  return {
    x: resolveUnit(point?.x ?? 0, "x", dimensions),
    y: resolveUnit(point?.y ?? 0, "y", dimensions)
  };
}

export function resolveSize(size: LayerSize | undefined, dimensions: CanvasDimensions): ResolvedLayout["size"] {
  return {
    width: resolveOptionalSizeUnit(size?.width, "width", dimensions),
    height: resolveOptionalSizeUnit(size?.height, "height", dimensions)
  };
}

export function resolveAnchor(anchor: AnchorValue | undefined): Point {
  if (typeof anchor === "string") {
    return anchorKeywordToPoint(anchor);
  }

  if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
    return { x: anchor.x, y: anchor.y };
  }

  return { x: 0, y: 0 };
}

export function resolveUnit(value: UnitValue, axis: Axis, dimensions: CanvasDimensions): number {
  if (typeof value === "number") {
    return value;
  }

  const match = PERCENT_PATTERN.exec(value);
  if (!match) {
    return Number(value);
  }

  const amount = Number(match[1]);
  const explicitAxis = match[2];
  const basis =
    explicitAxis === "w"
      ? dimensions.width
      : explicitAxis === "h"
        ? dimensions.height
        : percentageBasis(axis, dimensions);

  return (amount / 100) * basis;
}

interface EvaluatedTransitionState {
  opacity: number;
  offset: Point;
  scale: number;
  rotation: number;
  reveal: RevealInset | null;
  revealShape: RevealShape | null;
  revealPattern: RevealPattern | null;
  wash: TransitionWash | null;
  filter: TransitionFilter | null;
  transform: TransitionTransform;
}

export function evaluateLayerTransitions(
  layer: Pick<TimelineLayer, "durationFrames" | "transitionIn" | "transitionOut">,
  localFrame: number,
  dimensions: CanvasDimensions
): EvaluatedTransitionState {
  const state: EvaluatedTransitionState = {
    opacity: 1,
    offset: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    reveal: null,
    revealShape: null,
    revealPattern: null,
    wash: null,
    filter: null,
    transform: identityTransitionTransform()
  };

  applyTransition(state, layer.transitionIn, "in", localFrame, layer.durationFrames, dimensions);
  applyTransition(state, layer.transitionOut, "out", localFrame, layer.durationFrames, dimensions);
  return state;
}

function applyTransition(
  state: EvaluatedTransitionState,
  transition: KavioTransition | null | undefined,
  phase: "in" | "out",
  localFrame: number,
  layerDurationFrames: number,
  dimensions: CanvasDimensions
): void {
  const requestedDurationFrames = transitionDuration(transition);
  if (!transition || layerDurationFrames <= 0 || requestedDurationFrames <= 0) {
    return;
  }

  const durationFrames = Math.min(requestedDurationFrames, layerDurationFrames);
  const startFrame = phase === "in" ? 0 : Math.max(0, layerDurationFrames - durationFrames);
  if (localFrame < startFrame || localFrame >= startFrame + durationFrames) {
    return;
  }

  const rawProgress = durationFrames === 1 ? 1 : (localFrame - startFrame) / (durationFrames - 1);
  const timingFrame = localFrame - startFrame;
  const progress =
    transition.timing === undefined
      ? evaluateEasing(transition.easing ?? defaultTransitionEasing(transition.type, phase), rawProgress)
      : evaluateTiming(transition.timing, timingFrame, durationFrames);
  const hiddenProgress = phase === "in" ? 1 - progress : progress;
  const visibleProgress = phase === "in" ? progress : 1 - progress;

  switch (transition.type) {
    case "fade":
    case "crossfade":
      state.opacity *= visibleProgress;
      break;
    case "slide": {
      const offset = transitionOffset(transition.direction ?? "up", phase, hiddenProgress, progress, dimensions, 0.08);
      state.offset.x += offset.x;
      state.offset.y += offset.y;
      break;
    }
    case "push": {
      const offset = transitionOffset(transition.direction ?? "left", phase, hiddenProgress, progress, dimensions, 1);
      state.offset.x += offset.x;
      state.offset.y += offset.y;
      break;
    }
    case "wipe":
      state.reveal = mergeRevealInset(state.reveal, transitionReveal(transition.direction ?? "up", phase, progress));
      break;
    case "zoom":
      state.scale *= 1 + transitionAmount(transition, 0.12) * hiddenProgress;
      break;
    case "spin":
    case "rotate":
      state.rotation += transitionRotation(transition, phase, hiddenProgress, progress, transition.type === "spin" ? 180 : 90);
      break;
    case "flip":
      applyFlipTransition(state, transition, phase, hiddenProgress, progress);
      break;
    case "blurDissolve":
      state.opacity *= visibleProgress;
      state.filter = mergeTransitionFilter(state.filter, { blur: transitionAmount(transition, 16) * hiddenProgress });
      break;
    case "colorDissolve":
      state.wash = mergeTransitionWash(state.wash, {
        color: transition.color ?? "#ffffff",
        opacity: clamp01(hiddenProgress * transitionAmount(transition, 1))
      });
      break;
    case "dip":
      state.wash = mergeTransitionWash(state.wash, {
        color: transition.color ?? "#000000",
        opacity: clamp01(hiddenProgress * transitionAmount(transition, 1))
      });
      break;
    case "iris":
      state.revealShape = {
        shape: transition.shape ?? "circle",
        progress: clamp01(visibleProgress)
      };
      break;
    case "stretch":
      applyStretchTransition(state, transition, hiddenProgress, 1);
      break;
    case "squeeze":
      applyStretchTransition(state, transition, hiddenProgress, -1);
      break;
    case "clockWipe":
      state.revealPattern = mergeRevealPattern(state.revealPattern, {
        kind: "clock",
        progress: clamp01(visibleProgress),
        direction: transition.direction ?? "right",
        rows: 1,
        columns: 1
      });
      break;
    case "barWipe":
      state.revealPattern = mergeRevealPattern(state.revealPattern, barWipePattern(transition, visibleProgress));
      break;
    case "gridWipe":
      state.revealPattern = mergeRevealPattern(state.revealPattern, gridRevealPattern(transition, "grid", visibleProgress));
      break;
    case "tileReveal":
      state.revealPattern = mergeRevealPattern(state.revealPattern, gridRevealPattern(transition, "tiles", visibleProgress));
      break;
    case "radialBlur":
      state.opacity *= visibleProgress;
      state.filter = mergeTransitionFilter(state.filter, { blur: transitionAmount(transition, 18) * hiddenProgress });
      state.scale *= 1 + transitionIntensity(transition, 0.04) * hiddenProgress;
      break;
    case "zoomBlur":
      state.opacity *= visibleProgress;
      state.filter = mergeTransitionFilter(state.filter, { blur: transitionAmount(transition, 18) * hiddenProgress });
      state.scale *= 1 + transitionIntensity(transition, 0.14) * hiddenProgress;
      break;
    case "bookFlip":
      applyFlipTransition(state, transition, phase, hiddenProgress, progress, 105);
      break;
    case "pageCurlLite":
      applyPageCurlLiteTransition(state, transition, phase, hiddenProgress, progress);
      break;
    case "skewSlide": {
      const offset = transitionOffset(transition.direction ?? "up", phase, hiddenProgress, progress, dimensions, 0.16);
      state.offset.x += offset.x;
      state.offset.y += offset.y;
      applyDirectionalSkew(state, transition.direction ?? "up", hiddenProgress, transitionIntensity(transition, 12));
      break;
    }
    case "expandMask":
      state.revealShape = {
        shape: transition.shape ?? "circle",
        progress: clamp01(visibleProgress)
      };
      break;
    case "letterboxReveal":
      state.reveal = mergeRevealInset(state.reveal, letterboxReveal(transition.axis ?? "y", visibleProgress));
      break;
    case "filmFlash":
      state.wash = mergeTransitionWash(state.wash, {
        color: transition.color ?? "#fff7dd",
        opacity: clamp01(hiddenProgress * transitionAmount(transition, 1))
      });
      break;
    case "cameraWhip": {
      const direction = transition.direction ?? "left";
      const offset = transitionOffset(direction, phase, hiddenProgress, progress, dimensions, 0.72);
      state.offset.x += offset.x;
      state.offset.y += offset.y;
      applyDirectionalSkew(state, direction, hiddenProgress, transitionIntensity(transition, 10));
      state.filter = mergeTransitionFilter(state.filter, { blur: transitionAmount(transition, 14) * hiddenProgress });
      break;
    }
    case "cover":
    case "reveal": {
      const offset = transitionOffset(transition.direction ?? "left", phase, hiddenProgress, progress, dimensions, 1);
      state.offset.x += offset.x;
      state.offset.y += offset.y;
      break;
    }
    case "diagonalWipe":
      state.revealPattern = mergeRevealPattern(state.revealPattern, {
        kind: "diagonal",
        progress: clamp01(visibleProgress),
        direction: "right",
        rows: 1,
        columns: 1,
        corner: phase === "in" ? transition.corner ?? "top-left" : oppositeCorner(transition.corner ?? "top-left")
      });
      break;
    case "grayscaleDissolve":
      state.opacity *= visibleProgress;
      state.filter = mergeTransitionFilter(state.filter, { grayscale: hiddenProgress });
      break;
  }
}

function transitionDuration(transition: KavioTransition | null | undefined): number {
  if (!transition) {
    return 0;
  }

  const timingDuration = transition.timing === undefined ? undefined : timingDurationFrames(transition.timing);
  return transition.durationFrames ?? timingDuration ?? 0;
}

function defaultTransitionEasing(type: KavioTransition["type"], phase: "in" | "out"): EasingValue {
  if (
    type === "slide" ||
    type === "push" ||
    type === "zoom" ||
    type === "flip" ||
    type === "stretch" ||
    type === "squeeze" ||
    type === "zoomBlur" ||
    type === "bookFlip" ||
    type === "pageCurlLite" ||
    type === "skewSlide" ||
    type === "cameraWhip" ||
    type === "cover" ||
    type === "reveal"
  ) {
    return phase === "in" ? "outCubic" : "inCubic";
  }

  if (type === "spin" || type === "rotate") {
    return phase === "in" ? "outBack" : "inBack";
  }

  return "linear";
}

function transitionOffset(
  direction: TransitionDirection,
  phase: "in" | "out",
  inRemainingProgress: number,
  outProgress: number,
  dimensions: CanvasDimensions,
  distanceScale: number
): Point {
  const vector = transitionVector(direction);
  const distance = transitionDistance(direction, dimensions) * distanceScale;
  const multiplier = phase === "in" ? -inRemainingProgress : outProgress;

  return {
    x: vector.x * distance * multiplier,
    y: vector.y * distance * multiplier
  };
}

function transitionReveal(direction: TransitionDirection, phase: "in" | "out", progress: number): RevealInset {
  const hidden = (phase === "in" ? 1 - progress : progress) * 100;
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };

  switch (direction) {
    case "up":
      inset[phase === "in" ? "bottom" : "top"] = hidden;
      break;
    case "down":
      inset[phase === "in" ? "top" : "bottom"] = hidden;
      break;
    case "left":
      inset[phase === "in" ? "right" : "left"] = hidden;
      break;
    case "right":
      inset[phase === "in" ? "left" : "right"] = hidden;
      break;
  }

  return inset;
}

function transitionVector(direction: TransitionDirection): Point {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

function transitionDistance(direction: TransitionDirection, dimensions: CanvasDimensions): number {
  return direction === "left" || direction === "right" ? dimensions.width : dimensions.height;
}

function mergeRevealInset(current: RevealInset | null, next: RevealInset): RevealInset {
  if (!current) {
    return next;
  }

  return {
    top: Math.max(current.top, next.top),
    right: Math.max(current.right, next.right),
    bottom: Math.max(current.bottom, next.bottom),
    left: Math.max(current.left, next.left)
  };
}

function mergeRevealPattern(current: RevealPattern | null, next: RevealPattern): RevealPattern {
  if (!current || next.progress <= current.progress) {
    return next;
  }

  return current;
}

function barWipePattern(transition: KavioTransition, visibleProgress: number): RevealPattern {
  const direction = transition.direction ?? (transition.axis === "y" ? "down" : "right");
  const horizontal = direction === "left" || direction === "right";

  return {
    kind: "bars",
    progress: clamp01(visibleProgress),
    direction,
    rows: horizontal ? 1 : transitionGridCount(transition.rows, 8),
    columns: horizontal ? transitionGridCount(transition.columns, 8) : 1
  };
}

function gridRevealPattern(transition: KavioTransition, kind: "grid" | "tiles", visibleProgress: number): RevealPattern {
  return {
    kind,
    progress: clamp01(visibleProgress),
    direction: transition.direction ?? "right",
    rows: transitionGridCount(transition.rows, 4),
    columns: transitionGridCount(transition.columns, 6)
  };
}

function transitionGridCount(value: number | undefined, fallback: number): number {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate)) {
    return fallback;
  }

  return Math.max(1, Math.min(32, Math.round(candidate)));
}

function transitionAmount(transition: KavioTransition, fallback: number): number {
  const value = transition.amount ?? transition.intensity ?? fallback;
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function transitionIntensity(transition: KavioTransition, fallback: number): number {
  const value = transition.intensity ?? fallback;
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function transitionRotation(
  transition: KavioTransition,
  phase: "in" | "out",
  hiddenProgress: number,
  outProgress: number,
  fallbackAmount: number
): number {
  const amount = transitionAmount(transition, fallbackAmount);
  const direction = transition.direction === "left" || transition.direction === "down" ? -1 : 1;
  return direction * (phase === "in" ? -amount * hiddenProgress : amount * outProgress);
}

function applyFlipTransition(
  state: EvaluatedTransitionState,
  transition: KavioTransition,
  phase: "in" | "out",
  hiddenProgress: number,
  outProgress: number,
  fallbackAmount = 90
): void {
  const amount = transitionAmount(transition, fallbackAmount);
  const axis = transition.axis ?? "y";
  const direction = transition.direction === "left" || transition.direction === "down" ? -1 : 1;
  const rotation = direction * (phase === "in" ? -amount * hiddenProgress : amount * outProgress);

  if (axis === "x") {
    state.transform.rotateX += rotation;
  } else {
    state.transform.rotateY += rotation;
  }
}

function applyPageCurlLiteTransition(
  state: EvaluatedTransitionState,
  transition: KavioTransition,
  phase: "in" | "out",
  hiddenProgress: number,
  outProgress: number
): void {
  const amount = transition.amount !== undefined && Number.isFinite(transition.amount) ? Math.max(0, transition.amount) : 70;
  const direction = transition.direction ?? "left";
  const sign = direction === "left" || direction === "down" ? -1 : 1;
  const rotation = sign * (phase === "in" ? -amount * hiddenProgress : amount * outProgress);
  const curl = transitionIntensity(transition, 10) * hiddenProgress * sign;

  if (transition.axis === "x" || direction === "up" || direction === "down") {
    state.transform.rotateX += rotation;
    state.transform.skewX += curl;
    state.transform.scaleY *= Math.max(0.01, 1 - hiddenProgress * 0.08);
  } else {
    state.transform.rotateY += rotation;
    state.transform.skewY += curl;
    state.transform.scaleX *= Math.max(0.01, 1 - hiddenProgress * 0.08);
  }
}

function applyDirectionalSkew(
  state: EvaluatedTransitionState,
  direction: TransitionDirection,
  hiddenProgress: number,
  amount: number
): void {
  const sign = direction === "left" || direction === "down" ? -1 : 1;
  if (direction === "left" || direction === "right") {
    state.transform.skewY += sign * amount * hiddenProgress;
  } else {
    state.transform.skewX += sign * amount * hiddenProgress;
  }
}

function applyStretchTransition(
  state: EvaluatedTransitionState,
  transition: KavioTransition,
  hiddenProgress: number,
  direction: 1 | -1
): void {
  const amount = transitionAmount(transition, 0.28) * hiddenProgress;
  const axis = transition.axis ?? "x";
  const primary = 1 + direction * amount;
  const secondary = 1 - direction * amount * 0.35;

  if (axis === "x") {
    state.transform.scaleX *= Math.max(0.01, primary);
    state.transform.scaleY *= Math.max(0.01, secondary);
  } else {
    state.transform.scaleY *= Math.max(0.01, primary);
    state.transform.scaleX *= Math.max(0.01, secondary);
  }
}

function letterboxReveal(axis: "x" | "y", visibleProgress: number): RevealInset {
  const hidden = (1 - clamp01(visibleProgress)) * 50;
  return axis === "x"
    ? { top: 0, right: hidden, bottom: 0, left: hidden }
    : { top: hidden, right: 0, bottom: hidden, left: 0 };
}

function mergeTransitionFilter(current: TransitionFilter | null, next: TransitionFilter): TransitionFilter {
  return {
    blur: Math.max(current?.blur ?? 0, next.blur ?? 0),
    grayscale: Math.max(current?.grayscale ?? 0, next.grayscale ?? 0)
  };
}

function oppositeCorner(corner: KavioTransitionCorner): KavioTransitionCorner {
  switch (corner) {
    case "top-left":
      return "bottom-right";
    case "top-right":
      return "bottom-left";
    case "bottom-left":
      return "top-right";
    case "bottom-right":
      return "top-left";
  }
}

function mergeTransitionWash(current: TransitionWash | null, next: TransitionWash): TransitionWash {
  if (!current || next.opacity >= current.opacity) {
    return next;
  }

  return current;
}

function identityTransitionTransform(): TransitionTransform {
  return {
    rotateX: 0,
    rotateY: 0,
    skewX: 0,
    skewY: 0,
    scaleX: 1,
    scaleY: 1
  };
}

function isIdentityTransitionTransform(value: TransitionTransform): boolean {
  return value.rotateX === 0 && value.rotateY === 0 && value.skewX === 0 && value.skewY === 0 && value.scaleX === 1 && value.scaleY === 1;
}

export function evaluateKeyframes(
  keyframes: readonly NumericKeyframe[] | undefined,
  localFrame: number,
  fallback: number
): number {
  if (!keyframes || keyframes.length === 0) {
    return fallback;
  }

  const first = keyframes[0];
  if (!first) {
    return fallback;
  }

  if (localFrame <= first.frame) {
    return first.value;
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (!current || !next || next.frame <= current.frame) {
      continue;
    }

    if (localFrame <= next.frame) {
      const progress = (localFrame - current.frame) / (next.frame - current.frame);
      const easedProgress =
        current.timing === undefined
          ? evaluateEasing(current.easing ?? "linear", progress)
          : evaluateTiming(current.timing, localFrame - current.frame, next.frame - current.frame + 1);
      return lerp(current.value, next.value, easedProgress);
    }
  }

  return keyframes[keyframes.length - 1]?.value ?? fallback;
}

export function evaluateEasing(easing: EasingValue, progress: number): number {
  const t = clamp01(progress);

  switch (easing) {
    case "linear":
      return t;
    case "inQuad":
      return t * t;
    case "outQuad":
      return 1 - (1 - t) * (1 - t);
    case "inOutQuad":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "inCubic":
      return t * t * t;
    case "outCubic":
      return 1 - Math.pow(1 - t, 3);
    case "inOutCubic":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "inCirc":
      return 1 - Math.sqrt(1 - Math.pow(t, 2));
    case "outCirc":
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case "inOutCirc":
      return t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    case "inExpo":
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case "outExpo":
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case "inOutExpo":
      if (t === 0 || t === 1) {
        return t;
      }
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    case "anticipate":
    case "back":
    case "inBack":
      return (BACK_OVERSHOOT + 1) * t * t * t - BACK_OVERSHOOT * t * t;
    case "outBack": {
      const shifted = t - 1;
      return 1 + (BACK_OVERSHOOT + 1) * shifted * shifted * shifted + BACK_OVERSHOOT * shifted * shifted;
    }
    case "inOutBack": {
      const overshoot = BACK_OVERSHOOT * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((overshoot + 1) * 2 * t - overshoot)) / 2
        : (Math.pow(2 * t - 2, 2) * ((overshoot + 1) * (t * 2 - 2) + overshoot) + 2) / 2;
    }
    case "inElastic":
      return t === 0 || t === 1 ? t : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ELASTIC_PERIOD);
    case "outElastic":
      return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_PERIOD) + 1;
    case "inOutElastic": {
      if (t === 0 || t === 1) {
        return t;
      }
      const period = (2 * Math.PI) / 4.5;
      return t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * period)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * period)) / 2 + 1;
    }
    case "inBounce":
      return 1 - outBounce(1 - t);
    case "outBounce":
      return outBounce(t);
    case "inOutBounce":
      return t < 0.5 ? (1 - outBounce(1 - 2 * t)) / 2 : (1 + outBounce(2 * t - 1)) / 2;
    default: {
      const bezier = parseCubicBezier(easing);
      if (!bezier) {
        throw new Error(`Unsupported easing: ${easing}`);
      }
      return evaluateCubicBezier(bezier, t);
    }
  }
}

export function evaluateTiming(timing: TimingDefinition, localFrame: number, fallbackDurationFrames?: number): number {
  const durationFrames = Math.max(1, fallbackDurationFrames ?? timingDurationFrames(timing) ?? 1);
  const progress = durationFrames === 1 ? 1 : localFrame / (durationFrames - 1);

  switch (timing.type) {
    case "tween":
      return evaluateEasing(timing.easing ?? "linear", progress);
    case "spring":
      return evaluateSpringTiming(timing, progress);
    case "steps":
      return evaluateStepsTiming(timing, progress);
    case "sequence":
      return evaluateSequenceTiming(timing, Math.max(0, localFrame));
    case "stagger":
      return evaluateStaggerTiming(timing, Math.max(0, localFrame));
  }
}

export function timingDurationFrames(timing: TimingDefinition): number | undefined {
  switch (timing.type) {
    case "tween":
    case "spring":
    case "steps":
      return timing.durationFrames;
    case "sequence":
      return timing.segments.reduce((total, segment) => total + segment.durationFrames, 0);
    case "stagger": {
      const childDuration = timingDurationFrames(timing.timing) ?? 1;
      const lastOffset = Math.max(0, timing.childCount - 1) * timing.eachFrames;
      return childDuration + lastOffset;
    }
  }
}

function evaluateStepsTiming(timing: Extract<TimingDefinition, { type: "steps" }>, progress: number): number {
  const t = clamp01(progress);
  const steps = Math.max(1, Math.trunc(timing.steps));
  if (t === 0 || t === 1) {
    return t;
  }

  return timing.direction === "start" ? Math.ceil(t * steps) / steps : Math.floor(t * steps) / steps;
}

function evaluateSequenceTiming(timing: Extract<TimingDefinition, { type: "sequence" }>, localFrame: number): number {
  if (timing.segments.length === 0) {
    return 1;
  }

  let cursor = 0;
  let previousTo = 0;

  for (let index = 0; index < timing.segments.length; index += 1) {
    const segment = timing.segments[index];
    if (!segment) {
      continue;
    }

    const durationFrames = Math.max(1, segment.durationFrames);
    const endFrame = cursor + durationFrames;
    const from = segment.from ?? previousTo;
    const to = segment.to ?? (index + 1) / timing.segments.length;

    if (localFrame < endFrame || index === timing.segments.length - 1) {
      const segmentFrame = Math.min(Math.max(0, localFrame - cursor), Math.max(0, durationFrames - 1));
      const progress =
        segment.timing === undefined ? evaluateEasing("linear", durationFrames === 1 ? 1 : segmentFrame / (durationFrames - 1)) : evaluateTiming(segment.timing, segmentFrame, durationFrames);
      return lerp(from, to, progress);
    }

    previousTo = to;
    cursor = endFrame;
  }

  return previousTo;
}

function evaluateStaggerTiming(timing: Extract<TimingDefinition, { type: "stagger" }>, localFrame: number): number {
  const childIndex = Math.min(Math.max(0, timing.childIndex ?? 0), Math.max(0, timing.childCount - 1));
  const order = staggerOrder(childIndex, timing.childCount, timing.from ?? "start");
  const childFrame = localFrame - order * timing.eachFrames;
  if (childFrame < 0) {
    return 0;
  }

  return evaluateTiming(timing.timing, childFrame, timingDurationFrames(timing.timing));
}

function staggerOrder(childIndex: number, childCount: number, from: NonNullable<Extract<TimingDefinition, { type: "stagger" }>["from"]>): number {
  switch (from) {
    case "end":
      return Math.max(0, childCount - 1 - childIndex);
    case "center":
      return Math.abs(childIndex - (childCount - 1) / 2);
    case "start":
      return childIndex;
  }
}

function evaluateSpringTiming(timing: Extract<TimingDefinition, { type: "spring" }>, progress: number): number {
  const t = clamp01(progress);
  const snapWindow = clamp(timing.restSpeed ?? 0.01, 0, 1) * 0.1;
  if (t === 0 || t === 1 || t >= 1 - snapWindow) {
    return t === 0 ? 0 : 1;
  }

  const stiffness = positiveFinite(timing.stiffness, 100);
  const damping = positiveFinite(timing.damping, 12) * (1 - clamp01(timing.bounce ?? 0) * 0.5);
  const mass = positiveFinite(timing.mass, 1);
  const curve = springCurveAt(t, stiffness, damping, mass);
  const end = springCurveAt(1, stiffness, damping, mass);
  if (!Number.isFinite(curve) || !Number.isFinite(end) || Math.abs(end) < 1e-6) {
    return t;
  }

  return curve / end;
}

function springCurveAt(t: number, stiffness: number, damping: number, mass: number): number {
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega0 * t) * (Math.cos(omegaD * t) + (zeta * omega0 * Math.sin(omegaD * t)) / omegaD);
  }

  if (zeta === 1) {
    return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t);
  }

  const sqrtTerm = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta - sqrtTerm);
  const r2 = -omega0 * (zeta + sqrtTerm);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

function outBounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  }
  if (t < 2 / 2.75) {
    const shifted = t - 1.5 / 2.75;
    return 7.5625 * shifted * shifted + 0.75;
  }
  if (t < 2.5 / 2.75) {
    const shifted = t - 2.25 / 2.75;
    return 7.5625 * shifted * shifted + 0.9375;
  }
  const shifted = t - 2.625 / 2.75;
  return 7.5625 * shifted * shifted + 0.984375;
}

export function parseCubicBezier(easing: string): [number, number, number, number] | undefined {
  const match = CUBIC_BEZIER_PATTERN.exec(easing);
  if (!match) {
    return undefined;
  }

  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    return undefined;
  }

  return [x1, y1, x2, y2];
}

function emptyCaptionState(
  sourceKind: CaptionSourceKind,
  localFrame: number,
  highlightMode: CaptionHighlightMode
): EvaluatedCaptionState {
  return {
    sourceKind,
    localFrame,
    visible: false,
    cueIndex: null,
    cue: null,
    lineText: "",
    lines: [],
    words: [],
    activeWord: null,
    activeWordIndex: null,
    highlightMode,
    highlightedWordIndex: null,
    highlightedLineText: null
  };
}

function splitCaptionLines(text: string): string[] {
  return text.length === 0 ? [] : text.split(/\r\n?|\n/);
}

function isFrameInRange(frame: number, startFrame: number, endFrame: number): boolean {
  return frame >= startFrame && frame < endFrame;
}

function isCaptionTimelineLayer(layer: TimelineLayer): layer is CaptionTimelineLayer {
  if (layer.type !== "caption") {
    return false;
  }

  const candidate = layer as TimelineLayer & { source?: unknown };
  return isCaptionSource(candidate.source);
}

function isCaptionSource(value: unknown): value is KavioCaptionSource {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  if (value.kind === "inline") {
    return Array.isArray(value.cues);
  }

  return (
    (value.kind === "vtt" || value.kind === "srt" || value.kind === "asset") &&
    typeof value.asset === "string"
  );
}

function addResourceViolation(
  violations: ResourceLimitViolation[],
  resource: ResourceLimitName,
  actual: number | undefined,
  limit: number,
  path: string
): void {
  if (actual === undefined || !Number.isFinite(actual) || actual <= limit) {
    return;
  }

  violations.push({
    code: resourceLimitCode(resource),
    severity: "error",
    message: resourceLimitMessage(resource, actual, limit),
    path,
    stage: "validation",
    retryable: false,
    resource,
    actual,
    limit
  });
}

function resourceLimitCode(resource: ResourceLimitName): ResourceLimitCode {
  switch (resource) {
    case "maxFrames":
      return "LIMIT_MAX_FRAMES";
    case "maxWidth":
      return "LIMIT_MAX_WIDTH";
    case "maxHeight":
      return "LIMIT_MAX_HEIGHT";
    case "maxLayers":
      return "LIMIT_MAX_LAYERS";
    case "maxAssets":
      return "LIMIT_MAX_ASSETS";
    case "maxPropStringLength":
      return "LIMIT_MAX_PROP_STRING_LENGTH";
    case "maxAssetBytes":
      return "LIMIT_MAX_ASSET_BYTES";
    case "maxSourceWidth":
      return "LIMIT_MAX_SOURCE_WIDTH";
    case "maxSourceHeight":
      return "LIMIT_MAX_SOURCE_HEIGHT";
    case "maxBlurRadius":
      return "LIMIT_MAX_BLUR_RADIUS";
    case "maxFilteredLayers":
      return "LIMIT_MAX_FILTERED_LAYERS";
    case "maxMaskedLayers":
      return "LIMIT_MAX_MASKED_LAYERS";
    case "maxMaskSourceWidth":
      return "LIMIT_MAX_MASK_SOURCE_WIDTH";
    case "maxMaskSourceHeight":
      return "LIMIT_MAX_MASK_SOURCE_HEIGHT";
    case "maxTextMotionFragments":
      return "LIMIT_MAX_TEXT_MOTION_FRAGMENTS";
    case "maxProceduralMaskPixels":
      return "LIMIT_MAX_PROCEDURAL_MASK_PIXELS";
    case "maxTransitionDurationFrames":
      return "LIMIT_MAX_TRANSITION_DURATION";
  }
}

function resourceLimitMessage(resource: ResourceLimitName, actual: number, limit: number): string {
  switch (resource) {
    case "maxFrames":
      return `composition duration ${actual} exceeds max frames limit ${limit}.`;
    case "maxWidth":
      return `composition width ${actual} exceeds max width limit ${limit}.`;
    case "maxHeight":
      return `composition height ${actual} exceeds max height limit ${limit}.`;
    case "maxLayers":
      return `layer count ${actual} exceeds max layers limit ${limit}.`;
    case "maxAssets":
      return `asset count ${actual} exceeds max assets limit ${limit}.`;
    case "maxPropStringLength":
      return `prop string length ${actual} exceeds max prop string length limit ${limit}.`;
    case "maxAssetBytes":
      return `asset size ${actual} bytes exceeds max asset size limit ${limit}.`;
    case "maxSourceWidth":
      return `source width ${actual} exceeds max source width limit ${limit}.`;
    case "maxSourceHeight":
      return `source height ${actual} exceeds max source height limit ${limit}.`;
    case "maxBlurRadius":
      return `motion blur radius ${actual} exceeds max blur radius limit ${limit}.`;
    case "maxFilteredLayers":
      return `simultaneous filtered layer count ${actual} exceeds max filtered layers limit ${limit}.`;
    case "maxMaskedLayers":
      return `simultaneous masked layer count ${actual} exceeds max masked layers limit ${limit}.`;
    case "maxMaskSourceWidth":
      return `mask source width ${actual} exceeds max mask source width limit ${limit}.`;
    case "maxMaskSourceHeight":
      return `mask source height ${actual} exceeds max mask source height limit ${limit}.`;
    case "maxTextMotionFragments":
      return `text motion fragment count ${actual} exceeds max text motion fragments limit ${limit}.`;
    case "maxProceduralMaskPixels":
      return `procedural mask pixel count ${actual} exceeds max procedural mask pixels limit ${limit}.`;
    case "maxTransitionDurationFrames":
      return `transition duration ${actual} exceeds max transition duration limit ${limit}.`;
  }
}

function maxLayerBlurRadius(layer: KavioLayer): number {
  let radius = 0;
  for (const effect of layer.effects ?? []) {
    if (effect.type === "blur") {
      radius = Math.max(radius, effect.radius);
    }
  }

  if (hasTransitionBlur(layer.transitionIn)) {
    radius = Math.max(radius, transitionAmount(layer.transitionIn, 16));
  }
  if (hasTransitionBlur(layer.transitionOut)) {
    radius = Math.max(radius, transitionAmount(layer.transitionOut, 16));
  }

  return radius;
}

function hasFilterEffect(layer: KavioLayer): boolean {
  return (layer.effects ?? []).some((effect) => effect.type === "blur");
}

function hasTransitionBlur(transition: KavioTransition | null | undefined): transition is KavioTransition {
  return transition?.type === "blurDissolve" || transition?.type === "radialBlur" || transition?.type === "zoomBlur" || transition?.type === "cameraWhip";
}

function estimateTextMotionFragments(text: string, split: "none" | "word" | "char" | "line" | undefined): number {
  switch (split ?? "none") {
    case "char":
      return Array.from(text).length;
    case "word": {
      const words = text.trim().split(/\s+/).filter(Boolean);
      return Math.max(1, words.length);
    }
    case "line":
      return Math.max(1, text.split(/\r\n|\r|\n/).length);
    case "none":
      return 1;
  }
}

function maxSimultaneousLayerCount(events: Array<{ frame: number; delta: number }>): number {
  let current = 0;
  let maximum = 0;
  const sorted = [...events].sort((a, b) => a.frame - b.frame || a.delta - b.delta);
  for (const event of sorted) {
    current += event.delta;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function applyLayerOverride(layer: KavioLayer, override: KavioLayerOverride | undefined): KavioLayer {
  if (override === undefined) {
    return cloneJsonValue(layer);
  }

  const merged = mergeOverrideObjects(
    cloneJsonValue(layer) as unknown as Record<string, unknown>,
    override as Record<string, unknown>
  );
  merged.id = layer.id;
  merged.type = layer.type;
  return merged as unknown as KavioLayer;
}

function mergeOverrideObjects(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (key === "id" || key === "type") {
      continue;
    }

    const baseValue = merged[key];
    merged[key] =
      isRecord(baseValue) && isRecord(value)
        ? mergeOverrideObjects(baseValue, value)
        : cloneJsonValue(value);
  }

  return merged;
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T;
  }

  if (isRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneJsonValue(nestedValue);
    }
    return clone as T;
  }

  return value;
}

function mergePropValues(declarations: PropValues, overrides: PropValues): PropValues {
  const values: PropValues = {};

  for (const [name, declaration] of Object.entries(declarations)) {
    if (isRecord(declaration) && "default" in declaration) {
      values[name] = declaration.default;
    } else if (!isRecord(declaration)) {
      values[name] = declaration;
    }
  }

  return { ...values, ...overrides };
}

function resolveUnknown(
  value: unknown,
  values: PropValues,
  errors: PropResolutionError[],
  path: string,
  skipRootProps: boolean,
  isRoot: boolean
): unknown {
  if (typeof value === "string") {
    return resolveString(value, values, errors, path);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      resolveUnknown(item, values, errors, `${path}[${index}]`, skipRootProps, false)
    );
  }

  if (isRecord(value)) {
    const resolved: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (isRoot && skipRootProps && key === "props") {
        resolved[key] = nestedValue;
        continue;
      }

      resolved[key] = resolveUnknown(
        nestedValue,
        values,
        errors,
        appendPath(path, key),
        skipRootProps,
        false
      );
    }
    return resolved;
  }

  return value;
}

function resolveString(value: string, values: PropValues, errors: PropResolutionError[], path: string): unknown {
  const wholeMatch = WHOLE_TEMPLATE_PATTERN.exec(value);
  if (wholeMatch?.[1]) {
    return resolvePropValue(wholeMatch[1], value, values, errors, path);
  }

  return value.replace(TEMPLATE_PATTERN, (token: string, propName: string) => {
    const propValue = resolvePropValue(propName, token, values, errors, path);
    return stringifyPropValue(propValue);
  });
}

function resolvePropValue(
  propName: string,
  fallback: string,
  values: PropValues,
  errors: PropResolutionError[],
  path: string
): unknown {
  if (Object.hasOwn(values, propName)) {
    return values[propName];
  }

  errors.push({
    code: "PROP_UNRESOLVED",
    severity: "error",
    message: `Missing value for template prop "${propName}".`,
    path,
    stage: "validation",
    hint: "Provide a prop value or a default in the document props declaration.",
    retryable: false,
    prop: propName
  });
  return fallback;
}

function stringifyPropValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return JSON.stringify(value);
}

function appendPath(path: string, key: string): string {
  return path.length === 0 ? key : `${path}.${key}`;
}

function resolveOptionalSizeUnit(
  value: UnitValue | undefined,
  axis: "width" | "height",
  dimensions: CanvasDimensions
): number | null {
  if (value === undefined || value === 0) {
    return null;
  }

  return resolveUnit(value, axis, dimensions);
}

function anchorKeywordToPoint(anchor: AnchorKeyword): Point {
  switch (anchor) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top":
      return { x: 0.5, y: 0 };
    case "top-right":
      return { x: 1, y: 0 };
    case "left":
      return { x: 0, y: 0.5 };
    case "center":
      return { x: 0.5, y: 0.5 };
    case "right":
      return { x: 1, y: 0.5 };
    case "bottom-left":
      return { x: 0, y: 1 };
    case "bottom":
      return { x: 0.5, y: 1 };
    case "bottom-right":
      return { x: 1, y: 1 };
  }
}

function percentageBasis(axis: Axis, dimensions: CanvasDimensions): number {
  return axis === "x" || axis === "width" ? dimensions.width : dimensions.height;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positiveFinite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function evaluateCubicBezier([x1, y1, x2, y2]: [number, number, number, number], progress: number): number {
  let lower = 0;
  let upper = 1;
  let parameter = progress;

  for (let index = 0; index < 24; index += 1) {
    const x = cubicBezierCoordinate(parameter, x1, x2);
    if (Math.abs(x - progress) < 1e-7) {
      break;
    }

    if (x < progress) {
      lower = parameter;
    } else {
      upper = parameter;
    }
    parameter = (lower + upper) / 2;
  }

  return cubicBezierCoordinate(parameter, y1, y2);
}

function cubicBezierCoordinate(parameter: number, point1: number, point2: number): number {
  const inverse = 1 - parameter;
  return (
    3 * inverse * inverse * parameter * point1 +
    3 * inverse * parameter * parameter * point2 +
    parameter * parameter * parameter
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
