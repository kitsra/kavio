import type { KavioDocument } from "@kitsra/kavio-schema";
import { assembleDirectRenderCommand, assembleRenderCommand, getDirectRenderSupport } from "./assemble-command.js";
import { renderError, RENDER_ERROR_CODES } from "./errors.js";
import { createRenderHarnessServer } from "./harness-server.js";
import { createFfmpegRunner, type FfmpegChildProcess, type FfmpegSpawn } from "./ffmpeg-runner.js";
import { createFrameByteQueue } from "./frame-stream.js";
import { renderComposition } from "./render-composition.js";
import { renderBatch } from "./render-batch.js";
import { PlaywrightSession } from "./playwright-driver.js";
import { FakeBrowserDriver, createFakeFfmpegRunner } from "./testing.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// --- errors.ts -------------------------------------------------------------

const ffmpegFailure = renderError({
  code: "FFMPEG_FAILED",
  stage: "ffmpeg",
  message: "boom",
  hint: "check args"
});
assertEqual(ffmpegFailure.code, "FFMPEG_FAILED", "code preserved");
assertEqual(ffmpegFailure.stage, "ffmpeg", "stage preserved");
assertEqual(ffmpegFailure.severity, "error", "defaults to error severity");
assertEqual(ffmpegFailure.path, "", "defaults to empty path");
assertEqual(ffmpegFailure.retryable, false, "defaults to not retryable");
assertEqual(ffmpegFailure.hint, "check args", "hint preserved");
assert(RENDER_ERROR_CODES.includes("RENDER_TIMEOUT"), "code catalog exported");

const retryable = renderError({
  code: "ASSET_FETCH_FAILED",
  stage: "ingest",
  message: "network",
  retryable: true
});
assertEqual(retryable.retryable, true, "retryable flag honored");
assertEqual(retryable.hint, undefined, "hint omitted when not provided");

// --- assemble-command.ts ---------------------------------------------------

const graphicsOnlyView: KavioDocument = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 30, background: "#101820" },
  assets: {},
  layers: [
    { id: "bg", type: "shape", shape: "rect", fill: "#101820", startFrame: 0, durationFrames: 30 },
    { id: "headline", type: "text", text: "Hello", startFrame: 0, durationFrames: 30 }
  ],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const hybridView: KavioDocument = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 30, background: "#000000" },
  assets: {
    clip: { type: "video", src: "clip.mp4" },
    music: { type: "audio", src: "music.mp3" }
  },
  layers: [{ id: "bg", type: "video", asset: "clip", fit: "cover", startFrame: 0, durationFrames: 30 }],
  audio: [{ id: "music", asset: "music", role: "music", startFrame: 0, durationFrames: 30, volume: 0.7 }],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const graphicsArgs = assembleRenderCommand({
  view: graphicsOnlyView,
  preset: graphicsOnlyView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
});
const graphics = graphicsArgs.join(" ");
assert(graphics.includes("color=c="), "graphics-only synthesizes a color base source");
assert(graphics.includes("overlay-%05d.png"), "reads the overlay frame sequence");
assert(graphics.includes("[video_out]"), "maps a final composited video stream");
assert(graphics.includes("[audio_out]"), "maps a final audio stream");
assert(graphics.includes("anullsrc"), "graphics-only synthesizes silent audio");
assert(graphics.includes("yuv420p"), "encodes with yuv420p pixel format");
assert(graphics.includes("+faststart"), "adds faststart for mp4");
assert(graphicsArgs.at(-1)?.endsWith(".mp4") ?? false, "last arg is the output path");
assertEqual(graphicsArgs.filter((arg) => arg === "-filter_complex").length, 1, "emits a single -filter_complex");

const pipedArgs = assembleRenderCommand({
  view: graphicsOnlyView,
  preset: graphicsOnlyView.exports[0]!
});
const piped = pipedArgs.join(" ");
assert(piped.includes("-f image2pipe"), "omitting framePattern reads overlay frames from an image2pipe stream");
assert(pipedArgs.some((arg, index) => arg === "-i" && pipedArgs[index + 1] === "-"), "piped overlay input reads from stdin");
assert(!piped.includes("overlay-%05d.png"), "piped render does not reference a frame pattern");
assert(piped.includes("shortest=0"), "piped overlay does not shorten the timeline when frame capture backpressures");
assert(piped.includes("[video_out]"), "piped render still maps the composited video stream");
assertEqual(pipedArgs.filter((arg) => arg === "-filter_complex").length, 1, "piped render emits a single -filter_complex");

const unsafeBackgroundView: KavioDocument = {
  ...graphicsOnlyView,
  composition: {
    ...graphicsOnlyView.composition,
    background: "red;blue,green[0]:white'black\\end"
  }
};
const unsafeBackgroundArgs = assembleRenderCommand({
  view: unsafeBackgroundView,
  preset: unsafeBackgroundView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
});
const unsafeBackgroundInput = unsafeBackgroundArgs[unsafeBackgroundArgs.indexOf("-i") + 1] ?? "";
assert(
  unsafeBackgroundInput.includes("red\\;blue\\,green\\[0\\]\\:white\\'black\\\\end"),
  "lavfi background escapes filter metacharacters"
);

const hybridArgs = assembleRenderCommand({
  view: hybridView,
  preset: hybridView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
}).join(" ");
assert(hybridArgs.includes("-i clip.mp4"), "declares the source video input");
assert(hybridArgs.includes("overlay="), "composites the overlay over the base");
assert(hybridArgs.includes("amix="), "mixes the declared audio track");
assert(hybridArgs.includes("-i music.mp3"), "declares the audio input");

const loopedDuckingView: KavioDocument = {
  ...hybridView,
  composition: { ...hybridView.composition, durationFrames: 90 },
  assets: {
    ...hybridView.assets,
    music: { type: "audio", src: "music.mp3", loop: true },
    voiceover: { type: "audio", src: "voiceover.wav" }
  },
  layers: [{ ...hybridView.layers[0]!, durationFrames: 90 }],
  audio: [
    {
      id: "music",
      asset: "music",
      role: "music",
      startFrame: 0,
      durationFrames: 90,
      duck: { against: "voiceover", amountDb: -12, attackFrames: 3, releaseFrames: 9 }
    },
    { id: "voiceover", asset: "voiceover", role: "voiceover", startFrame: 30, durationFrames: 30 }
  ]
};
const loopedDuckingArgs = assembleRenderCommand({
  view: loopedDuckingView,
  preset: loopedDuckingView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
}).join(" ");
assert(loopedDuckingArgs.includes("-stream_loop -1 -t 3 -i music.mp3"), "render command emits planned audio looping");
assert(loopedDuckingArgs.includes("sidechaincompress="), "render command emits planned FFmpeg sidechain ducking");
assert(loopedDuckingArgs.includes("[voiceover_audio]asplit=outputs=2"), "render command preserves voiceover for ducking and mixing");

const pipView: KavioDocument = {
  version: "0.1",
  composition: { width: 1920, height: 1080, fps: 30, durationFrames: 90, background: "#000000" },
  assets: {
    main: { type: "video", src: "main.mp4" },
    inset: { type: "video", src: "inset.mp4" }
  },
  layers: [
    { id: "main", type: "video", asset: "main", fit: "cover", startFrame: 0, durationFrames: 90 },
    {
      id: "inset",
      type: "video",
      asset: "inset",
      fit: "cover",
      startFrame: 30,
      durationFrames: 45,
      position: { x: 1320, y: 60 },
      anchor: { x: 0, y: 0 },
      size: { width: 480, height: 270 }
    },
    { id: "headline", type: "text", text: "Text over both videos", startFrame: 0, durationFrames: 90 }
  ],
  audio: [],
  exports: [{ name: "pip", format: "mp4", codec: "h264", width: 1920, height: 1080 }]
};
const pipArgs = assembleRenderCommand({
  view: pipView,
  preset: pipView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
});
const pip = pipArgs.join(" ");
assert(pip.includes("-i main.mp4"), "pip render declares the base video input");
assert(pip.includes("-i inset.mp4"), "pip render declares the inset video input");
assert(!pip.includes("concat=n=2"), "time-overlapping videos are not concatenated");
assert(pip.includes("overlay=x=1320:y=60"), "inset video composites at its layer top-left position");
assert(pip.includes("enable='between("), "inset video plane is bounded to its frame window");
assert(pip.includes("overlay-%05d.png"), "graphics overlay still reads captured frames");
assert(pip.includes("[video_out]"), "pip render still maps the final composited stream");
assertEqual(pipArgs.filter((arg) => arg === "-filter_complex").length, 1, "pip render emits a single -filter_complex");
// The graphics overlay must composite over the pip result, not the bare base.
const pipFilterComplex = pipArgs[pipArgs.indexOf("-filter_complex") + 1] ?? "";
assert(
  pipFilterComplex.indexOf("overlay=x=1320:y=60") < pipFilterComplex.indexOf("[video_out]"),
  "graphics overlay composites after the pip plane"
);

const sequentialView: KavioDocument = {
  ...pipView,
  layers: [
    { id: "first", type: "video", asset: "main", fit: "cover", startFrame: 0, durationFrames: 45 },
    { id: "second", type: "video", asset: "inset", fit: "cover", startFrame: 45, durationFrames: 45 }
  ]
};
const sequentialArgs = assembleRenderCommand({
  view: sequentialView,
  preset: sequentialView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
}).join(" ");
assert(sequentialArgs.includes("concat=n=2"), "non-overlapping videos still concatenate in time");

const webmView: KavioDocument = {
  ...graphicsOnlyView,
  exports: [{ name: "web", format: "webm", width: 1080, height: 1920 }]
};
const webmArgs = assembleRenderCommand({
  view: webmView,
  preset: webmView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
}).join(" ");
assert(webmArgs.includes("-c:v libvpx-vp9"), "webm defaults to VP9 video");
assert(webmArgs.includes("-c:a libopus"), "webm defaults to Opus audio");
assert(!webmArgs.includes("+faststart"), "webm does not use mp4/mov faststart flags");

const bitrateView: KavioDocument = {
  ...graphicsOnlyView,
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920, bitrate: "8M" }]
};
const bitrateArgs = assembleRenderCommand({
  view: bitrateView,
  preset: bitrateView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
});
assert(bitrateArgs.some((arg, index) => arg === "-b:v" && bitrateArgs[index + 1] === "8M"), "video bitrate is passed to ffmpeg");
assert(!bitrateArgs.includes("-crf"), "video bitrate overrides CRF mode");

const directShapeView: KavioDocument = {
  version: "0.1",
  composition: { width: 640, height: 360, fps: 30, durationFrames: 45, background: "#000000" },
  assets: {},
  layers: [
    {
      id: "panel",
      type: "shape",
      shape: "rect",
      fill: "#ff3366",
      stroke: { color: "#ffffff", width: 4 },
      opacity: 0.75,
      startFrame: 5,
      durationFrames: 20,
      position: { x: 32, y: 48 },
      size: { width: 200, height: 96 }
    }
  ],
  audio: [],
  exports: [{ name: "direct", format: "mp4", codec: "h264", width: 640, height: 360 }]
};
const directSupport = getDirectRenderSupport(directShapeView);
assert(directSupport.ok, "shape-only composition is eligible for FFmpeg-direct render");
const directArgs = assembleDirectRenderCommand({
  view: directShapeView,
  preset: directShapeView.exports[0]!,
  outputPath: "/tmp/direct.mp4"
}).join(" ");
assert(!directArgs.includes("overlay-%05d.png"), "direct render does not read overlay PNG frames");
assert(!directArgs.includes("overlay="), "direct render does not composite a PNG overlay stream");
assert(directArgs.includes("drawbox=x=32:y=48:w=200:h=96:color=0xff3366@0.75:t=fill:enable='between(n,5,24)'"), "direct render compiles shape fill to drawbox");
assert(directArgs.includes("drawbox=x=32:y=48:w=200:h=96:color=0xffffff@0.75:t=4:enable='between(n,5,24)'"), "direct render compiles shape stroke to drawbox");

const directTextSupport = getDirectRenderSupport(graphicsOnlyView);
assert(!directTextSupport.ok, "text composition is not eligible for FFmpeg-direct render yet");

const directImageView: KavioDocument = {
  version: "0.1",
  composition: { width: 320, height: 240, fps: 30, durationFrames: 12, background: "#000000" },
  assets: {
    first: { type: "image", src: "first.png" },
    second: { type: "image", src: "second.png" }
  },
  layers: [
    {
      id: "first",
      type: "image",
      asset: "first",
      startFrame: 0,
      durationFrames: 6,
      position: { x: 160, y: 120 },
      anchor: "center",
      size: { width: 320, height: 240 },
      fit: "cover"
    },
    {
      id: "second",
      type: "image",
      asset: "second",
      startFrame: 6,
      durationFrames: 6,
      position: { x: "50%w", y: "50%h" },
      anchor: "center",
      size: { width: "100%w", height: "100%h" },
      fit: "cover"
    }
  ],
  audio: [],
  exports: [{ name: "image-direct", format: "mp4", codec: "h264", width: 320, height: 240 }]
};
assert(getDirectRenderSupport(directImageView).ok, "full-frame image sequence is eligible for FFmpeg-direct render");
const directImageArgs = assembleDirectRenderCommand({
  view: directImageView,
  preset: directImageView.exports[0]!,
  outputPath: "/tmp/image-direct.mp4"
}).join(" ");
assert(directImageArgs.includes("-loop 1 -framerate 30 -t 0.2 -i first.png"), "direct image render loops the first still for its layer duration");
assert(directImageArgs.includes("-loop 1 -framerate 30 -t 0.2 -i second.png"), "direct image render loops the second still for its layer duration");
assert(directImageArgs.includes("concat=n=2:v=1:a=0"), "direct image render concatenates still segments");
assert(!directImageArgs.includes("image2pipe"), "direct image render skips browser overlay frames");

const directImageMotionView: KavioDocument = {
  ...directImageView,
  composition: { ...directImageView.composition, background: "#334455" },
  layers: directImageView.layers.map((layer) => ({
    ...layer,
    keyframes: {
      scale: [
        { frame: 0, value: 1 },
        { frame: 3, value: 1.025 },
        { frame: 5, value: 1.025 }
      ]
    },
    transitionIn: { type: "fade", durationFrames: 2, easing: "linear" },
    transitionOut: { type: "fade", durationFrames: 2, easing: "linear" }
  }))
};
assert(getDirectRenderSupport(directImageMotionView).ok, "linear image fade and push-in sequence is eligible for FFmpeg-direct render");
const directImageMotionArgs = assembleDirectRenderCommand({
  view: directImageMotionView,
  preset: directImageMotionView.exports[0]!,
  outputPath: "/tmp/image-direct-motion.mp4"
}).join(" ");
assert(directImageMotionArgs.includes("-i first.png"), "direct image motion render reads the first still as a single frame");
assert(!directImageMotionArgs.includes("-loop 1 -framerate 30 -t 0.2 -i first.png"), "direct image motion render does not loop still inputs before zoompan");
assert(directImageMotionArgs.includes("zoompan=z='min(1+on*0.008333,1.025)'"), "direct image render preserves supported scale push-in");
assert(directImageMotionArgs.includes("fade=t=in:st=0:d=0.066667:color=0x334455"), "direct image render preserves supported fade in");
assert(directImageMotionArgs.includes("fade=t=out:st=0.133333:d=0.066667:color=0x334455"), "direct image render preserves supported fade out");

const directImageTransitionView: KavioDocument = {
  ...directImageView,
  composition: { ...directImageView.composition, durationFrames: 10 },
  layers: [
    { ...directImageView.layers[0]!, durationFrames: 6 },
    { ...directImageView.layers[1]!, startFrame: 4, durationFrames: 6 }
  ],
  tracks: [
    {
      id: "main",
      clips: [
        { id: "first", layerId: "first", startFrame: 0, durationFrames: 6 },
        {
          id: "second",
          layerId: "second",
          startFrame: 4,
          durationFrames: 6,
          transitionFromPrevious: {
            presentation: { type: "crossfade" },
            timing: { type: "tween", durationFrames: 2, easing: "linear" }
          }
        }
      ]
    }
  ]
};
assert(getDirectRenderSupport(directImageTransitionView).ok, "linear image transition track is eligible for FFmpeg-direct render");
const directImageTransitionArgs = assembleDirectRenderCommand({
  view: directImageTransitionView,
  preset: directImageTransitionView.exports[0]!,
  outputPath: "/tmp/image-direct-transition.mp4"
}).join(" ");
assert(directImageTransitionArgs.includes("xfade=transition=fade:duration=0.066667:offset=0.133333"), "direct image transition track uses FFmpeg xfade");
assert(!directImageTransitionArgs.includes("concat=n=2:v=1:a=0"), "direct image transition track does not concatenate overlapped stills");

const directImageWithEasedTransition: KavioDocument = {
  ...directImageTransitionView,
  tracks: [
    {
      id: "main",
      clips: [
        { id: "first", layerId: "first", startFrame: 0, durationFrames: 6 },
        {
          id: "second",
          layerId: "second",
          startFrame: 4,
          durationFrames: 6,
          transitionFromPrevious: {
            presentation: { type: "crossfade" },
            timing: { type: "tween", durationFrames: 2, easing: "outCubic" }
          }
        }
      ]
    }
  ]
};
assert(!getDirectRenderSupport(directImageWithEasedTransition).ok, "non-linear image transition track still uses browser rendering");

const directImageWithEasedZoom: KavioDocument = {
  ...directImageMotionView,
  layers: [
    {
      ...directImageMotionView.layers[0]!,
      keyframes: {
        scale: [
          { frame: 0, value: 1, easing: "outCubic" },
          { frame: 3, value: 1.025 },
          { frame: 5, value: 1.025 }
        ]
      }
    },
    directImageMotionView.layers[1]!
  ]
};
assert(!getDirectRenderSupport(directImageWithEasedZoom).ok, "non-linear image push-in still uses browser rendering");

const directImageWithUnsupportedMotion: KavioDocument = {
  ...directImageMotionView,
  layers: [
    {
      ...directImageMotionView.layers[0]!,
      keyframes: {
        x: [
          { frame: 0, value: 0 },
          { frame: 1, value: 10 }
        ]
      }
    },
    directImageMotionView.layers[1]!
  ]
};
assert(!getDirectRenderSupport(directImageWithUnsupportedMotion).ok, "unsupported image motion still uses browser rendering");

const directImageWithFitNone: KavioDocument = {
  ...directImageView,
  layers: [
    {
      id: "first",
      type: "image",
      asset: "first",
      startFrame: 0,
      durationFrames: 12,
      position: { x: 160, y: 120 },
      anchor: "center",
      size: { width: 320, height: 240 },
      fit: "none"
    }
  ]
};
assert(!getDirectRenderSupport(directImageWithFitNone).ok, "fit none image sequences still use browser rendering");

// --- harness-server.ts -----------------------------------------------------

const harnessServer = await createRenderHarnessServer({ composition: graphicsOnlyView });
try {
  const servedHtml = await fetch(harnessServer.url).then((response) => response.text());
  assert(servedHtml.includes("/composition.json"), "harness server serves the harness html");
  assert(servedHtml.includes("/vendor/browser-renderer/index.js"), "harness html references the vendored renderer");
  const servedComposition = (await fetch(`${harnessServer.url}composition.json`).then((response) =>
    response.json()
  )) as { version?: string };
  assertEqual(servedComposition.version, graphicsOnlyView.version, "harness server serves the composition json");
  const vendorCore = await fetch(`${harnessServer.url}vendor/core/index.js`);
  assertEqual(vendorCore.status, 200, "harness server serves the vendored core bundle");
  const missing = await fetch(`${harnessServer.url}nope`);
  assertEqual(missing.status, 404, "harness server returns 404 for unknown routes");
} finally {
  await harnessServer.close();
}

// --- ffmpeg-runner.ts ------------------------------------------------------

function fakeSpawnExit(code: number): FfmpegSpawn {
  return () =>
    ({
      stdout: { on() {} },
      stderr: { on() {} },
      on(event: string, listener: (value: number | null) => void) {
        if (event === "close") {
          setTimeout(() => listener(code), 0);
        }
      },
      kill() {}
    }) as unknown as FfmpegChildProcess;
}

const ffmpegOk = await createFfmpegRunner({ spawn: fakeSpawnExit(0), resolveBinary: () => "ffmpeg" }).run(["-version"]);
assertEqual(ffmpegOk.code, 0, "ffmpeg runner resolves on zero exit");

let ffmpegFailed = false;
try {
  await createFfmpegRunner({ spawn: fakeSpawnExit(1), resolveBinary: () => "ffmpeg" }).run(["bad"]);
} catch (error) {
  ffmpegFailed = (error as { code?: string }).code === "FFMPEG_FAILED";
}
assert(ffmpegFailed, "ffmpeg runner rejects with FFMPEG_FAILED on non-zero exit");

const stdinWrites: Uint8Array[] = [];
let stdinEnded = false;
const stdinSpawn: FfmpegSpawn = () =>
  ({
    stdin: {
      write(chunk: Uint8Array) {
        stdinWrites.push(chunk);
        return true;
      },
      end() {
        stdinEnded = true;
      },
      on() {},
      once() {}
    },
    stdout: { on() {} },
    stderr: { on() {} },
    on(event: string, listener: (value: number | null) => void) {
      if (event === "close") {
        // Close only after stdin has been ended, like real ffmpeg draining its input.
        const poll = (): void => {
          if (stdinEnded) {
            listener(0);
            return;
          }
          setTimeout(poll, 0);
        };
        setTimeout(poll, 0);
      }
    },
    kill() {}
  }) as unknown as FfmpegChildProcess;

async function* twoChunks(): AsyncGenerator<Uint8Array> {
  yield new Uint8Array([1, 2]);
  yield new Uint8Array([3]);
}
const stdinRun = await createFfmpegRunner({ spawn: stdinSpawn, resolveBinary: () => "ffmpeg" }).run(["-i", "-"], {
  stdin: twoChunks()
});
assertEqual(stdinRun.code, 0, "ffmpeg runner resolves after piping stdin");
assertEqual(stdinWrites.length, 2, "ffmpeg runner writes every stdin chunk");
assertEqual(stdinWrites[0]?.join(","), "1,2", "ffmpeg runner preserves stdin chunk bytes");
assert(stdinEnded, "ffmpeg runner ends stdin after the source completes");

{
  // Backpressure on every chunk must not accumulate stream listeners.
  const listenerAdds = new Map<string, number>();
  const countListener = (event: string): void => {
    listenerAdds.set(event, (listenerAdds.get(event) ?? 0) + 1);
  };
  let drainListener: (() => void) | null = null;
  let slowEnded = false;
  const slowSpawn: FfmpegSpawn = () =>
    ({
      stdin: {
        write() {
          setTimeout(() => drainListener?.(), 0);
          return false;
        },
        end() {
          slowEnded = true;
        },
        on(event: string, listener: () => void) {
          countListener(event);
          if (event === "drain") {
            drainListener = listener;
          }
        },
        once(event: string, listener: () => void) {
          countListener(event);
          if (event === "drain") {
            drainListener = listener;
          }
        }
      },
      stdout: { on() {} },
      stderr: { on() {} },
      on(event: string, listener: (value: number | null) => void) {
        if (event === "close") {
          const poll = (): void => {
            if (slowEnded) {
              listener(0);
              return;
            }
            setTimeout(poll, 0);
          };
          setTimeout(poll, 0);
        }
      },
      kill() {}
    }) as unknown as FfmpegChildProcess;

  async function* manyChunks(): AsyncGenerator<Uint8Array> {
    for (let i = 0; i < 50; i += 1) {
      yield new Uint8Array([i]);
    }
  }
  await createFfmpegRunner({ spawn: slowSpawn, resolveBinary: () => "ffmpeg" }).run(["-i", "-"], {
    stdin: manyChunks()
  });
  const totalListenerAdds = [...listenerAdds.values()].reduce((sum, count) => sum + count, 0);
  assert(
    totalListenerAdds <= 6,
    `stdin pump must attach a bounded number of stream listeners, got ${totalListenerAdds} (${JSON.stringify([...listenerAdds])})`
  );
}

let stdinSourceFailed = false;
async function* failingChunks(): AsyncGenerator<Uint8Array> {
  yield new Uint8Array([1]);
  throw new Error("capture exploded");
}
try {
  await createFfmpegRunner({ spawn: stdinSpawn, resolveBinary: () => "ffmpeg" }).run(["-i", "-"], {
    stdin: failingChunks()
  });
} catch (error) {
  stdinSourceFailed = error instanceof Error && error.message.includes("capture exploded");
}
assert(stdinSourceFailed, "ffmpeg runner surfaces stdin source failures");

// --- frame-stream.ts ---------------------------------------------------------

{
  const queue = createFrameByteQueue();
  await queue.push(new Uint8Array([1]));
  await queue.push(new Uint8Array([2, 3]));
  queue.end();
  const drained: number[] = [];
  for await (const chunk of queue) {
    drained.push(...chunk);
  }
  assertEqual(drained.join(","), "1,2,3", "frame byte queue yields pushed chunks in order");
}

{
  const queue = createFrameByteQueue({ maxBufferedBytes: 1 });
  let secondPushResolved = false;
  await queue.push(new Uint8Array([1]));
  const secondPush = queue.push(new Uint8Array([2])).then(() => {
    secondPushResolved = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertEqual(secondPushResolved, false, "frame byte queue applies backpressure past the byte cap");
  const iterator = queue[Symbol.asyncIterator]();
  await iterator.next();
  await secondPush;
  assertEqual(secondPushResolved, true, "frame byte queue releases pushes once the consumer drains");
  queue.end();
}

{
  const queue = createFrameByteQueue();
  await queue.push(new Uint8Array([1]));
  queue.fail(new Error("downstream died"));
  let pushRejected = false;
  try {
    await queue.push(new Uint8Array([2]));
  } catch (error) {
    pushRejected = error instanceof Error && error.message === "downstream died";
  }
  assert(pushRejected, "frame byte queue rejects pushes after fail()");
  let iterationRejected = false;
  try {
    for await (const _chunk of queue) {
      // drain
    }
  } catch (error) {
    iterationRejected = error instanceof Error && error.message === "downstream died";
  }
  assert(iterationRejected, "frame byte queue rejects iteration after fail()");
}

// --- render-composition.ts -------------------------------------------------

const templateDoc: KavioDocument = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 6, background: "#101820" },
  assets: {},
  layers: [
    { id: "bg", type: "shape", shape: "rect", fill: "#101820", startFrame: 0, durationFrames: 6 },
    { id: "headline", type: "text", text: "{{headline}}", startFrame: 0, durationFrames: 6 }
  ],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const outDir = await mkdtemp(join(tmpdir(), "kavio-render-test-"));

const successDriver = new FakeBrowserDriver();
const successRunner = createFakeFfmpegRunner();
const successResult = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: successDriver,
  ffmpegRunner: successRunner
});
assert(successResult.ok === true, "render succeeds with fakes");
if (successResult.ok) {
  assert(successResult.outputPath.endsWith(".mp4"), "produces an mp4 path");
  assert(successResult.metadata.tools.ffmpeg.version.length > 0, "records ffmpeg version");
  assert(successResult.metadata.checksums.length === 1, "records an output checksum");
  assertEqual(successResult.metadata.codecs.video, "h264", "mp4 metadata records the effective video codec");
  assertEqual(successResult.metadata.codecs.audio, "aac", "mp4 metadata records the effective audio codec");
  assertEqual(successResult.timings.requestedRenderMode, "browser-overlay", "browser render reports its requested mode");
  assertEqual(successResult.timings.renderMode, "browser-overlay", "browser render reports its resolved mode");
  assert(successResult.timings.captureMs !== undefined && successResult.timings.captureMs >= 0, "browser render reports capture timing");
  assert(successResult.timings.browserOpenMs !== undefined && successResult.timings.browserOpenMs >= 0, "browser render reports driver open timing");
  assert(successResult.timings.captureEvaluateMs !== undefined && successResult.timings.captureEvaluateMs >= 0, "browser render reports summed evaluate timing");
  assert(successResult.timings.captureScreenshotMs !== undefined && successResult.timings.captureScreenshotMs >= 0, "browser render reports summed screenshot timing");
  assert(successResult.timings.encodeMs >= 0, "render reports encode timing");
  assert(successResult.timings.checksumMs >= 0, "render reports checksum timing");
  assert(successResult.timings.totalMs >= successResult.timings.encodeMs, "total timing covers encode stage");
}
assertEqual(successDriver.renderedFrames.length, 6, "captures every frame");
assertEqual(successDriver.closes, 1, "closes the browser driver on success");
assertEqual(successRunner.calls.length, 1, "invokes ffmpeg once");
assert(successRunner.calls[0]?.includes("image2pipe") === true, "browser render reads overlay frames from an image2pipe stream");
assert(!(successRunner.calls[0]?.join(" ").includes("overlay-%05d.png") ?? false), "browser render no longer references a PNG frame directory");
assertEqual(successRunner.stdinChunks.length, 6, "browser render streams every captured frame to ffmpeg stdin");

const directDriver = new FakeBrowserDriver();
const directRunner = createFakeFfmpegRunner();
const directRenderResult = await renderComposition(directShapeView, {
  preset: "direct",
  outDir,
  renderMode: "ffmpeg-direct",
  driver: directDriver,
  ffmpegRunner: directRunner
});
assert(directRenderResult.ok === true, "ffmpeg-direct render succeeds with fakes");
assertEqual(directDriver.opens, 0, "ffmpeg-direct render does not open the browser driver");
assertEqual(directDriver.renderedFrames.length, 0, "ffmpeg-direct render does not capture browser frames");
assertEqual(directRunner.calls.length, 1, "ffmpeg-direct render invokes ffmpeg once");
assert(!directRunner.calls[0]?.join(" ").includes("overlay-%05d.png"), "ffmpeg-direct render call skips overlay PNG input");
if (directRenderResult.ok) {
  assertEqual(directRenderResult.metadata.tools.chromium.revision, "not-used", "ffmpeg-direct metadata records no Chromium use");
  assertEqual(directRenderResult.timings.captureMs, undefined, "ffmpeg-direct render reports no capture timing");
  assertEqual(directRenderResult.timings.renderMode, "ffmpeg-direct", "ffmpeg-direct render reports its resolved mode");
  assert(directRenderResult.timings.encodeMs >= 0, "ffmpeg-direct render reports encode timing");
}

const autoDirectDriver = new FakeBrowserDriver();
const autoDirectResult = await renderComposition(directShapeView, {
  preset: "direct",
  outDir,
  renderMode: "auto",
  driver: autoDirectDriver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(autoDirectResult.ok === true, "auto render succeeds for a directly supported composition");
assertEqual(autoDirectDriver.opens, 0, "auto render selects FFmpeg-direct when supported");
if (autoDirectResult.ok) {
  assertEqual(autoDirectResult.timings.requestedRenderMode, "auto", "auto render reports its requested mode");
  assertEqual(autoDirectResult.timings.renderMode, "ffmpeg-direct", "auto render reports its direct resolution");
}

const autoFallbackDriver = new FakeBrowserDriver();
const autoFallbackResult = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Fallback" },
  outDir,
  renderMode: "auto",
  driver: autoFallbackDriver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(autoFallbackResult.ok === true, "auto render falls back for an unsupported composition");
assertEqual(autoFallbackDriver.opens, 1, "auto render selects browser-overlay when direct rendering is unsupported");
if (autoFallbackResult.ok) {
  assertEqual(autoFallbackResult.timings.renderMode, "browser-overlay", "auto render reports its browser fallback");
}

const directImageDriver = new FakeBrowserDriver();
const directImageRunner = createFakeFfmpegRunner();
const directImageRenderResult = await renderComposition(directImageView, {
  preset: "image-direct",
  outDir,
  renderMode: "ffmpeg-direct",
  driver: directImageDriver,
  ffmpegRunner: directImageRunner
});
assert(directImageRenderResult.ok === true, "ffmpeg-direct image render succeeds with fakes");
assertEqual(directImageDriver.opens, 0, "ffmpeg-direct image render does not open the browser driver");
assertEqual(directImageRunner.stdinChunks.length, 0, "ffmpeg-direct image render does not pipe browser frames");
assert(directImageRunner.calls[0]?.join(" ").includes("concat=n=2:v=1:a=0") === true, "ffmpeg-direct image render uses concat");

const parallelRenderDriver = new FakeBrowserDriver();
const parallelRenderRunner = createFakeFfmpegRunner();
const parallelRenderResult = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: parallelRenderDriver,
  ffmpegRunner: parallelRenderRunner,
  captureParallelism: 3
});
assert(parallelRenderResult.ok === true, "parallel capture render succeeds with fakes");
assertEqual(parallelRenderDriver.renderedFrames.length, 6, "parallel capture renders every frame across forks");
assertEqual(parallelRenderRunner.stdinChunks.length, 6, "parallel capture still streams every frame to ffmpeg in order");
assert(parallelRenderDriver.forks >= 1, "parallel capture forks the browser driver");
assertEqual(parallelRenderDriver.forkCloses, parallelRenderDriver.forks, "parallel capture closes every fork");

const invalidParallelismResult = await renderComposition(templateDoc, {
  preset: "reels",
  outDir,
  captureParallelism: 0,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(invalidParallelismResult.ok === false, "capture parallelism must be a positive integer");
if (!invalidParallelismResult.ok) {
  assertEqual(invalidParallelismResult.errors[0]?.path, "captureParallelism", "capture parallelism error identifies the option");
}

const webmRenderDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "web", format: "webm", width: 1080, height: 1920 }]
};
const webmRenderResult = await renderComposition(webmRenderDoc, {
  preset: "web",
  propValues: { headline: "Web" },
  outDir,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(webmRenderResult.ok === true, "webm render succeeds with fakes");
if (webmRenderResult.ok) {
  assertEqual(webmRenderResult.metadata.codecs.video, "vp9", "webm metadata records VP9 default");
  assertEqual(webmRenderResult.metadata.codecs.audio, "opus", "webm metadata records Opus default");
}

const defaultPropDoc: KavioDocument = {
  ...templateDoc,
  props: { headline: { type: "string", default: "Fallback headline" } }
};
const defaultPropResult = await renderComposition(defaultPropDoc, {
  preset: "reels",
  outDir,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(defaultPropResult.ok === true, "render resolves declared prop defaults when values are omitted");

const pngDoc: KavioDocument = {
  ...templateDoc,
  exports: [
    { name: "card", format: "png", width: 1080, height: 1920, frame: 3 },
    { name: "sticker", format: "png", width: 1080, height: 1920, background: "transparent" }
  ]
};
const pngDriver = new FakeBrowserDriver();
const pngRunner = createFakeFfmpegRunner();
const pngResult = await renderComposition(pngDoc, {
  preset: "card",
  propValues: { headline: "Still" },
  outDir,
  driver: pngDriver,
  ffmpegRunner: pngRunner
});
assert(pngResult.ok === true, "png export renders with fakes");
if (pngResult.ok) {
  assert(pngResult.outputPath.endsWith(".png"), "png export writes a .png output path");
  assertEqual(pngResult.metadata.codecs.video, null, "png metadata records no video codec");
  assertEqual(pngResult.metadata.codecs.audio, null, "png metadata records no audio codec");
  assert(pngResult.metadata.checksums[0]!.bytes! > 0, "png export writes the captured bytes");
  assert(pngResult.timings.captureMs !== undefined, "png export reports capture timing");
  assertEqual(pngResult.timings.encodeMs, 0, "png export skips encoding");
}
assertEqual(pngRunner.calls.length, 0, "png export never invokes ffmpeg");
assertEqual(pngDriver.renderedFrames.join(","), "3", "png export captures exactly the requested frame");
assertEqual(pngDriver.closes, 1, "png export closes the browser driver");

const transparentPngResult = await renderComposition(pngDoc, {
  preset: "sticker",
  propValues: { headline: "Alpha" },
  outDir,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(transparentPngResult.ok === true, "transparent png export is supported");

const invalidDoc: KavioDocument = {
  ...templateDoc,
  composition: { ...templateDoc.composition, durationFrames: 0 }
};
const invalidResult = await renderComposition(invalidDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(invalidResult.ok === false, "invalid doc fails before rendering");
if (!invalidResult.ok) {
  assert(invalidResult.errors.some((error) => error.stage === "validation"), "returns validation errors");
}

const failDriver = new FakeBrowserDriver();
const failResult = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: failDriver,
  ffmpegRunner: createFakeFfmpegRunner({ fail: true })
});
assert(failResult.ok === false, "ffmpeg failure yields ok:false");
if (!failResult.ok) {
  assert(failResult.errors.some((error) => error.code === "FFMPEG_FAILED"), "surfaces ffmpeg failure");
}
assertEqual(failDriver.closes, 1, "closes the browser driver even on ffmpeg failure");

const pngSequenceDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "frames", format: "png-sequence", width: 1080, height: 1920 }]
};
const pngSequenceDriver = new FakeBrowserDriver();
const pngSequenceResult = await renderComposition(pngSequenceDoc, {
  preset: "frames",
  propValues: { headline: "Frames" },
  outDir,
  driver: pngSequenceDriver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(pngSequenceResult.ok === true, "png-sequence export renders with fakes");
if (pngSequenceResult.ok) {
  assert(pngSequenceResult.outputPath.endsWith("frames"), "png-sequence output path names its directory");
  assert(pngSequenceResult.outputPattern?.endsWith("frame-%05d.png") === true, "png-sequence exposes its numbered output pattern");
  assertEqual(pngSequenceResult.metadata.checksums[0]?.bytes, 48, "png-sequence checksum covers all frame bytes");
  assertEqual(pngSequenceResult.timings.encodeMs, 0, "png-sequence skips encoding");
}
assertEqual(pngSequenceDriver.renderedFrames.length, 6, "png-sequence captures every frame");

const gifDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "loop", format: "gif", width: 1080, height: 1920 }]
};
const gifDriver = new FakeBrowserDriver();
const gifRunner = createFakeFfmpegRunner();
const gifResult = await renderComposition(gifDoc, {
  preset: "loop",
  propValues: { headline: "GIF" },
  outDir,
  driver: gifDriver,
  ffmpegRunner: gifRunner
});
assert(gifResult.ok === true, "gif render succeeds with fakes");
assertEqual(gifDriver.renderedFrames.length, 6, "gif render captures every frame");
assert(gifRunner.calls[0]?.includes("gif") === true, "gif render selects gif muxing");
assert(gifRunner.calls[0]?.includes("-map") === true, "gif render maps video output");
assert(gifRunner.calls[0]?.includes(`[${"audio_out"}]`) === false, "gif render skips audio output");

const transparentDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "alpha-webm", format: "webm", width: 1080, height: 1920, background: "transparent" }]
};
const transparentDriver = new FakeBrowserDriver();
const transparentResult = await renderComposition(transparentDoc, {
  preset: "alpha-webm",
  propValues: { headline: "Alpha" },
  outDir,
  driver: transparentDriver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(transparentResult.ok === true, "transparent webm render succeeds with fakes");
if (transparentResult.ok) {
  assertEqual(transparentResult.metadata.codecs.video, "vp9", "transparent webm records VP9 codec");
}
assertEqual(transparentDriver.renderedFrames.length, 6, "transparent webm captures every frame");

const transparentMp4Doc: KavioDocument = {
  ...templateDoc,
  composition: { ...templateDoc.composition, background: "transparent" },
  exports: [{ name: "bad-alpha", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};
const transparentMp4Driver = new FakeBrowserDriver();
const transparentMp4Result = await renderComposition(transparentMp4Doc, {
  preset: "bad-alpha",
  propValues: { headline: "Alpha" },
  outDir,
  driver: transparentMp4Driver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(transparentMp4Result.ok === false, "transparent mp4 output fails before rendering");
assertEqual(transparentMp4Driver.renderedFrames.length, 0, "transparent mp4 output does not capture frames");

// --- custom HTML frames ----------------------------------------------------

const htmlShells: string[] = [];
const htmlEvaluations: string[] = [];
const htmlSession = new PlaywrightSession({
  htmlStyles: "body{color:red}",
  renderHtmlFrame: (frame) => `<main data-frame="${frame}">${frame}</main>`
}, async () => ({
  async newContext() {
    return {
      async newPage() {
        return {
          async goto() {},
          async evaluate(expression: string) { htmlEvaluations.push(expression); },
          async setContent(html: string) { htmlShells.push(html); },
          async waitForFunction() {},
          async screenshot() { return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); },
          async close() {}
        };
      },
      async newCDPSession() {
        return {
          async send(method: string) {
            return method === "Page.captureScreenshot" ? { data: "iVBORw0KGgo=" } : undefined;
          }
        };
      },
      async close() {}
    };
  },
  version() { return "fake-html-chromium"; },
  async close() {}
}));
const htmlDriver = htmlSession.createDriver();
await htmlDriver.open(templateDoc);
await htmlDriver.renderFrame(2);
const htmlFork = await htmlDriver.fork();
await htmlFork.renderFrame(3);
await htmlFork.close();
await htmlDriver.close();
await htmlSession.close();
assertEqual(htmlShells.length, 2, "custom HTML initializes the main and forked page shells");
assert(htmlShells.every((shell) => shell.includes("body{color:red}")), "custom HTML installs static styles");
assert(htmlEvaluations.some((expression) => expression.includes('data-frame=\\"2\\"')), "custom HTML renders the requested frame");
assert(htmlEvaluations.some((expression) => expression.includes('data-frame=\\"3\\"')), "custom HTML works in capture forks");

// --- render-batch.ts -------------------------------------------------------

let sessionLaunches = 0;
let sessionBrowserCloses = 0;
let sessionContextCloses = 0;
const reusableSession = new PlaywrightSession({}, async () => {
  sessionLaunches += 1;
  return {
    async newContext() {
      return {
        async newPage() {
          return {
            async goto() {},
            async evaluate() {},
            async setContent() {},
            async waitForFunction() {},
            async screenshot() { return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); },
            async close() {}
          };
        },
        async newCDPSession() {
          return {
            async send(method: string) {
              return method === "Page.captureScreenshot" ? { data: "iVBORw0KGgo=" } : undefined;
            }
          };
        },
        async close() { sessionContextCloses += 1; }
      };
    },
    version() { return "fake-session-chromium"; },
    async close() { sessionBrowserCloses += 1; }
  };
});

const firstSessionRender = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Session A" },
  outputName: "session-a.mp4",
  outDir,
  driver: reusableSession.createDriver(),
  ffmpegRunner: createFakeFfmpegRunner(),
  captureParallelism: 3
});
const secondSessionRender = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Session B" },
  outputName: "session-b.mp4",
  outDir,
  driver: reusableSession.createDriver(),
  ffmpegRunner: createFakeFfmpegRunner(),
  captureParallelism: 3
});
assert(firstSessionRender.ok && secondSessionRender.ok, "reusable browser session renders isolated jobs");
if (firstSessionRender.ok && secondSessionRender.ok) {
  assertEqual(firstSessionRender.timings.browserLaunches, 3, "first session render launches its capture browsers");
  assertEqual(secondSessionRender.timings.browserLaunches, 0, "compatible next render reuses browser launches without wall-clock assertions");
}
assertEqual(sessionLaunches, 3, "session launches once per capture worker rather than once per job");
assertEqual(sessionContextCloses, 6, "session closes every job and fork context while retaining browsers");
const failedSessionRender = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Session failure" },
  outputName: "session-failure.mp4",
  outDir,
  driver: reusableSession.createDriver(),
  ffmpegRunner: createFakeFfmpegRunner({ fail: true }),
  captureParallelism: 3
});
assert(failedSessionRender.ok === false, "reusable browser session reports an encode failure");
assertEqual(sessionLaunches, 3, "failed compatible render still reuses retained browsers");
assertEqual(sessionContextCloses, 9, "failed render closes every job and fork context");
await reusableSession.close();
assertEqual(sessionBrowserCloses, 3, "session closes every retained browser");

const batchTemplate: KavioDocument = {
  ...templateDoc,
  exports: [
    { name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 },
    { name: "square", format: "mp4", codec: "h264", width: 1080, height: 1080 }
  ]
};

const batchDriver = new FakeBrowserDriver();
const batchResults = await renderBatch(
  {
    template: batchTemplate,
    rows: [
      { id: "a", props: { headline: "A" } },
      { id: "b", props: { headline: "B" } }
    ],
    presets: ["reels", "square"]
  },
  { outDir, driver: batchDriver, ffmpegRunner: createFakeFfmpegRunner(), captureParallelism: 2 }
);
assertEqual(batchResults.length, 4, "batch expands rows x presets");
assert(
  batchResults.every((item) => item.result.ok),
  "all batch jobs succeed"
);
const batchPaths = batchResults.map((item) => (item.result.ok ? item.result.outputPath : ""));
assertEqual(new Set(batchPaths).size, 4, "batch produces distinct output paths");
assert(batchDriver.forks >= 1, "batch passes capture parallelism to each browser render");

const failFastResults = await renderBatch(
  {
    template: batchTemplate,
    rows: [
      { id: "a", props: { headline: "A" } },
      { id: "b", props: { headline: "B" } }
    ],
    presets: ["reels", "square"]
  },
  { outDir, driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner({ fail: true }), failFast: true }
);
assertEqual(failFastResults.length, 1, "fail-fast stops after the first failure");
assert(failFastResults[0]?.result.ok === false, "fail-fast records the failing job");

console.log("Render error helper self-checks passed.");
console.log("Render command assembly self-checks passed.");
console.log("Render harness server self-checks passed.");
console.log("Render ffmpeg runner self-checks passed.");
console.log("Render composition orchestrator self-checks passed.");
console.log("Render batch orchestrator self-checks passed.");
