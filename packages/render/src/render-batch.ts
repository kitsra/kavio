import { expandRenderBatch, type BrowserDriver, type RenderBatchInput } from "@kavio/render-worker";
import { renderComposition, type RenderCompositionOptions, type RenderCompositionResult } from "./render-composition.js";
import type { FfmpegRunner } from "./ffmpeg-runner.js";

export interface RenderBatchOptions {
  outDir?: string;
  driver?: BrowserDriver;
  ffmpegRunner?: FfmpegRunner;
  concurrency?: number;
  failFast?: boolean;
  signal?: AbortSignal;
  continueOnFrameError?: boolean;
}

export interface RenderBatchItemResult {
  id: string;
  outputName: string;
  result: RenderCompositionResult;
}

/** Expand a template × prop rows × export presets into jobs and render each one. */
export async function renderBatch(
  input: RenderBatchInput,
  options: RenderBatchOptions = {}
): Promise<RenderBatchItemResult[]> {
  const jobs = expandRenderBatch(input);
  const results = new Map<number, RenderBatchItemResult>();
  // A shared injected driver cannot be driven concurrently; force sequential then.
  const concurrency = options.driver !== undefined ? 1 : Math.max(1, Math.trunc(options.concurrency ?? 1));

  let nextIndex = 0;
  let aborted = false;

  const worker = async (): Promise<void> => {
    while (!aborted) {
      const index = nextIndex;
      nextIndex += 1;
      const job = jobs[index];
      if (job === undefined) {
        return;
      }

      const result = await renderComposition(job.document, buildRenderOptions(job, options));
      results.set(index, { id: job.id, outputName: job.outputName, result });

      if (!result.ok && options.failFast === true) {
        aborted = true;
        return;
      }
    }
  };

  const workerCount = Math.min(concurrency, jobs.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return [...results.entries()].sort(([left], [right]) => left - right).map(([, result]) => result);
}

function buildRenderOptions(
  job: ReturnType<typeof expandRenderBatch>[number],
  options: RenderBatchOptions
): RenderCompositionOptions {
  return {
    preset: job.preset,
    propValues: job.props,
    outputName: job.outputName,
    ...(options.outDir !== undefined && { outDir: options.outDir }),
    ...(options.driver !== undefined && { driver: options.driver }),
    ...(options.ffmpegRunner !== undefined && { ffmpegRunner: options.ffmpegRunner }),
    ...(options.signal !== undefined && { signal: options.signal }),
    ...(options.continueOnFrameError !== undefined && { continueOnFrameError: options.continueOnFrameError })
  };
}
