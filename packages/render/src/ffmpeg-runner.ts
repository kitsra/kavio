import { resolveFfmpegPath } from "./binaries.js";
import { renderError } from "./errors.js";

export interface FfmpegChildStream {
  on(event: "data", listener: (chunk: unknown) => void): void;
}

export interface FfmpegChildWritable {
  write(chunk: Uint8Array): boolean;
  end(): void;
  on(event: "drain" | "error", listener: (...args: unknown[]) => void): void;
  once(event: "close", listener: () => void): void;
}

export interface FfmpegChildProcess {
  stdin?: FfmpegChildWritable | null;
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
  /**
   * Byte chunks piped to ffmpeg's stdin (e.g. an image2pipe PNG frame stream).
   * The runner applies write backpressure and ends stdin when the source
   * completes; a source failure kills ffmpeg and rejects with that error.
   */
  stdin?: AsyncIterable<Uint8Array>;
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
        let closed = false;

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

        if (runOptions.stdin !== undefined) {
          const stdin = child.stdin;
          if (stdin === undefined || stdin === null) {
            child.kill("SIGKILL");
            settle(() =>
              reject(
                renderError({
                  code: "FFMPEG_FAILED",
                  stage: "ffmpeg",
                  message: "ffmpeg child process exposes no stdin to pipe frames into."
                })
              )
            );
            return;
          }
          pumpStdin(stdin, runOptions.stdin, () => closed).catch((error: unknown) => {
            child.kill("SIGKILL");
            settle(() => reject(error));
          });
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
          closed = true;
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

async function pumpStdin(
  stdin: FfmpegChildWritable,
  source: AsyncIterable<Uint8Array>,
  isClosed: () => boolean
): Promise<void> {
  // One permanent listener per event; each backpressure pause parks a single
  // waiter that any of drain/error/close wakes. EPIPE from an early ffmpeg
  // exit is swallowed here — the child close handler reports the real failure
  // with stderr context.
  let waiter: (() => void) | null = null;
  const wake = (): void => {
    const parked = waiter;
    waiter = null;
    parked?.();
  };
  stdin.on("drain", wake);
  stdin.on("error", wake);
  stdin.once("close", wake);

  for await (const chunk of source) {
    if (isClosed()) {
      return;
    }
    if (!stdin.write(chunk)) {
      await new Promise<void>((resolve) => {
        waiter = resolve;
      });
    }
  }
  if (!isClosed()) {
    stdin.end();
  }
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
