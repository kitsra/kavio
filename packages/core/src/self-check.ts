import {
  applyExportPreset,
  collectResourceLimitViolations,
  createExportView,
  DEFAULT_RESOURCE_LIMITS,
  evaluateActiveLayers,
  evaluateCaptionLayer,
  evaluateCaptionState,
  evaluateEasing,
  evaluateKeyframes,
  evaluateLayer,
  getLocalFrame,
  isLayerActive,
  parseCubicBezier,
  resolveExportPreset,
  resolveDocumentProps,
  resolveLayout
} from "./index.js";
import type { CaptionTimelineLayer, TimelineLayer } from "./index.js";
import type { KavioDocument } from "@kavio/schema";

const dimensions = { width: 1000, height: 500 };
const layer: TimelineLayer = {
  id: "headline",
  type: "text",
  startFrame: 10,
  durationFrames: 5,
  position: { x: "50%", y: "25%h" },
  anchor: "center",
  size: { width: "20%w", height: 100 },
  keyframes: {
    opacity: [
      { frame: 0, value: 0, easing: "outQuad" },
      { frame: 4, value: 1 }
    ],
    rotation: [
      { frame: 0, value: 0 },
      { frame: 4, value: 40 }
    ]
  }
};

assert(isLayerActive(layer, 10), "layer is active on its start frame");
assert(isLayerActive(layer, 14), "layer is active on its final visible frame");
assert(!isLayerActive(layer, 15), "layer is inactive at startFrame + durationFrames");
assertEqual(getLocalFrame(layer, 10), 0, "local frame starts at zero");
assertEqual(getLocalFrame(layer, 15), 5, "local frame is deterministic outside visibility");

const activeLayers = evaluateActiveLayers([layer], 12, dimensions);
assertEqual(activeLayers.length, 1, "active layer evaluation preserves visible layers");

const evaluated = evaluateLayer(layer, 12, dimensions);
assertClose(evaluated.opacity, 0.75, "keyframes use easing from the segment's first keyframe");
assertClose(evaluated.rotation, 20, "rotation interpolates linearly by default");
assertEqual(evaluated.position.x, 500, "x percentages resolve against width");
assertEqual(evaluated.position.y, 125, "explicit h percentages resolve against height");
assertEqual(evaluated.size.width, 200, "width percentages resolve against width");
assertEqual(evaluated.topLeft.x, 400, "center anchor shifts top-left x by half width");
assertEqual(evaluated.topLeft.y, 75, "center anchor shifts top-left y by half height");

const captionLayer: CaptionTimelineLayer = {
  id: "captions",
  type: "caption",
  startFrame: 20,
  durationFrames: 40,
  source: {
    kind: "inline",
    cues: [
      {
        startFrame: 0,
        endFrame: 12,
        text: "First line\nsecond line",
        words: [
          { startFrame: 0, endFrame: 4, text: "First" },
          { startFrame: 4, endFrame: 8, text: "line" },
          { startFrame: 8, endFrame: 12, text: "second" }
        ]
      },
      {
        startFrame: 12,
        endFrame: 24,
        text: "Next cue",
        words: [
          { startFrame: 12, endFrame: 18, text: "Next" },
          { startFrame: 18, endFrame: 24, text: "cue" }
        ]
      }
    ]
  },
  style: { highlight: { mode: "word" } }
};

const captionAtStart = evaluateCaptionLayer(captionLayer, 20);
assert(captionAtStart.visible, "caption cue is visible at its start frame");
assertEqual(captionAtStart.cueIndex, 0, "caption cue selection is layer-local");
assertEqual(captionAtStart.lineText, "First line\nsecond line", "caption line text preserves cue text");
assertEqual(captionAtStart.lines.length, 2, "caption line text splits on newlines");
assertEqual(captionAtStart.activeWord?.text, "First", "caption word highlight includes first-frame word");
assertEqual(captionAtStart.highlightedWordIndex, 0, "word highlight exposes active word index");

const captionAtBoundary = evaluateCaptionLayer(captionLayer, 32);
assertEqual(captionAtBoundary.cueIndex, 1, "caption cue endFrame is exclusive at boundaries");
assertEqual(captionAtBoundary.activeWord?.text, "Next", "caption word state advances at cue boundary");
assertEqual(captionAtBoundary.words[1]?.state, "pending", "future caption words are marked pending");

const captionAfterWord = evaluateCaptionLayer(captionLayer, 39);
assertEqual(captionAfterWord.words[0]?.state, "completed", "past caption words are marked completed");
assertEqual(captionAfterWord.activeWord?.text, "cue", "caption highlights the active word");

const captionInactive = evaluateCaptionLayer(captionLayer, 60);
assert(!captionInactive.visible, "caption layer is inactive at startFrame + durationFrames");
assertEqual(captionInactive.cueIndex, null, "inactive caption layers do not select cues");

const lineHighlight = evaluateCaptionState(captionLayer.source, 4, { highlightMode: "line" });
assertEqual(lineHighlight.highlightedWordIndex, null, "line highlight does not expose a word index");
assertEqual(lineHighlight.highlightedLineText, "First line\nsecond line", "line highlight exposes active line text");

const externalCaptionState = evaluateCaptionState({ kind: "vtt", asset: "captions" }, 0);
assert(!externalCaptionState.visible, "external caption assets require parsed cues before selection");
assertEqual(externalCaptionState.sourceKind, "vtt", "external caption state keeps source kind");

const evaluatedCaptionLayer = evaluateLayer(captionLayer, 24, dimensions);
assertEqual(evaluatedCaptionLayer.caption?.activeWord?.text, "line", "generic layer evaluation includes caption state");

const layout = resolveLayout({ position: { x: "10%w", y: "10%h" }, anchor: { x: 1, y: 0 }, size: { width: 50, height: 40 } }, dimensions);
assertEqual(layout.topLeft.x, 50, "fractional anchors are applied to resolved sizes");
assertEqual(layout.topLeft.y, 50, "top anchor leaves y unchanged");

const keyframeValue = evaluateKeyframes(
  [
    { frame: 0, value: 10, easing: "linear" },
    { frame: 10, value: 30 }
  ],
  5,
  0
);
assertEqual(keyframeValue, 20, "numeric keyframes interpolate between frames");
assertEqual(evaluateKeyframes([{ frame: 2, value: 8 }], 0, 1), 8, "before first keyframe holds first value");
assertEqual(evaluateKeyframes([{ frame: 2, value: 8 }], 20, 1), 8, "after last keyframe holds last value");

assertClose(evaluateEasing("inOutCubic", 0.5), 0.5, "inOutCubic is centered");
assert(parseCubicBezier("cubic-bezier(0, 0, 1, 1)") !== undefined, "cubic-bezier parser accepts CSS form");
assertClose(evaluateEasing("cubic-bezier(0, 0, 1, 1)", 0.25), 0.25, "linear cubic-bezier evaluates as linear");

const resolvedProps = resolveDocumentProps<Record<string, unknown> & { props: Record<string, unknown> }>(
  {
    props: {
      title: { type: "string", default: "Launch" },
      count: { type: "number", default: 3 }
    },
    text: "{{title}} x{{count}}",
    rawCount: "{{count}}",
    missing: "{{required}}"
  },
  { title: "Drop" }
);
assert(!resolvedProps.ok, "unresolved props report a predictable failure");
assertEqual(resolvedProps.value.text, "Drop x3", "embedded props stringify into text");
assertEqual(resolvedProps.value.rawCount, 3, "whole-value props preserve non-string values");
assertEqual(resolvedProps.errors[0]?.code, "PROP_UNRESOLVED", "unresolved props use a stable error code");

const exportDocument: KavioDocument = {
  version: "0.1",
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationFrames: 90,
    background: "#101010"
  },
  assets: {},
  layers: [
    {
      id: "headline",
      type: "text",
      startFrame: 0,
      durationFrames: 90,
      position: { x: "50%w", y: 200 },
      size: { width: 800, height: 120 },
      text: "Launch"
    },
    {
      id: "logo",
      type: "shape",
      startFrame: 0,
      durationFrames: 90,
      position: { x: 40, y: 40 },
      shape: "rect",
      fill: "#ff0055"
    }
  ],
  exports: [
    {
      name: "square",
      format: "mp4",
      codec: "h264",
      width: 1080,
      height: 1080,
      layerOverrides: {
        headline: {
          position: { y: 140 },
          size: { height: 160 }
        }
      }
    }
  ]
};

const exportView = applyExportPreset(exportDocument, "square");
assertEqual(exportView.composition.width, 1080, "export views use preset width");
assertEqual(exportView.composition.height, 1080, "export views use preset height");
assertEqual(exportView.composition.fps, 30, "export views preserve composition timing");
assertEqual(exportView.exports.length, 1, "export views keep only the selected preset");
assertEqual(exportView.exports[0]?.name, "square", "export views keep the selected export preset");
assert(exportView !== exportDocument, "export views clone the root document");
assert(exportView.layers !== exportDocument.layers, "export views clone the layer array");
assert(exportView.layers[0] !== exportDocument.layers[0], "export views clone layer objects");

const overriddenHeadline = exportView.layers[0];
assert(overriddenHeadline?.type === "text", "overridden headline remains a text layer");
assertEqual(overriddenHeadline?.position?.x, "50%w", "layer override preserves sibling position fields");
assertEqual(overriddenHeadline?.position?.y, 140, "layer override applies nested position fields");
assertEqual(overriddenHeadline?.size?.width, 800, "layer override preserves sibling size fields");
assertEqual(overriddenHeadline?.size?.height, 160, "layer override applies nested size fields");
assertEqual(exportDocument.layers[0]?.position?.y, 200, "layer overrides do not mutate source layers");
const sourceHeadline = exportDocument.layers[0];
assert(sourceHeadline?.type === "text", "source headline remains a text layer");
assertEqual(sourceHeadline.size?.height, 120, "size overrides do not mutate source layers");

const directPresetView = createExportView(exportDocument, {
  name: "portrait",
  format: "mp4",
  codec: "h264",
  width: 720,
  height: 1280,
  layerOverrides: {
    logo: { position: { x: 60 } }
  }
});
assertEqual(directPresetView.composition.height, 1280, "direct preset input can create an export view");
assertEqual(directPresetView.layers[1]?.position?.x, 60, "direct preset input applies matching overrides");
assertEqual(resolveExportPreset(exportDocument, "square").width, 1080, "export presets resolve by name");
assertThrows(() => applyExportPreset(exportDocument, "missing"), "unknown export preset names throw");

const resourceViolations = collectResourceLimitViolations({
  frames: DEFAULT_RESOURCE_LIMITS.maxFrames + 1,
  width: DEFAULT_RESOURCE_LIMITS.maxWidth,
  height: DEFAULT_RESOURCE_LIMITS.maxHeight + 1,
  layerCount: DEFAULT_RESOURCE_LIMITS.maxLayers + 1,
  assetCount: DEFAULT_RESOURCE_LIMITS.maxAssets + 1,
  propStringLength: DEFAULT_RESOURCE_LIMITS.maxPropStringLength + 1
});
assertEqual(resourceViolations.length, 5, "resource limits produce deterministic violations");
assertEqual(resourceViolations[0]?.code, "LIMIT_MAX_FRAMES", "frame resource limit code is stable");
assertEqual(resourceViolations[1]?.code, "LIMIT_MAX_HEIGHT", "dimension resource limit code is stable");
assertEqual(resourceViolations[2]?.code, "LIMIT_MAX_LAYERS", "layer resource limit code is stable");
assertEqual(resourceViolations[3]?.code, "LIMIT_MAX_ASSETS", "asset resource limit code is stable");
assertEqual(resourceViolations[4]?.code, "LIMIT_MAX_PROP_STRING_LENGTH", "prop string limit code is stable");

console.log("Core timeline self-checks passed.");

function assert(value: boolean, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 1e-6) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(callback: () => unknown, message: string): void {
  try {
    callback();
  } catch {
    return;
  }

  throw new Error(message);
}
