import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createBrowserViewport,
  createPngFrameCapture,
  type BrowserDriver,
  type BrowserFrameCapture,
  type BrowserFrameCaptureOptions,
  type BrowserOpenOptions,
  type BrowserViewport
} from "@kitsra/kavio-render-worker";
import type { KavioDocument } from "@kitsra/kavio-schema";
import { renderError } from "./errors.js";
import type { FfmpegRunner, FfmpegRunOptions, FfmpegRunResult } from "./ffmpeg-runner.js";

const FAKE_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** In-memory BrowserDriver that returns deterministic PNG bytes without Chromium. */
export class FakeBrowserDriver implements BrowserDriver {
  opens = 0;
  closes = 0;
  /** Forks created across this driver and its descendants. */
  forks = 0;
  /** Fork close() calls, aggregated on the root driver. */
  forkCloses = 0;
  /** Frames rendered across this driver and all forks, in completion order. */
  renderedFrames: number[] = [];
  private viewport: BrowserViewport | null = null;
  private root: FakeBrowserDriver | null = null;

  async open(composition: KavioDocument, options: BrowserOpenOptions = {}): Promise<void> {
    this.opens += 1;
    this.viewport = options.viewport ?? createBrowserViewport(composition);
  }

  async fork(): Promise<BrowserDriver> {
    if (this.viewport === null) {
      throw renderError({
        code: "RENDER_FRAME_FAILED",
        stage: "render",
        message: "FakeBrowserDriver.fork called before open()."
      });
    }
    const root = this.root ?? this;
    root.forks += 1;
    const child = new FakeBrowserDriver();
    child.root = root;
    child.viewport = this.viewport;
    return child;
  }

  async renderFrame(frame: number, options: BrowserFrameCaptureOptions = {}): Promise<BrowserFrameCapture> {
    if (this.viewport === null) {
      throw renderError({
        code: "RENDER_FRAME_FAILED",
        stage: "render",
        message: "FakeBrowserDriver.renderFrame called before open()."
      });
    }
    (this.root ?? this).renderedFrames.push(frame);
    return createPngFrameCapture({
      frame,
      bytes: FAKE_PNG,
      viewport: this.viewport,
      omitBackground: options.omitBackground ?? true,
      timing: { evaluateMs: 0, screenshotMs: 0 }
    });
  }

  async close(): Promise<void> {
    if (this.root !== null) {
      this.root.forkCloses += 1;
    } else {
      this.closes += 1;
    }
    this.viewport = null;
  }
}

export interface FakeFfmpegRunner extends FfmpegRunner {
  /** Argument lists captured from each run() call. */
  readonly calls: string[][];
  /** Chunks consumed from the stdin stream across all run() calls. */
  readonly stdinChunks: Uint8Array[];
}

export interface CreateFakeFfmpegRunnerOptions {
  /** When true, run() rejects with FFMPEG_FAILED (for cleanup-on-failure tests). */
  fail?: boolean;
}

/** FfmpegRunner that records args and writes a placeholder output file. */
export function createFakeFfmpegRunner(options: CreateFakeFfmpegRunnerOptions = {}): FakeFfmpegRunner {
  const calls: string[][] = [];
  const stdinChunks: Uint8Array[] = [];
  return {
    calls,
    stdinChunks,
    async run(args: readonly string[], runOptions?: FfmpegRunOptions): Promise<FfmpegRunResult> {
      calls.push([...args]);

      if (options.fail === true) {
        throw renderError({ code: "FFMPEG_FAILED", stage: "ffmpeg", message: "Fake ffmpeg failure." });
      }

      if (runOptions?.stdin !== undefined) {
        for await (const chunk of runOptions.stdin) {
          stdinChunks.push(chunk);
        }
      }

      const outputPath = args[args.length - 1];
      if (outputPath !== undefined && outputPath.length > 0) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, FAKE_PNG);
      }

      return { code: 0, stderr: "" };
    }
  };
}
