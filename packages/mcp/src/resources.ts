import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DEFAULT_RESOURCE_LIMITS } from "@kitsra/kavio-core";
import { STANDARD_PRESETS } from "./handlers.js";
import type { ResourceDefinition } from "./types.js";

const require = createRequire(import.meta.url);

function readSchema(): string {
  return readFileSync(require.resolve("@kitsra/kavio-schema/schema"), "utf8");
}

const BASIC_EXAMPLE = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 90, background: "#101820" },
  props: {
    headline: { type: "string", default: "Your headline" }
  },
  assets: {},
  layers: [
    { id: "bg", type: "shape", shape: "rect", fill: "#101820", startFrame: 0, durationFrames: 90 },
    {
      id: "headline",
      type: "text",
      text: "{{headline}}",
      startFrame: 6,
      durationFrames: 78,
      position: { x: 540, y: 860 },
      anchor: "center",
      style: { fontFamily: "Inter", fontSize: 72, fontWeight: 800, color: "#FFFFFF", align: "center" },
      keyframes: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 12, value: 1, easing: "outCubic" }
        ]
      }
    }
  ],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const ENUMS = {
  layerType: ["video", "image", "text", "shape", "caption"],
  assetType: ["video", "image", "audio", "font"],
  fit: ["cover", "contain", "fill", "none"],
  anchor: ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"],
  easing: [
    "linear",
    "inQuad",
    "outQuad",
    "inOutQuad",
    "inCubic",
    "outCubic",
    "inOutCubic",
    "inCirc",
    "outCirc",
    "inOutCirc",
    "inExpo",
    "outExpo",
    "inOutExpo",
    "anticipate",
    "back",
    "inBack",
    "outBack",
    "inOutBack",
    "inElastic",
    "outElastic",
    "inOutElastic",
    "inBounce",
    "outBounce",
    "inOutBounce"
  ],
  timing: ["tween", "spring", "steps", "sequence", "stagger"],
  preset: ["fadeIn", "fadeOut", "slideUp", "slideDown", "slideLeft", "slideRight", "popIn", "zoomIn"],
  presetNamespace: ["transition", "cinematic", "textMotion", "camera", "effect"],
  effect: ["blur", "brightness", "contrast", "saturate", "tint"],
  transitionTiming: ["tween"],
  maskSourceKind: ["shape", "asset", "procedural"],
  maskShape: ["rect", "circle", "diamond"],
  proceduralMask: ["linearGradient", "radialGradient", "scanlines"],
  maskAssetMode: ["alpha"],
  transition: [
    "fade",
    "slide",
    "wipe",
    "crossfade",
    "zoom",
    "push",
    "spin",
    "rotate",
    "flip",
    "blurDissolve",
    "colorDissolve",
    "dip",
    "iris",
    "stretch",
    "squeeze",
    "clockWipe",
    "barWipe",
    "gridWipe",
    "tileReveal",
    "radialBlur",
    "zoomBlur",
    "bookFlip",
    "pageCurlLite",
    "skewSlide",
    "expandMask",
    "letterboxReveal",
    "filmFlash",
    "cameraWhip"
  ],
  cameraMotion: ["kenBurns", "pushIn", "pullBack", "pan", "tilt"],
  audioRole: ["music", "voiceover", "sfx", "source"],
  exportFormat: ["mp4", "webm", "mov", "gif", "png-sequence"],
  propType: ["string", "number", "boolean", "color", "url", "enum", "asset"]
};

const CURRENT_TRANSITION_SUPPORT = Object.fromEntries(
  ENUMS.transition.map((transition) => [
    transition,
    {
      browserPreview: "stable",
      stillFrameRender: "stable",
      opaqueVideoRender: "stable",
      transparentVideoRender: "unsupported",
      gifRender: "unsupported",
      pngSequenceRender: "unsupported",
      nativeRender: "unsupported"
    }
  ])
);

const CURRENT_EFFECT_SUPPORT = Object.fromEntries(
  ENUMS.effect.map((effect) => [
    effect,
    {
      browserPreview: "unsupported",
      stillFrameRender: "unsupported",
      opaqueVideoRender: "unsupported",
      transparentVideoRender: "unsupported",
      gifRender: "unsupported",
      pngSequenceRender: "unsupported",
      nativeRender: "unsupported",
      note: "Schema-declared layer effects are not applied by the current evaluator or browser renderer."
    }
  ])
);

const MASK_SOURCE_SUPPORT = {
  shape: {
    stable: ["rect", "circle", "diamond"],
    experimental: ["bar", "grid", "tiles"],
    unsupported: [],
    browserPreview: "stable",
    stillFrameRender: "stable",
    opaqueVideoRender: "stable",
    transparentVideoRender: "unsupported",
    gifRender: "unsupported",
    pngSequenceRender: "unsupported",
    nativeRender: "unsupported"
  },
  asset: {
    stable: ["image-alpha"],
    experimental: ["image-luma"],
    unsupported: ["video-luma"],
    browserPreview: "stable",
    stillFrameRender: "stable",
    opaqueVideoRender: "stable",
    transparentVideoRender: "unsupported",
    gifRender: "unsupported",
    pngSequenceRender: "unsupported",
    nativeRender: "unsupported",
    note: "Stable asset masks reference declared image assets and use alpha sampling only."
  },
  procedural: {
    stable: ["linearGradient", "radialGradient", "scanlines"],
    experimental: ["noise", "threshold", "dither"],
    unsupported: ["liquid", "shaderImageReveal"],
    browserPreview: "stable",
    stillFrameRender: "stable",
    opaqueVideoRender: "stable",
    transparentVideoRender: "unsupported",
    gifRender: "unsupported",
    pngSequenceRender: "unsupported",
    nativeRender: "unsupported",
    note: "Stable procedural masks require an integer seed even when the current CSS rendering is simple."
  },
  generatedOverlay: {
    stable: [],
    experimental: [],
    unsupported: ["filmFlash", "lightLeak", "filmBurn", "grain", "vignette", "chromaticOffset"],
    browserPreview: "unsupported",
    stillFrameRender: "unsupported",
    opaqueVideoRender: "unsupported",
    transparentVideoRender: "unsupported",
    gifRender: "unsupported",
    pngSequenceRender: "unsupported",
    nativeRender: "unsupported",
    note: "Generated overlays are reserved for future deterministic overlay/effect work and are not valid layer masks today."
  }
};

const MOTION_SUPPORT = {
  supportStates: ["stable", "previewOnly", "experimental", "unsupported"],
  renderTargets: [
    "browserPreview",
    "stillFrameRender",
    "opaqueVideoRender",
    "transparentVideoRender",
    "gifRender",
    "pngSequenceRender",
    "nativeRender"
  ],
  transitions: CURRENT_TRANSITION_SUPPORT,
  transitionSeries: {
    schema: "stable",
    coreEvaluation: "stable",
    cliInspect: "stable",
    mcpInspect: "stable",
    browserPreview: "stable",
    stillFrameRender: "stable",
    opaqueVideoRender: "stable",
    transparentVideoRender: "unsupported",
    gifRender: "unsupported",
    pngSequenceRender: "unsupported",
    nativeRender: "unsupported",
    note: "Tracks compile to explicit overlap windows for outgoing and incoming clip evaluation; browser-backed preview and render paths share the same frame evaluator."
  },
  effects: CURRENT_EFFECT_SUPPORT,
  masks: MASK_SOURCE_SUPPORT,
  performanceBudgets: {
    maxBlurRadius: DEFAULT_RESOURCE_LIMITS.maxBlurRadius,
    maxFilteredLayers: DEFAULT_RESOURCE_LIMITS.maxFilteredLayers,
    maxMaskedLayers: DEFAULT_RESOURCE_LIMITS.maxMaskedLayers,
    maxMaskSourceWidth: DEFAULT_RESOURCE_LIMITS.maxMaskSourceWidth,
    maxMaskSourceHeight: DEFAULT_RESOURCE_LIMITS.maxMaskSourceHeight,
    maxTextMotionFragments: DEFAULT_RESOURCE_LIMITS.maxTextMotionFragments,
    maxProceduralMaskPixels: DEFAULT_RESOURCE_LIMITS.maxProceduralMaskPixels,
    maxTransitionDurationFrames: DEFAULT_RESOURCE_LIMITS.maxTransitionDurationFrames,
    note: "Render planning uses these budgets after export preset expansion."
  }
};

export const resources: ResourceDefinition[] = [
  {
    uri: "kavio://schema/0.1.json",
    name: "Kavio JSON Schema 0.1",
    description: "The canonical JSON Schema for a Kavio composition — the generation contract.",
    mimeType: "application/json",
    read: readSchema
  },
  {
    uri: "kavio://presets.json",
    name: "Export presets",
    description: "Standard social export presets shared with the Kavio builder SDK.",
    mimeType: "application/json",
    read: () => `${JSON.stringify(STANDARD_PRESETS, null, 2)}\n`
  },
  {
    uri: "kavio://examples/basic.json",
    name: "Basic example composition",
    description: "A minimal valid Kavio composition with a background, animated headline, and an export.",
    mimeType: "application/json",
    read: () => `${JSON.stringify(BASIC_EXAMPLE, null, 2)}\n`
  },
  {
    uri: "kavio://enums.json",
    name: "Enum reference",
    description: "Allowed values for layer/asset types, easings, timing types, effects, transitions, formats, and prop types.",
    mimeType: "application/json",
    read: () => `${JSON.stringify(ENUMS, null, 2)}\n`
  },
  {
    uri: "kavio://motion-support.json",
    name: "Motion support matrix",
    description: "Current transition/effect support states by render target plus motion performance budgets.",
    mimeType: "application/json",
    read: () => `${JSON.stringify(MOTION_SUPPORT, null, 2)}\n`
  }
];
