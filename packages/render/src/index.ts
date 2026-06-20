export const KAVIO_RENDER_PACKAGE = "@kavio/render";

export { renderError, isRenderError, RENDER_ERROR_CODES, type RenderErrorCode, type RenderErrorOptions } from "./errors.js";
export { assembleRenderCommand, type AssembleRenderCommandOptions } from "./assemble-command.js";
export { resolveFfmpegPath } from "./binaries.js";
export {
  createFfmpegRunner,
  type FfmpegRunner,
  type FfmpegRunOptions,
  type FfmpegRunResult,
  type FfmpegSpawn,
  type FfmpegChildProcess,
  type CreateFfmpegRunnerOptions
} from "./ffmpeg-runner.js";
export {
  createRenderHarnessServer,
  type RenderHarnessServer,
  type CreateRenderHarnessServerOptions
} from "./harness-server.js";
export { PlaywrightDriver, type PlaywrightDriverOptions } from "./playwright-driver.js";
export {
  renderComposition,
  type RenderCompositionOptions,
  type RenderCompositionResult
} from "./render-composition.js";
export { renderBatch, type RenderBatchOptions, type RenderBatchItemResult } from "./render-batch.js";
export type { RenderBatchInput, RenderBatchRow } from "@kavio/render-worker";
export {
  FakeBrowserDriver,
  createFakeFfmpegRunner,
  type FakeFfmpegRunner,
  type CreateFakeFfmpegRunnerOptions
} from "./testing.js";
