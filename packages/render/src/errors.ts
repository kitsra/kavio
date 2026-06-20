import type { KavioError, KavioErrorStage } from "@kavio/schema";

export const RENDER_ERROR_CODES = [
  "BINARY_MISSING",
  "BINARY_INCOMPATIBLE",
  "ASSET_FETCH_FAILED",
  "ASSET_UNSUPPORTED",
  "RENDER_FRAME_FAILED",
  "RENDER_TIMEOUT",
  "RENDER_CANCELLED",
  "RENDER_FAILED",
  "FFMPEG_FAILED",
  "FFMPEG_TIMEOUT",
  "IO_WRITE_FAILED",
  "IO_TEMP_FAILED"
] as const;

export type RenderErrorCode = (typeof RENDER_ERROR_CODES)[number];

export interface RenderErrorOptions {
  code: RenderErrorCode;
  stage: KavioErrorStage;
  message: string;
  path?: string;
  hint?: string;
  retryable?: boolean;
}

export function renderError(options: RenderErrorOptions): KavioError {
  const error: KavioError = {
    code: options.code,
    severity: "error",
    message: options.message,
    path: options.path ?? "",
    stage: options.stage,
    retryable: options.retryable ?? false
  };

  if (options.hint !== undefined) {
    error.hint = options.hint;
  }

  return error;
}

export function isRenderError(value: unknown): value is KavioError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { stage?: unknown }).stage === "string"
  );
}
