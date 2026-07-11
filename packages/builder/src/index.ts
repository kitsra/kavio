import { validateComposition, type CompositionTiming, type KavioDocument, type ValidationResult } from "@kitsra/kavio-schema";

export type { KavioError, ValidationResult } from "@kitsra/kavio-schema";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type AuthorValue =
  | JsonValue
  | PropReference
  | AssetReference
  | TimingDefinition
  | TransitionDefinition
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
  | "inOutBounce"
  | `cubic-bezier(${number},${number},${number},${number})`;
export type AnimatableProperty = "opacity" | "x" | "y" | "scale" | "rotation";
export type TransitionType =
  | "fade"
  | "slide"
  | "wipe"
  | "crossfade"
  | "zoom"
  | "push"
  | "spin"
  | "rotate"
  | "flip"
  | "blurDissolve"
  | "colorDissolve"
  | "dip"
  | "iris"
  | "stretch"
  | "squeeze"
  | "clockWipe"
  | "barWipe"
  | "gridWipe"
  | "tileReveal"
  | "radialBlur"
  | "zoomBlur"
  | "bookFlip"
  | "pageCurlLite"
  | "skewSlide"
  | "expandMask"
  | "letterboxReveal"
  | "filmFlash"
  | "cameraWhip";
export type TransitionDirection = "up" | "down" | "left" | "right";
export type TransitionAxis = "x" | "y";
export type TransitionShape = "circle" | "diamond";
export type CameraMotionDirection = "up" | "down" | "left" | "right" | "center";
export type TextMotionType = "typeOn" | "cascade" | "scramble" | "highlightSweep" | "trackingIn";
export type TextMotionSplitMode = "none" | "word" | "char" | "line";
export type TextMotionOrigin = "start" | "center" | "end";
export type CameraSafeArea =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
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
  transitionIn?: TransitionDefinition | AuthorValue;
  transitionOut?: TransitionDefinition | AuthorValue;
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

export type PictureInPicturePlacement = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface PictureInPictureOptions extends VideoLayerOptions {
  placement?: PictureInPicturePlacement;
  /** Width as a percentage of the composition width. Default 32. */
  widthPercent?: number;
  /** Distance from the selected edges as a percentage of each canvas axis. Default 3. */
  insetPercent?: number;
  /** Width divided by height. Default 16 / 9. */
  aspectRatio?: number;
}

export interface ImageLayerOptions extends CommonLayerOptions {
  asset: AssetReference | string;
  fit?: Fit;
}

export interface TextLayerOptions extends CommonLayerOptions {
  text: AuthorValue;
  style?: AuthorValue;
  textMotion?: AuthorValue;
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
  timing?: TimingDefinition;
}

export interface TransitionDefinition {
  type: TransitionType;
  durationFrames?: number | undefined;
  direction?: TransitionDirection | undefined;
  axis?: TransitionAxis | undefined;
  shape?: TransitionShape | undefined;
  color?: string | undefined;
  amount?: number | undefined;
  intensity?: number | undefined;
  rows?: number | undefined;
  columns?: number | undefined;
  easing?: EasingName | undefined;
  timing?: TimingDefinition | undefined;
  [key: string]: AuthorValue;
}

export type TransitionOptions = Omit<TransitionDefinition, "type">;

export interface TweenTimingDefinition {
  type: "tween";
  durationFrames?: number;
  easing?: EasingName;
}

export interface SpringTimingDefinition {
  type: "spring";
  durationFrames?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  restSpeed?: number;
  bounce?: number;
}

export interface StepsTimingDefinition {
  type: "steps";
  durationFrames?: number;
  steps: number;
  direction?: "start" | "end";
}

export interface SequenceTimingSegment {
  durationFrames: number;
  timing?: TimingDefinition;
  from?: number;
  to?: number;
}

export interface SequenceTimingDefinition {
  type: "sequence";
  segments: SequenceTimingSegment[];
}

export interface StaggerTimingDefinition {
  type: "stagger";
  timing: TimingDefinition;
  childCount: number;
  eachFrames: number;
  childIndex?: number;
  from?: "start" | "center" | "end";
}

export type TimingDefinition =
  | TweenTimingDefinition
  | SpringTimingDefinition
  | StepsTimingDefinition
  | SequenceTimingDefinition
  | StaggerTimingDefinition;

export interface TransitionSeriesDefinition {
  presentation: {
    type: TransitionType;
    direction?: TransitionDirection;
    axis?: TransitionAxis;
    shape?: TransitionShape;
    color?: string;
    amount?: number;
    intensity?: number;
    rows?: number;
    columns?: number;
  };
  timing: {
    type: "tween";
    durationFrames: number;
    easing?: EasingName;
  };
}

export interface TrackClipOptions {
  layerId: string | LayerBuilder;
  startFrame: number;
  durationFrames: number;
  transitionFromPrevious?: TransitionSeriesDefinition | TransitionDefinition;
}

export interface TrackClipDefinition {
  id: string;
  layerId: string;
  startFrame: number;
  durationFrames: number;
  transitionFromPrevious?: TransitionSeriesDefinition;
}

export interface TrackDefinition {
  id: string;
  clips: TrackClipDefinition[];
}

export interface CameraMotionOptions {
  durationFrames: number;
  easing?: EasingName;
  intensity?: number;
  safeArea?: CameraSafeArea;
  subjectAnchor?: Anchor;
}

export interface CameraZoomOptions extends CameraMotionOptions {
  fromScale?: number;
  toScale?: number;
}

export interface CameraKenBurnsOptions extends CameraZoomOptions {
  direction?: CameraMotionDirection;
  amount?: number;
  restingX?: number;
  restingY?: number;
}

export interface CameraPanOptions extends CameraMotionOptions {
  direction?: "left" | "right";
  amount?: number;
  restingX?: number;
  fromX?: number;
  toX?: number;
  scale?: number;
}

export interface CameraTiltOptions extends CameraMotionOptions {
  direction?: "up" | "down";
  amount?: number;
  restingY?: number;
  fromY?: number;
  toY?: number;
  scale?: number;
}

export interface CameraParallaxOptions extends CameraMotionOptions {
  direction?: CameraMotionDirection;
  amount?: number;
  restingX?: number;
  restingY?: number;
  fromX?: number;
  toX?: number;
  fromY?: number;
  toY?: number;
  fromScale?: number;
  toScale?: number;
}

export interface CameraOrbitLiteOptions extends CameraMotionOptions {
  direction?: "left" | "right";
  amount?: number;
  verticalAmount?: number;
  rotationAmount?: number;
  restingX?: number;
  restingY?: number;
  restingRotation?: number;
  fromScale?: number;
  toScale?: number;
}

export interface CameraHandheldOptions extends CameraMotionOptions {
  seed?: number;
  amount?: number;
  rotationAmount?: number;
  restingX?: number;
  restingY?: number;
  restingRotation?: number;
  intervalFrames?: number;
  scale?: number;
}

export interface CameraCrashZoomOptions extends CameraMotionOptions {
  direction?: "in" | "out";
  fromScale?: number;
  toScale?: number;
  overshootScale?: number;
  impactFrame?: number;
}

export interface CameraDollyZoomLiteOptions extends CameraMotionOptions {
  direction?: "in" | "out";
  fromScale?: number;
  toScale?: number;
  amount?: number;
  restingX?: number;
  restingY?: number;
  fromX?: number;
  toX?: number;
  fromY?: number;
  toY?: number;
}

export interface CinematicPresetOptions {
  durationFrames?: number;
  easing?: EasingName;
  intensity?: number;
}

export interface CinematicDirectionalPresetOptions extends CinematicPresetOptions {
  direction?: TransitionDirection;
}

export interface CinematicColorPresetOptions extends CinematicPresetOptions {
  color?: string;
}

export interface CinematicIrisPresetOptions extends CinematicPresetOptions {
  shape?: TransitionShape;
}

export interface CinematicFlipPresetOptions extends CinematicDirectionalPresetOptions {
  axis?: TransitionAxis;
}

export interface CinematicGlitchCutOptions extends CinematicDirectionalPresetOptions {
  seed?: number;
}

export interface CinematicKenBurnsOptions {
  durationFrames?: number;
  fromScale?: number;
  toScale?: number;
  fromX?: number;
  toX?: number;
  fromY?: number;
  toY?: number;
  easing?: EasingName;
  subject?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    smoothingFrames?: number;
    source?: string;
  };
}

export interface CinematicLogoStingOptions extends CinematicPresetOptions {
  direction?: TransitionDirection;
}

export interface CinematicProductRevealOptions extends CinematicPresetOptions {
  direction?: TransitionDirection;
}

export interface CinematicSocialHookOptions extends CinematicDirectionalPresetOptions {
  color?: string;
}

export interface CinematicTitleSequenceOptions extends CinematicDirectionalPresetOptions {
  exitDirection?: TransitionDirection;
}

export interface CinematicEndCardOptions extends CinematicColorPresetOptions {
  direction?: TransitionDirection;
}

export interface CinematicLayerPreset {
  transitionIn?: TransitionDefinition;
  transitionOut?: TransitionDefinition;
  keyframes?: AuthorValue;
  crop?: AuthorValue;
}

export interface TextMotionDefinition {
  transitionIn?: TransitionDefinition;
  keyframes?: KeyframeMap;
  textMotion?: TextMotionPresetDefinition;
}

export interface TextMotionOptions {
  durationFrames?: number;
  easing?: EasingName;
}

export interface TextMotionPresetDefinition {
  type: TextMotionType;
  split?: TextMotionSplitMode;
  durationFrames?: number;
  easing?: EasingName;
  staggerFrames?: number;
  origin?: TextMotionOrigin;
  seed?: number;
  preserveLayout?: boolean;
  restingBox?: {
    width?: number;
    height?: number;
  };
  direction?: Extract<TransitionDirection, "up" | "down" | "left" | "right">;
  amount?: number;
  intensity?: number;
  color?: string;
}

export interface TextMotionSplitOptions extends TextMotionOptions {
  split?: TextMotionSplitMode;
  staggerFrames?: number;
  origin?: TextMotionOrigin;
  seed?: number;
  preserveLayout?: boolean;
  restingBox?: {
    width?: number;
    height?: number;
  };
}

export interface TextMotionRiseOptions extends TextMotionOptions {
  direction?: Extract<TransitionDirection, "up" | "down">;
}

export interface TextMotionBlurInOptions extends TextMotionOptions {
  amount?: number;
  intensity?: number;
}

export interface TextMotionCascadeOptions extends TextMotionSplitOptions {
  direction?: Extract<TransitionDirection, "up" | "down" | "left" | "right">;
  amount?: number;
  intensity?: number;
}

export interface TextMotionScrambleOptions extends TextMotionSplitOptions {}

export interface TextMotionHighlightSweepOptions extends TextMotionSplitOptions {
  color?: string;
  intensity?: number;
}

export interface TextMotionTrackingInOptions extends TextMotionSplitOptions {
  amount?: number;
  intensity?: number;
}

export type KeyframeTuple = readonly [frame: number, value: AuthorValue, easing?: EasingName];
export type KeyframeInput = Keyframe | KeyframeTuple;
export type KeyframeMap = Partial<Record<AnimatableProperty, readonly Keyframe[]>>;

const propPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const animatableProperties = ["opacity", "x", "y", "scale", "rotation"] as const satisfies readonly AnimatableProperty[];

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
    return this.motion({ [property]: frames } as KeyframeMap);
  }

  motion(frames: KeyframeMap): this {
    const existing = isRecord(this.layer.keyframes) ? this.layer.keyframes : {};
    const next = { ...existing };
    for (const property of animatableProperties) {
      const propertyFrames = frames[property];
      if (propertyFrames !== undefined) {
        next[property] = propertyFrames.map((frame) => ({ ...frame }));
      }
    }
    this.layer.keyframes = next;
    return this;
  }

  transitionIn(definition: TransitionDefinition): this {
    this.layer.transitionIn = { ...definition };
    return this;
  }

  transitionOut(definition: TransitionDefinition): this {
    this.layer.transitionOut = { ...definition };
    return this;
  }

  enter(definition: TransitionDefinition): this {
    return this.transitionIn(definition);
  }

  exit(definition: TransitionDefinition): this {
    return this.transitionOut(definition);
  }

  toInput(): Record<string, AuthorValue> {
    return cloneAuthorObject(this.layer);
  }

  toJSON(): Record<string, unknown> {
    return normalizeStandalone(this.layer) as Record<string, unknown>;
  }

  get id(): string {
    return String(this.layer.id);
  }
}

export class TrackBuilder {
  private readonly definition: TrackDefinition;

  constructor(id: string, clips: readonly TrackClipDefinition[] = []) {
    assertId(id, "track");
    this.definition = {
      id,
      clips: clips.map((clip) => cloneTrackClip(clip))
    };
  }

  clip(id: string, options: TrackClipOptions): this {
    this.definition.clips.push(trackClip(id, options));
    return this;
  }

  toInput(): TrackDefinition {
    return {
      id: this.definition.id,
      clips: this.definition.clips.map((clip) => cloneTrackClip(clip))
    };
  }

  toJSON(): Record<string, unknown> {
    return normalizeStandalone(this.toInput() as unknown as AuthorValue) as Record<string, unknown>;
  }
}

export class VideoBuilder {
  private readonly composition: Record<string, AuthorValue>;
  private readonly metadata?: Record<string, AuthorValue>;
  private readonly propDefinitions = new Map<string, Record<string, AuthorValue>>();
  private readonly assetDefinitions = new Map<string, Record<string, AuthorValue>>();
  private readonly layers: Record<string, AuthorValue>[] = [];
  private readonly trackDefinitions: TrackDefinition[] = [];
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

  addTrack(...tracks: readonly (TrackBuilder | TrackDefinition)[]): this {
    for (const entry of tracks) {
      this.trackDefinitions.push(entry instanceof TrackBuilder ? entry.toInput() : cloneTrack(entry));
    }
    return this;
  }

  tracks(...tracks: readonly (TrackBuilder | TrackDefinition)[]): this {
    return this.addTrack(...tracks);
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
      ...(this.trackDefinitions.length === 0
        ? {}
        : { tracks: this.trackDefinitions.map((track) => this.normalize(track as unknown as AuthorValue)) }),
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

export function pictureInPicture(id: string, options: PictureInPictureOptions): LayerBuilder {
  const {
    placement = "top-right",
    widthPercent = 32,
    insetPercent = 3,
    aspectRatio = 16 / 9,
    ...layerOptions
  } = options;
  assertOptionalRange(widthPercent, "picture-in-picture widthPercent", 1, 100);
  assertOptionalRange(insetPercent, "picture-in-picture insetPercent", 0, 49);
  assertOptionalPositiveNumber(aspectRatio, "picture-in-picture aspectRatio");

  const heightPercent = widthPercent / aspectRatio;
  if (heightPercent > 100) {
    throw new RangeError("picture-in-picture height must not exceed 100% of the composition width.");
  }
  const left = placement.endsWith("left");
  const top = placement.startsWith("top");

  return videoLayer(id, {
    fit: "cover",
    muted: true,
    z: 100,
    position: {
      x: percentUnit(left ? insetPercent : 100 - insetPercent, "w"),
      y: percentUnit(top ? insetPercent : 100 - insetPercent, "h")
    },
    anchor: placement,
    size: {
      width: percentUnit(widthPercent, "w"),
      height: percentUnit(heightPercent, "w")
    },
    ...layerOptions
  });
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

export function trackClip(id: string, options: TrackClipOptions): TrackClipDefinition {
  assertId(id, "track clip");
  const definition: TrackClipDefinition = {
    id,
    layerId: layerIdFor(options.layerId),
    startFrame: options.startFrame,
    durationFrames: options.durationFrames
  };

  if (options.transitionFromPrevious !== undefined) {
    definition.transitionFromPrevious = transitionSeries.fromPrevious(options.transitionFromPrevious);
  }

  return definition;
}

export function track(id: string, clips: readonly TrackClipDefinition[] = []): TrackBuilder {
  return new TrackBuilder(id, clips);
}

export const layers = {
  video: videoLayer,
  clip,
  pictureInPicture,
  image,
  text,
  shape,
  caption
} as const;

export const transition = {
  fade(options: TransitionOptions): TransitionDefinition {
    return transitionDefinition("fade", options);
  },
  slide(options: TransitionOptions & { direction: TransitionDirection }): TransitionDefinition {
    return transitionDefinition("slide", options);
  },
  wipe(options: TransitionOptions & { direction: TransitionDirection }): TransitionDefinition {
    return transitionDefinition("wipe", options);
  },
  crossfade(options: TransitionOptions): TransitionDefinition {
    return transitionDefinition("crossfade", options);
  },
  zoom(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("zoom", options);
  },
  push(options: TransitionOptions & { direction: TransitionDirection }): TransitionDefinition {
    return transitionDefinition("push", options);
  },
  spin(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("spin", options);
  },
  rotate(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("rotate", options);
  },
  flip(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("flip", options);
  },
  blurDissolve(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("blurDissolve", options);
  },
  colorDissolve(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("colorDissolve", options);
  },
  dip(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("dip", options);
  },
  iris(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("iris", options);
  },
  stretch(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("stretch", options);
  },
  squeeze(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("squeeze", options);
  },
  clockWipe(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("clockWipe", options);
  },
  barWipe(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("barWipe", options);
  },
  gridWipe(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("gridWipe", options);
  },
  tileReveal(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("tileReveal", options);
  },
  radialBlur(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("radialBlur", options);
  },
  zoomBlur(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("zoomBlur", options);
  },
  bookFlip(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("bookFlip", options);
  },
  pageCurlLite(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("pageCurlLite", options);
  },
  skewSlide(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("skewSlide", options);
  },
  expandMask(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("expandMask", options);
  },
  letterboxReveal(options: TransitionOptions = { durationFrames: 12 }): TransitionDefinition {
    return transitionDefinition("letterboxReveal", options);
  },
  filmFlash(options: TransitionOptions = { durationFrames: 6 }): TransitionDefinition {
    return transitionDefinition("filmFlash", options);
  },
  cameraWhip(options: TransitionOptions = { durationFrames: 8 }): TransitionDefinition {
    return transitionDefinition("cameraWhip", options);
  }
} as const;

export const transitions = transition;

export const transitionSeries = {
  fromPrevious(definition: TransitionDefinition | TransitionSeriesDefinition): TransitionSeriesDefinition {
    if (isTransitionSeriesDefinition(definition)) {
      return cloneTransitionSeriesDefinition(definition);
    }

    return transitionSeriesDefinition(definition);
  }
} as const;

export const camera = {
  kenBurns(options: CameraKenBurnsOptions): KeyframeMap {
    const amount = cameraTravelAmount(options, 36);
    const direction = options.direction ?? "right";
    const frames = zoomMotion(options, 1, 1 + cameraIntensity(options, 0.08));

    if (direction === "left" || direction === "right") {
      frames.x = cameraAxisFrames({
        durationFrames: options.durationFrames,
        easing: options.easing,
        axis: "x",
        direction,
        amount,
        restingValue: options.restingX ?? 0,
        subjectAnchor: options.subjectAnchor
      });
    } else if (direction === "up" || direction === "down") {
      frames.y = cameraAxisFrames({
        durationFrames: options.durationFrames,
        easing: options.easing,
        axis: "y",
        direction,
        amount,
        restingValue: options.restingY ?? 0,
        subjectAnchor: options.subjectAnchor
      });
    }

    return frames;
  },
  pushIn(options: CameraZoomOptions): KeyframeMap {
    return zoomMotion(options, options.fromScale ?? 1, options.toScale ?? 1 + cameraIntensity(options, 0.08));
  },
  pullBack(options: CameraZoomOptions): KeyframeMap {
    return zoomMotion(options, options.fromScale ?? 1 + cameraIntensity(options, 0.08), options.toScale ?? 1);
  },
  pan(options: CameraPanOptions): KeyframeMap {
    const direction = options.direction ?? "left";
    const amount = cameraTravelAmount(options, 72);
    const scale = options.scale ?? 1 + cameraIntensity(options, 0.04);
    const frames: KeyframeMap = {
      x: cameraAxisFrames({
        durationFrames: options.durationFrames,
        easing: options.easing,
        axis: "x",
        direction,
        amount,
        restingValue: options.restingX ?? 0,
        fromValue: options.fromX,
        toValue: options.toX,
        subjectAnchor: options.subjectAnchor
      })
    };

    if (scale !== 1) {
      frames.scale = cameraTrack(options.durationFrames, scale, scale);
    }

    return frames;
  },
  tilt(options: CameraTiltOptions): KeyframeMap {
    const direction = options.direction ?? "up";
    const amount = cameraTravelAmount(options, 72);
    const scale = options.scale ?? 1 + cameraIntensity(options, 0.04);
    const frames: KeyframeMap = {
      y: cameraAxisFrames({
        durationFrames: options.durationFrames,
        easing: options.easing,
        axis: "y",
        direction,
        amount,
        restingValue: options.restingY ?? 0,
        fromValue: options.fromY,
        toValue: options.toY,
        subjectAnchor: options.subjectAnchor
      })
    };

    if (scale !== 1) {
      frames.scale = cameraTrack(options.durationFrames, scale, scale);
    }

    return frames;
  },
  parallax(options: CameraParallaxOptions): KeyframeMap {
    const direction = options.direction ?? "right";
    const amount = cameraTravelAmount(options, 48);
    const frames = zoomMotion(options, options.fromScale ?? 1.02, options.toScale ?? 1.02 + cameraIntensity(options, 0.04));

    if (direction === "left" || direction === "right") {
      frames.x = cameraAxisFrames({
        durationFrames: options.durationFrames,
        easing: options.easing,
        axis: "x",
        direction,
        amount,
        restingValue: options.restingX ?? 0,
        fromValue: options.fromX,
        toValue: options.toX,
        subjectAnchor: options.subjectAnchor
      });
    } else if (direction === "up" || direction === "down") {
      frames.y = cameraAxisFrames({
        durationFrames: options.durationFrames,
        easing: options.easing,
        axis: "y",
        direction,
        amount,
        restingValue: options.restingY ?? 0,
        fromValue: options.fromY,
        toValue: options.toY,
        subjectAnchor: options.subjectAnchor
      });
    }

    return frames;
  },
  orbitLite(options: CameraOrbitLiteOptions): KeyframeMap {
    const endFrame = cameraEndFrame(options.durationFrames);
    const middleFrame = Math.floor(endFrame / 2);
    const amount = cameraTravelAmount(options, 42);
    const halfAmount = amount / 2;
    const verticalAmount = cameraTravelAmount({ ...options, amount: options.verticalAmount ?? 18 }, 18);
    const rotationAmount = options.rotationAmount ?? 1.8 * (1 + cameraIntensity(options, 0));
    const directionSign = (options.direction ?? "right") === "left" ? -1 : 1;
    const restingX = options.restingX ?? 0;
    const restingY = options.restingY ?? 0;
    const restingRotation = options.restingRotation ?? 0;
    const frames: KeyframeMap = {
      x: cameraThreePointTrack(
        options.durationFrames,
        restingX - directionSign * halfAmount,
        restingX,
        restingX + directionSign * halfAmount,
        options.easing
      ),
      scale: cameraThreePointTrack(
        options.durationFrames,
        options.fromScale ?? 1.02,
        Math.max(options.fromScale ?? 1.02, options.toScale ?? 1.05),
        options.toScale ?? 1.02,
        options.easing
      ),
      rotation: cameraTrack(
        options.durationFrames,
        restingRotation - directionSign * rotationAmount,
        restingRotation + directionSign * rotationAmount,
        options.easing
      )
    };

    if (endFrame > 1 && verticalAmount !== 0) {
      frames.y = [
        compactObject({ frame: 0, value: restingY + verticalAmount / 2, easing: options.easing }) as unknown as Keyframe,
        compactObject({ frame: middleFrame, value: restingY - verticalAmount / 2, easing: options.easing }) as unknown as Keyframe,
        { frame: endFrame, value: restingY + verticalAmount / 2 }
      ];
    }

    return frames;
  },
  handheld(options: CameraHandheldOptions): KeyframeMap {
    const amount = cameraTravelAmount(options, 8);
    const rotationAmount = options.rotationAmount ?? 0.8 * (1 + cameraIntensity(options, 0));
    const scale = options.scale ?? 1 + cameraIntensity(options, 0.02);
    const frames: KeyframeMap = {
      x: cameraJitterTrack({
        durationFrames: options.durationFrames,
        seed: options.seed ?? 1,
        intervalFrames: options.intervalFrames ?? 6,
        restingValue: options.restingX ?? 0,
        amount,
        easing: options.easing ?? "inOutQuad"
      }),
      y: cameraJitterTrack({
        durationFrames: options.durationFrames,
        seed: (options.seed ?? 1) + 101,
        intervalFrames: options.intervalFrames ?? 6,
        restingValue: options.restingY ?? 0,
        amount: amount * 0.65,
        easing: options.easing ?? "inOutQuad"
      }),
      rotation: cameraJitterTrack({
        durationFrames: options.durationFrames,
        seed: (options.seed ?? 1) + 211,
        intervalFrames: options.intervalFrames ?? 6,
        restingValue: options.restingRotation ?? 0,
        amount: rotationAmount,
        easing: options.easing ?? "inOutQuad"
      })
    };

    if (scale !== 1) {
      frames.scale = cameraTrack(options.durationFrames, scale, scale);
    }

    return frames;
  },
  crashZoom(options: CameraCrashZoomOptions): KeyframeMap {
    const direction = options.direction ?? "in";
    const intensityValue = cameraIntensity(options, 0.28);
    const fromScale = options.fromScale ?? (direction === "in" ? 1 : 1 + intensityValue);
    const toScale = options.toScale ?? (direction === "in" ? 1 + intensityValue : 1);
    const overshootDirection = direction === "in" ? 1 : -1;
    const overshootScale = options.overshootScale ?? toScale + overshootDirection * intensityValue * 0.2;

    return {
      scale: cameraCrashZoomTrack({
        durationFrames: options.durationFrames,
        easing: options.easing ?? "outCubic",
        fromScale,
        overshootScale,
        toScale,
        impactFrame: options.impactFrame
      })
    };
  },
  dollyZoomLite(options: CameraDollyZoomLiteOptions): KeyframeMap {
    const direction = options.direction ?? "out";
    const intensityValue = cameraIntensity(options, 0.12);
    const fromScale = options.fromScale ?? (direction === "out" ? 1 + intensityValue : 1);
    const toScale = options.toScale ?? (direction === "out" ? 1 : 1 + intensityValue);
    const amount = cameraTravelAmount(options, 28);
    const xBias = anchorBias(options.subjectAnchor, "x");
    const yBias = anchorBias(options.subjectAnchor, "y");
    const directionSign = direction === "out" ? 1 : -1;
    const frames = zoomMotion(options, fromScale, toScale);

    if (options.fromX !== undefined || options.toX !== undefined || xBias !== 0) {
      const restingX = options.restingX ?? 0;
      frames.x = cameraTrack(
        options.durationFrames,
        options.fromX ?? restingX - xBias * amount * directionSign,
        options.toX ?? restingX + xBias * amount * directionSign,
        options.easing
      );
    }

    if (options.fromY !== undefined || options.toY !== undefined || yBias !== 0) {
      const restingY = options.restingY ?? 0;
      frames.y = cameraTrack(
        options.durationFrames,
        options.fromY ?? restingY - yBias * amount * directionSign,
        options.toY ?? restingY + yBias * amount * directionSign,
        options.easing
      );
    }

    return frames;
  }
} as const;

export const cinematic = {
  zoomPush(options: CinematicDirectionalPresetOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 14;
    return compactObject({
      transitionIn: transition.zoom({
        durationFrames,
        amount: options.intensity ?? 0.18,
        easing: options.easing ?? "outCubic"
      }),
      transitionOut: transition.push({
        direction: options.direction ?? "left",
        durationFrames,
        easing: options.easing ?? "inCubic"
      })
    }) as CinematicLayerPreset;
  },
  whipPan(options: CinematicDirectionalPresetOptions = {}): CinematicLayerPreset {
    return compactObject({
      transitionIn: transition.push({
        direction: options.direction ?? "left",
        durationFrames: options.durationFrames ?? 8,
        easing: options.easing ?? "inOutCubic",
        intensity: options.intensity
      })
    }) as CinematicLayerPreset;
  },
  filmFlash(options: CinematicColorPresetOptions = {}): CinematicLayerPreset {
    return compactObject({
      transitionIn: transition.colorDissolve({
        color: options.color ?? "#ffffff",
        durationFrames: options.durationFrames ?? 6,
        amount: options.intensity ?? 1,
        easing: options.easing ?? "outQuad"
      })
    }) as CinematicLayerPreset;
  },
  dreamyBlur(options: CinematicPresetOptions = {}): CinematicLayerPreset {
    return compactObject({
      transitionIn: transition.blurDissolve({
        durationFrames: options.durationFrames ?? 18,
        amount: options.intensity ?? 18,
        easing: options.easing ?? "outCubic"
      })
    }) as CinematicLayerPreset;
  },
  broadcastDip(options: CinematicColorPresetOptions = {}): CinematicLayerPreset {
    return compactObject({
      transitionIn: transition.dip({
        color: options.color ?? "#05070a",
        durationFrames: options.durationFrames ?? 10,
        amount: options.intensity ?? 1,
        easing: options.easing ?? "inOutCubic"
      })
    }) as CinematicLayerPreset;
  },
  irisOpen(options: CinematicIrisPresetOptions = {}): CinematicLayerPreset {
    return compactObject({
      transitionIn: transition.iris({
        shape: options.shape ?? "circle",
        durationFrames: options.durationFrames ?? 16,
        intensity: options.intensity,
        easing: options.easing ?? "outCubic"
      })
    }) as CinematicLayerPreset;
  },
  flipCard(options: CinematicFlipPresetOptions = {}): CinematicLayerPreset {
    return compactObject({
      transitionIn: transition.flip({
        axis: options.axis ?? "y",
        direction: options.direction,
        durationFrames: options.durationFrames ?? 14,
        amount: options.intensity ?? 90,
        easing: options.easing ?? "outCubic"
      })
    }) as CinematicLayerPreset;
  },
  glitchCut(options: CinematicGlitchCutOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 8;
    const endFrame = cameraEndFrame(durationFrames);
    const direction = options.direction ?? "left";
    const directionSign = direction === "right" || direction === "down" ? 1 : -1;
    const axis = direction === "up" || direction === "down" ? "y" : "x";
    const offset = roundMotionValue((options.intensity ?? 1) * 14 * directionSign);
    const jitter = roundMotionValue((seedToUnit(normalizeSeed(options.seed ?? 17)) * 2 - 1) * 6 * (options.intensity ?? 1));
    const settleFrame = Math.min(endFrame, 3);

    return compactObject({
      transitionIn: transition.skewSlide({
        direction,
        durationFrames,
        intensity: 12 * (options.intensity ?? 1),
        easing: options.easing ?? "outExpo"
      }),
      keyframes: compactObject({
        [axis]: keyframes([
          { frame: 0, value: offset, timing: timing.steps({ steps: 2, direction: "end" }) },
          { frame: 1, value: roundMotionValue(-offset * 0.45 + jitter), timing: timing.steps({ steps: 2, direction: "end" }) },
          { frame: settleFrame, value: 0, easing: options.easing ?? "outExpo" }
        ]) as unknown as AuthorValue,
        opacity: keyframes([
          { frame: 0, value: 0.72, timing: timing.steps({ steps: 2, direction: "end" }) },
          { frame: settleFrame, value: 1 }
        ]) as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  },
  lightLeak(options: CinematicColorPresetOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 14;
    const easingValue = options.easing ?? "outQuad";
    const drift = roundMotionValue(10 * (options.intensity ?? 1));

    return compactObject({
      transitionIn: transition.colorDissolve({
        color: options.color ?? "#fff1b8",
        durationFrames,
        amount: options.intensity ?? 0.72,
        easing: easingValue
      }),
      keyframes: compactObject({
        x: cameraTrack(durationFrames, -drift, drift, easingValue) as unknown as AuthorValue,
        opacity: keyframes([
          [0, 0.82, easingValue],
          [Math.max(1, durationFrames - 1), 1]
        ]) as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  },
  kenBurns(options: CinematicKenBurnsOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 90;
    const subjectStart =
      options.subject === undefined
        ? undefined
        : options.easing === undefined
          ? { frame: 0, x: options.subject.fromX, y: options.subject.fromY }
          : { frame: 0, x: options.subject.fromX, y: options.subject.fromY, easing: options.easing };
    const subjectCropOptions =
      options.subject === undefined
        ? undefined
        : ({
            keyframes: [subjectStart!, { frame: durationFrames, x: options.subject.toX, y: options.subject.toY }],
            ...(options.subject.smoothingFrames === undefined ? {} : { smoothingFrames: options.subject.smoothingFrames }),
            ...(options.subject.source === undefined ? {} : { source: options.subject.source })
          } satisfies SubjectCropOptions);
    return compactObject({
      keyframes: compactObject({
        scale: keyframes([
          [0, options.fromScale ?? 1.04, options.easing ?? "outCubic"],
          [durationFrames, options.toScale ?? 1.14]
        ]) as unknown as AuthorValue,
        x:
          options.fromX === undefined && options.toX === undefined
            ? undefined
            : keyframes([
                [0, options.fromX ?? 0, options.easing ?? "outCubic"],
                [durationFrames, options.toX ?? 0]
              ]) as unknown as AuthorValue,
        y:
          options.fromY === undefined && options.toY === undefined
            ? undefined
            : keyframes([
                [0, options.fromY ?? 0, options.easing ?? "outCubic"],
                [durationFrames, options.toY ?? 0]
              ]) as unknown as AuthorValue
      }),
      crop: subjectCropOptions === undefined ? undefined : crop.subject(subjectCropOptions)
    }) as CinematicLayerPreset;
  },
  logoSting(options: CinematicLogoStingOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 18;
    const easingValue = options.easing ?? "outBack";
    const rotationDirection = options.direction === "right" || options.direction === "down" ? 1 : -1;

    return compactObject({
      transitionIn: transition.zoom({
        durationFrames: Math.max(1, Math.round(durationFrames * 0.6)),
        amount: options.intensity ?? 0.12,
        easing: easingValue
      }),
      transitionOut: transition.fade({
        durationFrames: Math.max(1, Math.round(durationFrames * 0.45)),
        easing: "inCubic"
      }),
      keyframes: compactObject({
        scale: cameraThreePointTrack(
          durationFrames,
          0.92,
          1 + cameraIntensity(options, 0.04),
          1,
          easingValue
        ) as unknown as AuthorValue,
        rotation: cameraTrack(durationFrames, rotationDirection * -2, 0, options.easing ?? "outCubic") as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  },
  productReveal(options: CinematicProductRevealOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 24;
    const easingValue = options.easing ?? "outCubic";

    return compactObject({
      transitionIn: transition.wipe({
        direction: options.direction ?? "up",
        durationFrames,
        easing: easingValue
      }),
      keyframes: compactObject({
        scale: cameraTrack(durationFrames, 0.96, 1 + cameraIntensity(options, 0.02), easingValue) as unknown as AuthorValue,
        opacity: entranceOpacityKeyframes(Math.max(1, Math.round(durationFrames * 0.6)), easingValue) as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  },
  socialHook(options: CinematicSocialHookOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 16;
    const easingValue = options.easing ?? "outCubic";

    return compactObject({
      transitionIn: transition.colorDissolve({
        color: options.color ?? "#ffffff",
        durationFrames: Math.max(1, Math.round(durationFrames * 0.45)),
        amount: options.intensity ?? 0.7,
        easing: "outQuad"
      }),
      transitionOut: transition.push({
        direction: options.direction ?? "left",
        durationFrames: Math.max(1, Math.round(durationFrames * 0.5)),
        easing: "inCubic"
      }),
      keyframes: compactObject({
        scale: cameraCrashZoomTrack({
          durationFrames,
          easing: easingValue,
          fromScale: 1 + cameraIntensity(options, 0.16),
          overshootScale: 0.98,
          toScale: 1
        }) as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  },
  titleSequence(options: CinematicTitleSequenceOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 30;
    const easingValue = options.easing ?? "outCubic";

    return compactObject({
      transitionIn: transition.slide({
        direction: options.direction ?? "up",
        durationFrames,
        easing: easingValue
      }),
      transitionOut: transition.slide({
        direction: options.exitDirection ?? "down",
        durationFrames: Math.max(1, Math.round(durationFrames * 0.55)),
        easing: "inCubic"
      }),
      keyframes: compactObject({
        opacity: entranceOpacityKeyframes(durationFrames, easingValue) as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  },
  endCard(options: CinematicEndCardOptions = {}): CinematicLayerPreset {
    const durationFrames = options.durationFrames ?? 20;
    const easingValue = options.easing ?? "outCubic";
    const horizontalDirection =
      options.direction === "left" || options.direction === "right" ? options.direction : undefined;
    const verticalDirection = options.direction === "up" || options.direction === "down" ? options.direction : undefined;

    return compactObject({
      transitionIn: transition.dip({
        color: options.color ?? "#05070a",
        durationFrames,
        amount: options.intensity ?? 1,
        easing: "inOutCubic"
      }),
      transitionOut: transition.fade({
        durationFrames: Math.max(1, Math.round(durationFrames * 0.5)),
        easing: "inCubic"
      }),
      keyframes: compactObject({
        scale: cameraTrack(durationFrames, 0.98, 1, easingValue) as unknown as AuthorValue,
        x:
          horizontalDirection === undefined
            ? undefined
            : cameraAxisFrames({
                durationFrames,
                easing: easingValue,
                axis: "x",
                direction: horizontalDirection,
                amount: 20 * (1 + cameraIntensity(options, 0)),
                restingValue: 0
              }) as unknown as AuthorValue,
        y:
          verticalDirection === undefined
            ? undefined
            : cameraAxisFrames({
                durationFrames,
                easing: easingValue,
                axis: "y",
                direction: verticalDirection,
                amount: 20 * (1 + cameraIntensity(options, 0)),
                restingValue: 0
              }) as unknown as AuthorValue
      })
    }) as CinematicLayerPreset;
  }
} as const;

export const cinematicPresets = cinematic;

function textMotionPreset(
  type: TextMotionType,
  options: TextMotionSplitOptions & Partial<TextMotionPresetDefinition>,
  defaults: {
    split: TextMotionSplitMode;
    durationFrames: number;
    easing: EasingName;
    staggerFrames: number;
  }
): TextMotionDefinition {
  return {
    textMotion: compactObject({
      type,
      split: options.split ?? defaults.split,
      durationFrames: options.durationFrames ?? defaults.durationFrames,
      easing: options.easing ?? defaults.easing,
      staggerFrames: options.staggerFrames ?? defaults.staggerFrames,
      origin: options.origin,
      seed: options.seed,
      preserveLayout: options.preserveLayout ?? true,
      restingBox: options.restingBox,
      direction: options.direction,
      amount: options.amount,
      intensity: options.intensity,
      color: options.color
    }) as unknown as TextMotionPresetDefinition
  };
}

export const textMotion = {
  rise(options: TextMotionRiseOptions = {}): TextMotionDefinition {
    const durationFrames = options.durationFrames ?? 14;
    const easingValue = options.easing ?? "outCubic";
    return {
      transitionIn: transition.slide({
        direction: options.direction ?? "up",
        durationFrames,
        easing: easingValue
      }),
      keyframes: {
        opacity: entranceOpacityKeyframes(durationFrames, easingValue)
      }
    };
  },
  blurIn(options: TextMotionBlurInOptions = {}): TextMotionDefinition {
    return {
      transitionIn: transition.blurDissolve({
        durationFrames: options.durationFrames ?? 12,
        amount: options.amount,
        intensity: options.intensity,
        easing: options.easing ?? "outCubic"
      })
    };
  },
  typeOn(options: TextMotionSplitOptions = {}): TextMotionDefinition {
    return textMotionPreset("typeOn", options, {
      split: "char",
      durationFrames: 18,
      easing: "linear",
      staggerFrames: 1
    });
  },
  cascade(options: TextMotionCascadeOptions = {}): TextMotionDefinition {
    return textMotionPreset("cascade", options, {
      split: "word",
      durationFrames: 14,
      easing: "outCubic",
      staggerFrames: 2
    });
  },
  scramble(options: TextMotionScrambleOptions = {}): TextMotionDefinition {
    return textMotionPreset("scramble", options, {
      split: "char",
      durationFrames: 18,
      easing: "outCubic",
      staggerFrames: 1
    });
  },
  highlightSweep(options: TextMotionHighlightSweepOptions = {}): TextMotionDefinition {
    return textMotionPreset("highlightSweep", options, {
      split: "word",
      durationFrames: 18,
      easing: "outCubic",
      staggerFrames: 0
    });
  },
  trackingIn(options: TextMotionTrackingInOptions = {}): TextMotionDefinition {
    return textMotionPreset("trackingIn", options, {
      split: "char",
      durationFrames: 16,
      easing: "outCubic",
      staggerFrames: 1
    });
  }
} as const;

export const textMotions = textMotion;
export const effect = {} as const;

export const presetNamespaces = {
  transition,
  cinematic,
  textMotion,
  camera,
  effect
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
      easing: frame.easing,
      timing: frame.timing
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
  inCirc: "inCirc",
  outCirc: "outCirc",
  inOutCirc: "inOutCirc",
  inExpo: "inExpo",
  outExpo: "outExpo",
  inOutExpo: "inOutExpo",
  anticipate: "anticipate",
  back: "back",
  inBack: "inBack",
  outBack: "outBack",
  inOutBack: "inOutBack",
  inElastic: "inElastic",
  outElastic: "outElastic",
  inOutElastic: "inOutElastic",
  inBounce: "inBounce",
  outBounce: "outBounce",
  inOutBounce: "inOutBounce",
  cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingName {
    return `cubic-bezier(${x1},${y1},${x2},${y2})`;
  }
} as const;

export const timing = {
  tween(options: Omit<TweenTimingDefinition, "type"> = {}): TweenTimingDefinition {
    assertOptionalPositiveInteger(options.durationFrames, "tween durationFrames");
    return compactObject({
      type: "tween",
      durationFrames: options.durationFrames,
      easing: options.easing
    }) as unknown as TweenTimingDefinition;
  },
  spring(options: Omit<SpringTimingDefinition, "type"> = {}): SpringTimingDefinition {
    assertOptionalPositiveInteger(options.durationFrames, "spring durationFrames");
    assertOptionalPositiveNumber(options.stiffness, "spring stiffness");
    assertOptionalPositiveNumber(options.damping, "spring damping");
    assertOptionalPositiveNumber(options.mass, "spring mass");
    assertOptionalNonNegativeNumber(options.restSpeed, "spring restSpeed");
    assertOptionalRange(options.bounce, "spring bounce", 0, 1);
    return compactObject({
      type: "spring",
      durationFrames: options.durationFrames,
      stiffness: options.stiffness,
      damping: options.damping,
      mass: options.mass,
      restSpeed: options.restSpeed,
      bounce: options.bounce
    }) as unknown as SpringTimingDefinition;
  },
  steps(options: Omit<StepsTimingDefinition, "type">): StepsTimingDefinition {
    assertOptionalPositiveInteger(options.durationFrames, "steps durationFrames");
    assertPositiveInteger(options.steps, "steps");
    return compactObject({
      type: "steps",
      durationFrames: options.durationFrames,
      steps: options.steps,
      direction: options.direction
    }) as unknown as StepsTimingDefinition;
  },
  sequence(segments: readonly SequenceTimingSegment[]): SequenceTimingDefinition {
    if (segments.length === 0) {
      throw new Error("sequence timing requires at least one segment.");
    }
    return {
      type: "sequence",
      segments: segments.map((segment) => {
        assertPositiveInteger(segment.durationFrames, "sequence segment durationFrames");
        return compactObject({
          durationFrames: segment.durationFrames,
          timing: segment.timing,
          from: segment.from,
          to: segment.to
        }) as unknown as SequenceTimingSegment;
      })
    };
  },
  stagger(options: Omit<StaggerTimingDefinition, "type">): StaggerTimingDefinition {
    assertPositiveInteger(options.childCount, "stagger childCount");
    assertNonNegativeInteger(options.eachFrames, "stagger eachFrames");
    assertOptionalNonNegativeInteger(options.childIndex, "stagger childIndex");
    if (options.childIndex !== undefined && options.childIndex >= options.childCount) {
      throw new Error("stagger childIndex must be lower than childCount.");
    }
    return compactObject({
      type: "stagger",
      timing: options.timing,
      childCount: options.childCount,
      eachFrames: options.eachFrames,
      childIndex: options.childIndex,
      from: options.from
    }) as unknown as StaggerTimingDefinition;
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

function percentUnit(value: number, axis: "w" | "h"): `${number}%w` | `${number}%h` {
  return `${Number(value.toFixed(6))}%${axis}` as `${number}%w` | `${number}%h`;
}

function transitionDefinition(type: TransitionType, options: TransitionOptions): TransitionDefinition {
  return compactObject({
    type,
    durationFrames: options.durationFrames,
    direction: options.direction,
    axis: options.axis,
    shape: options.shape,
    color: options.color,
    amount: options.amount,
    intensity: options.intensity,
    easing: options.easing,
    timing: options.timing
  }) as unknown as TransitionDefinition;
}

function transitionSeriesDefinition(definition: TransitionDefinition): TransitionSeriesDefinition {
  return {
    presentation: compactObject({
      type: definition.type,
      direction: definition.direction,
      axis: definition.axis,
      shape: definition.shape,
      color: definition.color,
      amount: definition.amount,
      intensity: definition.intensity,
      rows: definition.rows,
      columns: definition.columns
    }) as unknown as TransitionSeriesDefinition["presentation"],
    timing: compactObject({
      type: "tween",
      durationFrames: definition.durationFrames,
      easing: definition.easing
    }) as unknown as TransitionSeriesDefinition["timing"]
  };
}

function entranceOpacityKeyframes(durationFrames: number, easingValue: EasingName): Keyframe[] {
  if (durationFrames <= 1) {
    return [{ frame: 0, value: 1 }];
  }

  return keyframes([
    [0, 0, easingValue],
    [durationFrames - 1, 1]
  ]);
}

function zoomMotion(options: CameraZoomOptions, fallbackFromScale: number, fallbackToScale: number): KeyframeMap {
  return {
    scale: cameraTrack(
      options.durationFrames,
      options.fromScale ?? fallbackFromScale,
      options.toScale ?? fallbackToScale,
      options.easing
    )
  };
}

function cameraTrack(durationFrames: number, fromValue: number, toValue: number, easing?: EasingName): Keyframe[] {
  const endFrame = cameraEndFrame(durationFrames);
  if (endFrame === 0) {
    return [{ frame: 0, value: fromValue }];
  }

  const firstFrame = compactObject({
    frame: 0,
    value: fromValue,
    easing
  }) as unknown as Keyframe;

  return [firstFrame, { frame: endFrame, value: toValue }];
}

function cameraThreePointTrack(
  durationFrames: number,
  fromValue: number,
  middleValue: number,
  toValue: number,
  easing?: EasingName
): Keyframe[] {
  const endFrame = cameraEndFrame(durationFrames);
  if (endFrame === 0) {
    return [{ frame: 0, value: fromValue }];
  }

  const middleFrame = Math.floor(endFrame / 2);
  if (middleFrame === 0 || middleFrame === endFrame) {
    return cameraTrack(durationFrames, fromValue, toValue, easing);
  }

  return [
    compactObject({ frame: 0, value: fromValue, easing }) as unknown as Keyframe,
    compactObject({ frame: middleFrame, value: middleValue, easing }) as unknown as Keyframe,
    { frame: endFrame, value: toValue }
  ];
}

function cameraCrashZoomTrack(options: {
  durationFrames: number;
  easing: EasingName;
  fromScale: number;
  overshootScale: number;
  toScale: number;
  impactFrame?: number | undefined;
}): Keyframe[] {
  const endFrame = cameraEndFrame(options.durationFrames);
  if (endFrame === 0) {
    return [{ frame: 0, value: options.fromScale }];
  }

  const fallbackImpactFrame = Math.max(1, Math.floor(endFrame * 0.35));
  const impactFrame = clampInteger(options.impactFrame ?? fallbackImpactFrame, 1, endFrame);
  if (impactFrame === endFrame) {
    return keyframes([
      [0, options.fromScale, options.easing],
      [endFrame, options.toScale]
    ]);
  }

  return keyframes([
    [0, options.fromScale, options.easing],
    [impactFrame, options.overshootScale, "outBack"],
    [endFrame, options.toScale]
  ]);
}

function cameraJitterTrack(options: {
  durationFrames: number;
  seed: number;
  intervalFrames: number;
  restingValue: number;
  amount: number;
  easing: EasingName;
}): Keyframe[] {
  const endFrame = cameraEndFrame(options.durationFrames);
  const intervalFrames = clampInteger(options.intervalFrames, 1, Math.max(1, endFrame));
  const frames: Keyframe[] = [];
  let state = normalizeSeed(options.seed);

  for (let frame = 0; frame <= endFrame; frame += intervalFrames) {
    state = nextSeed(state);
    const value = roundMotionValue(options.restingValue + (seedToUnit(state) * 2 - 1) * options.amount);
    frames.push(
      compactObject({
        frame,
        value,
        easing: frame === endFrame ? undefined : options.easing
      }) as unknown as Keyframe
    );
  }

  if (frames[frames.length - 1]?.frame !== endFrame) {
    state = nextSeed(state);
    frames.push({
      frame: endFrame,
      value: roundMotionValue(options.restingValue + (seedToUnit(state) * 2 - 1) * options.amount)
    });
  }

  if (frames.length === 1) {
    frames[0] = { frame: 0, value: options.restingValue };
  }

  return frames;
}

function cameraAxisFrames(options: {
  durationFrames: number;
  easing?: EasingName | undefined;
  axis: "x" | "y";
  direction: Exclude<CameraMotionDirection, "center">;
  amount: number;
  restingValue: number;
  fromValue?: number | undefined;
  toValue?: number | undefined;
  subjectAnchor?: Anchor | undefined;
}): Keyframe[] {
  const halfAmount = options.amount / 2;
  const directionSign = options.direction === "left" || options.direction === "up" ? -1 : 1;
  const subjectBias = anchorBias(options.subjectAnchor, options.axis) * halfAmount * 0.5;
  const fromValue = options.fromValue ?? options.restingValue - directionSign * halfAmount + subjectBias;
  const toValue = options.toValue ?? options.restingValue + directionSign * halfAmount + subjectBias;

  return cameraTrack(options.durationFrames, fromValue, toValue, options.easing);
}

function cameraIntensity(options: Pick<CameraMotionOptions, "intensity">, fallback: number): number {
  return Math.max(0, options.intensity ?? fallback);
}

function cameraTravelAmount(options: Pick<CameraMotionOptions, "intensity" | "safeArea"> & { amount?: number }, fallback: number): number {
  const baseAmount = options.amount ?? fallback * (1 + cameraIntensity(options, 0));
  return baseAmount * safeAreaMultiplier(options.safeArea);
}

function cameraEndFrame(durationFrames: number): number {
  if (!Number.isInteger(durationFrames) || durationFrames < 1) {
    throw new Error("Camera motion durationFrames must be a positive integer.");
  }

  return durationFrames - 1;
}

function safeAreaMultiplier(safeArea: CameraSafeArea | undefined): number {
  if (safeArea === undefined) {
    return 1;
  }

  if (typeof safeArea === "number") {
    return 1 - clamp(safeArea, 0, 0.45) * 2;
  }

  const largestInset = Math.max(safeArea.top ?? 0, safeArea.right ?? 0, safeArea.bottom ?? 0, safeArea.left ?? 0);
  return 1 - clamp(largestInset, 0, 0.45) * 2;
}

function anchorBias(anchor: Anchor | undefined, axis: "x" | "y"): number {
  if (anchor === undefined) {
    return 0;
  }

  if (typeof anchor === "object") {
    const value = axis === "x" ? anchor.x : anchor.y;
    return clamp(value, 0, 1) * 2 - 1;
  }

  if (axis === "x") {
    if (anchor.endsWith("left")) {
      return -1;
    }
    if (anchor.endsWith("right")) {
      return 1;
    }
    return 0;
  }

  if (anchor.startsWith("top")) {
    return -1;
  }
  if (anchor.startsWith("bottom")) {
    return 1;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeSeed(seed: number): number {
  const normalized = Math.trunc(seed) % 2147483647;
  return normalized <= 0 ? normalized + 2147483646 : normalized;
}

function nextSeed(seed: number): number {
  return (seed * 16807) % 2147483647;
}

function seedToUnit(seed: number): number {
  return (seed - 1) / 2147483646;
}

function roundMotionValue(value: number): number {
  return Math.round(value * 1000) / 1000;
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

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function assertOptionalPositiveInteger(value: number | undefined, name: string): void {
  if (value !== undefined) {
    assertPositiveInteger(value, name);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

function assertOptionalNonNegativeInteger(value: number | undefined, name: string): void {
  if (value !== undefined) {
    assertNonNegativeInteger(value, name);
  }
}

function assertOptionalPositiveNumber(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`${name} must be a positive number.`);
  }
}

function assertOptionalNonNegativeNumber(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a non-negative number.`);
  }
}

function assertOptionalRange(value: number | undefined, name: string, min: number, max: number): void {
  if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
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

function layerIdFor(value: string | LayerBuilder): string {
  return value instanceof LayerBuilder ? value.id : value;
}

function cloneTrack(track: TrackDefinition): TrackDefinition {
  return {
    id: track.id,
    clips: track.clips.map((clip) => cloneTrackClip(clip))
  };
}

function cloneTrackClip(clip: TrackClipDefinition): TrackClipDefinition {
  const output: TrackClipDefinition = {
    id: clip.id,
    layerId: clip.layerId,
    startFrame: clip.startFrame,
    durationFrames: clip.durationFrames
  };

  if (clip.transitionFromPrevious !== undefined) {
    output.transitionFromPrevious = cloneTransitionSeriesDefinition(clip.transitionFromPrevious);
  }

  return output;
}

function cloneTransitionSeriesDefinition(definition: TransitionSeriesDefinition): TransitionSeriesDefinition {
  const output: TransitionSeriesDefinition = {
    presentation: {
      type: definition.presentation.type
    },
    timing: {
      type: "tween",
      durationFrames: definition.timing.durationFrames
    }
  };

  if (definition.presentation.direction !== undefined) {
    output.presentation.direction = definition.presentation.direction;
  }
  if (definition.presentation.axis !== undefined) {
    output.presentation.axis = definition.presentation.axis;
  }
  if (definition.presentation.shape !== undefined) {
    output.presentation.shape = definition.presentation.shape;
  }
  if (definition.presentation.color !== undefined) {
    output.presentation.color = definition.presentation.color;
  }
  if (definition.presentation.amount !== undefined) {
    output.presentation.amount = definition.presentation.amount;
  }
  if (definition.presentation.intensity !== undefined) {
    output.presentation.intensity = definition.presentation.intensity;
  }
  if (definition.presentation.rows !== undefined) {
    output.presentation.rows = definition.presentation.rows;
  }
  if (definition.presentation.columns !== undefined) {
    output.presentation.columns = definition.presentation.columns;
  }
  if (definition.timing.easing !== undefined) {
    output.timing.easing = definition.timing.easing;
  }

  return output;
}

function isTransitionSeriesDefinition(value: unknown): value is TransitionSeriesDefinition {
  return isRecord(value) && isRecord(value.presentation) && isRecord(value.timing);
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
