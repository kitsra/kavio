import {
  applyExportPreset,
  collectCompositionResourceLimitInputs,
  collectResourceLimitViolations,
  compileTransitionOverlapWindows,
  createExportView,
  DEFAULT_RESOURCE_LIMITS,
  evaluateActiveLayers,
  evaluateCaptionLayer,
  evaluateCaptionState,
  evaluateEasing,
  evaluateKeyframes,
  evaluateLayer,
  evaluateLayerTransitions,
  evaluateTiming,
  evaluateTransitionSeries,
  getLocalFrame,
  isLayerActive,
  parseCubicBezier,
  resolveExportPreset,
  resolveDocumentProps,
  resolveLayout,
  timingDurationFrames
} from "./index.js";
import type { CaptionTimelineLayer, TimelineLayer } from "./index.js";
import type { KavioDocument } from "@kitsra/kavio-schema";

const dimensions = { width: 1000, height: 500 };
const layer: TimelineLayer = {
  id: "headline",
  type: "text",
  startFrame: 10,
  durationFrames: 5,
  position: { x: "50%", y: "25%h" },
  anchor: "center",
  size: { width: "20%w", height: 100 },
  mask: {
    source: {
      kind: "shape",
      shape: "circle"
    }
  },
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
assertEqual(evaluated.reveal ?? null, null, "layers without wipe transitions do not expose a reveal inset");
assertEqual(evaluated.mask?.source.kind, "shape", "layer evaluation carries stable mask sources");

const slideTransitionLayer: TimelineLayer = {
  id: "slide",
  type: "text",
  startFrame: 0,
  durationFrames: 20,
  position: { x: 500, y: 250 },
  transitionIn: { type: "slide", direction: "up", durationFrames: 5 },
  transitionOut: { type: "fade", durationFrames: 5 }
};
const slideAtStart = evaluateLayer(slideTransitionLayer, 0, dimensions);
const slideAfterEntrance = evaluateLayer(slideTransitionLayer, 4, dimensions);
const slideAtEnd = evaluateLayer(slideTransitionLayer, 19, dimensions);
assertClose(slideAtStart.position.y, 290, "slide-up entrances start below the resting position");
assertClose(slideAfterEntrance.position.y, 250, "slide-up entrances end at the resting position");
assertClose(slideAtEnd.opacity, 0, "transitionOut fade reaches transparent on the final visible frame");

const wipeTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "wipe", direction: "right", durationFrames: 5 } },
  0,
  dimensions
);
assertEqual(wipeTransition.reveal?.left, 100, "rightward wipe entrances start clipped from the left");

const zoomTransition = evaluateLayer(
  {
    id: "zoom",
    type: "video",
    startFrame: 0,
    durationFrames: 12,
    transitionIn: { type: "zoom", durationFrames: 6, amount: 0.2 }
  },
  0,
  dimensions
);
assertClose(zoomTransition.scale, 1.2, "zoom transitions start scaled before settling");

const flipTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "flip", axis: "y", durationFrames: 5 } },
  0,
  dimensions
);
assertClose(flipTransition.transform.rotateY, -90, "flip transitions expose a 3D rotation");

const blurTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionOut: { type: "blurDissolve", durationFrames: 5, amount: 20 } },
  9,
  dimensions
);
assertClose(blurTransition.opacity, 0, "blur dissolve exits fade out");
assertClose(blurTransition.filter?.blur ?? 0, 20, "blur dissolve exits ramp blur");

const dipTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "dip", color: "#ffffff", durationFrames: 5 } },
  0,
  dimensions
);
assertEqual(dipTransition.wash?.color, "#ffffff", "dip transitions expose the requested wash color");
assertClose(dipTransition.wash?.opacity ?? 0, 1, "dip transitions start fully washed");

const irisTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "iris", shape: "diamond", durationFrames: 5 } },
  0,
  dimensions
);
assertEqual(irisTransition.revealShape?.shape, "diamond", "iris transitions expose their reveal shape");
assertClose(irisTransition.revealShape?.progress ?? 1, 0, "iris entrances start closed");

const clockTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "clockWipe", direction: "right", durationFrames: 5 } },
  0,
  dimensions
);
assertEqual(clockTransition.revealPattern?.kind, "clock", "clock wipes expose a clock reveal pattern");
assertClose(clockTransition.revealPattern?.progress ?? 1, 0, "clock wipe entrances start hidden");

const gridTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "gridWipe", direction: "down", rows: 3, columns: 5, durationFrames: 5 } },
  0,
  dimensions
);
assertEqual(gridTransition.revealPattern?.rows, 3, "grid wipes preserve requested rows");
assertEqual(gridTransition.revealPattern?.columns, 5, "grid wipes preserve requested columns");

const zoomBlurTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "zoomBlur", durationFrames: 5, amount: 18, intensity: 0.14 } },
  0,
  dimensions
);
assertClose(zoomBlurTransition.filter?.blur ?? 0, 18, "zoom blur entrances ramp blur");
assertClose(zoomBlurTransition.scale, 1.14, "zoom blur entrances add secondary scale");

const pageCurlTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "pageCurlLite", direction: "left", durationFrames: 5, intensity: 10 } },
  0,
  dimensions
);
assertClose(pageCurlTransition.transform.rotateY, 70, "page curl exposes deterministic 3D rotation");
assertClose(pageCurlTransition.transform.skewY, -10, "page curl exposes deterministic skew");

const letterboxTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "letterboxReveal", axis: "y", durationFrames: 5 } },
  0,
  dimensions
);
assertClose(letterboxTransition.reveal?.top ?? 0, 50, "letterbox reveals start clipped from top");
assertClose(letterboxTransition.reveal?.bottom ?? 0, 50, "letterbox reveals start clipped from bottom");

const cameraWhipTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "cameraWhip", direction: "left", durationFrames: 5, amount: 14, intensity: 10 } },
  0,
  dimensions
);
assertClose(cameraWhipTransition.filter?.blur ?? 0, 14, "camera whip entrances ramp blur");
assertClose(cameraWhipTransition.transform.skewY, -10, "camera whip entrances expose directional skew");

const coverTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "cover", direction: "left", durationFrames: 5 } },
  0,
  dimensions
);
assertClose(coverTransition.offset.x, dimensions.width, "cover entrances move the incoming layer over the outgoing layer");

const revealTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionOut: { type: "reveal", direction: "left", durationFrames: 5 } },
  9,
  dimensions
);
assertClose(revealTransition.offset.x, -dimensions.width, "reveal exits move the outgoing layer away from the incoming layer");

const diagonalTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "diagonalWipe", corner: "top-right", durationFrames: 5 } },
  0,
  dimensions
);
assertEqual(diagonalTransition.revealPattern?.kind, "diagonal", "diagonal wipes expose a polygon reveal pattern");
assertEqual(diagonalTransition.revealPattern?.corner, "top-right", "diagonal wipes preserve their requested corner");

const grayscaleTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "grayscaleDissolve", durationFrames: 5 } },
  0,
  dimensions
);
assertClose(grayscaleTransition.opacity, 0, "grayscale dissolves start transparent");
assertClose(grayscaleTransition.filter?.grayscale ?? 0, 1, "grayscale dissolves start fully desaturated");

const transitionSeriesDocument: KavioDocument = {
  version: "0.1",
  composition: { width: 1000, height: 500, fps: 30, durationFrames: 90 },
  assets: {},
  layers: [
    { id: "scene-a", type: "text", text: "A", startFrame: 0, durationFrames: 60, position: { x: 500, y: 250 } },
    { id: "scene-b", type: "text", text: "B", startFrame: 48, durationFrames: 42, position: { x: 500, y: 250 } }
  ],
  tracks: [
    {
      id: "main",
      clips: [
        { id: "a", layerId: "scene-a", startFrame: 0, durationFrames: 60 },
        {
          id: "b",
          layerId: "scene-b",
          startFrame: 48,
          durationFrames: 42,
          transitionFromPrevious: {
            presentation: { type: "push", direction: "left" },
            timing: { type: "tween", durationFrames: 12, easing: "outCubic" }
          }
        }
      ]
    }
  ],
  exports: [{ name: "preview", format: "mp4", codec: "h264", width: 1000, height: 500 }]
};
const transitionWindows = compileTransitionOverlapWindows(transitionSeriesDocument.tracks);
assertEqual(transitionWindows.length, 1, "transition series compiles overlap windows");
assertEqual(transitionWindows[0]?.startFrame, 48, "transition series windows start with the incoming clip");
assertEqual(transitionWindows[0]?.endFrame, 60, "transition series windows end after timing duration");
const seriesAtStart = evaluateTransitionSeries(transitionSeriesDocument, 48, dimensions);
assertEqual(seriesAtStart.length, 1, "transition series evaluates active overlap windows");
const activeSeriesWindow = seriesAtStart[0];
assert(activeSeriesWindow !== undefined, "transition series returns the active window");
assertEqual(activeSeriesWindow.previous.clipId, "a", "transition series includes the outgoing clip");
assertEqual(activeSeriesWindow.next.clipId, "b", "transition series includes the incoming clip");
assert(activeSeriesWindow.previous.layer.visible, "outgoing clip layer is visible during the overlap");
assert(activeSeriesWindow.next.layer.visible, "incoming clip layer is visible during the overlap");
assertClose(activeSeriesWindow.previous.layer.position.x, 500, "outgoing push starts at its resting x position");
assertClose(activeSeriesWindow.next.layer.position.x, 1500, "incoming push starts offscreen before moving in");
assertEqual(evaluateTransitionSeries(transitionSeriesDocument, 60, dimensions).length, 0, "transition series endFrame is exclusive");

const coverSeriesDocument = structuredClone(transitionSeriesDocument);
coverSeriesDocument.tracks![0]!.clips[1]!.transitionFromPrevious!.presentation = { type: "cover", direction: "left" };
const coverSeries = evaluateTransitionSeries(coverSeriesDocument, 48, dimensions)[0]!;
assertClose(coverSeries.previous.layer.position.x, 500, "cover keeps the outgoing clip stationary");
assertClose(coverSeries.next.layer.position.x, 1500, "cover moves the incoming clip over it");

const revealSeriesDocument = structuredClone(transitionSeriesDocument);
revealSeriesDocument.tracks![0]!.clips[1]!.transitionFromPrevious!.presentation = { type: "reveal", direction: "left" };
const revealSeries = evaluateTransitionSeries(revealSeriesDocument, 48, dimensions)[0]!;
assertClose(revealSeries.previous.layer.position.x, 500, "reveal starts with the outgoing clip in place");
assertClose(revealSeries.next.layer.position.x, 500, "reveal keeps the incoming clip stationary");

const linearTransitionSeriesDocument: KavioDocument = {
  ...transitionSeriesDocument,
  tracks: [
    {
      id: "main",
      clips: [
        { id: "a", layerId: "scene-a", startFrame: 0, durationFrames: 60 },
        {
          id: "b",
          layerId: "scene-b",
          startFrame: 48,
          durationFrames: 42,
          transitionFromPrevious: {
            presentation: { type: "push", direction: "left" },
            timing: { type: "tween", durationFrames: 5 }
          }
        }
      ]
    }
  ]
};
const linearSeriesAtSecondFrame = evaluateTransitionSeries(linearTransitionSeriesDocument, 49, dimensions)[0];
assert(linearSeriesAtSecondFrame !== undefined, "transition series without explicit easing evaluates active frames");
assertClose(linearSeriesAtSecondFrame.easedProgress, 0.25, "transition series preserves tween timing's linear default");
assertClose(linearSeriesAtSecondFrame.previous.layer.position.x, 250, "outgoing transition-series clip uses linear default timing");
assertClose(linearSeriesAtSecondFrame.next.layer.position.x, 1250, "incoming transition-series clip uses linear default timing");

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
assertClose(evaluateEasing("inCirc", 1), 1, "inCirc reaches one");
assertClose(evaluateEasing("outExpo", 0), 0, "outExpo starts at zero");
assertClose(evaluateEasing("inOutBounce", 0), 0, "inOutBounce starts at zero");
assert(evaluateEasing("anticipate", 0.25) < 0, "anticipate eases backward before advancing");
assert(parseCubicBezier("cubic-bezier(0, 0, 1, 1)") !== undefined, "cubic-bezier parser accepts CSS form");
assertClose(evaluateEasing("cubic-bezier(0, 0, 1, 1)", 0.25), 0.25, "linear cubic-bezier evaluates as linear");

assertClose(evaluateTiming({ type: "tween", durationFrames: 5, easing: "outCirc" }, 4), 1, "tween timing reaches one");
assertClose(evaluateTiming({ type: "steps", durationFrames: 11, steps: 4 }, 1), 0, "end steps hold the first value");
assertClose(
  evaluateTiming({ type: "steps", durationFrames: 11, steps: 4, direction: "start" }, 1),
  0.25,
  "start steps jump immediately"
);
assertClose(
  evaluateTiming({
    type: "sequence",
    segments: [
      { durationFrames: 3, from: 0, to: -0.2, timing: { type: "tween", easing: "linear" } },
      { durationFrames: 3, from: -0.2, to: 1, timing: { type: "tween", easing: "linear" } }
    ]
  }, 2),
  -0.2,
  "sequence timing can encode anticipation segments"
);
assertClose(
  evaluateTiming({
    type: "stagger",
    childCount: 4,
    childIndex: 2,
    eachFrames: 3,
    timing: { type: "tween", durationFrames: 5, easing: "linear" }
  }, 8),
  0.5,
  "stagger offsets child timing by frame"
);
assertClose(evaluateTiming({ type: "spring", durationFrames: 8, stiffness: 80, damping: 10, mass: 1 }, 0), 0, "spring starts at zero");
assertClose(evaluateTiming({ type: "spring", durationFrames: 8, stiffness: 80, damping: 10, mass: 1 }, 7), 1, "spring reaches one");
assertEqual(
  timingDurationFrames({ type: "stagger", childCount: 3, eachFrames: 2, timing: { type: "steps", durationFrames: 5, steps: 2 } }),
  9,
  "stagger timing duration includes child offsets"
);

const steppedKeyframeValue = evaluateKeyframes(
  [
    { frame: 0, value: 0, timing: { type: "steps", steps: 4 } },
    { frame: 10, value: 40 }
  ],
  1,
  0
);
assertEqual(steppedKeyframeValue, 0, "keyframes can use timing objects instead of easing strings");

const timedTransition = evaluateLayerTransitions(
  { durationFrames: 10, transitionIn: { type: "fade", timing: { type: "tween", durationFrames: 5, easing: "outExpo" } } },
  4,
  dimensions
);
assertClose(timedTransition.opacity, 1, "transition timing can supply duration and easing object");

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
  propStringLength: DEFAULT_RESOURCE_LIMITS.maxPropStringLength + 1,
  blurRadius: DEFAULT_RESOURCE_LIMITS.maxBlurRadius + 1,
  filteredLayerCount: DEFAULT_RESOURCE_LIMITS.maxFilteredLayers + 1,
  maskedLayerCount: DEFAULT_RESOURCE_LIMITS.maxMaskedLayers + 1,
  maskSourceWidth: DEFAULT_RESOURCE_LIMITS.maxMaskSourceWidth + 1,
  maskSourceHeight: DEFAULT_RESOURCE_LIMITS.maxMaskSourceHeight + 1,
  textMotionFragments: DEFAULT_RESOURCE_LIMITS.maxTextMotionFragments + 1,
  proceduralMaskPixels: DEFAULT_RESOURCE_LIMITS.maxProceduralMaskPixels + 1,
  transitionDurationFrames: DEFAULT_RESOURCE_LIMITS.maxTransitionDurationFrames + 1
});
assertEqual(resourceViolations.length, 13, "resource limits produce deterministic violations");
assertEqual(resourceViolations[0]?.code, "LIMIT_MAX_FRAMES", "frame resource limit code is stable");
assertEqual(resourceViolations[1]?.code, "LIMIT_MAX_HEIGHT", "dimension resource limit code is stable");
assertEqual(resourceViolations[2]?.code, "LIMIT_MAX_LAYERS", "layer resource limit code is stable");
assertEqual(resourceViolations[3]?.code, "LIMIT_MAX_ASSETS", "asset resource limit code is stable");
assertEqual(resourceViolations[4]?.code, "LIMIT_MAX_PROP_STRING_LENGTH", "prop string limit code is stable");
assertEqual(resourceViolations[5]?.code, "LIMIT_MAX_BLUR_RADIUS", "blur budget limit code is stable");
assertEqual(resourceViolations[6]?.code, "LIMIT_MAX_FILTERED_LAYERS", "filtered layer budget limit code is stable");
assertEqual(resourceViolations[7]?.code, "LIMIT_MAX_MASKED_LAYERS", "masked layer budget limit code is stable");
assertEqual(resourceViolations[8]?.code, "LIMIT_MAX_MASK_SOURCE_WIDTH", "mask source width budget limit code is stable");
assertEqual(resourceViolations[9]?.code, "LIMIT_MAX_MASK_SOURCE_HEIGHT", "mask source height budget limit code is stable");
assertEqual(resourceViolations[10]?.code, "LIMIT_MAX_TEXT_MOTION_FRAGMENTS", "text motion fragment budget limit code is stable");
assertEqual(resourceViolations[11]?.code, "LIMIT_MAX_PROCEDURAL_MASK_PIXELS", "procedural mask pixel budget limit code is stable");
assertEqual(resourceViolations[12]?.code, "LIMIT_MAX_TRANSITION_DURATION", "transition duration budget limit code is stable");

const motionBudgetDocument: KavioDocument = {
  version: "0.1",
  composition: { width: 640, height: 360, fps: 24, durationFrames: 60 },
  assets: {},
  layers: [
    {
      id: "blur-a",
      type: "shape",
      shape: "rect",
      startFrame: 0,
      durationFrames: 30,
      transitionIn: { type: "blurDissolve", durationFrames: 12, amount: 20 },
      mask: {
        source: {
          kind: "procedural",
          type: "radialGradient",
          seed: 4,
          resolution: { width: 1920, height: 1080 }
        }
      }
    },
    {
      id: "blur-b",
      type: "shape",
      shape: "rect",
      startFrame: 10,
      durationFrames: 30,
      effects: [{ type: "blur", radius: 64 }],
      mask: {
        source: {
          kind: "shape",
          shape: "diamond"
        }
      }
    },
    {
      id: "kinetic-text",
      type: "text",
      text: "Split me",
      startFrame: 0,
      durationFrames: 20,
      textMotion: {
        type: "typeOn",
        split: "char",
        durationFrames: 8
      }
    }
  ],
  exports: []
};
const motionBudgetInputs = collectCompositionResourceLimitInputs(motionBudgetDocument);
assertEqual(motionBudgetInputs.blurRadius, 64, "composition budget inputs track max blur radius");
assertEqual(motionBudgetInputs.filteredLayerCount, 2, "composition budget inputs track simultaneous filtered layers");
assertEqual(motionBudgetInputs.maskedLayerCount, 2, "composition budget inputs track simultaneous masked layers");
assertEqual(motionBudgetInputs.maskSourceWidth, 1920, "composition budget inputs track declared mask source width");
assertEqual(motionBudgetInputs.maskSourceHeight, 1080, "composition budget inputs track declared mask source height");
assertEqual(motionBudgetInputs.textMotionFragments, 8, "composition budget inputs track text motion fragments");
assertEqual(motionBudgetInputs.proceduralMaskPixels, 2073600, "composition budget inputs track procedural mask pixel count");
assertEqual(motionBudgetInputs.transitionDurationFrames, 12, "composition budget inputs track max transition duration");

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
