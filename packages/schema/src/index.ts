export const schemaVersion = "0.1" as const;

export type KavioSchemaVersion = typeof schemaVersion;
export type KavioJsonPrimitive = string | number | boolean | null;
export type KavioJsonValue = KavioJsonPrimitive | KavioJsonValue[] | { [key: string]: KavioJsonValue };

export type KavioErrorStage = "validation" | "ingest" | "render" | "ffmpeg" | "io";
export type KavioErrorSeverity = "error" | "warning";

export interface KavioError {
  code: string;
  severity: KavioErrorSeverity;
  message: string;
  path: string;
  stage: KavioErrorStage;
  hint?: string;
  retryable: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: KavioError[];
}

export interface KavioMetadata {
  title?: string;
  author?: string;
  tags?: string[];
  createdAt?: string;
  [key: string]: KavioJsonValue | undefined;
}

export interface CompositionTiming {
  width: number;
  height: number;
  fps: 24 | 25 | 30 | 50 | 60 | number;
  durationFrames: number;
  background?: KavioColor | "transparent";
  colorSpace?: KavioColorSpace;
}

export type KavioColorSpace = "srgb" | "display-p3";
export type KavioColor = string;
export type KavioFrame = number;
export type KavioDimension = number | KavioRelativeUnit;
export type KavioRelativeUnit = `${number}%` | `${number}%w` | `${number}%h`;

export interface KavioPosition {
  x?: KavioDimension;
  y?: KavioDimension;
}

export interface KavioSize {
  width?: KavioDimension;
  height?: KavioDimension;
}

export type KavioAnchorName =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface KavioAnchorPoint {
  x: number;
  y: number;
}

export type KavioAnchor = KavioAnchorName | KavioAnchorPoint;

export type KavioPropType = "string" | "number" | "boolean" | "color" | "url" | "enum" | "asset";

export interface KavioPropDefinition {
  type: KavioPropType;
  required?: boolean;
  default?: KavioJsonValue;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: KavioJsonPrimitive[];
  description?: string;
}

export type KavioPropsDefinition = Record<string, KavioPropDefinition>;

export type KavioAssetType = "video" | "image" | "audio" | "font";

export interface KavioAssetBase {
  type: KavioAssetType;
  src: string;
  checksum?: string;
}

export interface KavioTimedAssetBase extends KavioAssetBase {
  trimStartFrames?: KavioFrame;
  trimEndFrames?: KavioFrame | null;
  loop?: boolean;
}

export interface KavioVideoAsset extends KavioTimedAssetBase {
  type: "video";
}

export interface KavioImageAsset extends KavioAssetBase {
  type: "image";
}

export interface KavioAudioAsset extends KavioTimedAssetBase {
  type: "audio";
}

export interface KavioFontAsset extends KavioAssetBase {
  type: "font";
  family: string;
  weight?: number | string;
  style?: "normal" | "italic" | "oblique" | string;
}

export type KavioAssetDefinition = KavioVideoAsset | KavioImageAsset | KavioAudioAsset | KavioFontAsset;
export type KavioAssets = Record<string, KavioAssetDefinition>;

export type KavioLayerType = "video" | "image" | "text" | "shape" | "caption";
export type KavioFit = "cover" | "contain" | "fill" | "none";
export type KavioTextAlign = "left" | "center" | "right";
export type KavioEasingName =
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
export type KavioEasing = KavioEasingName | `cubic-bezier(${number},${number},${number},${number})`;
export type KavioAnimatableProperty = "opacity" | "x" | "y" | "scale" | "rotation";
export type KavioAnimationPreset =
  | "fadeIn"
  | "fadeOut"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "popIn"
  | "zoomIn";

export interface KavioKeyframe {
  frame: KavioFrame;
  value: number;
  easing?: KavioEasing;
}

export type KavioKeyframes = Partial<Record<KavioAnimatableProperty, KavioKeyframe[]>>;

export type KavioEffect =
  | { type: "blur"; radius: number }
  | { type: "brightness"; value: number }
  | { type: "contrast"; value: number }
  | { type: "saturate"; value: number }
  | { type: "tint"; color: KavioColor };

export type KavioTransitionType = "fade" | "slide" | "wipe" | "crossfade";
export type KavioTransitionDirection = "up" | "down" | "left" | "right";

export interface KavioTransition {
  type: KavioTransitionType;
  durationFrames: KavioFrame;
  direction?: KavioTransitionDirection;
  easing?: KavioEasing;
}

export interface KavioSubjectCropKeyframe {
  frame: KavioFrame;
  x: number;
  y: number;
  easing?: KavioEasing;
}

export type KavioVideoCrop =
  | { mode: "center" }
  | {
      mode: "subject";
      x?: number;
      y?: number;
      keyframes?: KavioSubjectCropKeyframe[];
      smoothingFrames?: KavioFrame;
      source?: string;
    };

export interface KavioLayerBase {
  id: string;
  type: KavioLayerType;
  startFrame: KavioFrame;
  durationFrames: KavioFrame;
  position?: KavioPosition;
  anchor?: KavioAnchor;
  size?: KavioSize;
  opacity?: number;
  rotation?: number;
  scale?: number;
  z?: number | null;
  track?: string;
  keyframes?: KavioKeyframes;
  effects?: KavioEffect[];
  transitionIn?: KavioTransition | null;
  transitionOut?: KavioTransition | null;
}

export interface KavioVideoLayer extends KavioLayerBase {
  type: "video";
  asset: string;
  fit?: KavioFit;
  crop?: KavioVideoCrop;
  muted?: boolean;
  volume?: number;
  playbackRate?: number;
}

export interface KavioImageLayer extends KavioLayerBase {
  type: "image";
  asset: string;
  fit?: KavioFit;
}

export interface KavioTextStroke {
  color: KavioColor;
  width: number;
}

export interface KavioTextShadow {
  color: KavioColor;
  x: number;
  y: number;
  blur: number;
}

export interface KavioTextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic" | "oblique" | string;
  color?: KavioColor;
  align?: KavioTextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  maxLines?: number;
  wrap?: boolean;
  background?: KavioColor | null;
  padding?: number;
  stroke?: KavioTextStroke | null;
  shadow?: KavioTextShadow | null;
}

export interface KavioTextLayer extends KavioLayerBase {
  type: "text";
  text: string;
  style?: KavioTextStyle;
}

export interface KavioShapeStroke {
  color: KavioColor;
  width: number;
}

export interface KavioShapeLayer extends KavioLayerBase {
  type: "shape";
  shape: "rect";
  fill?: KavioColor;
  stroke?: KavioShapeStroke | null;
  radius?: number;
}

export interface KavioCaptionWord {
  startFrame: KavioFrame;
  endFrame: KavioFrame;
  text: string;
}

export interface KavioCaptionCue {
  startFrame: KavioFrame;
  endFrame: KavioFrame;
  text: string;
  words?: KavioCaptionWord[];
}

export type KavioCaptionSource =
  | { kind: "inline"; cues: KavioCaptionCue[] }
  | { kind: "vtt"; asset: string }
  | { kind: "srt"; asset: string }
  | { kind: "asset"; asset: string };

export interface KavioCaptionHighlight {
  mode: "none" | "word" | "line";
  color?: KavioColor;
  scale?: number;
}

export interface KavioCaptionStyle extends KavioTextStyle {
  maxCharsPerLine?: number;
  highlight?: KavioCaptionHighlight;
}

export type KavioCaptionSafeArea = "bottom" | "center" | "top" | KavioPosition;

export interface KavioCaptionLayer extends KavioLayerBase {
  type: "caption";
  source: KavioCaptionSource;
  style?: KavioCaptionStyle;
  safeArea?: KavioCaptionSafeArea;
}

export type KavioLayer =
  | KavioVideoLayer
  | KavioImageLayer
  | KavioTextLayer
  | KavioShapeLayer
  | KavioCaptionLayer;

export type KavioAudioRole = "music" | "voiceover" | "sfx" | "source";

export interface KavioAudioDuck {
  against: KavioAudioRole;
  amountDb: number;
  attackFrames?: KavioFrame;
  releaseFrames?: KavioFrame;
}

export interface KavioAudioTrack {
  id: string;
  asset: string;
  role: KavioAudioRole;
  startFrame: KavioFrame;
  durationFrames?: KavioFrame;
  offsetFrames?: KavioFrame;
  volume?: number;
  fadeInFrames?: KavioFrame;
  fadeOutFrames?: KavioFrame;
  loop?: boolean;
  duck?: KavioAudioDuck;
}

export type KavioExportFormat = "mp4" | "webm" | "mov" | "gif" | "png-sequence";
export type KavioExportCodec = "h264" | "hevc" | "vp9" | "prores";
export type KavioAudioCodec = "aac" | "opus" | "mp3" | "pcm";

export function extensionForFormat(format: KavioExportFormat): string {
  return format === "png-sequence" ? "zip" : format;
}

export type KavioLayerOverride = Partial<
  Omit<KavioLayer, "id" | "type" | "startFrame" | "durationFrames">
> & {
  startFrame?: KavioFrame;
  durationFrames?: KavioFrame;
};

export interface KavioExportPreset {
  name: string;
  format: KavioExportFormat;
  codec?: KavioExportCodec;
  width: number;
  height: number;
  fps?: number;
  bitrate?: string;
  crf?: number;
  audioCodec?: KavioAudioCodec;
  audioBitrate?: string;
  loudnessLufs?: number;
  background?: KavioColor | "transparent" | null;
  layerOverrides?: Record<string, KavioLayerOverride>;
}

export interface KavioDocument {
  version: KavioSchemaVersion;
  metadata?: KavioMetadata;
  composition: CompositionTiming;
  props?: KavioPropsDefinition;
  assets: KavioAssets;
  layers: KavioLayer[];
  audio?: KavioAudioTrack[];
  exports: KavioExportPreset[];
}

export const supportedMigrationVersions = [schemaVersion] as const;

export type KavioMigrationVersion = (typeof supportedMigrationVersions)[number];

export interface MigrateCompositionOptions {
  fromVersion?: KavioMigrationVersion;
  toVersion?: KavioMigrationVersion;
}

export type KavioMigration = (document: KavioDocument) => KavioDocument;

export function migrateComposition01To01(document: KavioDocument): KavioDocument {
  return document;
}

export const schemaMigrations: Readonly<Record<KavioMigrationVersion, Readonly<Record<KavioMigrationVersion, KavioMigration>>>> = {
  "0.1": {
    "0.1": migrateComposition01To01
  }
};

export function migrateComposition(document: KavioDocument, options: MigrateCompositionOptions = {}): KavioDocument {
  const fromVersion = options.fromVersion ?? document.version;
  const toVersion = options.toVersion ?? schemaVersion;

  const migration = schemaMigrations[fromVersion]?.[toVersion];
  if (migration === undefined) {
    throw new RangeError(`Unsupported Kavio schema migration from ${fromVersion} to ${toVersion}.`);
  }

  return migration(document);
}

type AssetType = "video" | "image" | "audio" | "font";
type LayerType = "video" | "image" | "text" | "shape" | "caption";
type PropType = "string" | "number" | "boolean" | "color" | "url" | "enum" | "asset";
type ExportFormat = "mp4" | "webm" | "mov" | "gif" | "png-sequence";
type AnimatableProperty = "opacity" | "x" | "y" | "scale" | "rotation";

interface AssetInfo {
  id: string;
  path: string;
  type: AssetType;
  family?: string;
}

interface PropInfo {
  name: string;
  path: string;
  type: PropType;
  options?: readonly unknown[];
  hasDefault: boolean;
  required: boolean;
}

interface LayerInfo {
  id: string;
  path: string;
  type?: LayerType;
}

interface CompositionInfo {
  durationFrames?: number;
  fps?: number;
}

const ASSET_TYPES = new Set<AssetType>(["video", "image", "audio", "font"]);
const LAYER_TYPES = new Set<LayerType>(["video", "image", "text", "shape", "caption"]);
const PROP_TYPES = new Set<PropType>(["string", "number", "boolean", "color", "url", "enum", "asset"]);
const EXPORT_FORMATS = new Set<ExportFormat>(["mp4", "webm", "mov", "gif", "png-sequence"]);
const FIT_VALUES = new Set(["cover", "contain", "fill", "none"]);
const TEXT_ALIGN_VALUES = new Set(["left", "center", "right"]);
const ANCHOR_VALUES = new Set([
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right"
]);
const ANIMATABLE_PROPERTIES = new Set<AnimatableProperty>(["opacity", "x", "y", "scale", "rotation"]);
const EASING_VALUES = new Set([
  "linear",
  "inQuad",
  "outQuad",
  "inOutQuad",
  "inCubic",
  "outCubic",
  "inOutCubic",
  "inBack",
  "outBack",
  "inOutBack"
]);
const AUDIO_ROLES = new Set(["music", "voiceover", "sfx", "source"]);
const CAPTION_SOURCE_KINDS = new Set(["inline", "vtt", "srt", "asset"]);
const WEB_SAFE_FONT_FAMILIES = new Set([
  "arial",
  "helvetica",
  "times new roman",
  "georgia",
  "courier new",
  "verdana",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
  "inter"
]);
const PLACEHOLDER_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
const PROP_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const CUBIC_BEZIER_PATTERN =
  /^cubic-bezier\(\s*(-?(?:\d+|\d*\.\d+))\s*,\s*(-?(?:\d+|\d*\.\d+))\s*,\s*(-?(?:\d+|\d*\.\d+))\s*,\s*(-?(?:\d+|\d*\.\d+))\s*\)$/;

export function validateComposition(input: unknown): ValidationResult {
  const errors: KavioError[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [validationError("SCHEMA_DOCUMENT_TYPE", "", "Composition must be an object.")]
    };
  }

  validateTopLevelShape(input, errors);
  const props = validateProps(input.props, errors);
  const composition = validateCompositionTiming(input.composition, errors);
  const assets = validateAssets(input.assets, errors);
  const layers = validateLayers(input.layers, assets, composition, errors);

  validateAudio(input.audio, assets, composition, errors);
  validateExports(input.exports, layers, composition, errors);
  validateInterpolations(input, props, errors);

  return { ok: errors.every((error) => error.severity !== "error"), errors };
}

function validateTopLevelShape(input: Record<string, unknown>, errors: KavioError[]): void {
  if (typeof input.version !== "string") {
    errors.push(validationError("SCHEMA_VERSION_REQUIRED", "version", "version is required."));
  } else if (input.version !== schemaVersion) {
    errors.push(
      validationError(
        "SCHEMA_VERSION_UNSUPPORTED",
        "version",
        `version must be ${schemaVersion}.`,
        `Set version to "${schemaVersion}" for this schema package.`
      )
    );
  }

  if (!isRecord(input.composition)) {
    errors.push(validationError("SCHEMA_COMPOSITION_REQUIRED", "composition", "composition is required."));
  }

  if (input.props !== undefined && !isRecord(input.props)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", "props", "props must be an object."));
  }

  if (!isRecord(input.assets)) {
    errors.push(validationError("SCHEMA_ASSETS_REQUIRED", "assets", "assets must be an object."));
  }

  if (!Array.isArray(input.layers)) {
    errors.push(validationError("SCHEMA_LAYERS_REQUIRED", "layers", "layers must be an array."));
  }

  if (input.audio !== undefined && !Array.isArray(input.audio)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", "audio", "audio must be an array."));
  }

  if (!Array.isArray(input.exports)) {
    errors.push(validationError("SCHEMA_EXPORTS_REQUIRED", "exports", "exports must be an array."));
  }
}

function validateCompositionTiming(value: unknown, errors: KavioError[]): CompositionInfo {
  if (!isRecord(value)) {
    return {};
  }

  const info: CompositionInfo = {};
  const width = requireInteger(value, "width", "composition.width", 1, 7680, errors);
  const height = requireInteger(value, "height", "composition.height", 1, 7680, errors);
  const fps = requireInteger(value, "fps", "composition.fps", 1, 120, errors);
  const durationFrames = requireInteger(value, "durationFrames", "composition.durationFrames", 1, undefined, errors);

  if (width !== undefined && height !== undefined && width * height > 7680 * 7680) {
    errors.push(
      validationError(
        "LIMIT_DIMENSIONS_EXCEEDED",
        "composition",
        "composition dimensions exceed the maximum supported canvas area.",
        "Use width and height values up to 7680 pixels."
      )
    );
  }

  if (fps !== undefined) {
    info.fps = fps;
    if (![24, 25, 30, 50, 60].includes(fps)) {
      errors.push(
        validationWarning(
          "SCHEMA_FPS_NONSTANDARD",
          "composition.fps",
          "fps is valid but non-standard.",
          "Use 24, 25, 30, 50, or 60 unless this template intentionally needs another frame rate."
        )
      );
    }
  }

  if (durationFrames !== undefined) {
    info.durationFrames = durationFrames;
  }

  optionalString(value, "background", "composition.background", errors);
  optionalEnum(value, "colorSpace", "composition.colorSpace", new Set(["srgb", "display-p3"]), errors);

  return info;
}

function validateProps(value: unknown, errors: KavioError[]): Map<string, PropInfo> {
  const props = new Map<string, PropInfo>();
  if (value === undefined || !isRecord(value)) {
    return props;
  }

  for (const [name, declaration] of Object.entries(value)) {
    const path = propertyPath("props", name);
    if (!PROP_NAME_PATTERN.test(name)) {
      errors.push(
        validationError(
          "PROP_INVALID_NAME",
          path,
          "prop names must start with a letter or underscore and contain only letters, numbers, underscores, or hyphens."
        )
      );
    }

    if (!isRecord(declaration)) {
      errors.push(validationError("PROP_INVALID_DECLARATION", path, "prop declaration must be an object."));
      continue;
    }

    const typeValue = declaration.type;
    if (typeof typeValue !== "string") {
      errors.push(validationError("PROP_REQUIRED_FIELD", propertyPath(path, "type"), "prop type is required."));
      continue;
    }

    if (!isPropType(typeValue)) {
      errors.push(
        validationError(
          "PROP_INVALID_TYPE",
          propertyPath(path, "type"),
          `prop type "${typeValue}" is not supported.`,
          "Use string, number, boolean, color, url, enum, or asset."
        )
      );
      continue;
    }

    const requiredValue = declaration.required;
    if (requiredValue !== undefined && typeof requiredValue !== "boolean") {
      errors.push(validationError("PROP_TYPE_MISMATCH", propertyPath(path, "required"), "prop required must be a boolean."));
    }

    let options: readonly unknown[] | undefined;
    if (typeValue === "enum") {
      if (!Array.isArray(declaration.options) || declaration.options.length === 0) {
        errors.push(
          validationError(
            "PROP_REQUIRED_FIELD",
            propertyPath(path, "options"),
            "enum props must declare at least one option."
          )
        );
      } else {
        options = declaration.options;
      }
    }

    if (declaration.default !== undefined) {
      validatePropValue(declaration.default, typeValue, propertyPath(path, "default"), options, errors);
    }

    if (declaration.maxLength !== undefined) {
      optionalInteger(declaration, "maxLength", propertyPath(path, "maxLength"), 1, undefined, errors);
    }

    const prop: PropInfo = {
      name,
      path,
      type: typeValue,
      hasDefault: declaration.default !== undefined,
      required: requiredValue === true
    };

    if (options !== undefined) {
      prop.options = options;
    }

    props.set(name, prop);
  }

  return props;
}

function validateAssets(value: unknown, errors: KavioError[]): Map<string, AssetInfo> {
  const assets = new Map<string, AssetInfo>();
  if (!isRecord(value)) {
    return assets;
  }

  for (const [id, asset] of Object.entries(value)) {
    const path = propertyPath("assets", id);
    if (!id) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", path, "asset id must not be empty."));
    }

    if (!isRecord(asset)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", path, "asset must be an object."));
      continue;
    }

    const typeValue = requireString(asset, "type", propertyPath(path, "type"), errors);
    requireString(asset, "src", propertyPath(path, "src"), errors);

    if (typeValue === undefined || !isAssetType(typeValue)) {
      if (typeValue !== undefined) {
        errors.push(
          validationError(
            "SCHEMA_INVALID_FIELD",
            propertyPath(path, "type"),
            `asset type "${typeValue}" is not supported.`,
            "Use video, image, audio, or font."
          )
        );
      }
      continue;
    }

    const info: AssetInfo = { id, path, type: typeValue };
    if (typeValue === "font") {
      const family = requireString(asset, "family", propertyPath(path, "family"), errors);
      if (family !== undefined) {
        info.family = family;
      }
    }

    optionalInteger(asset, "trimStartFrames", propertyPath(path, "trimStartFrames"), 0, undefined, errors);
    optionalInteger(asset, "trimEndFrames", propertyPath(path, "trimEndFrames"), 0, undefined, errors, true);
    optionalBoolean(asset, "loop", propertyPath(path, "loop"), errors);
    optionalString(asset, "checksum", propertyPath(path, "checksum"), errors);

    assets.set(id, info);
  }

  return assets;
}

function validateLayers(
  value: unknown,
  assets: ReadonlyMap<string, AssetInfo>,
  composition: CompositionInfo,
  errors: KavioError[]
): Map<string, LayerInfo> {
  const layers = new Map<string, LayerInfo>();
  const seenLayerIds = new Map<string, string>();
  if (!Array.isArray(value)) {
    return layers;
  }

  value.forEach((layer, index) => {
    const path = indexPath("layers", index);
    if (!isRecord(layer)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", path, "layer must be an object."));
      return;
    }

    const id = requireString(layer, "id", propertyPath(path, "id"), errors);
    const typeValue = requireString(layer, "type", propertyPath(path, "type"), errors);
    const startFrame = requireInteger(layer, "startFrame", propertyPath(path, "startFrame"), 0, undefined, errors);
    const durationFrames = requireInteger(layer, "durationFrames", propertyPath(path, "durationFrames"), 1, undefined, errors);

    if (id !== undefined) {
      if (id.length === 0) {
        errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(path, "id"), "layer id must not be empty."));
      }

      const firstPath = seenLayerIds.get(id);
      if (firstPath !== undefined) {
        errors.push(
          validationError(
            "SCHEMA_DUPLICATE_LAYER_ID",
            propertyPath(path, "id"),
            `duplicate layer id "${id}".`,
            `Layer ids must be unique. First seen at ${firstPath}.`
          )
        );
      } else {
        seenLayerIds.set(id, propertyPath(path, "id"));
      }
    }

    const layerInfo: LayerInfo | undefined = id !== undefined ? { id, path } : undefined;
    if (typeValue !== undefined) {
      if (isLayerType(typeValue)) {
        if (layerInfo !== undefined) {
          layerInfo.type = typeValue;
        }
        validateLayerByType(layer, typeValue, path, assets, errors);
      } else {
        errors.push(
          validationError(
            "SCHEMA_INVALID_FIELD",
            propertyPath(path, "type"),
            `layer type "${typeValue}" is not supported.`,
            "Use video, image, text, shape, or caption."
          )
        );
      }
    }

    if (layerInfo !== undefined) {
      layers.set(layerInfo.id, layerInfo);
    }

    validateFrameRange(path, startFrame, durationFrames, composition.durationFrames, errors);
    validateCommonLayerFields(layer, path, assets, errors);
  });

  return layers;
}

function validateLayerByType(
  layer: Record<string, unknown>,
  type: LayerType,
  path: string,
  assets: ReadonlyMap<string, AssetInfo>,
  errors: KavioError[]
): void {
  switch (type) {
    case "video":
      validateAssetReference(layer.asset, propertyPath(path, "asset"), "video", assets, errors);
      optionalEnum(layer, "fit", propertyPath(path, "fit"), FIT_VALUES, errors);
      validateVideoCrop(layer.crop, propertyPath(path, "crop"), layer.durationFrames, errors);
      optionalBoolean(layer, "muted", propertyPath(path, "muted"), errors);
      optionalNumber(layer, "volume", propertyPath(path, "volume"), 0, 1, errors);
      optionalNumber(layer, "playbackRate", propertyPath(path, "playbackRate"), 0, undefined, errors);
      break;
    case "image":
      validateAssetReference(layer.asset, propertyPath(path, "asset"), "image", assets, errors);
      optionalEnum(layer, "fit", propertyPath(path, "fit"), FIT_VALUES, errors);
      break;
    case "text":
      requireString(layer, "text", propertyPath(path, "text"), errors);
      validateTextStyle(layer.style, propertyPath(path, "style"), assets, errors);
      break;
    case "shape":
      optionalEnum(layer, "shape", propertyPath(path, "shape"), new Set(["rect"]), errors);
      optionalString(layer, "fill", propertyPath(path, "fill"), errors);
      validateStroke(layer.stroke, propertyPath(path, "stroke"), errors);
      optionalNumber(layer, "radius", propertyPath(path, "radius"), 0, undefined, errors);
      break;
    case "caption":
      validateCaptionSource(layer.source, propertyPath(path, "source"), assets, errors);
      validateTextStyle(layer.style, propertyPath(path, "style"), assets, errors);
      break;
  }
}

function validateCommonLayerFields(
  layer: Record<string, unknown>,
  path: string,
  assets: ReadonlyMap<string, AssetInfo>,
  errors: KavioError[]
): void {
  validatePosition(layer.position, propertyPath(path, "position"), errors);
  validateSize(layer.size, propertyPath(path, "size"), errors);
  validateAnchor(layer.anchor, propertyPath(path, "anchor"), errors);
  optionalNumber(layer, "opacity", propertyPath(path, "opacity"), 0, 1, errors);
  optionalNumber(layer, "rotation", propertyPath(path, "rotation"), undefined, undefined, errors);
  optionalNumber(layer, "scale", propertyPath(path, "scale"), 0, undefined, errors);
  optionalInteger(layer, "z", propertyPath(path, "z"), undefined, undefined, errors, true);
  optionalString(layer, "track", propertyPath(path, "track"), errors);
  validateKeyframes(layer.keyframes, propertyPath(path, "keyframes"), layer.durationFrames, errors);

  if (Array.isArray(layer.effects)) {
    layer.effects.forEach((effect, index) => {
      const effectPath = indexPath(propertyPath(path, "effects"), index);
      if (!isRecord(effect)) {
        errors.push(validationError("SCHEMA_INVALID_FIELD", effectPath, "effect must be an object."));
        return;
      }
      optionalEnum(effect, "type", propertyPath(effectPath, "type"), new Set(["blur", "brightness", "contrast", "saturate", "tint"]), errors);
    });
  } else if (layer.effects !== undefined) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(path, "effects"), "effects must be an array."));
  }

  validateTransition(layer.transitionIn, propertyPath(path, "transitionIn"), errors);
  validateTransition(layer.transitionOut, propertyPath(path, "transitionOut"), errors);
}

function validateTextStyle(
  value: unknown,
  path: string,
  assets: ReadonlyMap<string, AssetInfo>,
  errors: KavioError[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "style must be an object."));
    return;
  }

  optionalString(value, "fontFamily", propertyPath(path, "fontFamily"), errors);
  optionalNumber(value, "fontSize", propertyPath(path, "fontSize"), 1, 2000, errors);
  optionalNumberOrString(value, "fontWeight", propertyPath(path, "fontWeight"), 1, 1000, errors);
  optionalString(value, "fontStyle", propertyPath(path, "fontStyle"), errors);
  optionalString(value, "color", propertyPath(path, "color"), errors);
  optionalEnum(value, "align", propertyPath(path, "align"), TEXT_ALIGN_VALUES, errors);
  optionalNumber(value, "lineHeight", propertyPath(path, "lineHeight"), 0, undefined, errors);
  optionalNumber(value, "letterSpacing", propertyPath(path, "letterSpacing"), undefined, undefined, errors);
  optionalInteger(value, "maxLines", propertyPath(path, "maxLines"), 0, undefined, errors);
  optionalInteger(value, "maxCharsPerLine", propertyPath(path, "maxCharsPerLine"), 1, undefined, errors);
  optionalBoolean(value, "wrap", propertyPath(path, "wrap"), errors);
  optionalString(value, "background", propertyPath(path, "background"), errors, true);
  optionalNumber(value, "padding", propertyPath(path, "padding"), 0, undefined, errors);
  validateStroke(value.stroke, propertyPath(path, "stroke"), errors);

  if (isRecord(value.shadow)) {
    optionalString(value.shadow, "color", propertyPath(propertyPath(path, "shadow"), "color"), errors);
    optionalNumber(value.shadow, "x", propertyPath(propertyPath(path, "shadow"), "x"), undefined, undefined, errors);
    optionalNumber(value.shadow, "y", propertyPath(propertyPath(path, "shadow"), "y"), undefined, undefined, errors);
    optionalNumber(value.shadow, "blur", propertyPath(propertyPath(path, "shadow"), "blur"), 0, undefined, errors);
  } else if (value.shadow !== undefined && value.shadow !== null) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(path, "shadow"), "shadow must be an object or null."));
  }

  if (isRecord(value.highlight)) {
    optionalEnum(value.highlight, "mode", propertyPath(propertyPath(path, "highlight"), "mode"), new Set(["none", "word", "line"]), errors);
    optionalString(value.highlight, "color", propertyPath(propertyPath(path, "highlight"), "color"), errors);
    optionalNumber(value.highlight, "scale", propertyPath(propertyPath(path, "highlight"), "scale"), 0, undefined, errors);
  } else if (value.highlight !== undefined) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(path, "highlight"), "highlight must be an object."));
  }

  const fontFamily = value.fontFamily;
  if (typeof fontFamily === "string") {
    validateRegisteredFont(fontFamily, propertyPath(path, "fontFamily"), assets, errors);
  }
}

function validateStroke(value: unknown, path: string, errors: KavioError[]): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "stroke must be an object or null."));
    return;
  }

  optionalString(value, "color", propertyPath(path, "color"), errors);
  optionalNumber(value, "width", propertyPath(path, "width"), 0, undefined, errors);
}

function validateCaptionSource(
  value: unknown,
  path: string,
  assets: ReadonlyMap<string, AssetInfo>,
  errors: KavioError[]
): void {
  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_REQUIRED_FIELD", path, "caption source is required."));
    return;
  }

  const kind = requireString(value, "kind", propertyPath(path, "kind"), errors);
  if (kind !== undefined && !CAPTION_SOURCE_KINDS.has(kind)) {
    errors.push(
      validationError(
        "SCHEMA_INVALID_FIELD",
        propertyPath(path, "kind"),
        `caption source kind "${kind}" is not supported.`,
        "Use inline, vtt, srt, or asset."
      )
    );
  }

  if (kind === "inline") {
    if (!Array.isArray(value.cues)) {
      errors.push(validationError("SCHEMA_REQUIRED_FIELD", propertyPath(path, "cues"), "inline captions require cues."));
    } else {
      validateCaptionCues(value.cues, propertyPath(path, "cues"), errors);
    }
  } else if (kind === "vtt" || kind === "srt" || kind === "asset") {
    validateAssetReference(value.asset, propertyPath(path, "asset"), undefined, assets, errors);
  }
}

function validateCaptionCues(cues: unknown[], path: string, errors: KavioError[]): void {
  cues.forEach((cue, index) => {
    const cuePath = indexPath(path, index);
    if (!isRecord(cue)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", cuePath, "caption cue must be an object."));
      return;
    }

    const startFrame = requireInteger(cue, "startFrame", propertyPath(cuePath, "startFrame"), 0, undefined, errors);
    const endFrame = requireInteger(cue, "endFrame", propertyPath(cuePath, "endFrame"), 0, undefined, errors);
    requireString(cue, "text", propertyPath(cuePath, "text"), errors);
    if (startFrame !== undefined && endFrame !== undefined && endFrame <= startFrame) {
      errors.push(
        validationError(
          "SCHEMA_FRAME_RANGE_INVALID",
          cuePath,
          "caption cue endFrame must be greater than startFrame."
        )
      );
    }

    if (cue.words !== undefined) {
      if (!Array.isArray(cue.words)) {
        errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(cuePath, "words"), "caption words must be an array."));
      } else {
        validateCaptionWords(cue.words, propertyPath(cuePath, "words"), errors);
      }
    }
  });
}

function validateCaptionWords(words: unknown[], path: string, errors: KavioError[]): void {
  words.forEach((word, index) => {
    const wordPath = indexPath(path, index);
    if (!isRecord(word)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", wordPath, "caption word must be an object."));
      return;
    }

    const startFrame = requireInteger(word, "startFrame", propertyPath(wordPath, "startFrame"), 0, undefined, errors);
    const endFrame = requireInteger(word, "endFrame", propertyPath(wordPath, "endFrame"), 0, undefined, errors);
    requireString(word, "text", propertyPath(wordPath, "text"), errors);
    if (startFrame !== undefined && endFrame !== undefined && endFrame <= startFrame) {
      errors.push(
        validationError(
          "SCHEMA_FRAME_RANGE_INVALID",
          wordPath,
          "caption word endFrame must be greater than startFrame."
        )
      );
    }
  });
}

function validateAudio(
  value: unknown,
  assets: ReadonlyMap<string, AssetInfo>,
  composition: CompositionInfo,
  errors: KavioError[]
): void {
  if (value === undefined || !Array.isArray(value)) {
    return;
  }

  value.forEach((track, index) => {
    const path = indexPath("audio", index);
    if (!isRecord(track)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", path, "audio track must be an object."));
      return;
    }

    optionalString(track, "id", propertyPath(path, "id"), errors);
    validateAssetReference(track.asset, propertyPath(path, "asset"), "audio", assets, errors);
    optionalEnum(track, "role", propertyPath(path, "role"), AUDIO_ROLES, errors);

    const startFrame = optionalInteger(track, "startFrame", propertyPath(path, "startFrame"), 0, undefined, errors);
    const durationFrames = optionalInteger(track, "durationFrames", propertyPath(path, "durationFrames"), 1, undefined, errors);
    validateFrameRange(path, startFrame, durationFrames, composition.durationFrames, errors);

    optionalInteger(track, "offsetFrames", propertyPath(path, "offsetFrames"), 0, undefined, errors);
    optionalNumber(track, "volume", propertyPath(path, "volume"), 0, 1, errors);
    optionalInteger(track, "fadeInFrames", propertyPath(path, "fadeInFrames"), 0, undefined, errors);
    optionalInteger(track, "fadeOutFrames", propertyPath(path, "fadeOutFrames"), 0, undefined, errors);
    optionalBoolean(track, "loop", propertyPath(path, "loop"), errors);
  });
}

function validateExports(
  value: unknown,
  layers: ReadonlyMap<string, LayerInfo>,
  composition: CompositionInfo,
  errors: KavioError[]
): void {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length === 0) {
    errors.push(validationError("SCHEMA_REQUIRED_FIELD", "exports", "exports must contain at least one preset."));
  }

  value.forEach((exportPreset, index) => {
    const path = indexPath("exports", index);
    if (!isRecord(exportPreset)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", path, "export preset must be an object."));
      return;
    }

    requireString(exportPreset, "name", propertyPath(path, "name"), errors);
    const format = requireString(exportPreset, "format", propertyPath(path, "format"), errors);
    requireInteger(exportPreset, "width", propertyPath(path, "width"), 1, 7680, errors);
    requireInteger(exportPreset, "height", propertyPath(path, "height"), 1, 7680, errors);
    optionalInteger(exportPreset, "fps", propertyPath(path, "fps"), 1, 120, errors);
    optionalString(exportPreset, "bitrate", propertyPath(path, "bitrate"), errors);
    optionalInteger(exportPreset, "crf", propertyPath(path, "crf"), 0, 63, errors);
    optionalString(exportPreset, "audioCodec", propertyPath(path, "audioCodec"), errors);
    optionalString(exportPreset, "audioBitrate", propertyPath(path, "audioBitrate"), errors);
    optionalNumber(exportPreset, "loudnessLufs", propertyPath(path, "loudnessLufs"), undefined, undefined, errors);
    optionalString(exportPreset, "background", propertyPath(path, "background"), errors, true);

    if (format !== undefined && !isExportFormat(format)) {
      errors.push(
        validationError(
          "SCHEMA_INVALID_FIELD",
          propertyPath(path, "format"),
          `export format "${format}" is not supported.`,
          "Use mp4, webm, mov, gif, or png-sequence."
        )
      );
    }

    validateExportCodec(exportPreset, path, format, errors);
    validateExportBackground(exportPreset, path, format, errors);
    validateLayerOverrides(exportPreset.layerOverrides, propertyPath(path, "layerOverrides"), layers, composition, errors);
  });
}

function validateExportCodec(
  exportPreset: Record<string, unknown>,
  path: string,
  format: string | undefined,
  errors: KavioError[]
): void {
  const codec = exportPreset.codec;
  if (codec === undefined) {
    return;
  }

  if (typeof codec !== "string") {
    errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(path, "codec"), "export codec must be a string."));
    return;
  }

  if (!isExportFormat(format)) {
    return;
  }

  const allowedCodecsByFormat: Record<ExportFormat, readonly string[]> = {
    mp4: ["h264", "hevc"],
    webm: ["vp9"],
    mov: ["prores"],
    gif: [],
    "png-sequence": []
  };
  const allowed = allowedCodecsByFormat[format];
  if (!allowed.includes(codec)) {
    errors.push(
      validationError(
        "SCHEMA_UNSUPPORTED_EXPORT_CODEC",
        propertyPath(path, "codec"),
        `codec "${codec}" is not supported for ${format} exports.`,
        allowed.length > 0 ? `Use ${allowed.join(" or ")} for ${format}.` : `Remove codec for ${format} exports.`
      )
    );
  }
}

function validateExportBackground(
  exportPreset: Record<string, unknown>,
  path: string,
  format: string | undefined,
  errors: KavioError[]
): void {
  if (exportPreset.background !== "transparent" || !isExportFormat(format)) {
    return;
  }

  if (format !== "webm" && format !== "mov" && format !== "png-sequence") {
    errors.push(
      validationError(
        "SCHEMA_UNSUPPORTED_EXPORT_BACKGROUND",
        propertyPath(path, "background"),
        `transparent background is not supported for ${format} exports.`,
        "Use webm, mov, or png-sequence for alpha output."
      )
    );
  }
}

function validateLayerOverrides(
  value: unknown,
  path: string,
  layers: ReadonlyMap<string, LayerInfo>,
  composition: CompositionInfo,
  errors: KavioError[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "layerOverrides must be an object."));
    return;
  }

  for (const [layerId, override] of Object.entries(value)) {
    const overridePath = propertyPath(path, layerId);
    if (!layers.has(layerId)) {
      errors.push(
        validationError(
          "SCHEMA_UNKNOWN_LAYER_REFERENCE",
          overridePath,
          `layer override references unknown layer "${layerId}".`
        )
      );
    }

    if (!isRecord(override)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", overridePath, "layer override must be an object."));
      continue;
    }

    const startFrame = optionalInteger(override, "startFrame", propertyPath(overridePath, "startFrame"), 0, undefined, errors);
    const durationFrames = optionalInteger(
      override,
      "durationFrames",
      propertyPath(overridePath, "durationFrames"),
      1,
      undefined,
      errors
    );
    validateFrameRange(overridePath, startFrame, durationFrames, composition.durationFrames, errors);
    validatePosition(override.position, propertyPath(overridePath, "position"), errors);
    validateSize(override.size, propertyPath(overridePath, "size"), errors);
    validateAnchor(override.anchor, propertyPath(overridePath, "anchor"), errors);
    validateVideoCrop(override.crop, propertyPath(overridePath, "crop"), durationFrames, errors);
  }
}

function validateVideoCrop(value: unknown, path: string, layerDuration: unknown, errors: KavioError[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "crop must be an object."));
    return;
  }

  const mode = requireString(value, "mode", propertyPath(path, "mode"), errors);
  if (mode !== undefined && mode !== "center" && mode !== "subject") {
    errors.push(
      validationError(
        "SCHEMA_INVALID_FIELD",
        propertyPath(path, "mode"),
        `crop mode "${mode}" is not supported.`,
        'Use "center" or "subject".'
      )
    );
  }

  if (mode === "center") {
    return;
  }

  const x = optionalNumber(value, "x", propertyPath(path, "x"), 0, 1, errors);
  const y = optionalNumber(value, "y", propertyPath(path, "y"), 0, 1, errors);
  optionalInteger(value, "smoothingFrames", propertyPath(path, "smoothingFrames"), 0, undefined, errors);
  optionalString(value, "source", propertyPath(path, "source"), errors);

  if (value.keyframes !== undefined) {
    if (!Array.isArray(value.keyframes)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPath(path, "keyframes"), "crop keyframes must be an array."));
    } else {
      validateCropKeyframes(value.keyframes, propertyPath(path, "keyframes"), layerDuration, errors);
    }
  }

  if (mode === "subject" && x === undefined && y === undefined && !Array.isArray(value.keyframes)) {
    errors.push(
      validationError(
        "SCHEMA_REQUIRED_FIELD",
        path,
        "subject crop must declare x/y or at least one keyframe.",
        "Use normalized subject coordinates from 0 to 1."
      )
    );
  }
}

function validateCropKeyframes(value: unknown[], path: string, layerDuration: unknown, errors: KavioError[]): void {
  let previousFrame = -1;
  const duration = isInteger(layerDuration) && layerDuration >= 1 ? layerDuration : undefined;

  value.forEach((keyframe, index) => {
    const keyframePath = indexPath(path, index);
    if (!isRecord(keyframe)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", keyframePath, "crop keyframe must be an object."));
      return;
    }

    const frame = requireInteger(keyframe, "frame", propertyPath(keyframePath, "frame"), 0, undefined, errors);
    requireNumber(keyframe, "x", propertyPath(keyframePath, "x"), 0, 1, errors);
    requireNumber(keyframe, "y", propertyPath(keyframePath, "y"), 0, 1, errors);
    optionalString(keyframe, "easing", propertyPath(keyframePath, "easing"), errors);

    if (frame !== undefined) {
      if (frame <= previousFrame) {
        errors.push(
          validationError(
            "SCHEMA_KEYFRAMES_UNSORTED",
            propertyPath(keyframePath, "frame"),
            "crop keyframes must be sorted by increasing frame."
          )
        );
      }
      if (duration !== undefined && frame >= duration) {
        errors.push(
          validationError(
            "SCHEMA_FRAME_RANGE_INVALID",
            propertyPath(keyframePath, "frame"),
            "crop keyframe frame must be inside the layer duration."
          )
        );
      }
      previousFrame = frame;
    }
  });
}

function validateKeyframes(
  value: unknown,
  path: string,
  layerDuration: unknown,
  errors: KavioError[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "keyframes must be an object."));
    return;
  }

  const duration = isInteger(layerDuration) && layerDuration >= 1 ? layerDuration : undefined;
  for (const [property, frames] of Object.entries(value)) {
    const propertyPathValue = propertyPath(path, property);
    if (!isAnimatableProperty(property)) {
      errors.push(
        validationError(
          "SCHEMA_INVALID_KEYFRAME_PROPERTY",
          propertyPathValue,
          `"${property}" is not an MVP animatable property.`,
          "Use opacity, x, y, scale, or rotation."
        )
      );
      continue;
    }

    if (!Array.isArray(frames)) {
      errors.push(validationError("SCHEMA_INVALID_FIELD", propertyPathValue, "keyframe track must be an array."));
      continue;
    }

    let previousFrame: number | undefined;
    frames.forEach((keyframe, index) => {
      const keyframePath = indexPath(propertyPathValue, index);
      if (!isRecord(keyframe)) {
        errors.push(validationError("SCHEMA_INVALID_FIELD", keyframePath, "keyframe must be an object."));
        return;
      }

      const frame = requireInteger(keyframe, "frame", propertyPath(keyframePath, "frame"), 0, duration, errors);
      validateKeyframeValue(keyframe.value, property, propertyPath(keyframePath, "value"), errors);
      validateEasing(keyframe.easing, propertyPath(keyframePath, "easing"), errors);

      if (frame !== undefined && previousFrame !== undefined && frame <= previousFrame) {
        errors.push(
          validationError(
            "SCHEMA_KEYFRAMES_UNSORTED",
            propertyPath(keyframePath, "frame"),
            "keyframes must be sorted by increasing frame.",
            "Sort keyframes by local frame and remove duplicate frame values."
          )
        );
      }

      if (frame !== undefined) {
        previousFrame = frame;
      }
    });
  }
}

function validateKeyframeValue(value: unknown, property: AnimatableProperty, path: string, errors: KavioError[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(validationError("SCHEMA_KEYFRAME_VALUE_TYPE", path, `${property} keyframe value must be a finite number.`));
    return;
  }

  if (property === "opacity" && (value < 0 || value > 1)) {
    errors.push(validationError("SCHEMA_KEYFRAME_VALUE_RANGE", path, "opacity keyframe value must be between 0 and 1."));
  }

  if (property === "scale" && value < 0) {
    errors.push(validationError("SCHEMA_KEYFRAME_VALUE_RANGE", path, "scale keyframe value must be greater than or equal to 0."));
  }
}

function validateEasing(value: unknown, path: string, errors: KavioError[]): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    errors.push(validationError("SCHEMA_INVALID_EASING", path, "easing must be a string."));
    return;
  }

  if (EASING_VALUES.has(value) || CUBIC_BEZIER_PATTERN.test(value)) {
    return;
  }

  errors.push(
    validationError(
      "SCHEMA_INVALID_EASING",
      path,
      `easing "${value}" is not supported.`,
      "Use a named MVP easing or cubic-bezier(x1,y1,x2,y2)."
    )
  );
}

function validateInterpolations(input: unknown, props: ReadonlyMap<string, PropInfo>, errors: KavioError[]): void {
  walkStrings(input, "", (value, path) => {
    const matches = [...value.matchAll(PLACEHOLDER_PATTERN)];
    const hasInterpolationSyntax = value.includes("{{") || value.includes("}}");
    if (!hasInterpolationSyntax) {
      return;
    }

    if (matches.length === 0) {
      errors.push(
        validationError(
          "PROP_UNRESOLVED",
          path,
          "string contains unresolved prop interpolation syntax.",
          "Use placeholders like {{propName}} and declare the prop in props."
        )
      );
      return;
    }

    const stripped = value.replace(PLACEHOLDER_PATTERN, "");
    if (stripped.includes("{{") || stripped.includes("}}")) {
      errors.push(
        validationError(
          "PROP_UNRESOLVED",
          path,
          "string contains unresolved prop interpolation syntax.",
          "Check for unmatched braces or nested placeholders."
        )
      );
    }

    for (const match of matches) {
      const rawName = match[1];
      const propName = rawName?.trim() ?? "";
      if (!PROP_NAME_PATTERN.test(propName)) {
        errors.push(
          validationError(
            "PROP_UNRESOLVED",
            path,
            `prop placeholder "{{${rawName ?? ""}}}" is not a valid prop name.`
          )
        );
        continue;
      }

      const prop = props.get(propName);
      if (prop === undefined) {
        errors.push(
          validationError(
            "PROP_UNDECLARED_PLACEHOLDER",
            path,
            `placeholder references undeclared prop "${propName}".`,
            `Declare props.${propName} or remove the placeholder.`
          )
        );
        continue;
      }

      const allowedTypes = allowedPropTypesForPath(path, value, match[0]);
      if (allowedTypes !== undefined && !allowedTypes.has(prop.type)) {
        errors.push(
          validationError(
            "PROP_TYPE_MISMATCH",
            path,
            `prop "${propName}" has type ${prop.type}, which is not valid for this field.`,
            `Use a prop of type ${Array.from(allowedTypes).join(" or ")} here.`
          )
        );
      }
    }
  });
}

function allowedPropTypesForPath(path: string, value: string, placeholder: string): ReadonlySet<PropType> | undefined {
  const isFullPlaceholder = value.trim() === placeholder;
  if (path.endsWith(".src") && path.startsWith("assets.")) {
    return new Set(["url", "string"]);
  }

  if (path.endsWith(".asset")) {
    return new Set(["asset", "string"]);
  }

  if (
    path.endsWith(".fill") ||
    path.endsWith(".background") ||
    path.endsWith(".color") ||
    path.endsWith(".stroke.color") ||
    path.endsWith(".shadow.color") ||
    path.endsWith(".highlight.color")
  ) {
    return new Set(["color", "string"]);
  }

  if (
    isFullPlaceholder &&
    (path.endsWith(".x") ||
      path.endsWith(".y") ||
      path.endsWith(".width") ||
      path.endsWith(".height") ||
      path.endsWith(".fontSize") ||
      path.endsWith(".fontWeight") ||
      path.endsWith(".lineHeight") ||
      path.endsWith(".letterSpacing") ||
      path.endsWith(".padding") ||
      path.endsWith(".radius"))
  ) {
    return new Set(["number"]);
  }

  return new Set(["string", "url", "color", "enum", "asset"]);
}

function validatePropValue(
  value: unknown,
  type: PropType,
  path: string,
  options: readonly unknown[] | undefined,
  errors: KavioError[]
): void {
  switch (type) {
    case "string":
    case "color":
    case "url":
    case "asset":
      if (typeof value !== "string") {
        errors.push(validationError("PROP_TYPE_MISMATCH", path, `default value for ${type} prop must be a string.`));
      }
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(validationError("PROP_TYPE_MISMATCH", path, "default value for number prop must be a finite number."));
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(validationError("PROP_TYPE_MISMATCH", path, "default value for boolean prop must be a boolean."));
      }
      break;
    case "enum":
      if (options !== undefined && !options.includes(value)) {
        errors.push(validationError("PROP_TYPE_MISMATCH", path, "default value for enum prop must be one of its options."));
      }
      break;
  }
}

function validateAssetReference(
  value: unknown,
  path: string,
  expectedType: AssetType | undefined,
  assets: ReadonlyMap<string, AssetInfo>,
  errors: KavioError[]
): void {
  if (typeof value !== "string") {
    errors.push(validationError("SCHEMA_REQUIRED_FIELD", path, "asset reference is required."));
    return;
  }

  const asset = assets.get(value);
  if (asset === undefined) {
    errors.push(validationError("SCHEMA_UNKNOWN_ASSET_REFERENCE", path, `unknown asset reference "${value}".`));
    return;
  }

  if (expectedType !== undefined && asset.type !== expectedType) {
    errors.push(
      validationError(
        "SCHEMA_ASSET_TYPE_MISMATCH",
        path,
        `asset "${value}" has type ${asset.type}; expected ${expectedType}.`,
        `Use a ${expectedType} asset id here or change ${asset.path}.type.`
      )
    );
  }
}

function validateFrameRange(
  path: string,
  startFrame: number | undefined,
  durationFrames: number | undefined,
  compositionDuration: number | undefined,
  errors: KavioError[]
): void {
  if (startFrame === undefined || durationFrames === undefined) {
    return;
  }

  if (!Number.isSafeInteger(startFrame + durationFrames)) {
    errors.push(validationError("SCHEMA_FRAME_RANGE_INVALID", path, "frame range exceeds safe integer limits."));
    return;
  }

  if (compositionDuration !== undefined && startFrame + durationFrames > compositionDuration) {
    errors.push(
      validationError(
        "SCHEMA_FRAME_RANGE_INVALID",
        path,
        "frame range extends beyond composition.durationFrames.",
        "Set startFrame + durationFrames to be less than or equal to composition.durationFrames."
      )
    );
  }
}

function validatePosition(value: unknown, path: string, errors: KavioError[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "position must be an object."));
    return;
  }

  optionalCoordinate(value, "x", propertyPath(path, "x"), errors);
  optionalCoordinate(value, "y", propertyPath(path, "y"), errors);
}

function validateSize(value: unknown, path: string, errors: KavioError[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "size must be an object."));
    return;
  }

  optionalCoordinate(value, "width", propertyPath(path, "width"), errors);
  optionalCoordinate(value, "height", propertyPath(path, "height"), errors);
}

function validateAnchor(value: unknown, path: string, errors: KavioError[]): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (!ANCHOR_VALUES.has(value)) {
      errors.push(
        validationError(
          "SCHEMA_INVALID_FIELD",
          path,
          `anchor "${value}" is not supported.`,
          "Use a named anchor or {x,y} fractions."
        )
      );
    }
    return;
  }

  if (isRecord(value)) {
    requireNumber(value, "x", propertyPath(path, "x"), 0, 1, errors);
    requireNumber(value, "y", propertyPath(path, "y"), 0, 1, errors);
    return;
  }

  errors.push(validationError("SCHEMA_INVALID_FIELD", path, "anchor must be a string or an {x,y} object."));
}

function validateTransition(value: unknown, path: string, errors: KavioError[]): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, "transition must be an object or null."));
    return;
  }

  optionalEnum(value, "type", propertyPath(path, "type"), new Set(["fade", "slide", "wipe", "crossfade"]), errors);
  optionalInteger(value, "durationFrames", propertyPath(path, "durationFrames"), 1, undefined, errors);
}

function validateRegisteredFont(
  fontFamily: string,
  path: string,
  assets: ReadonlyMap<string, AssetInfo>,
  errors: KavioError[]
): void {
  const normalizedFamily = fontFamily.toLowerCase();
  if (WEB_SAFE_FONT_FAMILIES.has(normalizedFamily)) {
    return;
  }

  for (const asset of assets.values()) {
    if (asset.type === "font" && asset.family?.toLowerCase() === normalizedFamily) {
      return;
    }
  }

  errors.push(
    validationError(
      "SCHEMA_FONT_NOT_REGISTERED",
      path,
      `fontFamily "${fontFamily}" does not match a registered font asset or known web-safe family.`,
      "Add a font asset with the matching family or use a web-safe family."
    )
  );
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: KavioError[]
): string | undefined {
  if (!(key in record)) {
    errors.push(validationError("SCHEMA_REQUIRED_FIELD", path, `${key} is required.`));
    return undefined;
  }

  const value = record[key];
  if (typeof value !== "string") {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, `${key} must be a string.`));
    return undefined;
  }

  if (value.length === 0) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, `${key} must not be empty.`));
  }

  return value;
}

function requireInteger(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[]
): number | undefined {
  if (!(key in record)) {
    errors.push(validationError("SCHEMA_REQUIRED_FIELD", path, `${key} is required.`));
    return undefined;
  }

  return validateIntegerValue(record[key], path, `${key} must be an integer.`, min, max, errors);
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[]
): number | undefined {
  if (!(key in record)) {
    errors.push(validationError("SCHEMA_REQUIRED_FIELD", path, `${key} is required.`));
    return undefined;
  }

  return validateNumberValue(record[key], path, `${key} must be a finite number.`, min, max, errors);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: KavioError[],
  nullable = false
): string | undefined {
  const value = record[key];
  if (value === undefined || (nullable && value === null)) {
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, `${key} must be a string${nullable ? " or null" : ""}.`));
    return undefined;
  }

  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string, path: string, errors: KavioError[]): boolean | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, `${key} must be a boolean.`));
    return undefined;
  }

  return value;
}

function optionalInteger(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[],
  nullable = false
): number | undefined {
  const value = record[key];
  if (value === undefined || (nullable && value === null)) {
    return undefined;
  }

  return validateIntegerValue(value, path, `${key} must be an integer${nullable ? " or null" : ""}.`, min, max, errors);
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[]
): number | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  return validateNumberValue(value, path, `${key} must be a finite number.`, min, max, errors);
}

function optionalNumberOrString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[]
): number | string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return validateNumberValue(value, path, `${key} must be a finite number or non-empty string.`, min, max, errors);
}

function optionalCoordinate(record: Record<string, unknown>, key: string, path: string, errors: KavioError[]): void {
  const value = record[key];
  if (value === undefined) {
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return;
  }

  if (typeof value === "string" && (/^-?(?:\d+|\d*\.\d+)%(?:w|h)?$/.test(value) || /{{\s*([^{}]+?)\s*}}/.test(value))) {
    return;
  }

  errors.push(validationError("SCHEMA_INVALID_FIELD", path, `${key} must be a number or percentage string.`));
}

function optionalEnum(
  record: Record<string, unknown>,
  key: string,
  path: string,
  allowed: ReadonlySet<string>,
  errors: KavioError[]
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, `${key} has an unsupported value.`));
    return undefined;
  }

  return value;
}

function validateIntegerValue(
  value: unknown,
  path: string,
  message: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[]
): number | undefined {
  if (!isInteger(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, message));
    return undefined;
  }

  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, rangeMessage(path, min, max)));
    return undefined;
  }

  return value;
}

function validateNumberValue(
  value: unknown,
  path: string,
  message: string,
  min: number | undefined,
  max: number | undefined,
  errors: KavioError[]
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, message));
    return undefined;
  }

  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    errors.push(validationError("SCHEMA_INVALID_FIELD", path, rangeMessage(path, min, max)));
    return undefined;
  }

  return value;
}

function rangeMessage(path: string, min: number | undefined, max: number | undefined): string {
  const fieldName = path.slice(path.lastIndexOf(".") + 1);
  if (min !== undefined && max !== undefined) {
    return `${fieldName} must be between ${min} and ${max}.`;
  }
  if (min !== undefined) {
    return `${fieldName} must be greater than or equal to ${min}.`;
  }
  return `${fieldName} must be less than or equal to ${max}.`;
}

function walkStrings(value: unknown, path: string, visit: (value: string, path: string) => void): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkStrings(item, indexPath(path, index), visit);
    });
    return;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, propertyPath(path, key), visit);
    }
  }
}

function validationError(code: string, path: string, message: string, hint?: string): KavioError {
  return kavioError(code, "error", path, message, hint);
}

function validationWarning(code: string, path: string, message: string, hint?: string): KavioError {
  return kavioError(code, "warning", path, message, hint);
}

function kavioError(
  code: string,
  severity: KavioErrorSeverity,
  path: string,
  message: string,
  hint: string | undefined
): KavioError {
  const error: KavioError = {
    code,
    severity,
    message,
    path,
    stage: "validation",
    retryable: false
  };

  if (hint !== undefined) {
    error.hint = hint;
  }

  return error;
}

function propertyPath(parent: string, key: string): string {
  const segment = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `[${JSON.stringify(key)}]`;
  if (!parent) {
    return segment;
  }

  return segment.startsWith("[") ? `${parent}${segment}` : `${parent}.${segment}`;
}

function indexPath(parent: string, index: number): string {
  return `${parent}[${index}]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

function isAssetType(value: string): value is AssetType {
  return ASSET_TYPES.has(value as AssetType);
}

function isLayerType(value: string): value is LayerType {
  return LAYER_TYPES.has(value as LayerType);
}

function isPropType(value: string): value is PropType {
  return PROP_TYPES.has(value as PropType);
}

function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && EXPORT_FORMATS.has(value as ExportFormat);
}

function isAnimatableProperty(value: string): value is AnimatableProperty {
  return ANIMATABLE_PROPERTIES.has(value as AnimatableProperty);
}
