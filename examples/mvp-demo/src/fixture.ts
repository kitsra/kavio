import { asset, caption, clip, exportPreset, image, keyframes, prop, shape, text, validate, video } from "@kavio/builder";
import { expandRenderBatch } from "@kavio/render-worker";
import type { RenderBatchInput, RenderBatchJob, RenderBatchRow } from "@kavio/render-worker";

const durationFrames = 300;

const primaryClipUrl = prop("primaryClipUrl", {
  type: "url",
  required: true,
  description: "Main background clip for the variant."
});
const secondaryClipUrl = prop("secondaryClipUrl", {
  type: "url",
  required: true,
  description: "Secondary cutaway clip for the middle beat."
});
const logoUrl = prop("logoUrl", {
  type: "url",
  required: true,
  description: "Brand logo image URL."
});
const musicUrl = prop("musicUrl", {
  type: "url",
  required: true,
  description: "Music bed URL."
});
const headline = prop("headline", {
  type: "string",
  required: true,
  maxLength: 92
});
const cta = prop("cta", {
  type: "string",
  required: true,
  maxLength: 36
});
const captionOne = prop("captionOne", {
  type: "string",
  required: true,
  maxLength: 52
});
const captionTwo = prop("captionTwo", {
  type: "string",
  required: true,
  maxLength: 52
});
const captionThree = prop("captionThree", {
  type: "string",
  required: true,
  maxLength: 52
});
const primaryColor = prop("primaryColor", {
  type: "color",
  default: "#101820"
});
const accentColor = prop("accentColor", {
  type: "color",
  default: "#FFB000"
});
const textColor = prop("textColor", {
  type: "color",
  default: "#FFFFFF"
});
const backgroundColor = prop("backgroundColor", {
  type: "color",
  default: "#101820"
});

const primaryClip = asset.video("primaryClip", primaryClipUrl, { loop: true });
const secondaryClip = asset.video("secondaryClip", secondaryClipUrl, { loop: true });
const logo = asset.image("logo", logoUrl);
const music = asset.audio("music", musicUrl, { loop: true });

const templateBuilder = video(
  {
    width: 1080,
    height: 1920,
    fps: 30,
    durationFrames,
    background: backgroundColor.toString(),
    colorSpace: "srgb"
  },
  {
    metadata: {
      title: "Kavio MVP demo template",
      tags: ["mvp-demo", "batch", "fixture"],
      purpose: "Template fixture for multi-row, multi-aspect rendering through the shared Kavio pipeline."
    }
  }
);

templateBuilder
  .props(
    primaryClipUrl,
    secondaryClipUrl,
    logoUrl,
    musicUrl,
    headline,
    cta,
    captionOne,
    captionTwo,
    captionThree,
    primaryColor,
    accentColor,
    textColor,
    backgroundColor
  )
  .assets(primaryClip, secondaryClip, logo, music)
  .add(
    clip("primaryClipLayer", {
      asset: primaryClip,
      startFrame: 0,
      durationFrames,
      fit: "cover",
      muted: true,
      transitionIn: { type: "fade", durationFrames: 12 },
      transitionOut: { type: "fade", durationFrames: 12 }
    }),
    shape("brandWash", {
      startFrame: 0,
      durationFrames,
      x: "0%w",
      y: "0%h",
      width: "100%w",
      height: "100%h",
      fill: backgroundColor,
      opacity: 0.48
    }),
    shape("accentRail", {
      startFrame: 0,
      durationFrames,
      x: 0,
      y: 0,
      width: 18,
      height: "100%h",
      fill: accentColor
    }),
    image("logo", {
      asset: logo,
      startFrame: 0,
      durationFrames,
      x: 88,
      y: 94,
      width: 184,
      height: 88,
      fit: "contain",
      anchor: "top-left"
    }).animate(
      "opacity",
      keyframes([
        [0, 0],
        [18, 1, "outQuad"]
      ])
    ),
    text("headline", {
      text: headline,
      startFrame: 24,
      durationFrames: 160,
      x: 88,
      y: 318,
      width: 904,
      anchor: "top-left",
      style: {
        fontFamily: "Inter",
        fontSize: 82,
        fontWeight: 800,
        color: textColor,
        align: "left",
        lineHeight: 0.96,
        maxLines: 3,
        wrap: true,
        shadow: {
          color: "#00000099",
          x: 0,
          y: 8,
          blur: 22
        }
      }
    }).animate(
      "y",
      keyframes([
        [0, 354],
        [18, 318, "outCubic"]
      ])
    ),
    clip("secondaryClipLayer", {
      asset: secondaryClip,
      startFrame: 116,
      durationFrames: 122,
      x: "50%w",
      y: 1090,
      width: 840,
      height: 472,
      fit: "cover",
      muted: true,
      anchor: "center",
      transitionIn: { type: "slide", direction: "up", durationFrames: 14 },
      transitionOut: { type: "fade", durationFrames: 12 }
    }),
    shape("ctaBacking", {
      startFrame: 194,
      durationFrames: 82,
      x: 88,
      y: 1600,
      width: 520,
      height: 104,
      fill: accentColor,
      radius: 52
    }).animate(
      "scale",
      keyframes([
        [0, 0.92],
        [12, 1, "outBack"]
      ])
    ),
    text("cta", {
      text: cta,
      startFrame: 194,
      durationFrames: 82,
      x: 348,
      y: 1652,
      width: 420,
      anchor: "center",
      style: {
        fontFamily: "Inter",
        fontSize: 40,
        fontWeight: 800,
        color: primaryColor,
        align: "center",
        maxLines: 1
      }
    }),
    caption("captions", {
      startFrame: 42,
      durationFrames: 216,
      source: {
        kind: "inline",
        cues: [
          { startFrame: 42, endFrame: 104, text: captionOne },
          { startFrame: 112, endFrame: 176, text: captionTwo },
          { startFrame: 186, endFrame: 258, text: captionThree }
        ]
      },
      safeArea: "bottom",
      style: {
        fontFamily: "Inter",
        fontSize: 44,
        fontWeight: 700,
        color: textColor,
        align: "center",
        maxCharsPerLine: 28,
        maxLines: 2,
        background: "#000000AA",
        padding: 18,
        highlight: {
          mode: "line",
          color: accentColor,
          scale: 1.03
        }
      }
    })
  )
  .audio({
    asset: music,
    role: "music",
    startFrame: 0,
    durationFrames,
    volume: 0.32,
    fadeInFrames: 18,
    fadeOutFrames: 24
  })
  .exports(
    exportPreset.reels({
      name: "reels-9x16",
      fps: 30,
      bitrate: "8M",
      audioCodec: "aac",
      audioBitrate: "192k",
      loudnessLufs: -14
    }),
    exportPreset.square({
      name: "square-1x1",
      fps: 30,
      bitrate: "6M",
      audioCodec: "aac",
      audioBitrate: "192k",
      loudnessLufs: -14,
      layerOverrides: {
        logo: { position: { x: 72, y: 66 }, size: { width: 154, height: 74 } },
        headline: { position: { x: 72, y: 220 }, size: { width: 936 }, style: { fontSize: 68 } },
        secondaryClipLayer: { position: { x: "50%w", y: 650 }, size: { width: 780, height: 438 } },
        ctaBacking: { position: { x: 72, y: 914 }, size: { width: 470, height: 92 }, radius: 46 },
        cta: { position: { x: 307, y: 960 }, size: { width: 380 }, style: { fontSize: 34 } }
      }
    }),
    exportPreset.landscape({
      name: "landscape-16x9",
      fps: 30,
      bitrate: "10M",
      audioCodec: "aac",
      audioBitrate: "192k",
      loudnessLufs: -14,
      layerOverrides: {
        logo: { position: { x: 92, y: 64 }, size: { width: 166, height: 80 } },
        headline: { position: { x: 92, y: 250 }, size: { width: 820 }, style: { fontSize: 66 } },
        secondaryClipLayer: { position: { x: 1390, y: 538 }, size: { width: 760, height: 428 } },
        ctaBacking: { position: { x: 92, y: 822 }, size: { width: 470, height: 92 }, radius: 46 },
        cta: { position: { x: 327, y: 868 }, size: { width: 380 }, style: { fontSize: 34 } },
        captions: { safeArea: { x: 960, y: 938 }, style: { fontSize: 34, maxCharsPerLine: 42 } }
      }
    })
  );

export const template = templateBuilder.toJSON();

export const rows = [
  {
    id: "launch",
    props: {
      primaryClipUrl: "https://assets.example.invalid/kavio/mvp/launch-primary.mp4",
      secondaryClipUrl: "https://assets.example.invalid/kavio/mvp/launch-detail.mp4",
      logoUrl: "https://assets.example.invalid/kavio/brands/nova-nest-logo.png",
      musicUrl: "https://assets.example.invalid/kavio/audio/bright-pulse.mp3",
      headline: "Launch three polished ads from one Kavio template",
      cta: "Start the batch",
      captionOne: "Drop in clips, logo, captions, and brand colors.",
      captionTwo: "Kavio keeps the timeline structured and reusable.",
      captionThree: "One template expands across every key format.",
      primaryColor: "#101820",
      accentColor: "#FFB000",
      textColor: "#FFFFFF",
      backgroundColor: "#101820"
    }
  },
  {
    id: "retail",
    props: {
      primaryClipUrl: "https://assets.example.invalid/kavio/mvp/retail-primary.mp4",
      secondaryClipUrl: "https://assets.example.invalid/kavio/mvp/retail-detail.mp4",
      logoUrl: "https://assets.example.invalid/kavio/brands/market-arc-logo.png",
      musicUrl: "https://assets.example.invalid/kavio/audio/warm-drive.mp3",
      headline: "Turn product footage into channel-ready promos",
      cta: "Shop the drop",
      captionOne: "Use the same recipe for new SKUs and offers.",
      captionTwo: "Swap the copy and palette per audience.",
      captionThree: "Export vertical, square, and landscape together.",
      primaryColor: "#132A2E",
      accentColor: "#7EE081",
      textColor: "#F7FFF7",
      backgroundColor: "#132A2E"
    }
  },
  {
    id: "event",
    props: {
      primaryClipUrl: "https://assets.example.invalid/kavio/mvp/event-primary.mp4",
      secondaryClipUrl: "https://assets.example.invalid/kavio/mvp/event-detail.mp4",
      logoUrl: "https://assets.example.invalid/kavio/brands/venue-signal-logo.png",
      musicUrl: "https://assets.example.invalid/kavio/audio/night-motion.mp3",
      headline: "Publish event teasers while the moment is still moving",
      cta: "Reserve now",
      captionOne: "Pull highlight clips into a repeatable campaign.",
      captionTwo: "Keep every venue asset on brand.",
      captionThree: "Ship every aspect ratio from one batch.",
      primaryColor: "#17233D",
      accentColor: "#F75C03",
      textColor: "#F8F9FA",
      backgroundColor: "#17233D"
    }
  },
  {
    id: "course",
    props: {
      primaryClipUrl: "https://assets.example.invalid/kavio/mvp/course-primary.mp4",
      secondaryClipUrl: "https://assets.example.invalid/kavio/mvp/course-detail.mp4",
      logoUrl: "https://assets.example.invalid/kavio/brands/learnline-logo.png",
      musicUrl: "https://assets.example.invalid/kavio/audio/focused-rise.mp3",
      headline: "Package learning clips into social lessons fast",
      cta: "Watch lesson one",
      captionOne: "Captions stay editable in the JSON recipe.",
      captionTwo: "Color props carry the brand kit.",
      captionThree: "Batch rows make new variants routine.",
      primaryColor: "#23395B",
      accentColor: "#F4D35E",
      textColor: "#FFFFFF",
      backgroundColor: "#23395B"
    }
  },
  {
    id: "app",
    props: {
      primaryClipUrl: "https://assets.example.invalid/kavio/mvp/app-primary.mp4",
      secondaryClipUrl: "https://assets.example.invalid/kavio/mvp/app-detail.mp4",
      logoUrl: "https://assets.example.invalid/kavio/brands/pulseboard-logo.png",
      musicUrl: "https://assets.example.invalid/kavio/audio/clean-signal.mp3",
      headline: "Create app launch variants without rebuilding the timeline",
      cta: "Try the demo",
      captionOne: "Screen clips, logo, CTA, captions, and music are props.",
      captionTwo: "Each row can target a different audience.",
      captionThree: "The manifest is ready for unattended rendering.",
      primaryColor: "#0B1F33",
      accentColor: "#4CC9F0",
      textColor: "#FFFFFF",
      backgroundColor: "#0B1F33"
    }
  }
] as const satisfies readonly RenderBatchRow[];

export const batchManifest = {
  template,
  rows,
  presets: ["reels-9x16", "square-1x1", "landscape-16x9"],
  outputDirectory: "renders/mvp-demo",
  outputNamePrefix: "mvp-demo"
} as const satisfies RenderBatchInput;

export const expandedJobs = expandRenderBatch(batchManifest);

export function validateFixture(): void {
  assertValidDocument(template, "template");
  assert(expandedJobs.length === 15, `expected 15 expanded jobs, received ${expandedJobs.length}`);

  const dimensions = new Set<string>();
  for (const job of expandedJobs) {
    assertValidDocument(job.document, `job ${job.id}`);
    dimensions.add(`${job.preset.width}x${job.preset.height}`);
    assert(job.outputPath?.startsWith("renders/mvp-demo/") === true, `job ${job.id} is missing an output path`);
  }

  assert(dimensions.has("1080x1920"), "expanded jobs include reels 1080x1920 output");
  assert(dimensions.has("1080x1080"), "expanded jobs include square 1080x1080 output");
  assert(dimensions.has("1920x1080"), "expanded jobs include landscape 1920x1080 output");
}

export function summarizeExpandedJobs(jobs: readonly RenderBatchJob[] = expandedJobs): unknown {
  return {
    renderImplemented: "shared-render-pipeline",
    note: "Use the render script to create local MP4 outputs through @kavio/render.",
    totalJobs: jobs.length,
    outputs: jobs.map((job) => ({
      id: job.id,
      rowId: job.rowId,
      presetName: job.presetName,
      outputName: job.outputName,
      outputPath: job.outputPath,
      width: job.preset.width,
      height: job.preset.height,
      format: job.preset.format
    })),
    jobs
  };
}

function assertValidDocument(document: unknown, label: string): void {
  const result = validate(document);
  if (!result.ok) {
    const details = result.errors.map((error) => `${error.path}: ${error.message}`).join("\n");
    throw new Error(`${label} failed validation:\n${details}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
