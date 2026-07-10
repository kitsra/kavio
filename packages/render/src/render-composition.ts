import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  | { ok: true; outputPath: string; metadata: RenderOutputMetadata; timings: RenderStageTimings }
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

  const outputName = options.outputName ?? `${preset.name}.${extensionForFormat(preset.format)}`;
  const outputPath = options.outDir === undefined ? outputName : join(options.outDir, outputName);
  const stillImage = preset.format === "png";
  const metadataPreset = stillImage ? preset : withEffectiveCodecs(preset);
  const requestedRenderMode = options.renderMode ?? "browser-overlay";
  const renderMode: ResolvedRenderCompositionMode = stillImage
    ? "browser-overlay"
    : requestedRenderMode === "auto"
      ? getDirectRenderSupport(view).ok ? "ffmpeg-direct" : "browser-overlay"
      : requestedRenderMode;

  try {
    let captureMs: number | undefined;
    let browserOpenMs: number | undefined;
    let captureEvaluateMs: number | undefined;
    let captureScreenshotMs: number | undefined;
    let encodeMs = 0;

    await mkdir(dirname(outputPath), { recursive: true });
    const ffmpegRunner = options.ffmpegRunner ?? createFfmpegRunner();
    let browserDriver: BrowserDriver | undefined;

    if (stillImage) {
      // Still images bypass ffmpeg entirely: capture one frame and write the
      // PNG bytes. The stage paints the effective background in-browser, so
      // opaque and transparent exports both match the preview exactly.
      browserDriver = options.driver ?? new PlaywrightDriver();
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
    } else if (renderMode === "ffmpeg-direct") {
      const args = assembleDirectRenderCommand({ view, preset, outputPath });
      const encodeStart = performance.now();
      await ffmpegRunner.run(args, options.signal === undefined ? {} : { signal: options.signal });
      encodeMs = performance.now() - encodeStart;
    } else {
      // Overlay frames stream straight into ffmpeg stdin so capture and encode
      // overlap; the bounded queue applies backpressure instead of buffering
      // the render or round-tripping PNG files through a temp directory.
      const args = assembleRenderCommand({ view, preset, outputPath });
      browserDriver = options.driver ?? new PlaywrightDriver();
      const frames = createFrameByteQueue();

      const captureStart = performance.now();
      // captureFrames manages browser-context cleanup (open → capture → close).
      const capturePromise = captureFrames({
        driver: browserDriver,
        composition: view,
        parallelism: options.captureParallelism ?? defaultCaptureParallelism(),
        continueOnFrameError: options.continueOnFrameError === true,
        onFrame: async (capture) => {
          await frames.push(capture.bytes);
        }
      }).then(
        (captureResult) => {
          captureMs = performance.now() - captureStart;
          browserOpenMs = captureResult.openMs;
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
    const checksum = await sha256File(outputPath);
    const checksumMs = performance.now() - checksumStart;

    const metadata = createRenderMetadata({
      composition: view.composition,
      preset: metadataPreset,
      outputName,
      outputPath,
      checksums: checksum,
      ffmpegVersion: options.ffmpegVersion ?? (stillImage ? "not-used" : "ffmpeg-static"),
      chromiumRevision: options.chromiumRevision ?? (renderMode === "ffmpeg-direct" ? "not-used" : chromiumRevisionOf(browserDriver))
    });

    const timings: RenderStageTimings = {
      requestedRenderMode,
      renderMode,
      ...(captureMs !== undefined && { captureMs }),
      ...(browserOpenMs !== undefined && { browserOpenMs }),
      ...(captureEvaluateMs !== undefined && { captureEvaluateMs }),
      ...(captureScreenshotMs !== undefined && { captureScreenshotMs }),
      encodeMs,
      checksumMs,
      totalMs: performance.now() - totalStart
    };
    return { ok: true, outputPath, metadata, timings };
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

async function sha256File(path: string): Promise<RenderChecksum> {
  const bytes = await readFile(path);
  const value = createHash("sha256").update(bytes).digest("hex");
  return { algorithm: "sha256", value, bytes: bytes.length };
}

function validateRenderablePreset(preset: KavioExportPreset, compositionBackground: string | undefined): KavioError | null {
  if (preset.format === "png-sequence") {
    return renderError({
      code: "RENDER_FAILED",
      stage: "render",
      path: "exports.0.format",
      message: `kavio render does not yet support ${preset.format} exports.`,
      hint: "Use gif, mp4, webm, or mov for the current render pipeline."
    });
  }

  const background = preset.background ?? compositionBackground;
  if (background === "transparent" && preset.format !== "webm" && preset.format !== "mov" && preset.format !== "png") {
    return renderError({
      code: "RENDER_FAILED",
      stage: "render",
      path: "exports.0.background",
      message: `kavio render does not support transparent ${preset.format} outputs.`,
      hint: "Use transparent webm, mov, or png exports for alpha output."
    });
  }

  return null;
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

function toKavioError(error: unknown): KavioError {
  if (isRenderError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return renderError({ code: "RENDER_FAILED", stage: "render", message });
}
