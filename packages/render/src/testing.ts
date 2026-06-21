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
  renderedFrames: number[] = [];
  private viewport: BrowserViewport | null = null;

  async open(composition: KavioDocument, options: BrowserOpenOptions = {}): Promise<void> {
    this.opens += 1;
    this.viewport = options.viewport ?? createBrowserViewport(composition);
  }

  async renderFrame(frame: number, options: BrowserFrameCaptureOptions = {}): Promise<BrowserFrameCapture> {
    if (this.viewport === null) {
      throw renderError({
        code: "RENDER_FRAME_FAILED",
        stage: "render",
        message: "FakeBrowserDriver.renderFrame called before open()."
      });
    }
    this.renderedFrames.push(frame);
    return createPngFrameCapture({
      frame,
      bytes: FAKE_PNG,
      viewport: this.viewport,
      omitBackground: options.omitBackground ?? true
    });
  }

  async close(): Promise<void> {
    this.closes += 1;
    this.viewport = null;
  }
}

export interface FakeFfmpegRunner extends FfmpegRunner {
  /** Argument lists captured from each run() call. */
  readonly calls: string[][];
}

export interface CreateFakeFfmpegRunnerOptions {
  /** When true, run() rejects with FFMPEG_FAILED (for cleanup-on-failure tests). */
  fail?: boolean;
}

/** FfmpegRunner that records args and writes a placeholder output file. */
export function createFakeFfmpegRunner(options: CreateFakeFfmpegRunnerOptions = {}): FakeFfmpegRunner {
  const calls: string[][] = [];
  return {
    calls,
    async run(args: readonly string[], _runOptions?: FfmpegRunOptions): Promise<FfmpegRunResult> {
      calls.push([...args]);

      if (options.fail === true) {
        throw renderError({ code: "FFMPEG_FAILED", stage: "ffmpeg", message: "Fake ffmpeg failure." });
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
