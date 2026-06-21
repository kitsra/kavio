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
import { assembleRenderCommand } from "./assemble-command.js";
import { createFfmpegRunner, type FfmpegRunner } from "./ffmpeg-runner.js";
import { isRenderError, renderError } from "./errors.js";
import { PlaywrightDriver } from "./playwright-driver.js";
import { withEffectiveCodecs } from "./encoding.js";

export interface RenderCompositionOptions {
  preset: string | import("@kitsra/kavio-schema").KavioExportPreset;
  propValues?: Record<string, unknown>;
  outDir?: string;
  outputName?: string;
  driver?: BrowserDriver;
  ffmpegRunner?: FfmpegRunner;
  signal?: AbortSignal;
  continueOnFrameError?: boolean;
  ffmpegVersion?: string;
  chromiumRevision?: string;
}

export type RenderCompositionResult =
  | { ok: true; outputPath: string; metadata: RenderOutputMetadata }
  | { ok: false; errors: KavioError[] };

/** End-to-end render for one (composition × export): props → view → validate → capture → encode. */
export async function renderComposition(
  doc: KavioDocument,
  options: RenderCompositionOptions
): Promise<RenderCompositionResult> {
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

  try {
    const metadata = await withRenderCleanup(async (cleanup) => {
      const workDir = await mkdtemp(join(tmpdir(), "kavio-render-"));
      cleanup.defer(
        createTemporaryFramesCleanupTask(async () => {
          await rm(workDir, { recursive: true, force: true });
        }, "workdir")
      );

      const driver = options.driver ?? new PlaywrightDriver();
      const framePattern = join(workDir, "overlay-%05d.png");

      // captureFrames manages browser-context cleanup (open → capture → close).
      await captureFrames({
        driver,
        composition: view,
        continueOnFrameError: options.continueOnFrameError === true,
        onFrame: async (capture) => {
          const name = `overlay-${String(capture.frame).padStart(5, "0")}.png`;
          await writeFile(join(workDir, name), capture.bytes);
        }
      });

      await mkdir(dirname(outputPath), { recursive: true });
      const args = assembleRenderCommand({ view, preset, framePattern, outputPath });

      const ffmpegRunner = options.ffmpegRunner ?? createFfmpegRunner();
      await ffmpegRunner.run(args, options.signal === undefined ? {} : { signal: options.signal });

      const checksum = await sha256File(outputPath);
      return createRenderMetadata({
        composition: view.composition,
        preset: metadataPreset,
        outputName,
        outputPath,
        checksums: checksum,
        ffmpegVersion: options.ffmpegVersion ?? "ffmpeg-static",
        chromiumRevision: options.chromiumRevision ?? chromiumRevisionOf(driver)
      });
    });

    return { ok: true, outputPath, metadata };
  } catch (error) {
    return { ok: false, errors: [toKavioError(error)] };
  }
}

function chromiumRevisionOf(driver: BrowserDriver): string {
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
