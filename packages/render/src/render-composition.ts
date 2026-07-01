import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyExportPreset, collectCompositionResourceLimitInputs, collectResourceLimitViolations, resolveTemplateProps } from "@kitsra/kavio-core";
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
  createTemporaryFramesCleanupTask,
  withRenderCleanup,
  type BrowserDriver,
  type RenderChecksum,
  type RenderOutputMetadata
} from "@kitsra/kavio-render-worker";
import { assembleDirectRenderCommand, assembleRenderCommand } from "./assemble-command.js";
import { createFfmpegRunner, type FfmpegRunner } from "./ffmpeg-runner.js";
import { isRenderError, renderError } from "./errors.js";
import { PlaywrightDriver } from "./playwright-driver.js";
import { withEffectiveCodecs } from "./encoding.js";

export type RenderCompositionMode = "browser-overlay" | "ffmpeg-direct";

export interface RenderCompositionOptions {
  preset: string | import("@kitsra/kavio-schema").KavioExportPreset;
  propValues?: Record<string, unknown>;
  outDir?: string;
  outputName?: string;
  /**
   * Experimental: "ffmpeg-direct" skips browser PNG capture for compositions
   * that can be compiled directly into FFmpeg filters.
   */
  renderMode?: RenderCompositionMode;
  driver?: BrowserDriver;
  ffmpegRunner?: FfmpegRunner;
  signal?: AbortSignal;
  continueOnFrameError?: boolean;
  ffmpegVersion?: string;
  chromiumRevision?: string;
}

export interface RenderStageTimings {
  /** Browser launch + frame capture wall time; absent for ffmpeg-direct renders. */
  captureMs?: number;
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
  const resolution = resolveTemplateProps(doc, options.propValues ?? {});
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

  const renderabilityError = validateRenderablePreset(preset);
  if (renderabilityError !== null) {
    return { ok: false, errors: [renderabilityError] };
  }

  const outputName = options.outputName ?? `${preset.name}.${extensionForFormat(preset.format)}`;
  const outputPath = options.outDir === undefined ? outputName : join(options.outDir, outputName);
  const metadataPreset = withEffectiveCodecs(preset);
  const renderMode = options.renderMode ?? "browser-overlay";

  try {
    let captureMs: number | undefined;
    let encodeMs = 0;
    let checksumMs = 0;

    const metadata = await withRenderCleanup(async (cleanup) => {
      await mkdir(dirname(outputPath), { recursive: true });
      let browserDriver: BrowserDriver | undefined;
      const args =
        renderMode === "ffmpeg-direct"
          ? assembleDirectRenderCommand({ view, preset, outputPath })
          : await (async () => {
              const captureStart = performance.now();
              browserDriver = options.driver ?? new PlaywrightDriver();
              const assembled = await assembleBrowserOverlayRenderCommand({
                view,
                preset,
                outputPath,
                driver: browserDriver,
                continueOnFrameError: options.continueOnFrameError === true,
                deferCleanup: (task) => cleanup.defer(task)
              });
              captureMs = performance.now() - captureStart;
              return assembled;
            })();

      const ffmpegRunner = options.ffmpegRunner ?? createFfmpegRunner();
      const encodeStart = performance.now();
      await ffmpegRunner.run(args, options.signal === undefined ? {} : { signal: options.signal });
      encodeMs = performance.now() - encodeStart;

      const checksumStart = performance.now();
      const checksum = await sha256File(outputPath);
      checksumMs = performance.now() - checksumStart;
      return createRenderMetadata({
        composition: view.composition,
        preset: metadataPreset,
        outputName,
        outputPath,
        checksums: checksum,
        ffmpegVersion: options.ffmpegVersion ?? "ffmpeg-static",
        chromiumRevision: options.chromiumRevision ?? (renderMode === "ffmpeg-direct" ? "not-used" : chromiumRevisionOf(browserDriver))
      });
    });

    const timings: RenderStageTimings = {
      ...(captureMs !== undefined && { captureMs }),
      encodeMs,
      checksumMs,
      totalMs: performance.now() - totalStart
    };
    return { ok: true, outputPath, metadata, timings };
  } catch (error) {
    return { ok: false, errors: [toKavioError(error)] };
  }
}

async function assembleBrowserOverlayRenderCommand(options: {
  view: KavioDocument;
  preset: KavioExportPreset;
  outputPath: string;
  driver: BrowserDriver;
  continueOnFrameError: boolean;
  deferCleanup(task: ReturnType<typeof createTemporaryFramesCleanupTask>): void;
}): Promise<string[]> {
  const workDir = await mkdtemp(join(tmpdir(), "kavio-render-"));
  options.deferCleanup(
    createTemporaryFramesCleanupTask(async () => {
      await rm(workDir, { recursive: true, force: true });
    }, "workdir")
  );

  const framePattern = join(workDir, "overlay-%05d.png");

  // captureFrames manages browser-context cleanup (open → capture → close).
  await captureFrames({
    driver: options.driver,
    composition: options.view,
    continueOnFrameError: options.continueOnFrameError,
    onFrame: async (capture) => {
      const name = `overlay-${String(capture.frame).padStart(5, "0")}.png`;
      await writeFile(join(workDir, name), capture.bytes);
    }
  });

  return assembleRenderCommand({
    view: options.view,
    preset: options.preset,
    framePattern,
    outputPath: options.outputPath
  });
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

function validateRenderablePreset(preset: KavioExportPreset): KavioError | null {
  if (preset.format === "gif" || preset.format === "png-sequence") {
    return renderError({
      code: "RENDER_FAILED",
      stage: "render",
      path: "exports.0.format",
      message: `kavio render does not yet support ${preset.format} exports.`,
      hint: "Use mp4, webm, or mov for the current render pipeline."
    });
  }

  if (preset.background === "transparent") {
    return renderError({
      code: "RENDER_FAILED",
      stage: "render",
      path: "exports.0.background",
      message: "kavio render does not yet support transparent final outputs.",
      hint: "Use an opaque export background until alpha-capable encoding lands."
    });
  }

  return null;
}

function toKavioError(error: unknown): KavioError {
  if (isRenderError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return renderError({ code: "RENDER_FAILED", stage: "render", message });
}
