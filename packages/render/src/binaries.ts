import { stat } from "node:fs/promises";
import { renderError } from "./errors.js";

import { execSync } from "node:child_process";

/**
 * Resolve the path to the bundled FFmpeg binary (`ffmpeg-static`) or fall back to
 * a system `ffmpeg` command available on the PATH. Throws a structured
 * `BINARY_MISSING` error when neither is available.
 */
export async function resolveFfmpegPath(): Promise<string> {
  // 1. Try resolving system ffmpeg from the environment PATH
  try {
    const systemPath = execSync("which ffmpeg", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (systemPath.length > 0) {
      await stat(systemPath);
      return systemPath;
    }
  } catch {
    // Fall back to ffmpeg-static if system ffmpeg is missing
  }

  // 2. Try resolving bundled ffmpeg-static
  let resolved: unknown;
  try {
    const mod = (await import("ffmpeg-static")) as { default?: unknown };
    resolved = mod.default ?? mod;
  } catch {
    throw missingFfmpeg();
  }

  if (typeof resolved !== "string" || resolved.length === 0) {
    throw missingFfmpeg();
  }

  try {
    await stat(resolved);
  } catch {
    throw missingFfmpeg();
  }

  return resolved;
}

function missingFfmpeg(): ReturnType<typeof renderError> {
  return renderError({
    code: "BINARY_MISSING",
    stage: "ffmpeg",
    message: "Bundled or system FFmpeg is not available.",
    hint: "Install a system ffmpeg or install render binaries with 'corepack pnpm run install:render-binaries'."
  });
}
