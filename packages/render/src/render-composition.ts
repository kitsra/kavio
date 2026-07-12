import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { applyExportPreset, collectCompositionResourceLimitInputs, collectResourceLimitViolations, resolveDocumentProps } from "@kitsra/kavio-core";
import {
  extensionForFormat,
  validateComposition,
  type KavioDocument,
  type KavioError,
  type KavioExportPreset
} from "@kitsra/kavio-schema";
import {
  captureFrames,
  createRenderMetadata,
  type BrowserDriver,
  type RenderChecksum,
  type RenderOutputMetadata
} from "@kitsra/kavio-render-worker";
import { assembleDirectRenderCommand, assembleRenderCommand, getDirectRenderSupport } from "./assemble-command.js";
import { createFfmpegRunner, type FfmpegRunner } from "./ffmpeg-runner.js";
import { createFrameByteQueue } from "./frame-stream.js";
import { isRenderError, renderError } from "./errors.js";
import { PlaywrightDriver } from "./playwright-driver.js";
import { withEffectiveCodecs } from "./encoding.js";

export type RenderCompositionMode = "auto" | "browser-overlay" | "ffmpeg-direct";
export type ResolvedRenderCompositionMode = Exclude<RenderCompositionMode, "auto">;

export interface RenderCompositionOptions {
  preset: string | import("@kitsra/kavio-schema").KavioExportPreset;
  propValues?: Record<string, unknown>;
  outDir?: string;
  outputName?: string;
  /**
   * "auto" selects FFmpeg-direct for eligible video compositions and falls
   * back to browser-overlay. Explicit FFmpeg-direct rejects unsupported views.
   */
  renderMode?: RenderCompositionMode;
  /**
   * Concurrent capture pages for browser-overlay renders. Defaults to
   * min(4, cores - 1). Deterministic: output bytes match serial capture.
   */
  captureParallelism?: number;
  driver?: BrowserDriver;
  ffmpegRunner?: FfmpegRunner;
  signal?: AbortSignal;
  continueOnFrameError?: boolean;
  ffmpegVersion?: string;
  chromiumRevision?: string;
}

export interface RenderStageTimings {
  /** Requested mode, including auto when used. */
  requestedRenderMode: RenderCompositionMode;
  /** Renderer actually used for this export. */
  renderMode: ResolvedRenderCompositionMode;
  /** Browser launch + frame capture wall time; absent for ffmpeg-direct renders. */
  captureMs?: number;
  /** Driver open wall time (browser launch + harness ready) within captureMs. */
  browserOpenMs?: number;
  /** Chromium processes launched during this render; zero means a batch session reused them. */
  browserLaunches?: number;
  /** Summed per-frame seek/evaluate time, when the driver reports it. */
  captureEvaluateMs?: number;
  /** Summed per-frame screenshot time, when the driver reports it. */
  captureScreenshotMs?: number;
  /** FFmpeg encode wall time. */
  encodeMs: number;
  /** Output checksum wall time. */
  checksumMs: number;
  /** Full renderComposition wall time, including validation and cleanup. */
  totalMs: number;
}

export type RenderCompositionResult =
  | { ok: true; outputPath: string; outputPattern?: string; metadata: RenderOutputMetadata; timings: RenderStageTimings }
  | { ok: false; errors: KavioError[] };

/** End-to-end render for one (composition × export): props → view → validate → capture → encode. */
export async function renderComposition(
  doc: KavioDocument,
  options: RenderCompositionOptions
): Promise<RenderCompositionResult> {
  const totalStart = performance.now();
  if (options.captureParallelism !== undefined && (!Number.isInteger(options.captureParallelism) || options.captureParallelism < 1)) {
    return {
      ok: false,
      errors: [
        renderError({
          code: "RENDER_FAILED",
          stage: "render",
          path: "captureParallelism",
          message: "captureParallelism must be a positive integer."
        })
      ]
    };
  }

  // resolveDocumentProps merges declared prop defaults before substitution.
  const resolution = resolveDocumentProps(doc, options.propValues ?? {});
  if (!resolution.ok) {
    return { ok: false, errors: resolution.errors };
  }

  let view: KavioDocument;
  try {
    view = applyExportPreset(resolution.value, options.preset);
  } catch (error) {
    return { ok: false, errors: [toKavioError(error)] };
  }

  const preset = view.exports[0];
  if (preset === undefined) {
    return {
      ok: false,
      errors: [renderError({ code: "RENDER_FAILED", stage: "render", message: "No export preset resolved for render." })]
    };
  }

  const validation = validateComposition(view);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const violations = collectResourceLimitViolations(collectCompositionResourceLimitInputs(view));
  if (violations.length > 0) {
    return { ok: false, errors: violations };
  }

  const renderabilityError = validateRenderablePreset(preset, view.composition.background);
  if (renderabilityError !== null) {
    return { ok: false, errors: [renderabilityError] };
  }

  const pngSequence = preset.format === "png-sequence";
  if (pngSequence && options.continueOnFrameError === true) {
    return {
      ok: false,
      errors: [
        renderError({
          code: "RENDER_FAILED",
          stage: "render",
          path: "continueOnFrameError",
          message: "png-sequence exports require every frame and do not support continueOnFrameError.",
          hint: "Remove continueOnFrameError so a missing frame fails and cleans up the incomplete sequence."
        })
      ]
    };
  }
  const requestedOutputName = options.outputName ?? `${preset.name}.${extensionForFormat(preset.format)}`;
  const sequenceOutput = pngSequence ? resolvePngSequenceOutputName(requestedOutputName) : null;
  if (sequenceOutput !== null && !sequenceOutput.ok) {
    return { ok: false, errors: [sequenceOutput.error] };
  }
  const outputName = sequenceOutput?.name ?? requestedOutputName;
  const outputPath = options.outDir === undefined ? outputName : join(options.outDir, outputName);
  const stillImage = preset.format === "png";
  const browserImageOutput = stillImage || pngSequence;
  const metadataPreset = browserImageOutput ? preset : withEffectiveCodecs(preset);
  const requestedRenderMode = options.renderMode ?? "browser-overlay";
  const renderMode: ResolvedRenderCompositionMode = browserImageOutput
    ? "browser-overlay"
    : requestedRenderMode === "auto"
      ? getDirectRenderSupport(view).ok ? "ffmpeg-direct" : "browser-overlay"
      : requestedRenderMode;

  try {
    let captureMs: number | undefined;
    let browserOpenMs: number | undefined;
    let browserLaunches: number | undefined;
    let captureEvaluateMs: number | undefined;
    let captureScreenshotMs: number | undefined;
    let encodeMs = 0;

    await mkdir(dirname(outputPath), { recursive: true });
    const ffmpegRunner = options.ffmpegRunner ?? createFfmpegRunner();
    let browserDriver: BrowserDriver | undefined;
    let sequenceChecksum: RenderChecksum | undefined;
    let outputPattern: string | undefined;

    if (stillImage) {
      // Still images bypass ffmpeg entirely: capture one frame and write the
      // PNG bytes. The stage paints the effective background in-browser, so
      // opaque and transparent exports both match the preview exactly.
      browserDriver = options.driver ?? new PlaywrightDriver();
      const launchesBefore = browserLaunchCountOf(browserDriver);
      const captureStart = performance.now();
      const captureResult = await captureFrames({
        driver: browserDriver,
        composition: withStillImageBackground(view, preset),
        startFrame: preset.frame ?? 0,
        frameCount: 1,
        retainCaptures: true
      });
      captureMs = performance.now() - captureStart;
      browserOpenMs = captureResult.openMs;
      browserLaunches = browserLaunchDelta(browserDriver, launchesBefore);
      captureEvaluateMs = captureResult.evaluateMs;
      captureScreenshotMs = captureResult.screenshotMs;
      const bytes = captureResult.captures[0]?.bytes;
      if (bytes === undefined) {
        throw renderError({
          code: "RENDER_FRAME_FAILED",
          stage: "render",
          message: `Still-image capture produced no frame for "${preset.name}".`
        });
      }
      await writeFile(outputPath, bytes);
    } else if (pngSequence) {
      await createPngSequenceDirectory(outputPath);
      browserDriver = options.driver ?? new PlaywrightDriver();
      const launchesBefore = browserLaunchCountOf(browserDriver);
      const hash = createHash("sha256");
      let bytes = 0;
      outputPattern = join(outputPath, "frame-%05d.png");
      const captureStart = performance.now();
      try {
        const captureResult = await captureFrames({
          driver: browserDriver,
          composition: withStillImageBackground(view, preset),
          parallelism: options.captureParallelism ?? defaultCaptureParallelism(),
          continueOnFrameError: options.continueOnFrameError === true,
          onFrame: async (capture) => {
            hash.update(capture.bytes);
            bytes += capture.bytes.byteLength;
            await writeFile(join(outputPath, pngSequenceFrameName(capture.frame)), capture.bytes);
          }
        });
        captureMs = performance.now() - captureStart;
        browserOpenMs = captureResult.openMs;
        browserLaunches = browserLaunchDelta(browserDriver, launchesBefore);
        captureEvaluateMs = captureResult.evaluateMs;
        captureScreenshotMs = captureResult.screenshotMs;
        sequenceChecksum = { algorithm: "sha256", value: hash.digest("hex"), bytes };
      } catch (error) {
        await rm(outputPath, { recursive: true, force: true });
        throw error;
      }
    } else if (renderMode === "ffmpeg-direct") {
      const args = assembleDirectRenderCommand({ view, preset, outputPath });
      const encodeStart = performance.now();
      await ffmpegRunner.run(args, options.signal === undefined ? {} : { signal: options.signal });
      encodeMs = performance.now() - encodeStart;
    } else {
      // Overlay frames stream straight into ffmpeg stdin so capture and encode
      // overlap; the bounded queue applies backpressure instead of buffering
      // the render or round-tripping PNG files through a temp directory.
      browserDriver = options.driver ?? new PlaywrightDriver();
      const captureDriver = browserDriver;
      const flattenedBrowserFrames = canFlattenBrowserFrames(captureDriver, view, preset);
      const captureView = flattenedBrowserFrames ? withStillImageBackground(view, preset) : view;
      const args = assembleRenderCommand({ view, preset, outputPath, flattenedBrowserFrames });
      const launchesBefore = browserLaunchCountOf(captureDriver);
      const frames = createFrameByteQueue();

      const captureStart = performance.now();
      // captureFrames manages browser-context cleanup (open → capture → close).
      const capturePromise = captureFrames({
        driver: captureDriver,
        composition: captureView,
        parallelism: options.captureParallelism ?? defaultCaptureParallelism(),
        continueOnFrameError: options.continueOnFrameError === true,
        onFrame: async (capture) => {
          await frames.push(capture.bytes);
        }
      }).then(
        (captureResult) => {
          captureMs = performance.now() - captureStart;
          browserOpenMs = captureResult.openMs;
          browserLaunches = browserLaunchDelta(captureDriver, launchesBefore);
          captureEvaluateMs = captureResult.evaluateMs;
          captureScreenshotMs = captureResult.screenshotMs;
          frames.end();
        },
        (error: unknown) => {
          frames.fail(error);
          throw error;
        }
      );

      const encodeStart = performance.now();
      const ffmpegPromise = ffmpegRunner
        .run(args, options.signal === undefined ? { stdin: frames } : { stdin: frames, signal: options.signal })
        .then(
          (result) => {
            encodeMs = performance.now() - encodeStart;
            return result;
          },
          (error: unknown) => {
            // Stop capture instead of letting it fill the queue for a dead consumer.
            frames.fail(error);
            throw error;
          }
        );

      const [captureSettled, ffmpegSettled] = await Promise.allSettled([capturePromise, ffmpegPromise]);
      // A genuine capture failure poisons the queue and surfaces through the
      // ffmpeg rejection too, so prefer the ffmpeg outcome, then capture.
      if (ffmpegSettled.status === "rejected") {
        throw ffmpegSettled.reason;
      }
      if (captureSettled.status === "rejected") {
        throw captureSettled.reason;
      }
    }

    const checksumStart = performance.now();
    const checksum = sequenceChecksum ?? await sha256File(outputPath);
    const checksumMs = performance.now() - checksumStart;

    const metadata = createRenderMetadata({
      composition: view.composition,
      preset: metadataPreset,
      outputName,
      outputPath,
      checksums: checksum,
      ffmpegVersion: options.ffmpegVersion ?? (browserImageOutput ? "not-used" : "ffmpeg-static"),
      chromiumRevision: options.chromiumRevision ?? (renderMode === "ffmpeg-direct" ? "not-used" : chromiumRevisionOf(browserDriver))
    });

    const timings: RenderStageTimings = {
      requestedRenderMode,
      renderMode,
      ...(captureMs !== undefined && { captureMs }),
      ...(browserOpenMs !== undefined && { browserOpenMs }),
      ...(browserLaunches !== undefined && { browserLaunches }),
      ...(captureEvaluateMs !== undefined && { captureEvaluateMs }),
      ...(captureScreenshotMs !== undefined && { captureScreenshotMs }),
      encodeMs,
      checksumMs,
      totalMs: performance.now() - totalStart
    };
    return { ok: true, outputPath, ...(outputPattern !== undefined && { outputPattern }), metadata, timings };
  } catch (error) {
    return { ok: false, errors: [toKavioError(error)] };
  }
}

function defaultCaptureParallelism(): number {
  return Math.max(1, Math.min(4, availableParallelism() - 1));
}

function chromiumRevisionOf(driver: BrowserDriver | undefined): string {
  if (driver instanceof PlaywrightDriver && driver.chromiumVersion !== null) {
    return driver.chromiumVersion;
  }
  return "unknown";
}

function browserLaunchCountOf(driver: BrowserDriver): number | undefined {
  return "browserLaunches" in driver && typeof driver.browserLaunches === "number" ? driver.browserLaunches : undefined;
}

function browserLaunchDelta(driver: BrowserDriver, before: number | undefined): number | undefined {
  const after = browserLaunchCountOf(driver);
  return before === undefined || after === undefined ? undefined : after - before;
}

async function sha256File(path: string): Promise<RenderChecksum> {
  const bytes = await readFile(path);
  const value = createHash("sha256").update(bytes).digest("hex");
  return { algorithm: "sha256", value, bytes: bytes.length };
}

function validateRenderablePreset(preset: KavioExportPreset, compositionBackground: string | undefined): KavioError | null {
  const background = preset.background ?? compositionBackground;
  if (background === "transparent" && preset.format !== "webm" && preset.format !== "mov" && preset.format !== "png-sequence" && preset.format !== "png") {
    return renderError({
      code: "RENDER_FAILED",
      stage: "render",
      path: "exports.0.background",
      message: `kavio render does not support transparent ${preset.format} outputs.`,
      hint: "Use transparent webm, mov, png-sequence, or png exports for alpha output."
    });
  }

  return null;
}

function resolvePngSequenceOutputName(outputName: string): { ok: true; name: string } | { ok: false; error: KavioError } {
  const name = outputName.toLowerCase().endsWith(".zip") ? outputName.slice(0, -4) : outputName;
  if (name.length === 0 || name === "." || name === ".." || /[\\/]/u.test(name)) {
    return {
      ok: false,
      error: renderError({
        code: "RENDER_FAILED",
        stage: "render",
        path: "outputName",
        message: "png-sequence outputName must name one new directory and cannot contain path separators.",
        hint: "Pass the parent directory with outDir and a directory name such as frames with outputName."
      })
    };
  }
  return { ok: true, name };
}

async function createPngSequenceDirectory(outputPath: string): Promise<void> {
  try {
    await mkdir(outputPath);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw renderError({
        code: "RENDER_FAILED",
        stage: "render",
        path: "outputName",
        message: `png-sequence output path already exists: ${outputPath}`,
        hint: "Choose a new outputName or remove the existing directory before rendering."
      });
    }
    throw error;
  }
}

function pngSequenceFrameName(frame: number): string {
  return `frame-${String(frame).padStart(5, "0")}.png`;
}

function isNodeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

/**
 * Still images paint their effective background in the browser stage instead
 * of compositing it in ffmpeg, so exports default to the composition
 * background rather than capturing transparent pixels.
 */
function withStillImageBackground(view: KavioDocument, preset: KavioExportPreset): KavioDocument {
  const background = preset.background ?? view.composition.background ?? "#000000";
  const [first, ...rest] = view.exports;
  if (first === undefined) {
    return view;
  }
  return { ...view, exports: [{ ...first, background }, ...rest] };
}

function canFlattenBrowserFrames(driver: BrowserDriver, view: KavioDocument, preset: KavioExportPreset): boolean {
  const background = preset.background ?? view.composition.background ?? "#000000";
  return (
    driver instanceof PlaywrightDriver &&
    driver.usesKavioRenderHarness &&
    background !== "transparent" &&
    !view.layers.some((layer) => layer.type === "video")
  );
}

function toKavioError(error: unknown): KavioError {
  if (isRenderError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return renderError({ code: "RENDER_FAILED", stage: "render", message });
}
