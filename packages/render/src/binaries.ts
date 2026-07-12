import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { renderError } from "./errors.js";

export type FfmpegBinarySource = "environment" | "system" | "ffmpeg-static";

export interface FfmpegBinaryDiagnostics {
  path: string;
  source: FfmpegBinarySource;
  version: string;
}

interface ResolvedFfmpegBinary {
  path: string;
  source: FfmpegBinarySource;
}

/**
 * Resolve FFmpeg in operational-precedence order: an explicit
 * `KAVIO_FFMPEG_PATH`, a system binary on PATH, then `ffmpeg-static`.
 */
export async function resolveFfmpegPath(): Promise<string> {
  return (await resolveFfmpegBinary()).path;
}

/** Resolve FFmpeg and report the exact binary and version selected. */
export async function resolveFfmpegDiagnostics(): Promise<FfmpegBinaryDiagnostics> {
  const binary = await resolveFfmpegBinary();

  try {
    const output = execFileSync(binary.path, ["-version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const version = /^ffmpeg version\s+(\S+)/im.exec(output)?.[1];
    if (version === undefined) {
      throw new Error("version output was not recognized");
    }
    return { ...binary, version };
  } catch {
    throw renderError({
      code: "BINARY_INCOMPATIBLE",
      stage: "ffmpeg",
      message: `FFmpeg at '${binary.path}' did not return a recognizable version.`,
      hint: `Run '${binary.path} -version' and confirm that the configured binary is FFmpeg.`
    });
  }
}

async function resolveFfmpegBinary(): Promise<ResolvedFfmpegBinary> {
  const configuredPath = process.env.KAVIO_FFMPEG_PATH;
  if (configuredPath !== undefined && configuredPath.length > 0) {
    const path = resolve(configuredPath);
    if (!(await isExecutableFile(path))) {
      throw renderError({
        code: "BINARY_MISSING",
        stage: "ffmpeg",
        message: `KAVIO_FFMPEG_PATH does not point to an executable file: '${path}'.`,
        hint: "Correct or unset KAVIO_FFMPEG_PATH; Kavio will only try system and ffmpeg-static fallbacks when it is unset."
      });
    }
    return { path, source: "environment" };
  }

  const systemPath = findSystemFfmpeg();
  if (systemPath !== null && (await isExecutableFile(systemPath))) {
    return { path: systemPath, source: "system" };
  }

  let staticPath: unknown;
  try {
    const mod = (await import("ffmpeg-static")) as { default?: unknown };
    staticPath = mod.default ?? mod;
  } catch {
    throw missingFfmpeg();
  }

  if (typeof staticPath !== "string" || staticPath.length === 0 || !(await isExecutableFile(staticPath))) {
    throw missingFfmpeg();
  }

  return { path: staticPath, source: "ffmpeg-static" };
}

function findSystemFfmpeg(): string | null {
  try {
    const locator = process.platform === "win32" ? "where" : "which";
    const output = execFileSync(locator, ["ffmpeg"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output.split(/\r?\n/, 1)[0]?.trim() || null;
  } catch {
    return null;
  }
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    await access(path, constants.X_OK);
    return info.isFile();
  } catch {
    return false;
  }
}

function missingFfmpeg(): ReturnType<typeof renderError> {
  return renderError({
    code: "BINARY_MISSING",
    stage: "ffmpeg",
    message: "No usable FFmpeg binary is available.",
    hint: "Set KAVIO_FFMPEG_PATH, install a system ffmpeg, or install render binaries with 'corepack pnpm run install:render-binaries'."
  });
}
