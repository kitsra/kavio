import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveFfmpegPath } from "@kitsra/kavio-render";

declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
};

export interface DemoAssets {
  primaryClip: string;
  secondaryClip: string;
  logo: string;
  music: string;
}

/**
 * Generate small synthetic media assets with FFmpeg's lavfi sources and reuse
 * the repository Kavio logo so the MVP demo renders with zero external
 * downloads.
 */
export async function prepareDemoAssets(outputDirectory = "tmp/mvp-demo/assets"): Promise<DemoAssets> {
  const ffmpeg = await resolveFfmpegPath();
  const dir = resolveDemoPath(outputDirectory);
  await mkdir(dir, { recursive: true });

  const assets: DemoAssets = {
    primaryClip: resolve(dir, "primary.mp4"),
    secondaryClip: resolve(dir, "secondary.mp4"),
    logo: kavioLogoPath(),
    music: resolve(dir, "tone.wav")
  };

  await runFfmpeg(ffmpeg, [
    "-y", "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=30:duration=4",
    "-pix_fmt", "yuv420p", "-t", "4", assets.primaryClip
  ]);
  await runFfmpeg(ffmpeg, [
    "-y", "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=30:duration=4",
    "-pix_fmt", "yuv420p", "-t", "4", assets.secondaryClip
  ]);
  await runFfmpeg(ffmpeg, [
    "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=8", assets.music
  ]);

  return assets;
}

function resolveDemoPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }
  return resolve(packageRoot(), path);
}

function packageRoot(): string {
  return decodeURIComponent(new URL("../", import.meta.url).pathname);
}

function kavioLogoPath(): string {
  return decodeURIComponent(new URL("../../../site/assets/brand/kavio-frame-stack-lockup.png", import.meta.url).pathname);
}

function runFfmpeg(ffmpeg: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`ffmpeg exited with ${code ?? "unknown"} while preparing assets.\n${stderr}`));
    });
  });
}

if (process.argv[1]?.endsWith("prepare-assets.js") === true) {
  prepareDemoAssets()
    .then((assets) => {
      process.stdout.write(`${JSON.stringify(assets, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${formatError(error)}\n`);
      process.exitCode = 1;
    });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = error as { code?: unknown; message?: unknown; hint?: unknown };
    const code = typeof value.code === "string" ? `[${value.code}] ` : "";
    const message = typeof value.message === "string" ? value.message : JSON.stringify(error);
    const hint = typeof value.hint === "string" ? `\n${value.hint}` : "";
    return `${code}${message}${hint}`;
  }
  return String(error);
}
