import { resolveFfmpegPath } from "./binaries.js";
import { renderError } from "./errors.js";

export interface FfmpegChildStream {
  on(event: "data", listener: (chunk: unknown) => void): void;
}

export interface FfmpegChildProcess {
  stdout: FfmpegChildStream | null;
  stderr: FfmpegChildStream | null;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close", listener: (code: number | null) => void): void;
  kill(signal?: string): void;
}

export type FfmpegSpawn = (command: string, args: readonly string[]) => FfmpegChildProcess;

export interface FfmpegRunOptions {
  onProgress?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface FfmpegRunResult {
  code: number;
  stderr: string;
}

export interface FfmpegRunner {
  run(args: readonly string[], options?: FfmpegRunOptions): Promise<FfmpegRunResult>;
}

export interface CreateFfmpegRunnerOptions {
  spawn?: FfmpegSpawn;
  resolveBinary?: () => string | Promise<string>;
}

const STDERR_TAIL_LENGTH = 800;

export function createFfmpegRunner(options: CreateFfmpegRunnerOptions = {}): FfmpegRunner {
  return {
    async run(args, runOptions = {}) {
      const spawn = options.spawn ?? (await defaultSpawn());
      const binary = await (options.resolveBinary ?? resolveFfmpegPath)();

      return await new Promise<FfmpegRunResult>((resolve, reject) => {
        const signal = runOptions.signal;
        if (signal?.aborted === true) {
          reject(cancelledError());
          return;
        }

        const child = spawn(binary, args);
        let stderr = "";
        let settled = false;

        const settle = (action: () => void): void => {
          if (settled) {
            return;
          }
          settled = true;
          if (signal !== undefined) {
            signal.removeEventListener("abort", onAbort);
          }
          action();
        };

        function onAbort(): void {
          child.kill("SIGKILL");
          settle(() => reject(cancelledError()));
        }

        if (signal !== undefined) {
          signal.addEventListener("abort", onAbort);
        }

        child.stderr?.on("data", (chunk) => {
          stderr = `${stderr}${String(chunk)}`.slice(-STDERR_TAIL_LENGTH);
        });

        if (runOptions.onProgress !== undefined) {
          const onProgress = runOptions.onProgress;
          child.stdout?.on("data", (chunk) => onProgress(String(chunk)));
        }

        child.on("error", (error) => {
          settle(() =>
            reject(
              renderError({
                code: "FFMPEG_FAILED",
                stage: "ffmpeg",
                message: `Failed to start ffmpeg: ${error.message}`
              })
            )
          );
        });

        child.on("close", (code) => {
          settle(() => {
            if (code === 0) {
              resolve({ code: 0, stderr });
              return;
            }
            const message = `ffmpeg exited with code ${code ?? "unknown"}.`;
            reject(
              stderr.length > 0
                ? renderError({ code: "FFMPEG_FAILED", stage: "ffmpeg", message, hint: stderr })
                : renderError({ code: "FFMPEG_FAILED", stage: "ffmpeg", message })
            );
          });
        });
      });
    }
  };
}

function cancelledError(): ReturnType<typeof renderError> {
  return renderError({
    code: "RENDER_CANCELLED",
    stage: "ffmpeg",
    message: "Render cancelled before ffmpeg completed."
  });
}

async function defaultSpawn(): Promise<FfmpegSpawn> {
  const childProcess = await import("node:child_process");
  return (command, args) => childProcess.spawn(command, [...args]) as unknown as FfmpegChildProcess;
}
