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
  KavioLayerOverride
} from "@kavio/schema";

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
  | "inBack"
  | "outBack"
  | "inOutBack";
export type EasingValue = EasingName | `cubic-bezier(${string})`;
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
  | "LIMIT_MAX_SOURCE_HEIGHT";

export const MAX_COMPOSITION_FRAMES = 216_000;
export const MAX_CANVAS_WIDTH = 3_840;
export const MAX_CANVAS_HEIGHT = 2_160;
export const MAX_LAYERS = 512;
export const MAX_ASSETS = 64;
export const MAX_PROP_STRING_LENGTH = 4_096;
export const MAX_ASSET_BYTES = 500 * 1024 * 1024;
export const MAX_SOURCE_WIDTH = 3_840;
export const MAX_SOURCE_HEIGHT = 2_160;

export const DEFAULT_RESOURCE_LIMITS = {
  maxFrames: MAX_COMPOSITION_FRAMES,
  maxWidth: MAX_CANVAS_WIDTH,
  maxHeight: MAX_CANVAS_HEIGHT,
  maxLayers: MAX_LAYERS,
  maxAssets: MAX_ASSETS,
  maxPropStringLength: MAX_PROP_STRING_LENGTH,
  maxAssetBytes: MAX_ASSET_BYTES,
  maxSourceWidth: MAX_SOURCE_WIDTH,
  maxSourceHeight: MAX_SOURCE_HEIGHT
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
  const x = evaluateKeyframes(keyframes.x, localFrame, position.x);
  const y = evaluateKeyframes(keyframes.y, localFrame, position.y);
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
    opacity: evaluateKeyframes(keyframes.opacity, localFrame, layer.opacity ?? 1),
    rotation: evaluateKeyframes(keyframes.rotation, localFrame, layer.rotation ?? 0),
    scale: evaluateKeyframes(keyframes.scale, localFrame, layer.scale ?? 1)
  };

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
  return violations;
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
      const easedProgress = evaluateEasing(current.easing ?? "linear", progress);
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
    default: {
      const bezier = parseCubicBezier(easing);
      if (!bezier) {
        throw new Error(`Unsupported easing: ${easing}`);
      }
      return evaluateCubicBezier(bezier, t);
    }
  }
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
  }
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
