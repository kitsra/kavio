import type {
  CompositionTiming,
  KavioAudioAsset,
  KavioAudioDuck,
  KavioAudioRole,
  KavioAudioTrack,
  KavioExportPreset,
  KavioFit,
  KavioSubjectCropKeyframe,
  KavioVideoAsset,
  KavioVideoCrop,
  KavioVideoLayer
} from "@kavio/schema";

export type FfmpegPlanStepKind = "input" | "filter" | "map" | "output" | "argument";

export interface FfmpegPlan {
  steps: FfmpegPlanStep[];
}

interface FfmpegPlanStepBase {
  id: string;
  kind: FfmpegPlanStepKind;
  description: string;
  args: string[];
  notes?: string[];
}

export interface FfmpegInputPlanStep extends FfmpegPlanStepBase {
  kind: "input";
  inputIndex: number;
  source: string;
}

export interface FfmpegFilterPlanStep extends FfmpegPlanStepBase {
  kind: "filter";
  chains: FfmpegFilterChain[];
}

export interface FfmpegMapPlanStep extends FfmpegPlanStepBase {
  kind: "map";
  labels: string[];
}

export interface FfmpegOutputPlanStep extends FfmpegPlanStepBase {
  kind: "output";
  target: string;
}

export interface FfmpegArgumentPlanStep extends FfmpegPlanStepBase {
  kind: "argument";
}

export type FfmpegPlanStep =
  | FfmpegInputPlanStep
  | FfmpegFilterPlanStep
  | FfmpegMapPlanStep
  | FfmpegOutputPlanStep
  | FfmpegArgumentPlanStep;

export interface FfmpegDimensions {
  width: number;
  height: number;
}

export interface FfmpegFilterChain {
  inputLabels: string[];
  filters: string[];
  outputLabel: string;
  expression: string;
}

export interface FfmpegBaseVideoPlanOptions {
  asset: Pick<KavioVideoAsset, "src" | "trimStartFrames" | "trimEndFrames" | "loop">;
  layer: Pick<KavioVideoLayer, "id" | "asset" | "durationFrames" | "fit" | "crop" | "playbackRate">;
  output: FfmpegDimensions | Pick<CompositionTiming, "width" | "height"> | Pick<KavioExportPreset, "width" | "height">;
  fps: number;
  inputIndex?: number;
  inputLabel?: string;
  outputLabel?: string;
  background?: string;
}

export interface FfmpegBaseVideoSequencePlanOptions {
  segments: FfmpegBaseVideoPlanOptions[];
  outputLabel?: string;
}

export interface FfmpegInputTrimOptions {
  source: string;
  startFrame?: number;
  durationFrames?: number;
  fps: number;
}

export interface FfmpegFitFilterOptions {
  dimensions: FfmpegDimensions;
  fit?: KavioFit;
  crop?: KavioVideoCrop;
  background?: string;
}

export interface FfmpegOverlayCompositingOptions {
  baseLabel: string;
  overlayLabel: string;
  outputLabel?: string;
  x?: string | number;
  y?: string | number;
  startFrame?: number;
  durationFrames?: number;
  fps?: number;
  shortest?: boolean;
}

export interface FfmpegOverlayFrameInputOptions {
  framePattern: string;
  fps: number;
  inputIndex?: number;
  inputLabel?: string;
  outputLabel?: string;
  startNumber?: number;
}

export interface FfmpegOverlayCompositingPlanOptions {
  baseLabel: string;
  frames: FfmpegOverlayFrameInputOptions;
  outputLabel?: string;
  x?: string | number;
  y?: string | number;
  startFrame?: number;
  durationFrames?: number;
  fps?: number;
  shortest?: boolean;
}

export interface FfmpegConcatFilterOptions {
  segmentLabels: string[];
  outputLabel?: string;
}

export interface FfmpegAudioTrackPlanOptions {
  asset: Pick<KavioAudioAsset | KavioVideoAsset, "src" | "trimStartFrames" | "trimEndFrames" | "loop">;
  track: Pick<
    KavioAudioTrack,
    | "id"
    | "asset"
    | "role"
    | "startFrame"
    | "durationFrames"
    | "offsetFrames"
    | "volume"
    | "fadeInFrames"
    | "fadeOutFrames"
    | "loop"
    | "duck"
  >;
  inputIndex?: number;
  inputLabel?: string;
  outputLabel?: string;
}

export interface FfmpegAudioMixPlanOptions {
  tracks: FfmpegAudioTrackPlanOptions[];
  fps: number;
  outputLabel?: string;
  normalizeLoudness?: boolean | FfmpegLoudnessNormalizationOptions;
}

export interface FfmpegLoudnessNormalizationOptions {
  integratedLufs?: number;
  truePeakDb?: number;
  loudnessRange?: number;
}

export function createEmptyPlan(): FfmpegPlan {
  return { steps: [] };
}

export function appendPlanStep(plan: FfmpegPlan, step: FfmpegPlanStep): FfmpegPlan {
  return { steps: [...plan.steps, step] };
}

export function renderFfmpegArgs(plan: FfmpegPlan): string[] {
  return plan.steps.flatMap((step) => step.args);
}

export function framesToSeconds(frames: number, fps: number): number {
  assertNonNegativeFrame(frames, "frames");
  assertPositiveFiniteNumber(fps, "fps");
  return frames / fps;
}

export function formatFfmpegTimestamp(seconds: number): string {
  assertFiniteNumber(seconds, "seconds");
  return formatDecimal(seconds);
}

export function buildInputTrimArgs(options: FfmpegInputTrimOptions): string[] {
  assertPositiveFiniteNumber(options.fps, "fps");
  if (options.source.length === 0) {
    throw new Error("FFmpeg input source must not be empty.");
  }

  const args: string[] = [];
  if (options.startFrame !== undefined) {
    assertNonNegativeFrame(options.startFrame, "startFrame");
    if (options.startFrame > 0) {
      args.push("-ss", formatFfmpegTimestamp(framesToSeconds(options.startFrame, options.fps)));
    }
  }
  if (options.durationFrames !== undefined) {
    assertPositiveFrame(options.durationFrames, "durationFrames");
    args.push("-t", formatFfmpegTimestamp(framesToSeconds(options.durationFrames, options.fps)));
  }
  args.push("-i", options.source);
  return args;
}

export function buildFitVideoFilters(options: FfmpegFitFilterOptions): string[] {
  const dimensions = normalizeDimensions(options.dimensions);
  const fit = options.fit ?? "cover";
  const background = escapeFilterValue(options.background ?? "black");
  const width = String(dimensions.width);
  const height = String(dimensions.height);

  switch (fit) {
    case "cover":
      return [
        `scale=${width}:${height}:force_original_aspect_ratio=increase`,
        buildCoverCropFilter(width, height, options.crop),
        "setsar=1"
      ];
    case "contain":
      return [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${background}`,
        "setsar=1"
      ];
    case "fill":
      return [`scale=${width}:${height}`, "setsar=1"];
    case "none":
      return ["setsar=1"];
    default:
      throw new Error(`Unsupported video fit "${fit}".`);
  }
}

export function buildBaseVideoFilterChain(options: FfmpegBaseVideoPlanOptions): FfmpegFilterChain {
  assertPositiveFiniteNumber(options.fps, "fps");
  assertPositiveFrame(options.layer.durationFrames, "layer.durationFrames");
  const inputIndex = options.inputIndex ?? 0;
  const inputLabel = options.inputLabel ?? streamLabel(inputIndex, "v");
  const outputLabel = options.outputLabel ?? `${sanitizeLabelPart(options.layer.id)}_base`;
  const playbackRate = options.layer.playbackRate ?? 1;
  assertPositiveFiniteNumber(playbackRate, "layer.playbackRate");

  const fitOptions: FfmpegFitFilterOptions = {
    dimensions: normalizeDimensions(options.output)
  };
  if (options.layer.fit !== undefined) {
    fitOptions.fit = options.layer.fit;
  }
  if (options.layer.crop !== undefined) {
    fitOptions.crop = options.layer.crop;
  }
  if (options.background !== undefined) {
    fitOptions.background = options.background;
  }

  const filters = [
    `setpts=${playbackRate === 1 ? "PTS-STARTPTS" : `(PTS-STARTPTS)/${formatDecimal(playbackRate)}`}`,
    ...buildFitVideoFilters(fitOptions)
  ];

  return createFilterChain([inputLabel], filters, outputLabel);
}

function buildCoverCropFilter(width: string, height: string, crop: KavioVideoCrop | undefined): string {
  if (crop?.mode !== "subject") {
    return `crop=${width}:${height}`;
  }

  const x = escapeFilterExpression(buildSubjectCropExpression(crop, "x"));
  const y = escapeFilterExpression(buildSubjectCropExpression(crop, "y"));
  return `crop=${width}:${height}:${x}:${y}`;
}

function buildSubjectCropExpression(crop: Extract<KavioVideoCrop, { mode: "subject" }>, axis: "x" | "y"): string {
  const focus = buildSubjectFocusExpression(crop, axis);
  const dimensionExpression = axis === "x" ? "iw-ow" : "ih-oh";
  return `min(max((${dimensionExpression})*(${focus}),0),${dimensionExpression})`;
}

function buildSubjectFocusExpression(crop: Extract<KavioVideoCrop, { mode: "subject" }>, axis: "x" | "y"): string {
  const points: KavioSubjectCropKeyframe[] = [];
  const staticValue = crop[axis];
  const keyframes = crop.keyframes ?? [];

  if (keyframes.length === 0 && typeof staticValue === "number") {
    assertNormalizedUnit(staticValue, `crop.${axis}`);
    points.push({ frame: 0, x: crop.x ?? 0.5, y: crop.y ?? 0.5 });
  }

  for (const keyframe of keyframes) {
    assertNonNegativeFrame(keyframe.frame, "crop.keyframes.frame");
    assertNormalizedUnit(keyframe.x, "crop.keyframes.x");
    assertNormalizedUnit(keyframe.y, "crop.keyframes.y");
    points.push({ ...keyframe });
  }

  if (points.length === 0) {
    return "0.5";
  }

  const sorted = [...points].sort((a, b) => a.frame - b.frame);
  if (sorted.length === 1) {
    return formatDecimal(sorted[0]![axis]);
  }

  let expression = formatDecimal(sorted[sorted.length - 1]![axis]);
  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const current = sorted[index]!;
    const next = sorted[index + 1]!;
    const currentValue = formatDecimal(current[axis]);
    const nextValue = formatDecimal(next[axis]);
    const segment =
      next.frame === current.frame
        ? currentValue
        : `${currentValue}+(${nextValue}-${currentValue})*(n-${current.frame})/${next.frame - current.frame}`;
    expression = `if(lte(n,${next.frame}),${segment},${expression})`;
  }

  const first = sorted[0]!;
  return `if(lte(n,${first.frame}),${formatDecimal(first[axis])},${expression})`;
}

export function planBaseVideo(options: FfmpegBaseVideoPlanOptions): FfmpegPlan {
  const inputIndex = options.inputIndex ?? 0;
  const inputStep = buildBaseVideoInputStep(options, inputIndex);
  const filterChain = buildBaseVideoFilterChain(options);

  const steps: FfmpegPlanStep[] = [
    inputStep,
    createFilterStep({
      id: `${sanitizeLabelPart(options.layer.id)}:base-filter`,
      description: `Normalize base video layer "${options.layer.id}" to ${options.output.width}x${options.output.height}.`,
      chains: [filterChain]
    })
  ];

  return { steps };
}

export function planBaseVideoSequence(options: FfmpegBaseVideoSequencePlanOptions): FfmpegPlan {
  if (options.segments.length === 0) {
    throw new Error("At least one base video segment is required.");
  }

  const inputSteps: FfmpegInputPlanStep[] = [];
  const chains: FfmpegFilterChain[] = [];
  const segmentLabels: string[] = [];

  options.segments.forEach((segment, index) => {
    const inputIndex = segment.inputIndex ?? index;
    const fallbackLabel = `${sanitizeLabelPart(segment.layer.id)}_base`;
    const segmentLabel =
      options.segments.length === 1 ? (options.outputLabel ?? segment.outputLabel ?? fallbackLabel) : (segment.outputLabel ?? `base_segment_${index}`);
    const plannedSegment = withBaseVideoLabels(segment, inputIndex, segmentLabel);

    inputSteps.push(buildBaseVideoInputStep(plannedSegment, inputIndex));
    chains.push(buildBaseVideoFilterChain(plannedSegment));
    segmentLabels.push(segmentLabel);
  });

  if (options.segments.length > 1) {
    chains.push(buildConcatFilterChain({ segmentLabels, outputLabel: options.outputLabel ?? "base_concat" }));
  }

  return {
    steps: [
      ...inputSteps,
      createFilterStep({
        id: "base-video:filter",
        description:
          options.segments.length === 1
            ? "Normalize one base video segment."
            : `Normalize and concatenate ${options.segments.length} base video segments.`,
        chains
      })
    ]
  };
}

export function buildOverlayCompositingFilterChain(options: FfmpegOverlayCompositingOptions): FfmpegFilterChain {
  const outputLabel = options.outputLabel ?? "composited";
  const x = formatOverlayCoordinate(options.x ?? 0);
  const y = formatOverlayCoordinate(options.y ?? 0);
  const overlayOptions = [`x=${x}`, `y=${y}`, "format=auto"];

  if (options.shortest !== undefined) {
    overlayOptions.push(`shortest=${options.shortest ? "1" : "0"}`);
  }

  const enableExpression = buildOverlayEnableExpression(options);
  if (enableExpression !== undefined) {
    overlayOptions.push(`enable='${enableExpression}'`);
  }

  return createFilterChain([options.baseLabel, options.overlayLabel], [`overlay=${overlayOptions.join(":")}`], outputLabel);
}

export function buildOverlayCompositingArgs(options: FfmpegOverlayCompositingOptions): string[] {
  return buildFilterComplexArgs([buildOverlayCompositingFilterChain(options)]);
}

export function buildOverlayFrameInputArgs(options: FfmpegOverlayFrameInputOptions): string[] {
  assertPositiveFiniteNumber(options.fps, "fps");
  if (options.framePattern.length === 0) {
    throw new Error("Overlay frame pattern must not be empty.");
  }

  const args = ["-framerate", formatDecimal(options.fps)];
  if (options.startNumber !== undefined) {
    assertNonNegativeFrame(options.startNumber, "startNumber");
    args.push("-start_number", String(options.startNumber));
  }
  args.push("-i", options.framePattern);
  return args;
}

export function buildOverlayFrameFilterChain(options: FfmpegOverlayFrameInputOptions): FfmpegFilterChain {
  const inputIndex = options.inputIndex ?? 1;
  const inputLabel = options.inputLabel ?? streamLabel(inputIndex, "v");
  const outputLabel = options.outputLabel ?? "overlay_frames";
  return createFilterChain([inputLabel], ["format=rgba", "setpts=PTS-STARTPTS"], outputLabel);
}

export function planOverlayCompositing(options: FfmpegOverlayCompositingPlanOptions): FfmpegPlan {
  const inputIndex = options.frames.inputIndex ?? 1;
  const overlayLabel = options.frames.outputLabel ?? "overlay_frames";
  const frames = withOverlayFrameLabels(options.frames, inputIndex, overlayLabel);
  const compositeOptions = buildOverlayCompositingPlanFilterOptions(options, overlayLabel);

  return {
    steps: [
      createInputStep({
        id: "overlay-frames:input",
        description: `Read transparent overlay frame sequence "${options.frames.framePattern}".`,
        args: buildOverlayFrameInputArgs(frames),
        inputIndex,
        source: options.frames.framePattern
      }),
      createFilterStep({
        id: "overlay-frames:composite",
        description: "Prepare transparent overlay frames and composite them over the base video.",
        chains: [buildOverlayFrameFilterChain(frames), buildOverlayCompositingFilterChain(compositeOptions)]
      })
    ]
  };
}

export function buildConcatFilterChain(options: FfmpegConcatFilterOptions): FfmpegFilterChain {
  if (options.segmentLabels.length === 0) {
    throw new Error("At least one segment label is required for concat planning.");
  }

  return createFilterChain(
    options.segmentLabels,
    [`concat=n=${options.segmentLabels.length}:v=1:a=0`],
    options.outputLabel ?? "base_concat"
  );
}

export function buildAudioMixFilterChains(options: FfmpegAudioMixPlanOptions): FfmpegFilterChain[] {
  return buildAudioMixPlanParts(options).chains;
}

export function planAudioMix(options: FfmpegAudioMixPlanOptions): FfmpegPlan {
  const parts = buildAudioMixPlanParts(options);
  return {
    steps: [
      ...parts.inputSteps,
      createFilterStep({
        id: "audio-mix:filter",
        description: `Mix ${options.tracks.length} audio track${options.tracks.length === 1 ? "" : "s"}.`,
        chains: parts.chains,
        notes: parts.notes
      })
    ]
  };
}

export function buildFilterComplexArgs(chains: FfmpegFilterChain[]): string[] {
  if (chains.length === 0) {
    return [];
  }

  return ["-filter_complex", chains.map((chain) => chain.expression).join(";")];
}

export function createInputStep(options: {
  id: string;
  description: string;
  args: string[];
  inputIndex: number;
  source: string;
  notes?: string[];
}): FfmpegInputPlanStep {
  return withOptionalNotes(
    {
      id: options.id,
      kind: "input",
      description: options.description,
      args: [...options.args],
      inputIndex: options.inputIndex,
      source: options.source
    },
    options.notes
  );
}

export function createFilterStep(options: {
  id: string;
  description: string;
  chains: FfmpegFilterChain[];
  notes?: string[];
}): FfmpegFilterPlanStep {
  return withOptionalNotes(
    {
      id: options.id,
      kind: "filter",
      description: options.description,
      chains: options.chains.map(cloneFilterChain),
      args: buildFilterComplexArgs(options.chains)
    },
    options.notes
  );
}

export function createMapStep(options: { id: string; description: string; labels: string[]; notes?: string[] }): FfmpegMapPlanStep {
  return withOptionalNotes(
    {
      id: options.id,
      kind: "map",
      description: options.description,
      labels: [...options.labels],
      args: options.labels.flatMap((label) => ["-map", bracketLabel(label)])
    },
    options.notes
  );
}

export function createOutputStep(options: {
  id: string;
  description: string;
  target: string;
  args?: string[];
  notes?: string[];
}): FfmpegOutputPlanStep {
  return withOptionalNotes(
    {
      id: options.id,
      kind: "output",
      description: options.description,
      target: options.target,
      args: [...(options.args ?? []), options.target]
    },
    options.notes
  );
}

export function createArgumentStep(options: {
  id: string;
  description: string;
  args: string[];
  notes?: string[];
}): FfmpegArgumentPlanStep {
  return withOptionalNotes(
    {
      id: options.id,
      kind: "argument",
      description: options.description,
      args: [...options.args]
    },
    options.notes
  );
}

interface AudioMixPlanParts {
  inputSteps: FfmpegInputPlanStep[];
  chains: FfmpegFilterChain[];
  notes: string[];
}

interface ResolvedAudioTrackPlan {
  option: FfmpegAudioTrackPlanOptions;
  inputIndex: number;
  inputLabel: string;
  outputLabel: string;
  sourceStartFrame: number;
  durationFrames?: number;
  notes: string[];
}

function withBaseVideoLabels(options: FfmpegBaseVideoPlanOptions, inputIndex: number, outputLabel: string): FfmpegBaseVideoPlanOptions {
  return {
    ...options,
    inputIndex,
    outputLabel
  };
}

function buildBaseVideoInputStep(options: FfmpegBaseVideoPlanOptions, inputIndex: number): FfmpegInputPlanStep {
  const trimStartFrames = options.asset.trimStartFrames ?? 0;
  assertNonNegativeFrame(trimStartFrames, "asset.trimStartFrames");
  const playbackRate = options.layer.playbackRate ?? 1;
  assertPositiveFiniteNumber(playbackRate, "layer.playbackRate");
  const requestedInputFrames = Math.ceil(options.layer.durationFrames * playbackRate);
  const availableInputFrames =
    options.asset.trimEndFrames === null || options.asset.trimEndFrames === undefined
      ? undefined
      : Math.max(0, options.asset.trimEndFrames - trimStartFrames);
  const durationFrames =
    availableInputFrames === undefined || options.asset.loop ? requestedInputFrames : Math.min(requestedInputFrames, availableInputFrames);
  const notes: string[] = [];

  if (availableInputFrames !== undefined && availableInputFrames < requestedInputFrames && !options.asset.loop) {
    notes.push("asset trimEndFrames is shorter than the requested layer duration at the configured playback rate");
  }
  if (options.asset.loop) {
    notes.push("asset.loop is recorded for inspection; loop expansion is not emitted by this primitive yet");
  }

  return createInputStep({
    id: `${sanitizeLabelPart(options.layer.id)}:input`,
    description: `Read video asset "${options.layer.asset}" for layer "${options.layer.id}".`,
    args: buildInputTrimArgs({
      source: options.asset.src,
      startFrame: trimStartFrames,
      durationFrames,
      fps: options.fps
    }),
    inputIndex,
    source: options.asset.src,
    notes
  });
}

function withOverlayFrameLabels(
  options: FfmpegOverlayFrameInputOptions,
  inputIndex: number,
  outputLabel: string
): FfmpegOverlayFrameInputOptions {
  return {
    ...options,
    inputIndex,
    outputLabel
  };
}

function buildOverlayCompositingPlanFilterOptions(
  options: FfmpegOverlayCompositingPlanOptions,
  overlayLabel: string
): FfmpegOverlayCompositingOptions {
  const compositeOptions: FfmpegOverlayCompositingOptions = {
    baseLabel: options.baseLabel,
    overlayLabel,
    outputLabel: options.outputLabel ?? "video_composited"
  };
  if (options.x !== undefined) {
    compositeOptions.x = options.x;
  }
  if (options.y !== undefined) {
    compositeOptions.y = options.y;
  }
  if (options.startFrame !== undefined) {
    compositeOptions.startFrame = options.startFrame;
  }
  if (options.durationFrames !== undefined) {
    compositeOptions.durationFrames = options.durationFrames;
  }
  if (options.fps !== undefined) {
    compositeOptions.fps = options.fps;
  }
  if (options.shortest !== undefined) {
    compositeOptions.shortest = options.shortest;
  }
  return compositeOptions;
}

function buildAudioMixPlanParts(options: FfmpegAudioMixPlanOptions): AudioMixPlanParts {
  assertPositiveFiniteNumber(options.fps, "fps");
  if (options.tracks.length === 0) {
    throw new Error("At least one audio track is required for mix planning.");
  }

  const voiceoverCount = options.tracks.filter((track) => track.track.role === "voiceover").length;
  if (voiceoverCount > 1) {
    throw new Error("MVP audio mix planning supports at most one voiceover track.");
  }

  const resolvedTracks = options.tracks.map((track, index) => resolveAudioTrackPlan(track, index));
  const chains: FfmpegFilterChain[] = [];
  const notes: string[] = [];
  const inputSteps = resolvedTracks.map((resolved) => {
    notes.push(...resolved.notes.map((note) => `${resolved.option.track.id}: ${note}`));
    const trimOptions: FfmpegInputTrimOptions = {
      source: resolved.option.asset.src,
      startFrame: resolved.sourceStartFrame,
      fps: options.fps
    };
    if (resolved.durationFrames !== undefined) {
      trimOptions.durationFrames = resolved.durationFrames;
    }
    return createInputStep({
      id: `${sanitizeLabelPart(resolved.option.track.id)}:audio-input`,
      description: `Read ${resolved.option.track.role} audio asset "${resolved.option.track.asset}" for track "${resolved.option.track.id}".`,
      args: buildInputTrimArgs(trimOptions),
      inputIndex: resolved.inputIndex,
      source: resolved.option.asset.src,
      notes: resolved.notes
    });
  });

  for (const resolved of resolvedTracks) {
    chains.push(buildAudioTrackFilterChain(resolved, options, resolved.outputLabel));
  }

  const mixLabels = new Map<string, string>();
  for (const resolved of resolvedTracks) {
    mixLabels.set(resolved.option.track.id, resolved.outputLabel);
  }

  for (const resolved of resolvedTracks) {
    const duck = resolved.option.track.duck;
    if (duck === undefined) {
      continue;
    }

    const sidechain = findAudioTrackByRole(resolvedTracks, duck.against, resolved.option.track.id);
    const sidechainDuration = sidechain.durationFrames ?? sidechain.option.track.durationFrames;
    if (sidechainDuration === undefined) {
      throw new Error(`Audio ducking against "${duck.against}" requires the sidechain track durationFrames.`);
    }

    const duckedLabel = `${sanitizeLabelPart(resolved.option.track.id)}_ducked`;
    chains.push(
      createFilterChain(
        [mixLabels.get(resolved.option.track.id) ?? resolved.outputLabel],
        [buildAudioDuckingFilter(duck, sidechain.option.track.startFrame, sidechainDuration, options.fps)],
        duckedLabel
      )
    );
    mixLabels.set(resolved.option.track.id, duckedLabel);
    notes.push(
      `${resolved.option.track.id}: ducking represented as a timeline volume envelope against ${duck.against}; sidechain compression execution is deferred`
    );
  }

  const finalTrackLabels = resolvedTracks.map((resolved) => mixLabels.get(resolved.option.track.id) ?? resolved.outputLabel);
  const mixFilters = [`amix=inputs=${finalTrackLabels.length}:duration=longest:dropout_transition=0`];
  if (options.normalizeLoudness !== false) {
    mixFilters.push(buildLoudnessNormalizationFilter(options.normalizeLoudness));
  }
  chains.push(createFilterChain(finalTrackLabels, mixFilters, options.outputLabel ?? "audio_mix"));

  return { inputSteps, chains, notes };
}

function resolveAudioTrackPlan(option: FfmpegAudioTrackPlanOptions, index: number): ResolvedAudioTrackPlan {
  assertNonNegativeFrame(option.track.startFrame, "track.startFrame");
  const inputIndex = option.inputIndex ?? index;
  const inputLabel = option.inputLabel ?? streamLabel(inputIndex, "a");
  const outputLabel = option.outputLabel ?? `${sanitizeLabelPart(option.track.id)}_audio`;
  const assetTrimStartFrames = option.asset.trimStartFrames ?? 0;
  const offsetFrames = option.track.offsetFrames ?? 0;
  assertNonNegativeFrame(assetTrimStartFrames, "asset.trimStartFrames");
  assertNonNegativeFrame(offsetFrames, "track.offsetFrames");
  const sourceStartFrame = assetTrimStartFrames + offsetFrames;
  assertNonNegativeFrame(sourceStartFrame, "audio source start frame");
  const notes: string[] = [];

  const trimEndFrames = option.asset.trimEndFrames === null ? undefined : option.asset.trimEndFrames;
  let durationFrames = option.track.durationFrames;
  if (durationFrames !== undefined) {
    assertPositiveFrame(durationFrames, "track.durationFrames");
  }
  if (trimEndFrames !== undefined) {
    assertNonNegativeFrame(trimEndFrames, "asset.trimEndFrames");
    const availableFrames = Math.max(0, trimEndFrames - sourceStartFrame);
    if (durationFrames === undefined) {
      durationFrames = availableFrames;
    } else if (!option.track.loop && !option.asset.loop) {
      durationFrames = Math.min(durationFrames, availableFrames);
    }
  }

  if (option.track.loop || option.asset.loop) {
    notes.push("loop is recorded for inspection; audio loop expansion is not emitted by this primitive yet");
  }

  const resolved: ResolvedAudioTrackPlan = {
    option,
    inputIndex,
    inputLabel,
    outputLabel,
    sourceStartFrame,
    notes
  };
  if (durationFrames !== undefined) {
    resolved.durationFrames = durationFrames;
  }
  return resolved;
}

function buildAudioTrackFilterChain(
  resolved: ResolvedAudioTrackPlan,
  options: FfmpegAudioMixPlanOptions,
  outputLabel: string
): FfmpegFilterChain {
  const track = resolved.option.track;
  const filters = ["asetpts=PTS-STARTPTS", "aresample=async=1"];

  if (track.volume !== undefined) {
    assertNonNegativeFiniteNumber(track.volume, "track.volume");
    if (track.volume !== 1) {
      filters.push(`volume=${formatDecimal(track.volume)}`);
    }
  }

  if (track.fadeInFrames !== undefined) {
    assertNonNegativeFrame(track.fadeInFrames, "track.fadeInFrames");
    if (track.fadeInFrames > 0) {
      filters.push(`afade=t=in:st=0:d=${formatFfmpegTimestamp(framesToSeconds(track.fadeInFrames, options.fps))}`);
    }
  }

  if (track.fadeOutFrames !== undefined) {
    assertNonNegativeFrame(track.fadeOutFrames, "track.fadeOutFrames");
    if (track.fadeOutFrames > 0) {
      if (resolved.durationFrames === undefined) {
        throw new Error(`Audio track "${track.id}" requires durationFrames or trimEndFrames to plan fadeOutFrames.`);
      }
      const fadeOutSeconds = framesToSeconds(track.fadeOutFrames, options.fps);
      const durationSeconds = framesToSeconds(resolved.durationFrames, options.fps);
      filters.push(
        `afade=t=out:st=${formatFfmpegTimestamp(Math.max(0, durationSeconds - fadeOutSeconds))}:d=${formatFfmpegTimestamp(fadeOutSeconds)}`
      );
    }
  }

  if (track.startFrame > 0) {
    filters.push(`adelay=${formatFfmpegTimestamp(framesToSeconds(track.startFrame, options.fps) * 1000)}:all=1`);
  }

  return createFilterChain([resolved.inputLabel], filters, outputLabel);
}

function findAudioTrackByRole(
  tracks: ResolvedAudioTrackPlan[],
  role: KavioAudioRole,
  excludingTrackId: string
): ResolvedAudioTrackPlan {
  const track = tracks.find((candidate) => candidate.option.track.id !== excludingTrackId && candidate.option.track.role === role);
  if (track === undefined) {
    throw new Error(`Audio ducking requires a track with role "${role}".`);
  }
  return track;
}

function buildAudioDuckingFilter(duck: KavioAudioDuck, sidechainStartFrame: number, sidechainDurationFrames: number, fps: number): string {
  assertNonPositiveFiniteNumber(duck.amountDb, "duck.amountDb");
  const amount = formatDecimal(Math.pow(10, duck.amountDb / 20));
  const start = formatFfmpegTimestamp(framesToSeconds(sidechainStartFrame, fps));
  const end = formatFfmpegTimestamp(framesToSeconds(sidechainStartFrame + sidechainDurationFrames, fps));
  const attackFrames = duck.attackFrames ?? 0;
  const releaseFrames = duck.releaseFrames ?? 0;
  assertNonNegativeFrame(attackFrames, "duck.attackFrames");
  assertNonNegativeFrame(releaseFrames, "duck.releaseFrames");
  const attack = formatFfmpegTimestamp(framesToSeconds(attackFrames, fps));
  const release = formatFfmpegTimestamp(framesToSeconds(releaseFrames, fps));
  let expression: string;
  if (attackFrames === 0 && releaseFrames === 0) {
    expression = `if(between(t,${start},${end}),${amount},1)`;
  } else if (attackFrames === 0) {
    expression = `if(lt(t,${start}),1,if(lte(t,${end}),${amount},if(lt(t,${end}+${release}),${amount}+(1-${amount})*(t-${end})/${release},1)))`;
  } else if (releaseFrames === 0) {
    expression = `if(lt(t,${start}),1,if(lt(t,${start}+${attack}),1-(1-${amount})*(t-${start})/${attack},if(lte(t,${end}),${amount},1)))`;
  } else {
    expression = `if(lt(t,${start}),1,if(lt(t,${start}+${attack}),1-(1-${amount})*(t-${start})/${attack},if(lte(t,${end}),${amount},if(lt(t,${end}+${release}),${amount}+(1-${amount})*(t-${end})/${release},1))))`;
  }
  return `volume='${escapeFilterExpression(expression)}'`;
}

function buildLoudnessNormalizationFilter(options: boolean | FfmpegLoudnessNormalizationOptions | undefined): string {
  const normalizedOptions = typeof options === "object" ? options : {};
  const integratedLufs = normalizedOptions.integratedLufs ?? -14;
  const truePeakDb = normalizedOptions.truePeakDb ?? -1.5;
  const loudnessRange = normalizedOptions.loudnessRange ?? 11;
  assertFiniteNumber(integratedLufs, "integratedLufs");
  assertFiniteNumber(truePeakDb, "truePeakDb");
  assertPositiveFiniteNumber(loudnessRange, "loudnessRange");
  return `loudnorm=I=${formatDecimal(integratedLufs)}:TP=${formatDecimal(truePeakDb)}:LRA=${formatDecimal(loudnessRange)}`;
}

function createFilterChain(inputLabels: string[], filters: string[], outputLabel: string): FfmpegFilterChain {
  if (inputLabels.length === 0) {
    throw new Error("At least one filter input label is required.");
  }
  if (filters.length === 0) {
    throw new Error("At least one FFmpeg filter is required.");
  }

  return {
    inputLabels: inputLabels.map(unbracketLabel),
    filters: [...filters],
    outputLabel: unbracketLabel(outputLabel),
    expression: `${inputLabels.map(bracketLabel).join("")}${filters.join(",")}${bracketLabel(outputLabel)}`
  };
}

function buildOverlayEnableExpression(options: FfmpegOverlayCompositingOptions): string | undefined {
  if (options.startFrame === undefined && options.durationFrames === undefined) {
    return undefined;
  }
  if (options.fps === undefined) {
    throw new Error("fps is required when overlay startFrame or durationFrames is provided.");
  }

  const startFrame = options.startFrame ?? 0;
  assertNonNegativeFrame(startFrame, "startFrame");
  const startSeconds = formatFfmpegTimestamp(framesToSeconds(startFrame, options.fps));

  if (options.durationFrames === undefined) {
    return `gte(t,${startSeconds})`;
  }

  assertPositiveFrame(options.durationFrames, "durationFrames");
  const endSeconds = formatFfmpegTimestamp(framesToSeconds(startFrame + options.durationFrames, options.fps));
  return `between(t,${startSeconds},${endSeconds})`;
}

function formatOverlayCoordinate(value: string | number): string {
  if (typeof value === "number") {
    assertFiniteNumber(value, "overlay coordinate");
    return formatDecimal(value);
  }

  if (value.length === 0) {
    throw new Error("Overlay coordinate expression must not be empty.");
  }
  return escapeFilterValue(value);
}

function streamLabel(inputIndex: number, stream: "v" | "a"): string {
  assertNonNegativeFrame(inputIndex, "inputIndex");
  return `${inputIndex}:${stream}`;
}

function bracketLabel(label: string): string {
  const value = unbracketLabel(label);
  return `[${value}]`;
}

function unbracketLabel(label: string): string {
  if (label.startsWith("[") && label.endsWith("]")) {
    return label.slice(1, -1);
  }
  return label;
}

function sanitizeLabelPart(value: string): string {
  const normalized = value.trim().replaceAll(/[^A-Za-z0-9_]+/g, "_").replaceAll(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "layer";
}

function normalizeDimensions(dimensions: FfmpegDimensions): FfmpegDimensions {
  assertPositiveFrame(dimensions.width, "width");
  assertPositiveFrame(dimensions.height, "height");
  return { width: dimensions.width, height: dimensions.height };
}

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function escapeFilterExpression(value: string): string {
  return escapeFilterValue(value).replaceAll(",", "\\,");
}

function cloneFilterChain(chain: FfmpegFilterChain): FfmpegFilterChain {
  return {
    inputLabels: [...chain.inputLabels],
    filters: [...chain.filters],
    outputLabel: chain.outputLabel,
    expression: chain.expression
  };
}

function withOptionalNotes<T extends FfmpegPlanStepBase>(step: T, notes: string[] | undefined): T {
  if (notes === undefined || notes.length === 0) {
    return step;
  }

  return { ...step, notes: [...notes] };
}

function formatDecimal(value: number): string {
  assertFiniteNumber(value, "value");
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function assertPositiveFrame(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function assertNonNegativeFrame(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

function assertPositiveFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number.`);
  }
}

function assertNonNegativeFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number.`);
  }
}

function assertNonPositiveFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value > 0) {
    throw new Error(`${name} must be a non-positive finite number.`);
  }
}

function assertNormalizedUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite.`);
  }
}
