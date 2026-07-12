import {
  buildAudioMixFilterChains,
  buildConcatFilterChain,
  buildOverlayCompositingArgs,
  createMapStep,
  planAudioMix,
  planBaseVideo,
  planBaseVideoSequence,
  planOverlayCompositing,
  planVideoPipOverlay,
  renderFfmpegArgs
} from "./index.js";

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

const basePlan = planBaseVideo({
  asset: {
    src: "input.mp4",
    trimStartFrames: 30,
    trimEndFrames: 180
  },
  layer: {
    id: "hero clip",
    asset: "hero",
    durationFrames: 120,
    fit: "cover"
  },
  output: { width: 1920, height: 1080 },
  fps: 30
});

assertEqual(basePlan.steps.length, 2, "base video planning emits input and filter steps");
assertEqual(basePlan.steps[0]?.kind, "input", "first base video step is inspectable as input");
assert(renderFfmpegArgs(basePlan).includes("-filter_complex"), "base plan renders filter_complex args");
assert(renderFfmpegArgs(basePlan).join(" ").includes("setpts=PTS-STARTPTS,fps=30"), "base video normalizes source timing to the render fps");

const subjectCropPlan = planBaseVideo({
  asset: {
    src: "landscape.mp4"
  },
  layer: {
    id: "subject clip",
    asset: "subject",
    durationFrames: 120,
    fit: "cover",
    crop: {
      mode: "subject",
      x: 0.35,
      y: 0.45,
      keyframes: [
        { frame: 0, x: 0.35, y: 0.45 },
        { frame: 90, x: 0.65, y: 0.5 }
      ]
    }
  },
  output: { width: 1080, height: 1920 },
  fps: 30
});
const subjectCropArgs = renderFfmpegArgs(subjectCropPlan).join(" ");
assert(subjectCropArgs.includes("crop=1080:1920:min(max"), "subject crop emits explicit crop coordinates");
assert(subjectCropArgs.includes("if(lte(n\\,90)"), "subject crop emits frame-aware focus interpolation");

const overlayArgs = buildOverlayCompositingArgs({
  baseLabel: "hero_clip_base",
  overlayLabel: "overlay_frames",
  outputLabel: "video_out",
  startFrame: 15,
  durationFrames: 45,
  fps: 30
});

assertEqual(overlayArgs[0], "-filter_complex", "overlay args are returned as ffmpeg filter_complex arguments");
assert(
  overlayArgs[1]?.includes("enable='between(t,0.5,2)'") ?? false,
  "overlay args include frame-derived enable expression"
);

const concat = buildConcatFilterChain({
  segmentLabels: ["segment_0", "segment_1"],
  outputLabel: "base_concat"
});
assert(concat.expression.includes("concat=n=2:v=1:a=0"), "concat helper records concat filter expression");

const sequencePlan = planBaseVideoSequence({
  segments: [
    {
      asset: { src: "clip-a.mp4", trimStartFrames: 0, trimEndFrames: 90 },
      layer: { id: "clip a", asset: "a", durationFrames: 90, fit: "cover" },
      output: { width: 1280, height: 720 },
      fps: 30
    },
    {
      asset: { src: "clip-b.mp4", trimStartFrames: 15, trimEndFrames: 105 },
      layer: { id: "clip b", asset: "b", durationFrames: 90, fit: "contain" },
      output: { width: 1280, height: 720 },
      fps: 30
    }
  ],
  outputLabel: "base_video"
});
assertEqual(sequencePlan.steps.length, 3, "base sequence planning emits two inputs and one filter step");
assert(renderFfmpegArgs(sequencePlan).join(" ").includes("concat=n=2:v=1:a=0"), "base sequence args include concat graph");

const overlayPlan = planOverlayCompositing({
  baseLabel: "base_video",
  frames: {
    framePattern: "overlay-%05d.png",
    fps: 30,
    inputIndex: 2,
    startNumber: 0
  },
  outputLabel: "video_out",
  shortest: true
});
assert(renderFfmpegArgs(overlayPlan).join(" ").includes("-framerate 30"), "overlay plan reads frame sequence at fps");
assert(
  renderFfmpegArgs(overlayPlan).join(" ").includes("[2:v]format=rgba,setpts=PTS-STARTPTS[overlay_frames]"),
  "overlay plan normalizes transparent frames"
);

const audioPlan = planAudioMix({
  fps: 30,
  tracks: [
    {
      asset: { src: "music.wav" },
      track: {
        id: "music",
        asset: "music",
        role: "music",
        startFrame: 0,
        durationFrames: 240,
        volume: 0.7,
        fadeInFrames: 15,
        fadeOutFrames: 30,
        duck: {
          against: "voiceover",
          amountDb: -12,
          attackFrames: 3,
          releaseFrames: 9
        }
      }
    },
    {
      asset: { src: "source.mp4", trimStartFrames: 30 },
      track: {
        id: "source audio",
        asset: "source-video",
        role: "source",
        startFrame: 0,
        durationFrames: 120,
        volume: 0.5
      }
    },
    {
      asset: { src: "voiceover.wav" },
      track: {
        id: "vo",
        asset: "voiceover",
        role: "voiceover",
        startFrame: 30,
        durationFrames: 90,
        offsetFrames: 6,
        volume: 1
      }
    }
  ],
  outputLabel: "audio_out"
});
const audioArgs = renderFfmpegArgs(audioPlan).join(" ");
assert(audioArgs.includes("afade=t=in:st=0:d=0.5"), "audio plan includes fade-in filters");
assert(audioArgs.includes("afade=t=out:st=7:d=1"), "audio plan includes fade-out filters");
assert(audioArgs.includes("asplit=outputs=2"), "audio plan splits the sidechain track for compression and mixing");
assert(audioArgs.includes("apad"), "audio plan pads the compressor sidechain so it cannot truncate the ducked track");
assert(
  audioArgs.includes(
    "sidechaincompress=threshold=0.233572:ratio=20:attack=100:release=300:knee=1:link=maximum:detection=peak"
  ),
  "audio plan emits deterministic FFmpeg sidechain compression"
);
assert(!audioArgs.includes("volume='if"), "audio plan no longer represents ducking as a timeline-only volume envelope");
assert(audioArgs.includes("amix=inputs=3:duration=longest"), "audio plan mixes all MVP audio roles");
assert(audioArgs.includes("loudnorm=I=-14"), "audio plan includes default loudness normalization");

const wholeAssetLoopPlan = planAudioMix({
  fps: 30,
  normalizeLoudness: false,
  tracks: [
    {
      asset: { src: "bed.wav", loop: true },
      track: { id: "looped bed", asset: "bed", role: "music", startFrame: 0, durationFrames: 90 }
    }
  ]
});
assert(
  renderFfmpegArgs(wholeAssetLoopPlan).join(" ").includes("-stream_loop -1 -t 3 -i bed.wav"),
  "finite whole-asset audio loops emit FFmpeg stream looping"
);

const trimmedLoopPlan = planAudioMix({
  fps: 30,
  normalizeLoudness: false,
  tracks: [
    {
      asset: { src: "bed.wav", trimStartFrames: 30, trimEndFrames: 60, loop: true },
      track: { id: "trimmed bed", asset: "bed", role: "music", startFrame: 0, durationFrames: 90 }
    }
  ]
});
const trimmedLoopArgs = renderFfmpegArgs(trimmedLoopPlan).join(" ");
assert(trimmedLoopArgs.includes("-ss 1 -t 1 -i bed.wav"), "trimmed loops read exactly one source segment");
assert(
  trimmedLoopArgs.includes("aresample=48000:async=1,aloop=loop=-1:size=48000,atrim=duration=3"),
  "trimmed loops repeat the source segment and bound it to the requested duration"
);

const unsupportedOffsetLoopPlan = planAudioMix({
  fps: 30,
  normalizeLoudness: false,
  tracks: [
    {
      asset: { src: "bed.wav", loop: true },
      track: { id: "offset bed", asset: "bed", role: "music", startFrame: 0, durationFrames: 90, offsetFrames: 30 }
    }
  ]
});
assert(
  unsupportedOffsetLoopPlan.steps.some((step) =>
    step.notes?.some((note) => note.includes("source offset without trimEndFrames does not define the repeat boundary"))
  ),
  "ambiguous offset loops retain a clear planner diagnostic"
);
assert(
  !renderFfmpegArgs(unsupportedOffsetLoopPlan).includes("-stream_loop"),
  "ambiguous offset loops preserve the existing non-looping input behavior"
);

const audioChains = buildAudioMixFilterChains({
  fps: 30,
  normalizeLoudness: false,
  tracks: [
    {
      asset: { src: "voiceover.wav" },
      track: {
        id: "vo only",
        asset: "voiceover",
        role: "voiceover",
        startFrame: 0,
        durationFrames: 30
      }
    }
  ]
});
assert(!audioChains.at(-1)?.expression.includes("loudnorm"), "audio loudness normalization can be disabled");

const mapStep = createMapStep({
  id: "map-video",
  description: "Map planned video output.",
  labels: ["video_out"]
});
assertEqual(mapStep.args.join(" "), "-map [video_out]", "map helper renders label mapping args");

// --- planVideoPipOverlay -----------------------------------------------------

const pipPlan = planVideoPipOverlay({
  segment: {
    asset: { src: "pip.mp4", trimStartFrames: 0, trimEndFrames: null, loop: false },
    layer: { id: "pip clip", asset: "pip", durationFrames: 60, fit: "cover", playbackRate: 1 },
    output: { width: 480, height: 270 },
    fps: 30,
    inputIndex: 1
  },
  baseLabel: "base_video",
  x: 1320,
  y: 90,
  startFrame: 30,
  durationFrames: 60,
  fps: 30,
  outputLabel: "pip_out"
});
const pipInputArgs = pipPlan.steps.filter((step) => step.kind === "input").flatMap((step) => step.args);
assert(pipInputArgs.join(" ").includes("-i pip.mp4"), "pip overlay plan declares the pip video input");
const pipFilterText = pipPlan.steps
  .filter((step) => step.kind === "filter")
  .flatMap((step) => step.chains)
  .map((chain) => chain.expression)
  .join(";");
assert(pipFilterText.includes("scale="), "pip overlay plan normalizes the pip video to its layer size");
assert(pipFilterText.includes("overlay=x=1320:y=90"), "pip overlay plan positions the pip plane");
assert(pipFilterText.includes("enable='between("), "pip overlay plan bounds the pip plane to its frame window");
assert(pipFilterText.includes("[base_video]"), "pip overlay plan composites over the provided base label");
assert(pipFilterText.includes("[pip_out]"), "pip overlay plan emits the requested output label");

console.log("FFmpeg pip overlay plan self-checks passed.");
