import {
  DEFAULT_BROWSER_FRAME_CAPTURE_OPTIONS,
  DEFAULT_BROWSER_DEVICE_SCALE_FACTOR,
  DEFAULT_CHROMIUM_LAUNCH_OPTIONS,
  DETERMINISTIC_CHROMIUM_FLAGS,
  RenderCleanupStack,
  captureFrames,
  createBrowserContextCleanupTask,
  createBrowserDriverMetadata,
  createBrowserViewport,
  createPngFrameCapture,
  createRenderMetadata,
  createStableOutputName,
  createTemporaryFramesCleanupTask,
  expandRenderBatch,
  withRenderCleanup
} from "./index.js";
import type { BrowserDriver, BrowserFrameCapture, BrowserFrameCaptureOptions, BrowserOpenOptions } from "./index.js";
import type { KavioDocument, KavioExportPreset } from "@kitsra/kavio-schema";

const squarePreset: KavioExportPreset = {
  name: "Square HD",
  format: "mp4",
  codec: "h264",
  audioCodec: "aac",
  width: 1080,
  height: 1080,
  fps: 30
};

const storyPreset: KavioExportPreset = {
  name: "Story 9:16",
  format: "webm",
  width: 1080,
  height: 1920,
  fps: 30
};

const template: KavioDocument = {
  version: "0.1",
  metadata: {
    title: "Batch template"
  },
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationFrames: 90
  },
  props: {
    headline: {
      type: "string",
      required: true
    }
  },
  assets: {},
  layers: [],
  exports: [squarePreset]
};

const browserComposition: KavioDocument = {
  version: "0.1",
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationFrames: 60,
    background: "transparent"
  },
  assets: {},
  layers: [],
  exports: [
    {
      name: "overlay",
      format: "png-sequence",
      width: 1920,
      height: 1080,
      fps: 30,
      background: "transparent"
    }
  ]
};

const viewport = createBrowserViewport(browserComposition);
assertEqual(viewport.width, 1920, "viewport width comes from the composition");
assertEqual(viewport.height, 1080, "viewport height comes from the composition");
assertEqual(viewport.deviceScaleFactor, DEFAULT_BROWSER_DEVICE_SCALE_FACTOR, "viewport uses the deterministic scale factor");

assert(
  DETERMINISTIC_CHROMIUM_FLAGS.includes("--disable-gpu"),
  "deterministic Chromium flags disable GPU rasterization variance"
);
assert(
  DETERMINISTIC_CHROMIUM_FLAGS.includes("--force-color-profile=srgb"),
  "deterministic Chromium flags pin the color profile"
);
assertEqual(DEFAULT_CHROMIUM_LAUNCH_OPTIONS.headless, true, "default Chromium launch is headless");

const browserMetadata = createBrowserDriverMetadata({
  chromiumRevision: "chromium-123456",
  version: "0.0.0-test"
});
assertEqual(browserMetadata.kind, "playwright", "metadata defaults to the Playwright driver kind");
assertEqual(browserMetadata.launch.chromiumRevision, "chromium-123456", "metadata records the Chromium revision");
assertEqual(browserMetadata.launch.deviceScaleFactor, 1, "metadata records the deterministic scale factor");
assertEqual(browserMetadata.launch.args[0], "--disable-gpu", "metadata records deterministic launch flags in order");

const capture = createPngFrameCapture({
  frame: 12,
  bytes: new Uint8Array([137, 80, 78, 71]),
  viewport
});
assertEqual(capture.frame, 12, "capture records the frame number");
assertEqual(capture.format, "png", "capture format is PNG");
assertEqual(capture.mimeType, "image/png", "capture MIME type is image/png");
assertEqual(capture.omitBackground, true, "capture defaults to transparent-background screenshots");
assertEqual(
  DEFAULT_BROWSER_FRAME_CAPTURE_OPTIONS.omitBackground,
  true,
  "default frame capture options request transparent overlay frames"
);

class MemoryBrowserDriver implements BrowserDriver {
  async open(_composition: KavioDocument): Promise<void> {}

  async renderFrame(frame: number): Promise<BrowserFrameCapture> {
    return createPngFrameCapture({
      frame,
      bytes: new Uint8Array([frame]),
      viewport
    });
  }

  async close(): Promise<void> {}
}

const driver = new MemoryBrowserDriver();
await driver.open(browserComposition);
const captured = await driver.renderFrame(3);
await driver.close();
assertEqual(captured.bytes[0], 3, "BrowserDriver returns PNG byte captures");

class RecordingBrowserDriver implements BrowserDriver {
  opened = 0;
  closed = 0;
  frames: number[] = [];
  captureOptions: boolean[] = [];
  viewportWidth: number | undefined;

  constructor(private readonly failingFrames = new Set<number>()) {}

  async open(_composition: KavioDocument, options?: BrowserOpenOptions): Promise<void> {
    this.opened += 1;
    this.viewportWidth = options?.viewport?.width;
  }

  async renderFrame(frame: number, options?: BrowserFrameCaptureOptions): Promise<BrowserFrameCapture> {
    this.frames.push(frame);
    this.captureOptions.push(options?.omitBackground ?? false);
    if (this.failingFrames.has(frame)) {
      throw new Error(`boom-${frame}`);
    }

    const captureOptions = {
      frame,
      bytes: new Uint8Array([frame, frame + 1]),
      viewport
    };
    return options?.omitBackground === undefined
      ? createPngFrameCapture(captureOptions)
      : createPngFrameCapture({
          ...captureOptions,
          omitBackground: options.omitBackground
        });
  }

  async close(): Promise<void> {
    this.closed += 1;
  }
}

const progressEvents: string[] = [];
const successDriver = new RecordingBrowserDriver();
const frameLoopResult = await captureFrames({
  driver: successDriver,
  composition: browserComposition,
  frameCount: 4,
  onFrame: (frameCapture, progress) => {
    progressEvents.push(`frame:${frameCapture.frame}:${progress.completedFrames}`);
  },
  onProgress: (progress) => {
    progressEvents.push(`${progress.phase}:${progress.frame ?? "none"}:${progress.completedFrames}`);
  }
});
assertEqual(successDriver.opened, 1, "frame capture loop opens the browser driver once");
assertEqual(successDriver.closed, 1, "frame capture loop closes the browser driver on success");
assertEqual(successDriver.viewportWidth, 1920, "frame capture loop passes a composition viewport to the driver");
assertEqual(successDriver.frames.join(","), "0,1,2,3", "frame capture loop renders each requested frame in order");
assertEqual(successDriver.captureOptions.every(Boolean), true, "frame capture loop defaults to transparent captures");
assertEqual(frameLoopResult.captures.length, 4, "frame capture loop returns successful frame captures");
assertEqual(frameLoopResult.errors.length, 0, "successful frame capture loop has no frame errors");
assertEqual(frameLoopResult.bytesCaptured, 8, "frame capture loop reports captured byte totals");
assertEqual(
  progressEvents.join("|"),
  "open:none:0|frame:0:1|capture:0:1|frame:1:2|capture:1:2|frame:2:3|capture:2:3|frame:3:4|capture:3:4|complete:none:4",
  "frame capture loop reports open, frame, capture, and completion progress"
);

const failFastDriver = new RecordingBrowserDriver(new Set([1]));
try {
  await captureFrames({
    driver: failFastDriver,
    composition: browserComposition,
    frameCount: 3
  });
  throw new Error("captureFrames should fail fast by default.");
} catch (error) {
  if (!(error instanceof Error)) {
    throw new Error("captureFrames should fail with an Error instance.");
  }
  assert(error.message.includes("Failed to capture frame 1"), "captureFrames reports the failed frame number");
}
assertEqual(failFastDriver.closed, 1, "frame capture loop closes the browser driver on fail-fast failure");
assertEqual(failFastDriver.frames.join(","), "0,1", "frame capture loop stops at the first frame error by default");

const continueDriver = new RecordingBrowserDriver(new Set([1]));
const frameErrors: number[] = [];
const continuedResult = await captureFrames({
  driver: continueDriver,
  composition: browserComposition,
  frameCount: 3,
  continueOnFrameError: true,
  onFrameError: (failure) => {
    frameErrors.push(failure.frame);
  }
});
assertEqual(continueDriver.closed, 1, "frame capture loop closes the browser driver after continued frame errors");
assertEqual(continueDriver.frames.join(","), "0,1,2", "continue-on-frame-error renders remaining frames");
assertEqual(continuedResult.captures.length, 2, "continue-on-frame-error returns successful captures");
assertEqual(continuedResult.errors.length, 1, "continue-on-frame-error records failed frames");
assertEqual(continuedResult.failedFrames, 1, "continue-on-frame-error reports failed frame count");
assertEqual(continuedResult.completedFrames, 3, "continue-on-frame-error counts failed frames as completed attempts");
assertEqual(frameErrors.join(","), "1", "continue-on-frame-error calls frame error callbacks");

const metadata = createRenderMetadata({
  composition: template.composition,
  preset: squarePreset,
  outputName: "launch-square.mp4",
  outputPath: "renders/launch-square.mp4",
  checksums: {
    algorithm: "sha256",
    value: "abc123",
    bytes: 12
  },
  ffmpegVersion: "ffmpeg version 7.1",
  chromiumRevision: "1234567",
  createdAt: "2026-01-01T00:00:00.000Z"
});

assertEqual(metadata.dimensions.width, 1080, "render metadata records output width");
assertEqual(metadata.dimensions.height, 1080, "render metadata records output height");
assertEqual(metadata.duration.frames, 90, "render metadata records duration frames");
assertEqual(metadata.duration.seconds, 3, "render metadata records duration seconds");
assertEqual(metadata.codecs.video, "h264", "render metadata records video codec");
assertEqual(metadata.codecs.audio, "aac", "render metadata records audio codec");
assertEqual(metadata.checksums[0]?.algorithm, "sha256", "render metadata records checksum algorithm");
assertEqual(metadata.tools.ffmpeg.version, "ffmpeg version 7.1", "render metadata records FFmpeg version");
assertEqual(metadata.tools.chromium.revision, "1234567", "render metadata records Chromium revision");

const cleanupEvents: string[] = [];
try {
  await withRenderCleanup(async (cleanup) => {
    cleanup.defer(
      createBrowserContextCleanupTask({
        close: async () => {
          cleanupEvents.push("browser");
        }
      })
    );
    cleanup.defer(
      createTemporaryFramesCleanupTask((context) => {
        cleanupEvents.push(`frames:${context.reason}`);
      })
    );
    throw new Error("render failed");
  });
  throw new Error("withRenderCleanup should rethrow the operation error.");
} catch (error) {
  if (!(error instanceof Error)) {
    throw new Error("withRenderCleanup should surface an Error instance.");
  }
  assertEqual(error.message, "render failed", "withRenderCleanup preserves the operation error when cleanup succeeds");
}
assertEqual(cleanupEvents.join(","), "frames:failure,browser", "cleanup runs in reverse registration order");

const stack = new RenderCleanupStack();
const released: string[] = [];
stack.defer(
  createTemporaryFramesCleanupTask(() => {
    released.push("kept");
  }, "kept-frames")
);
stack.defer(
  createTemporaryFramesCleanupTask(() => {
    released.push("released");
  }, "released-frames")
);
assert(stack.release("released-frames"), "cleanup release reports a removed task");
const cleanupReport = await stack.cleanup("success");
assertEqual(cleanupReport.cleaned.length, 1, "released cleanup tasks are skipped");
assertEqual(cleanupReport.cleaned[0]?.id, "kept-frames", "cleanup report records cleaned task ids");
assertEqual(released.join(","), "kept", "released cleanup task did not run");

const jobs = expandRenderBatch({
  template,
  rows: [
    {
      id: "Launch A",
      props: {
        headline: "First"
      }
    },
    {
      props: {
        headline: "Second"
      }
    }
  ],
  presets: ["Square HD", storyPreset],
  outputDirectory: "renders/",
  outputNamePrefix: "Summer Sale"
});

assertEqual(jobs.length, 4, "batch expansion creates every row and preset combination");
assertEqual(
  jobs[0]?.outputName,
  "summer-sale-row-001-launch-a-square-hd.mp4",
  "stable output names include prefix, row, and preset"
);
assertEqual(
  jobs[0]?.outputPath,
  "renders/summer-sale-row-001-launch-a-square-hd.mp4",
  "output paths trim trailing directory slashes"
);
assertEqual(jobs[0]?.document.exports.length, 1, "batch jobs isolate the selected export preset");
assertEqual(jobs[0]?.props.headline, "First", "batch jobs carry row props");
assertEqual(jobs[3]?.outputName, "summer-sale-row-002-story-9-16.webm", "unnamed rows still receive stable indexes");
assertEqual(
  createStableOutputName({
    row: { id: "Launch A" },
    rowIndex: 0,
    preset: squarePreset,
    presetIndex: 0
  }),
  "row-001-launch-a-square-hd.mp4",
  "stable output helper is deterministic without a prefix"
);

console.log("Render worker metadata, frame capture, cleanup, and batch self-checks passed.");

function assert(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
