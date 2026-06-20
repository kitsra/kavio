import { validateComposition, type CompositionTiming, type KavioDocument, type ValidationResult } from "@kavio/schema";

export type { KavioError, ValidationResult } from "@kavio/schema";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type AuthorValue =
  | JsonValue
  | PropReference
  | AssetReference
  | AuthorValue[]
  | { [key: string]: AuthorValue | undefined }
  | undefined;

export type AssetType = "video" | "image" | "audio" | "font";
export type LayerType = "video" | "image" | "text" | "shape" | "caption";
export type Fit = "cover" | "contain" | "fill" | "none";
export type Anchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right"
  | { x: number; y: number };
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
  | "inOutBack"
  | `cubic-bezier(${number},${number},${number},${number})`;
export type AnimatableProperty = "opacity" | "x" | "y" | "scale" | "rotation";
export type PropType = "string" | "number" | "boolean" | "color" | "url" | "enum" | "asset";
export type ExportFormat = "mp4" | "webm" | "mov" | "gif" | "png-sequence";
export type VideoCropMode = "center" | "subject";

export interface PropMetadata {
  type: PropType;
  required?: boolean;
  default?: JsonValue;
  maxLength?: number;
  options?: JsonPrimitive[];
  description?: string;
  [key: string]: AuthorValue;
}

export interface AssetOptions {
  trimStartFrames?: number;
  trimEndFrames?: number | null;
  loop?: boolean;
  checksum?: string;
  family?: string;
  weight?: number;
  style?: string;
  [key: string]: AuthorValue;
}

export interface CommonLayerOptions {
  startFrame: number;
  durationFrames: number;
  x?: AuthorValue;
  y?: AuthorValue;
  width?: AuthorValue;
  height?: AuthorValue;
  position?: AuthorValue;
  anchor?: AuthorValue;
  size?: AuthorValue;
  opacity?: AuthorValue;
  rotation?: AuthorValue;
  scale?: AuthorValue;
  z?: AuthorValue;
  track?: AuthorValue;
  keyframes?: AuthorValue;
  effects?: AuthorValue;
  transitionIn?: AuthorValue;
  transitionOut?: AuthorValue;
  [key: string]: AuthorValue;
}

export interface VideoLayerOptions extends CommonLayerOptions {
  asset: AssetReference | string;
  fit?: Fit;
  crop?: AuthorValue;
  muted?: boolean;
  volume?: number;
  playbackRate?: number;
}

export interface ImageLayerOptions extends CommonLayerOptions {
  asset: AssetReference | string;
  fit?: Fit;
}

export interface TextLayerOptions extends CommonLayerOptions {
  text: AuthorValue;
  style?: AuthorValue;
}

export interface ShapeLayerOptions extends CommonLayerOptions {
  shape?: "rect";
  fill?: AuthorValue;
  stroke?: AuthorValue;
  radius?: AuthorValue;
}

export interface CaptionLayerOptions extends CommonLayerOptions {
  source: AuthorValue;
  style?: AuthorValue;
  safeArea?: AuthorValue;
}

export interface AudioOptions {
  id?: string;
  asset: AssetReference | string;
  role?: "music" | "voiceover" | "sfx" | "source";
  startFrame?: number;
  durationFrames?: number;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  [key: string]: AuthorValue;
}

export interface ExportOptions {
  name?: string;
  format?: ExportFormat;
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: string;
  crf?: number;
  audioCodec?: string;
  audioBitrate?: string;
  loudnessLufs?: number;
  background?: string | null;
  layerOverrides?: AuthorValue;
  [key: string]: AuthorValue;
}

export interface CustomExportOptions extends ExportOptions {
  name: string;
  width: number;
  height: number;
}

export interface SocialExportOptions {
  instagramReels?: ExportOptions | false;
  tiktok?: ExportOptions | false;
  youtubeShorts?: ExportOptions | false;
  facebookReels?: ExportOptions | false;
  reels?: ExportOptions | false;
  square?: ExportOptions | false;
  portrait?: ExportOptions | false;
  landscape?: ExportOptions | false;
}

export interface SocialMediaPresetDefinition {
  id: string;
  label: string;
  platform: string;
  aspectRatio: string;
  width: number;
  height: number;
  fps?: number;
  defaultName: string;
  preset: ExportOptions;
}

export interface SubjectCropKeyframe {
  frame: number;
  x: number;
  y: number;
  easing?: EasingName;
}

export interface SubjectCropOptions {
  x?: number;
  y?: number;
  keyframes?: readonly SubjectCropKeyframe[];
  smoothingFrames?: number;
  source?: string;
}

export interface Keyframe {
  frame: number;
  value: AuthorValue;
  easing?: EasingName;
}

export type KeyframeTuple = readonly [frame: number, value: AuthorValue, easing?: EasingName];
export type KeyframeInput = Keyframe | KeyframeTuple;
export type KeyframeMap = Partial<Record<AnimatableProperty, readonly Keyframe[]>>;

const propPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export class PropReference {
  readonly name: string;
  readonly metadata?: PropMetadata;

  constructor(name: string, metadata?: PropMetadata) {
    if (!propPattern.test(name)) {
      throw new Error(`Invalid Kavio prop name "${name}".`);
    }

    this.name = name;
    if (metadata !== undefined) {
      this.metadata = metadata;
    }
  }

  toString(): string {
    return interpolationFor(this.name);
  }

  toJSON(): string {
    return interpolationFor(this.name);
  }
}

export class AssetReference {
  readonly id: string;
  readonly type: AssetType;
  private readonly definition: Record<string, AuthorValue>;

  constructor(id: string, type: AssetType, src: AuthorValue, options: AssetOptions = {}) {
    assertId(id, "asset");
    this.id = id;
    this.type = type;
    this.definition = compactObject({
      type,
      src,
      ...options
    });
  }

  toDefinition(): Record<string, AuthorValue> {
    return { ...this.definition };
  }

  toString(): string {
    return this.id;
  }

  toJSON(): string {
    return this.id;
  }
}

export class LayerBuilder {
  private readonly layer: Record<string, AuthorValue>;

  constructor(layer: Record<string, AuthorValue>) {
    this.layer = layer;
  }

  animate(property: AnimatableProperty, frames: readonly Keyframe[]): this {
    const existing = isRecord(this.layer.keyframes) ? this.layer.keyframes : {};
    this.layer.keyframes = {
      ...existing,
      [property]: frames.map((frame) => ({ ...frame }))
    };
    return this;
  }

  toInput(): Record<string, AuthorValue> {
    return cloneAuthorObject(this.layer);
  }

  toJSON(): Record<string, unknown> {
    return normalizeStandalone(this.layer) as Record<string, unknown>;
  }
}

export class VideoBuilder {
  private readonly composition: Record<string, AuthorValue>;
  private readonly metadata?: Record<string, AuthorValue>;
  private readonly propDefinitions = new Map<string, Record<string, AuthorValue>>();
  private readonly assetDefinitions = new Map<string, Record<string, AuthorValue>>();
  private readonly layers: Record<string, AuthorValue>[] = [];
  private readonly audioTracks: Record<string, AuthorValue>[] = [];
  private readonly exportDefinitions: Record<string, AuthorValue>[] = [];

  constructor(composition: CompositionTiming, options: { metadata?: Record<string, AuthorValue> } = {}) {
    this.composition = { ...composition };
    if (options.metadata !== undefined) {
      this.metadata = options.metadata;
    }
  }

  prop(reference: PropReference): this {
    this.registerProp(reference);
    return this;
  }

  props(...references: readonly PropReference[]): this {
    for (const reference of references) {
      this.registerProp(reference);
    }
    return this;
  }

  asset(reference: AssetReference): this {
    this.registerAsset(reference);
    return this;
  }

  assets(...references: readonly AssetReference[]): this {
    for (const reference of references) {
      this.registerAsset(reference);
    }
    return this;
  }

  add(...layers: readonly LayerBuilder[]): this {
    for (const layer of layers) {
      this.layers.push(layer.toInput());
    }
    return this;
  }

  audio(options: AudioOptions): this {
    const entry = compactObject({
      ...options,
      id: options.id ?? (options.asset instanceof AssetReference ? options.asset.id : undefined)
    });
    this.audioTracks.push(entry);
    return this;
  }

  addExport(definition: ExportOptions): this {
    this.exportDefinitions.push(compactObject(definition));
    return this;
  }

  exports(...definitions: readonly ExportOptions[]): this {
    for (const definition of definitions) {
      this.addExport(definition);
    }
    return this;
  }

  toJSON(): KavioDocument {
    const props = this.normalizeProps();
    const document = {
      version: "0.1",
      ...(this.metadata === undefined ? {} : { metadata: this.normalize(this.metadata) as Record<string, unknown> }),
      composition: this.normalize(this.composition) as unknown as CompositionTiming,
      ...(Object.keys(props).length === 0 ? {} : { props }),
      assets: this.normalizeAssets(),
      layers: this.layers.map((layer) => this.normalize(layer)),
      audio: this.audioTracks.map((track) => this.normalize(track)),
      exports: this.exportDefinitions.map((definition) => this.normalize(definition))
    };

    return structuredClone(document) as KavioDocument;
  }

  validate(): ValidationResult {
    return validateComposition(this.toJSON());
  }

  private registerAsset(reference: AssetReference): void {
    this.assetDefinitions.set(reference.id, reference.toDefinition());
  }

  private registerProp(reference: PropReference): void {
    if (reference.metadata === undefined) {
      return;
    }

    const existing = this.propDefinitions.get(reference.name) ?? {};
    this.propDefinitions.set(reference.name, { ...existing, ...reference.metadata });
  }

  private normalizeProps(): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [name, metadata] of this.propDefinitions) {
      output[name] = this.normalize(metadata);
    }
    return output;
  }

  private normalizeAssets(): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [id, definition] of this.assetDefinitions) {
      output[id] = this.normalize(definition);
    }
    return output;
  }

  private normalize(value: AuthorValue): unknown {
    if (value instanceof PropReference) {
      this.registerProp(value);
      return interpolationFor(value.name);
    }

    if (value instanceof AssetReference) {
      this.registerAsset(value);
      return value.id;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item));
    }

    if (isRecord(value)) {
      const output: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value)) {
        if (nested !== undefined) {
          output[key] = this.normalize(nested);
        }
      }
      return output;
    }

    return value;
  }
}

export function video(composition: CompositionTiming, options?: { metadata?: Record<string, AuthorValue> }): VideoBuilder {
  return new VideoBuilder(composition, options);
}

export function prop(name: string, metadata?: PropMetadata): PropReference {
  return new PropReference(name, metadata);
}

export function validate(input: VideoBuilder | KavioDocument): ValidationResult;
export function validate(input: unknown): ValidationResult;
export function validate(input: unknown): ValidationResult {
  return validateComposition(input instanceof VideoBuilder ? input.toJSON() : input);
}

export const asset = {
  video(id: string, src: AuthorValue, options?: AssetOptions): AssetReference {
    return new AssetReference(id, "video", src, options);
  },
  image(id: string, src: AuthorValue, options?: AssetOptions): AssetReference {
    return new AssetReference(id, "image", src, options);
  },
  audio(id: string, src: AuthorValue, options?: AssetOptions): AssetReference {
    return new AssetReference(id, "audio", src, options);
  },
  font(id: string, src: AuthorValue, options: AssetOptions & { family: string }): AssetReference {
    return new AssetReference(id, "font", src, options);
  }
} as const;

export function clip(id: string, options: VideoLayerOptions): LayerBuilder {
  return buildLayer(id, "video", options);
}

export function videoLayer(id: string, options: VideoLayerOptions): LayerBuilder {
  return clip(id, options);
}

export function image(id: string, options: ImageLayerOptions): LayerBuilder {
  return buildLayer(id, "image", options);
}

export function text(id: string, options: TextLayerOptions): LayerBuilder {
  return buildLayer(id, "text", options);
}

export function shape(id: string, options: ShapeLayerOptions): LayerBuilder {
  return buildLayer(id, "shape", { shape: "rect", ...options });
}

export function caption(id: string, options: CaptionLayerOptions): LayerBuilder {
  return buildLayer(id, "caption", options);
}

export const layers = {
  video: videoLayer,
  clip,
  image,
  text,
  shape,
  caption
} as const;

export function keyframes(frames: readonly KeyframeInput[]): Keyframe[] {
  return frames.map((frame) => {
    if (isKeyframeTuple(frame)) {
      const [frameNumber, value, ease] = frame;
      return compactObject({
        frame: frameNumber,
        value,
        easing: ease
      }) as unknown as Keyframe;
    }

    return compactObject({
      frame: frame.frame,
      value: frame.value,
      easing: frame.easing
    }) as unknown as Keyframe;
  });
}

export const easing = {
  linear: "linear",
  inQuad: "inQuad",
  outQuad: "outQuad",
  inOutQuad: "inOutQuad",
  inCubic: "inCubic",
  outCubic: "outCubic",
  inOutCubic: "inOutCubic",
  inBack: "inBack",
  outBack: "outBack",
  inOutBack: "inOutBack",
  cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingName {
    return `cubic-bezier(${x1},${y1},${x2},${y2})`;
  }
} as const;

export const exportPreset = {
  vertical(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "vertical-9x16",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1920,
      ...options
    });
  },
  reels(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "reels",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1920,
      ...options
    });
  },
  instagramReels(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "instagram-reels-9x16",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1920,
      ...options
    });
  },
  tiktok(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "tiktok-9x16",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1920,
      ...options
    });
  },
  youtubeShorts(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "youtube-shorts-9x16",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1920,
      ...options
    });
  },
  facebookReels(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "facebook-reels-9x16",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1920,
      ...options
    });
  },
  square(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "square",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1080,
      ...options
    });
  },
  portrait(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "portrait-4x5",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1350,
      ...options
    });
  },
  landscape(options: ExportOptions = {}): ExportOptions {
    return exportDefinition({
      name: "landscape",
      format: "mp4",
      codec: "h264",
      width: 1920,
      height: 1080,
      ...options
    });
  },
  social(options: SocialExportOptions = {}): ExportOptions[] {
    return compactArray([
      options.instagramReels === false ? undefined : exportPreset.instagramReels(options.instagramReels ?? {}),
      options.tiktok === false ? undefined : exportPreset.tiktok(options.tiktok ?? {}),
      options.youtubeShorts === false ? undefined : exportPreset.youtubeShorts(options.youtubeShorts ?? {}),
      options.facebookReels === false ? undefined : exportPreset.facebookReels(options.facebookReels ?? {}),
      options.reels === undefined || options.reels === false
        ? undefined
        : exportPreset.reels({ name: "reels-9x16", ...options.reels }),
      options.square === false ? undefined : exportPreset.square({ name: "square-1x1", ...(options.square ?? {}) }),
      options.portrait === false ? undefined : exportPreset.portrait(options.portrait ?? {}),
      options.landscape === false
        ? undefined
        : exportPreset.landscape({ name: "landscape-16x9", ...(options.landscape ?? {}) })
    ]);
  },
  custom(options: CustomExportOptions): ExportOptions {
    return exportDefinition({
      format: "mp4",
      codec: "h264",
      ...options
    });
  }
} as const;

export const exportPresets = exportPreset;
export const vertical = exportPreset.vertical;
export const reels = exportPreset.reels;
export const instagramReels = exportPreset.instagramReels;
export const tiktok = exportPreset.tiktok;
export const youtubeShorts = exportPreset.youtubeShorts;
export const facebookReels = exportPreset.facebookReels;
export const square = exportPreset.square;
export const portrait = exportPreset.portrait;
export const landscape = exportPreset.landscape;
export const social = exportPreset.social;
export const customExport = exportPreset.custom;

export const socialMediaPresets = [
  socialPresetDefinition("instagram-reels", "Instagram Reels", "Instagram", "9:16", exportPreset.instagramReels()),
  socialPresetDefinition("tiktok", "TikTok", "TikTok", "9:16", exportPreset.tiktok()),
  socialPresetDefinition("youtube-shorts", "YouTube Shorts", "YouTube", "9:16", exportPreset.youtubeShorts()),
  socialPresetDefinition("facebook-reels", "Facebook Reels", "Facebook", "9:16", exportPreset.facebookReels()),
  socialPresetDefinition("instagram-feed-portrait", "Instagram Feed Portrait", "Instagram", "4:5", exportPreset.portrait()),
  socialPresetDefinition("square-feed", "Square Feed", "Generic social", "1:1", exportPreset.square({ name: "square-1x1" })),
  socialPresetDefinition("landscape-feed", "Landscape Feed", "Generic social", "16:9", exportPreset.landscape({ name: "landscape-16x9" }))
] as const satisfies readonly SocialMediaPresetDefinition[];

export const crop = {
  center(): AuthorValue {
    return { mode: "center" };
  },
  subject(options: SubjectCropOptions): AuthorValue {
    return compactObject({
      mode: "subject",
      x: options.x,
      y: options.y,
      keyframes: options.keyframes === undefined ? undefined : options.keyframes.map((frame) => ({ ...frame })),
      smoothingFrames: options.smoothingFrames,
      source: options.source
    });
  }
} as const;

function buildLayer(id: string, type: LayerType, options: CommonLayerOptions): LayerBuilder {
  assertId(id, "layer");
  const { x, y, width, height, ...rest } = options;
  const layer = compactObject({
    id,
    type,
    ...rest
  });

  if (layer.position === undefined && (x !== undefined || y !== undefined)) {
    layer.position = compactObject({ x, y });
  }

  if (layer.size === undefined && (width !== undefined || height !== undefined)) {
    layer.size = compactObject({ width, height });
  }

  return new LayerBuilder(layer);
}

function exportDefinition(definition: ExportOptions): ExportOptions {
  return compactObject(definition) as ExportOptions;
}

function socialPresetDefinition(
  id: string,
  label: string,
  platform: string,
  aspectRatio: string,
  preset: ExportOptions
): SocialMediaPresetDefinition {
  const definition: SocialMediaPresetDefinition = {
    id,
    label,
    platform,
    aspectRatio,
    width: preset.width ?? 0,
    height: preset.height ?? 0,
    defaultName: preset.name ?? id,
    preset
  };
  if (preset.fps !== undefined) {
    definition.fps = preset.fps;
  }
  return definition;
}

function isKeyframeTuple(frame: KeyframeInput): frame is KeyframeTuple {
  return Array.isArray(frame);
}

function interpolationFor(name: string): string {
  return `{{${name}}}`;
}

function assertId(id: string, kind: string): void {
  if (id.trim() === "") {
    throw new Error(`Kavio ${kind} id must not be empty.`);
  }
}

function compactObject<T extends Record<string, AuthorValue>>(input: T): Record<string, AuthorValue> {
  const output: Record<string, AuthorValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function compactArray<T>(input: readonly (T | undefined)[]): T[] {
  return input.filter((item): item is T => item !== undefined);
}

function cloneAuthorObject(input: Record<string, AuthorValue>): Record<string, AuthorValue> {
  const output: Record<string, AuthorValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof PropReference || value instanceof AssetReference || value === undefined) {
      output[key] = value;
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) => cloneAuthorValue(item));
    } else if (isRecord(value)) {
      output[key] = cloneAuthorObject(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function cloneAuthorValue(value: AuthorValue): AuthorValue {
  if (value instanceof PropReference || value instanceof AssetReference || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneAuthorValue(item));
  }

  if (isRecord(value)) {
    return cloneAuthorObject(value);
  }

  return value;
}

function normalizeStandalone(value: AuthorValue): unknown {
  if (value instanceof PropReference) {
    return interpolationFor(value.name);
  }

  if (value instanceof AssetReference) {
    return value.id;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeStandalone(item));
  }

  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) {
        output[key] = normalizeStandalone(nested);
      }
    }
    return output;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, AuthorValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
