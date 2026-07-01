import type {
  KavioAudioCodec,
  KavioDocument,
  KavioExportCodec,
  KavioExportFormat,
  KavioExportPreset,
  KavioJsonValue
} from "@kitsra/kavio-schema";
import { extensionForFormat } from "@kitsra/kavio-schema";

export type BrowserDriverKind = "playwright" | "puppeteer" | "cloud-browser";
export type BrowserEngine = "chromium";
export type BrowserScreenshotFormat = "png";
export type BrowserScreenshotMimeType = "image/png";
export type ChromiumColorProfile = "srgb";

export const DEFAULT_BROWSER_DRIVER_KIND = "playwright" satisfies BrowserDriverKind;
export const DEFAULT_BROWSER_ENGINE = "chromium" satisfies BrowserEngine;
export const DEFAULT_BROWSER_SCREENSHOT_FORMAT = "png" satisfies BrowserScreenshotFormat;
export const DEFAULT_BROWSER_SCREENSHOT_MIME_TYPE = "image/png" satisfies BrowserScreenshotMimeType;
export const DEFAULT_BROWSER_DEVICE_SCALE_FACTOR = 1;
export const DEFAULT_CHROMIUM_COLOR_PROFILE = "srgb" satisfies ChromiumColorProfile;

export const DETERMINISTIC_CHROMIUM_FLAGS = [
  "--disable-gpu",
  "--disable-gpu-compositing",
  "--disable-font-subpixel-positioning",
  "--force-color-profile=srgb",
  "--font-render-hinting=none"
] as const;

export interface BrowserViewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface BrowserOpenOptions {
  viewport?: BrowserViewport;
}

export interface BrowserFrameCaptureOptions {
  omitBackground?: boolean;
}

export interface BrowserFrameCaptureTiming {
  /** Wall time spent seeking the composition to the frame in the page. */
  evaluateMs: number;
  /** Wall time spent producing the screenshot bytes. */
  screenshotMs: number;
}

export interface BrowserFrameCapture {
  frame: number;
  bytes: Uint8Array;
  format: BrowserScreenshotFormat;
  mimeType: BrowserScreenshotMimeType;
  width: number;
  height: number;
  omitBackground: boolean;
  /** Per-frame timing when the driver measures it. */
  timing?: BrowserFrameCaptureTiming;
}

export interface DeterministicChromiumLaunchOptions {
  headless: true;
  args: readonly string[];
}

export const DEFAULT_CHROMIUM_LAUNCH_OPTIONS = {
  headless: true,
  args: DETERMINISTIC_CHROMIUM_FLAGS
} as const satisfies DeterministicChromiumLaunchOptions;

export const DEFAULT_BROWSER_FRAME_CAPTURE_OPTIONS = {
  omitBackground: true
} as const satisfies BrowserFrameCaptureOptions;

export interface BrowserLaunchMetadata {
  engine: BrowserEngine;
  chromiumRevision: string;
  headless: true;
  args: readonly string[];
  colorProfile: ChromiumColorProfile;
  deviceScaleFactor: number;
}

export interface BrowserDriverMetadata {
  kind: BrowserDriverKind;
  name: string;
  version?: string;
  launch: BrowserLaunchMetadata;
}

export interface BrowserDriverMetadataOptions {
  kind?: BrowserDriverKind;
  name?: string;
  version?: string;
  chromiumRevision: string;
  launchOptions?: DeterministicChromiumLaunchOptions;
  deviceScaleFactor?: number;
  colorProfile?: ChromiumColorProfile;
}

export interface BrowserDriver {
  open(composition: KavioDocument, options?: BrowserOpenOptions): Promise<void>;
  renderFrame(frame: number, options?: BrowserFrameCaptureOptions): Promise<BrowserFrameCapture>;
  close(): Promise<void>;
}

export function createBrowserViewport(composition: KavioDocument, deviceScaleFactor = DEFAULT_BROWSER_DEVICE_SCALE_FACTOR): BrowserViewport {
  assertPositiveInteger(composition.composition.width, "composition.composition.width");
  assertPositiveInteger(composition.composition.height, "composition.composition.height");
  assertPositiveNumber(deviceScaleFactor, "deviceScaleFactor");

  return {
    width: composition.composition.width,
    height: composition.composition.height,
    deviceScaleFactor
  };
}

export function createBrowserDriverMetadata(options: BrowserDriverMetadataOptions): BrowserDriverMetadata {
  const launchOptions = options.launchOptions ?? DEFAULT_CHROMIUM_LAUNCH_OPTIONS;
  const deviceScaleFactor = options.deviceScaleFactor ?? DEFAULT_BROWSER_DEVICE_SCALE_FACTOR;
  const colorProfile = options.colorProfile ?? DEFAULT_CHROMIUM_COLOR_PROFILE;
  assertNonEmptyString(options.chromiumRevision, "chromiumRevision");
  assertPositiveNumber(deviceScaleFactor, "deviceScaleFactor");

  const launch: BrowserLaunchMetadata = {
    engine: DEFAULT_BROWSER_ENGINE,
    chromiumRevision: options.chromiumRevision,
    headless: launchOptions.headless,
    args: [...launchOptions.args],
    colorProfile,
    deviceScaleFactor
  };
  const metadataBase: Omit<BrowserDriverMetadata, "version"> = {
    kind: options.kind ?? DEFAULT_BROWSER_DRIVER_KIND,
    name: options.name ?? DEFAULT_BROWSER_DRIVER_KIND,
    launch
  };

  if (options.version === undefined) {
    return metadataBase;
  }

  return {
    ...metadataBase,
    version: options.version
  };
}

export function createPngFrameCapture(options: {
  frame: number;
  bytes: Uint8Array;
  viewport: BrowserViewport;
  omitBackground?: boolean;
  timing?: BrowserFrameCaptureTiming;
}): BrowserFrameCapture {
  assertNonNegativeInteger(options.frame, "frame");
  assertPositiveInteger(options.viewport.width, "viewport.width");
  assertPositiveInteger(options.viewport.height, "viewport.height");

  return {
    frame: options.frame,
    bytes: options.bytes,
    format: DEFAULT_BROWSER_SCREENSHOT_FORMAT,
    mimeType: DEFAULT_BROWSER_SCREENSHOT_MIME_TYPE,
    width: options.viewport.width,
    height: options.viewport.height,
    omitBackground: options.omitBackground ?? true,
    ...(options.timing !== undefined && { timing: options.timing })
  };
}

export type RenderChecksumAlgorithm = "sha256" | "sha512";
export type RenderCleanupReason = "success" | "failure" | "manual";
export type RenderCleanupScope = "browser-context" | "temporary-frames" | "temporary-file" | "custom";
export type RenderPropValues = Record<string, KavioJsonValue>;
export type RenderBatchPresetInput = string | KavioExportPreset;

export interface RenderChecksum {
  algorithm: RenderChecksumAlgorithm;
  value: string;
  bytes?: number;
}

export interface RenderOutputReference {
  name: string;
  path?: string;
  format: KavioExportFormat;
}

export interface RenderOutputDimensions {
  width: number;
  height: number;
}

export interface RenderOutputDuration {
  frames: number;
  fps: number;
  seconds: number;
}

export interface RenderOutputCodecs {
  video: KavioExportCodec | null;
  audio: KavioAudioCodec | null;
}

export interface RenderToolMetadata {
  ffmpeg: {
    version: string;
  };
  chromium: {
    revision: string;
  };
}

export interface RenderOutputMetadata {
  version: "0.1";
  output: RenderOutputReference;
  dimensions: RenderOutputDimensions;
  duration: RenderOutputDuration;
  codecs: RenderOutputCodecs;
  checksums: RenderChecksum[];
  tools: RenderToolMetadata;
  createdAt: string;
}

export interface CreateRenderMetadataOptions {
  composition: KavioDocument["composition"];
  preset: KavioExportPreset;
  outputName?: string;
  outputPath?: string;
  checksums?: RenderChecksum | readonly RenderChecksum[];
  ffmpegVersion: string;
  chromiumRevision: string;
  createdAt?: string;
}

export interface RenderCleanupContext {
  reason: RenderCleanupReason;
  error?: unknown;
}

export interface RenderCleanupTask {
  id: string;
  scope: RenderCleanupScope;
  cleanup(context: RenderCleanupContext): void | Promise<void>;
}

export interface RenderCleanupRecord {
  id: string;
  scope: RenderCleanupScope;
}

export interface RenderCleanupFailure extends RenderCleanupRecord {
  error: unknown;
}

export interface RenderCleanupReport {
  reason: RenderCleanupReason;
  cleaned: RenderCleanupRecord[];
  failures: RenderCleanupFailure[];
}

export interface RenderBatchRow {
  id?: string;
  props?: RenderPropValues;
}

export type FrameCaptureProgressPhase = "open" | "capture" | "frame-error" | "complete";

export interface FrameCaptureProgress {
  phase: FrameCaptureProgressPhase;
  frame?: number;
  totalFrames: number;
  completedFrames: number;
  capturedFrames: number;
  failedFrames: number;
  bytesCaptured: number;
  error?: unknown;
}

export interface FrameCaptureFrameError {
  frame: number;
  error: unknown;
}

export interface CaptureFramesOptions {
  driver: BrowserDriver;
  composition: KavioDocument;
  openOptions?: BrowserOpenOptions;
  captureOptions?: BrowserFrameCaptureOptions;
  startFrame?: number;
  frameCount?: number;
  continueOnFrameError?: boolean;
  /**
   * Keep every capture's bytes in the result `captures` array. Defaults to
   * true only when no `onFrame` sink is provided; streaming consumers should
   * not pay O(frames) memory for bytes they already handled.
   */
  retainCaptures?: boolean;
  onProgress?: (progress: FrameCaptureProgress) => void | Promise<void>;
  onFrame?: (capture: BrowserFrameCapture, progress: FrameCaptureProgress) => void | Promise<void>;
  onFrameError?: (failure: FrameCaptureFrameError, progress: FrameCaptureProgress) => void | Promise<void>;
}

export interface CaptureFramesResult {
  captures: BrowserFrameCapture[];
  errors: FrameCaptureFrameError[];
  totalFrames: number;
  completedFrames: number;
  capturedFrames: number;
  failedFrames: number;
  bytesCaptured: number;
  /** Wall time spent in driver.open() (browser launch + harness ready). */
  openMs: number;
  /** Sum of per-frame evaluate timings, when the driver reports them. */
  evaluateMs?: number;
  /** Sum of per-frame screenshot timings, when the driver reports them. */
  screenshotMs?: number;
}

export interface RenderBatchInput {
  template: KavioDocument;
  rows: readonly RenderBatchRow[];
  presets?: readonly RenderBatchPresetInput[];
  outputDirectory?: string;
  outputNamePrefix?: string;
}

export interface RenderBatchJob {
  id: string;
  rowIndex: number;
  rowId: string;
  presetIndex: number;
  presetName: string;
  props: RenderPropValues;
  preset: KavioExportPreset;
  document: KavioDocument;
  outputName: string;
  outputPath?: string;
}

export class RenderCleanupStack {
  private tasks: RenderCleanupTask[] = [];
  private closed = false;

  defer(task: RenderCleanupTask): RenderCleanupTask {
    if (this.closed) {
      throw new Error("Cannot register render cleanup after cleanup has started.");
    }
    assertNonEmptyString(task.id, "task.id");
    this.tasks.push(task);
    return task;
  }

  release(id: string): boolean {
    if (this.closed) {
      throw new Error("Cannot release render cleanup after cleanup has started.");
    }

    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return false;
    }

    this.tasks.splice(index, 1);
    return true;
  }

  async cleanup(reason: RenderCleanupReason, error?: unknown): Promise<RenderCleanupReport> {
    this.closed = true;
    const cleaned: RenderCleanupRecord[] = [];
    const failures: RenderCleanupFailure[] = [];
    const context = createCleanupContext(reason, error);

    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      const task = this.tasks[index];
      if (!task) {
        continue;
      }

      try {
        await task.cleanup(context);
        cleaned.push({ id: task.id, scope: task.scope });
      } catch (cleanupError) {
        failures.push({ id: task.id, scope: task.scope, error: cleanupError });
      }
    }

    this.tasks = [];
    return { reason, cleaned, failures };
  }
}

export function createRenderMetadata(options: CreateRenderMetadataOptions): RenderOutputMetadata {
  assertPositiveInteger(options.composition.durationFrames, "composition.durationFrames");
  assertPositiveInteger(options.preset.width, "preset.width");
  assertPositiveInteger(options.preset.height, "preset.height");
  assertPositiveNumber(options.preset.fps ?? options.composition.fps, "fps");
  assertNonEmptyString(options.ffmpegVersion, "ffmpegVersion");
  assertNonEmptyString(options.chromiumRevision, "chromiumRevision");

  const fps = options.preset.fps ?? options.composition.fps;
  const output: RenderOutputReference = {
    name: options.outputName ?? defaultOutputName(options.preset),
    format: options.preset.format
  };
  if (options.outputPath !== undefined) {
    output.path = options.outputPath;
  }

  return {
    version: "0.1",
    output,
    dimensions: {
      width: options.preset.width,
      height: options.preset.height
    },
    duration: {
      frames: options.composition.durationFrames,
      fps,
      seconds: options.composition.durationFrames / fps
    },
    codecs: {
      video: options.preset.codec ?? defaultVideoCodec(options.preset.format),
      audio: options.preset.audioCodec ?? null
    },
    checksums: normalizeChecksums(options.checksums),
    tools: {
      ffmpeg: {
        version: options.ffmpegVersion
      },
      chromium: {
        revision: options.chromiumRevision
      }
    },
    createdAt: options.createdAt ?? new Date().toISOString()
  };
}

export function createBrowserContextCleanupTask(
  driver: Pick<BrowserDriver, "close">,
  id = "browser-context"
): RenderCleanupTask {
  return {
    id,
    scope: "browser-context",
    cleanup: () => driver.close()
  };
}

export function createTemporaryFramesCleanupTask(
  cleanup: (context: RenderCleanupContext) => void | Promise<void>,
  id = "temporary-frames"
): RenderCleanupTask {
  return {
    id,
    scope: "temporary-frames",
    cleanup
  };
}

export async function withRenderCleanup<T>(
  operation: (cleanup: RenderCleanupStack) => T | Promise<T>
): Promise<T> {
  const cleanup = new RenderCleanupStack();
  let result: T | undefined;
  let operationError: unknown;
  let completed = false;

  try {
    result = await operation(cleanup);
    completed = true;
  } catch (error) {
    operationError = error;
  }

  const report = await cleanup.cleanup(completed ? "success" : "failure", operationError);
  if (report.failures.length > 0) {
    throw createCleanupFailureError(report, operationError);
  }

  if (operationError !== undefined) {
    throw operationError;
  }

  return result as T;
}

export async function captureFrames(options: CaptureFramesOptions): Promise<CaptureFramesResult> {
  const range = resolveFrameCaptureRange(options.composition, options.startFrame, options.frameCount);
  const captureOptions = {
    ...DEFAULT_BROWSER_FRAME_CAPTURE_OPTIONS,
    ...options.captureOptions
  };
  const retainCaptures = options.retainCaptures ?? options.onFrame === undefined;
  const captures: BrowserFrameCapture[] = [];
  const errors: FrameCaptureFrameError[] = [];
  let completedFrames = 0;
  let capturedFrames = 0;
  let failedFrames = 0;
  let bytesCaptured = 0;
  let openMs = 0;
  let evaluateMs: number | undefined;
  let screenshotMs: number | undefined;

  const createProgress =(phase: FrameCaptureProgressPhase, frame?: number, error?: unknown): FrameCaptureProgress => {
    const progress: FrameCaptureProgress = {
      phase,
      totalFrames: range.totalFrames,
      completedFrames,
      capturedFrames,
      failedFrames,
      bytesCaptured
    };
    if (frame !== undefined) {
      progress.frame = frame;
    }
    if (error !== undefined) {
      progress.error = error;
    }
    return progress;
  };

  await withRenderCleanup(async (cleanup) => {
    cleanup.defer(createBrowserContextCleanupTask(options.driver));
    await emitCaptureProgress(options.onProgress, createProgress("open"));
    const openStart = performance.now();
    await options.driver.open(options.composition, {
      viewport: createBrowserViewport(options.composition),
      ...options.openOptions
    });
    openMs = performance.now() - openStart;

    for (let frame = range.startFrame; frame < range.endFrame; frame += 1) {
      let capture: BrowserFrameCapture;
      try {
        capture = await options.driver.renderFrame(frame, captureOptions);
      } catch (error) {
        const failure = { frame, error };
        errors.push(failure);
        failedFrames += 1;
        completedFrames += 1;
        const progress = createProgress("frame-error", frame, error);
        await emitCaptureFrameError(options.onFrameError, failure, progress);
        await emitCaptureProgress(options.onProgress, progress);

        if (options.continueOnFrameError !== true) {
          throw createFrameCaptureError(failure);
        }

        continue;
      }

      if (retainCaptures) {
        captures.push(capture);
      }
      if (capture.timing !== undefined) {
        evaluateMs = (evaluateMs ?? 0) + capture.timing.evaluateMs;
        screenshotMs = (screenshotMs ?? 0) + capture.timing.screenshotMs;
      }
      capturedFrames += 1;
      completedFrames += 1;
      bytesCaptured += capture.bytes.byteLength;
      const progress = createProgress("capture", frame);
      await emitCapturedFrame(options.onFrame, capture, progress);
      await emitCaptureProgress(options.onProgress, progress);
    }

    await emitCaptureProgress(options.onProgress, createProgress("complete"));
  });

  return {
    captures,
    errors,
    totalFrames: range.totalFrames,
    completedFrames,
    capturedFrames,
    failedFrames,
    bytesCaptured,
    openMs,
    ...(evaluateMs !== undefined && { evaluateMs }),
    ...(screenshotMs !== undefined && { screenshotMs })
  };
}

export function expandRenderBatch(input: RenderBatchInput): RenderBatchJob[] {
  if (input.rows.length === 0) {
    throw new Error("Render batch must include at least one prop row.");
  }

  const presets = resolveBatchPresets(input.template, input.presets);
  if (presets.length === 0) {
    throw new Error("Render batch must include at least one export preset.");
  }

  const jobs: RenderBatchJob[] = [];
  input.rows.forEach((row, rowIndex) => {
    const rowId = stableRowId(row, rowIndex);
    presets.forEach((preset, presetIndex) => {
      const presetName = stableNamePart(preset.name, `preset-${formatIndex(presetIndex)}`);
      const outputNameOptions = {
        row,
        rowIndex,
        preset,
        presetIndex
      };
      const outputName = createStableOutputName(
        input.outputNamePrefix === undefined
          ? outputNameOptions
          : {
              ...outputNameOptions,
              prefix: input.outputNamePrefix
            }
      );
      const outputPath = joinOutputPath(input.outputDirectory, outputName);
      const props = cloneJsonObject(row.props ?? {});
      const job: RenderBatchJob = {
        id: `${rowId}:${presetName}`,
        rowIndex,
        rowId,
        presetIndex,
        presetName,
        props,
        preset: cloneJsonObject(preset),
        document: cloneDocumentForPreset(input.template, preset),
        outputName
      };
      if (outputPath !== undefined) {
        job.outputPath = outputPath;
      }
      jobs.push(job);
    });
  });

  return jobs;
}

export function createStableOutputName(options: {
  prefix?: string;
  row: RenderBatchRow;
  rowIndex: number;
  preset: KavioExportPreset;
  presetIndex: number;
}): string {
  const parts = [
    options.prefix === undefined ? undefined : stableNamePart(options.prefix, "batch"),
    stableRowId(options.row, options.rowIndex),
    stableNamePart(options.preset.name, `preset-${formatIndex(options.presetIndex)}`)
  ].filter((part): part is string => part !== undefined && part.length > 0);

  return `${parts.join("-")}.${extensionForFormat(options.preset.format)}`;
}

function resolveFrameCaptureRange(
  composition: KavioDocument,
  startFrame = 0,
  frameCount = composition.composition.durationFrames - startFrame
): { startFrame: number; endFrame: number; totalFrames: number } {
  assertPositiveInteger(composition.composition.durationFrames, "composition.composition.durationFrames");
  assertNonNegativeInteger(startFrame, "startFrame");
  assertPositiveInteger(frameCount, "frameCount");

  const endFrame = startFrame + frameCount;
  if (startFrame >= composition.composition.durationFrames) {
    throw new Error("startFrame must be less than composition.composition.durationFrames.");
  }
  if (endFrame > composition.composition.durationFrames) {
    throw new Error("frame capture range must not exceed composition.composition.durationFrames.");
  }

  return {
    startFrame,
    endFrame,
    totalFrames: frameCount
  };
}

async function emitCaptureProgress(
  onProgress: CaptureFramesOptions["onProgress"],
  progress: FrameCaptureProgress
): Promise<void> {
  if (onProgress !== undefined) {
    await onProgress(progress);
  }
}

async function emitCapturedFrame(
  onFrame: CaptureFramesOptions["onFrame"],
  capture: BrowserFrameCapture,
  progress: FrameCaptureProgress
): Promise<void> {
  if (onFrame !== undefined) {
    await onFrame(capture, progress);
  }
}

async function emitCaptureFrameError(
  onFrameError: CaptureFramesOptions["onFrameError"],
  failure: FrameCaptureFrameError,
  progress: FrameCaptureProgress
): Promise<void> {
  if (onFrameError !== undefined) {
    await onFrameError(failure, progress);
  }
}

function createFrameCaptureError(failure: FrameCaptureFrameError): Error {
  if (failure.error instanceof Error) {
    return new Error(`Failed to capture frame ${failure.frame}: ${failure.error.message}`, { cause: failure.error });
  }

  return new Error(`Failed to capture frame ${failure.frame}.`, { cause: failure.error });
}

function createCleanupContext(reason: RenderCleanupReason, error: unknown): RenderCleanupContext {
  if (error === undefined) {
    return { reason };
  }
  return { reason, error };
}

function createCleanupFailureError(report: RenderCleanupReport, operationError: unknown): AggregateError {
  const cleanupErrors = report.failures.map((failure) => failure.error);
  if (operationError !== undefined) {
    return new AggregateError(
      [operationError, ...cleanupErrors],
      "Render operation failed and one or more cleanup tasks failed."
    );
  }

  return new AggregateError(cleanupErrors, "One or more render cleanup tasks failed.");
}

function resolveBatchPresets(
  template: KavioDocument,
  presets: readonly RenderBatchPresetInput[] | undefined
): KavioExportPreset[] {
  const inputs = presets ?? template.exports;
  return inputs.map((preset) => {
    if (typeof preset !== "string") {
      return cloneJsonObject(preset);
    }

    const match = template.exports.find((candidate) => candidate.name === preset);
    if (!match) {
      throw new Error(`Unknown export preset "${preset}".`);
    }
    return cloneJsonObject(match);
  });
}

function cloneDocumentForPreset(template: KavioDocument, preset: KavioExportPreset): KavioDocument {
  return {
    ...cloneJsonObject(template),
    exports: [cloneJsonObject(preset)]
  };
}

function stableRowId(row: RenderBatchRow, rowIndex: number): string {
  const indexPart = `row-${formatIndex(rowIndex)}`;
  if (row.id === undefined || row.id.length === 0) {
    return indexPart;
  }

  return `${indexPart}-${stableNamePart(row.id, "item")}`;
}

function stableNamePart(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized.length === 0 ? fallback : normalized;
}

function formatIndex(index: number): string {
  return String(index + 1).padStart(3, "0");
}

function joinOutputPath(directory: string | undefined, outputName: string): string | undefined {
  if (directory === undefined || directory.length === 0) {
    return undefined;
  }

  return `${directory.replace(/\/+$/g, "")}/${outputName}`;
}

function defaultOutputName(preset: KavioExportPreset): string {
  return `${stableNamePart(preset.name, "render")}.${extensionForFormat(preset.format)}`;
}

function defaultVideoCodec(format: KavioExportFormat): KavioExportCodec | null {
  switch (format) {
    case "mp4":
      return "h264";
    case "webm":
      return "vp9";
    case "mov":
      return "prores";
    case "gif":
    case "png-sequence":
      return null;
  }
}

function normalizeChecksums(checksums: RenderChecksum | readonly RenderChecksum[] | undefined): RenderChecksum[] {
  if (checksums === undefined) {
    return [];
  }

  return (Array.isArray(checksums) ? checksums : [checksums]).map((checksum) => ({ ...checksum }));
}

function cloneJsonObject<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertNonEmptyString(value: string, name: string): void {
  if (value.length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

function assertPositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
}
