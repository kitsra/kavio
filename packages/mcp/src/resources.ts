import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { STANDARD_PRESETS } from "./handlers.js";
import type { ResourceDefinition } from "./types.js";

const require = createRequire(import.meta.url);

function readSchema(): string {
  return readFileSync(require.resolve("@kavio/schema/schema"), "utf8");
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
  easing: ["linear", "inQuad", "outQuad", "inOutQuad", "inCubic", "outCubic", "inOutCubic", "inBack", "outBack", "inOutBack"],
  preset: ["fadeIn", "fadeOut", "slideUp", "slideDown", "slideLeft", "slideRight", "popIn", "zoomIn"],
  effect: ["blur", "brightness", "contrast", "saturate", "tint"],
  transition: ["fade", "slide", "wipe", "crossfade"],
  audioRole: ["music", "voiceover", "sfx", "source"],
  exportFormat: ["mp4", "webm", "mov", "gif", "png-sequence"],
  propType: ["string", "number", "boolean", "color", "url", "enum", "asset"]
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
    description: "Allowed values for layer/asset types, easings, effects, transitions, formats, and prop types.",
    mimeType: "application/json",
    read: () => `${JSON.stringify(ENUMS, null, 2)}\n`
  }
];
