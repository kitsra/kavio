import { schemaVersion } from "@kitsra/kavio-schema";
import { createBrowserPreviewController, createBrowserRenderer, createExportPreviewComposition, createRenderHarnessHtml, nextPreviewFrame } from "./index.js";
import type { KavioDocument } from "@kitsra/kavio-schema";

class FakeStyle {
  private readonly customProperties = new Map<string, string>();

  [property: string]: unknown;

  setProperty(name: string, value: string): void {
    this.customProperties.set(name, value);
  }

  getPropertyValue(name: string): string {
    return this.customProperties.get(name) ?? "";
  }
}

class FakeTextNode {
  readonly nodeType = 3;
  readonly textContent: string;

  constructor(textContent: string) {
    this.textContent = textContent;
  }
}

type FakeChild = FakeElement | FakeTextNode;
type StyledElement = { style: CSSStyleDeclaration | FakeStyle };

class FakeElement {
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly ownerDocument: FakeDocument;
  readonly children: FakeChild[] = [];
  parentElement: FakeElement | null = null;
  textContent = "";
  type = "";
  value = "";
  min = "";
  max = "";
  step = "";
  checked = false;
  selected = false;
  disabled = false;

  constructor(ownerDocument: FakeDocument) {
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeChild[]): void {
    for (const child of children) {
      if ("parentElement" in child) {
        child.parentElement = this;
      }
      this.children.push(child);
    }
  }

  addEventListener(_type: string, _listener: unknown): void {
    return undefined;
  }

  remove(): void {
    if (!this.parentElement) {
      return;
    }

    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }

  querySelector<T>(selector: string): T | null {
    return (findMatchingElement(this, selector) as T | undefined) ?? null;
  }

  querySelectorAll<T>(selector: string): T[] {
    return findMatchingElements(this, selector) as T[];
  }

  replaceChildren(...children: FakeChild[]): void {
    for (const child of this.children) {
      if ("parentElement" in child) {
        child.parentElement = null;
      }
    }
    this.children.splice(0, this.children.length);
    this.append(...children);
  }
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  const match = /^\[data-([a-z-]+)='([^']+)'\]$/.exec(selector);
  if (!match) {
    return false;
  }

  const [, kebabName, value] = match;
  if (!kebabName || value === undefined) {
    return false;
  }

  const datasetName = kebabName.replace(/-([a-z])/g, (_all, letter: string) => letter.toUpperCase());
  return element.dataset[datasetName] === value;
}

function findMatchingElement(root: FakeElement, selector: string): FakeElement | undefined {
  return findMatchingElements(root, selector)[0];
}

function findMatchingElements(root: FakeElement, selector: string): FakeElement[] {
  const matches: FakeElement[] = [];
  for (const child of root.children) {
    if (!("dataset" in child)) {
      continue;
    }

    if (matchesSelector(child, selector)) {
      matches.push(child);
    }

    matches.push(...findMatchingElements(child, selector));
  }

  return matches;
}

class FakeImageElement extends FakeElement {
  alt = "";
  decoding = "auto";
  draggable = true;
  complete = true;
  naturalWidth = 320;
  naturalHeight = 160;
  src = "";

  async decode(): Promise<void> {
    return undefined;
  }
}

class FakeVideoElement extends FakeElement {
  src = "";
  muted = false;
  loop = false;
  preload = "";
  playsInline = false;
}

class FakeFontFace {
  readonly family: string;
  readonly source: string;
  readonly descriptors: FontFaceDescriptors | undefined;

  constructor(family: string, source: string, descriptors?: FontFaceDescriptors) {
    this.family = family;
    this.source = source;
    this.descriptors = descriptors;
  }

  async load(): Promise<FakeFontFace> {
    return this;
  }
}

class FakeFontFaceSet {
  readonly ready = Promise.resolve(this);
  readonly faces = new Set<FakeFontFace>();

  add(face: FakeFontFace): FakeFontFaceSet {
    this.faces.add(face);
    return this;
  }

  delete(face: FakeFontFace): boolean {
    return this.faces.delete(face);
  }
}

class FakeDocument {
  readonly body: FakeElement;
  readonly fonts = new FakeFontFaceSet();
  readonly defaultView = {
    FontFace: FakeFontFace
  };

  constructor() {
    this.body = new FakeElement(this);
  }

  createElement(_tagName: string): FakeElement {
    if (_tagName.toLowerCase() === "img") {
      return new FakeImageElement(this);
    }
    if (_tagName.toLowerCase() === "video") {
      return new FakeVideoElement(this);
    }

    return new FakeElement(this);
  }

  createTextNode(text: string): FakeTextNode {
    return new FakeTextNode(text);
  }

  querySelector<T>(selector: string): T | null {
    if (selector === "[data-kavio-runtime-root='true']") {
      const root = this.body.children.find((child): child is FakeElement => "dataset" in child && child.dataset.kavioRuntimeRoot === "true");
      return (root as T | undefined) ?? null;
    }

    return this.body.querySelector<T>(selector);
  }
}

function renderedElement(element: HTMLElement | undefined): FakeElement {
  if (!element) {
    throw new Error("Expected rendered layer element.");
  }

  return element as unknown as FakeElement;
}

function styleValue(element: StyledElement, property: string): string {
  return String((element.style as unknown as Record<string, unknown>)[property] ?? "");
}

function customStyleValue(element: StyledElement, property: string): string {
  return element.style.getPropertyValue(property);
}

function childElement(element: FakeElement, index: number): FakeElement {
  const child = element.children[index];
  if (!child || !("dataset" in child)) {
    throw new Error(`Expected child element at index ${index}.`);
  }

  return child;
}

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

const document = new FakeDocument();
const renderer = createBrowserRenderer({ document: document as unknown as Document });

const composition: KavioDocument = {
  version: schemaVersion,
  composition: {
    width: 1000,
    height: 500,
    fps: 25,
    durationFrames: 40,
    background: "#101010"
  },
  assets: {
    clip: {
      type: "video",
      src: "data:video/mp4;base64,stub"
    },
    logo: {
      type: "image",
      src: "data:image/png;base64,stub"
    },
    inter: {
      type: "font",
      src: "/fonts/inter.woff2",
      family: "Inter",
      weight: 800
    }
  },
  exports: [
    {
      name: "preview",
      format: "png-sequence",
      width: 1000,
      height: 500,
      background: "transparent"
    },
    {
      name: "vertical",
      format: "png-sequence",
      width: 360,
      height: 640,
      background: "#111111",
      layerOverrides: {
        panel: {
          position: { x: 20, y: 24 },
          size: { width: 300, height: 160 }
        }
      }
    }
  ],
  layers: [
    {
      id: "clipStatic",
      type: "video",
      asset: "clip",
      fit: "cover",
      crop: { mode: "subject", x: 0.25, y: 0.75 },
      muted: true,
      startFrame: 0,
      durationFrames: 40,
      position: { x: 20, y: 340 },
      size: { width: 180, height: 100 }
    },
    {
      id: "clipKeyframed",
      type: "video",
      asset: "clip",
      fit: "cover",
      crop: {
        mode: "subject",
        keyframes: [
          { frame: 0, x: 0.2, y: 0.3 },
          { frame: 30, x: 0.8, y: 0.7 }
        ]
      },
      muted: true,
      startFrame: 0,
      durationFrames: 40,
      position: { x: 220, y: 340 },
      size: { width: 180, height: 100 }
    },
    {
      id: "panel",
      type: "shape",
      shape: "rect",
      startFrame: 0,
      durationFrames: 40,
      position: { x: 100, y: 80 },
      size: { width: 200, height: 90 },
      opacity: 0.75,
      rotation: 15,
      scale: 1.25,
      fill: "#ff0055",
      stroke: { color: "#ffffff", width: 4 },
      radius: 12
    },
    {
      id: "headline",
      type: "text",
      text: "Hello\nKavio",
      startFrame: 10,
      durationFrames: 20,
      position: { x: "50%", y: "50%h" },
      anchor: "center",
      size: { width: 400, height: 120 },
      keyframes: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 10, value: 1 }
        ]
      },
      style: {
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fontStyle: "italic",
        color: "#ffffff",
        align: "center",
        lineHeight: 1.1,
        letterSpacing: 1.5,
        maxLines: 2,
        wrap: true,
        background: "#00000080",
        padding: 8,
        stroke: { color: "#111111", width: 2 },
        shadow: { color: "#000000", x: 0, y: 4, blur: 12 }
      }
    },
    {
      id: "staticLabel",
      type: "text",
      text: "Static label",
      startFrame: 0,
      durationFrames: 40,
      position: { x: 20, y: 20 }
    },
    {
      id: "motionLabel",
      type: "text",
      text: "Motion label",
      startFrame: 0,
      durationFrames: 40,
      position: { x: 20, y: 50 },
      textMotion: { type: "typeOn", durationFrames: 20 }
    },
    {
      id: "logo",
      type: "image",
      asset: "logo",
      fit: "contain",
      startFrame: 0,
      durationFrames: 40,
      position: { x: 860, y: 80 },
      size: { width: 120 }
    },
    {
      id: "caption",
      type: "caption",
      startFrame: 0,
      durationFrames: 40,
      source: {
        kind: "inline",
        cues: [
          {
            startFrame: 0,
            endFrame: 30,
            text: "Hello from Kavio captions",
            words: [
              { startFrame: 0, endFrame: 10, text: "Hello" },
              { startFrame: 10, endFrame: 20, text: "from" },
              { startFrame: 20, endFrame: 30, text: "Kavio" }
            ]
          }
        ]
      },
      style: {
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 800,
        color: "#ffffff",
        align: "center",
        maxCharsPerLine: 16,
        maxLines: 2,
        highlight: {
          mode: "word",
          color: "#ffd400",
          scale: 1.1
        }
      },
      safeArea: "bottom"
    },
    {
      id: "seriesA",
      type: "shape",
      shape: "rect",
      startFrame: 18,
      durationFrames: 14,
      position: { x: 100, y: 220 },
      size: { width: 120, height: 70 },
      fill: "#334155",
      z: 5
    },
    {
      id: "seriesB",
      type: "shape",
      shape: "rect",
      startFrame: 24,
      durationFrames: 16,
      position: { x: 260, y: 220 },
      size: { width: 120, height: 70 },
      fill: "#38bdf8",
      z: 6
    },
    {
      id: "gridTransition",
      type: "shape",
      shape: "rect",
      startFrame: 30,
      durationFrames: 10,
      position: { x: 420, y: 340 },
      size: { width: 120, height: 80 },
      fill: "#00aa88",
      transitionIn: { type: "gridWipe", direction: "right", rows: 2, columns: 3, durationFrames: 5 }
    },
    {
      id: "whipTransition",
      type: "shape",
      shape: "rect",
      startFrame: 30,
      durationFrames: 10,
      position: { x: 560, y: 340 },
      size: { width: 120, height: 80 },
      fill: "#cc3366",
      transitionIn: { type: "cameraWhip", direction: "left", durationFrames: 5, amount: 14, intensity: 10 }
    },
    {
      id: "diagonalTransition",
      type: "shape",
      shape: "rect",
      startFrame: 30,
      durationFrames: 10,
      position: { x: 700, y: 340 },
      size: { width: 120, height: 80 },
      fill: "#7c3aed",
      transitionIn: { type: "diagonalWipe", corner: "top-right", durationFrames: 5 }
    },
    {
      id: "grayscaleTransition",
      type: "shape",
      shape: "rect",
      startFrame: 30,
      durationFrames: 10,
      position: { x: 840, y: 340 },
      size: { width: 120, height: 80 },
      fill: "#f97316",
      transitionIn: { type: "grayscaleDissolve", durationFrames: 5 }
    }
  ],
  tracks: [
    {
      id: "series",
      clips: [
        { id: "a", layerId: "seriesA", startFrame: 18, durationFrames: 14 },
        {
          id: "b",
          layerId: "seriesB",
          startFrame: 24,
          durationFrames: 16,
          transitionFromPrevious: {
            presentation: { type: "push", direction: "left" },
            timing: { type: "tween", durationFrames: 6 }
          }
        }
      ]
    }
  ]
};

const loaded = await renderer.loadComposition(composition);
assertEqual(loaded.width, 1000, "loaded composition exposes width");
assertEqual(loaded.height, 500, "loaded composition exposes height");
await renderer.ready;
assertEqual(document.fonts.faces.size, 1, "loadComposition registers supplied font assets");

const frame = await renderer.renderFrame(15);
assertEqual(frame.layers.length, 8, "renderFrame returns active video, text, shape, image, and caption layers");

const staticVideo = renderedElement(frame.layers.find((layer) => layer.id === "clipStatic")?.element);
assertEqual(staticVideo.dataset.kavioLayerType, "video", "video layer carries inspectable type");
assertEqual(staticVideo.dataset.kavioAsset, "clip", "video layer carries asset id");
assertEqual(staticVideo.dataset.kavioFit, "cover", "video fit mode is inspectable");
assertEqual(staticVideo.dataset.kavioCropMode, "subject", "video subject crop mode is inspectable");
assertEqual(staticVideo.dataset.kavioSubjectX, "0.25", "static subject crop x is exposed");
assertEqual(staticVideo.dataset.kavioSubjectY, "0.75", "static subject crop y is exposed");
assertEqual(styleValue(childElement(staticVideo, 0), "objectFit"), "cover", "video element applies object-fit");
assertEqual(styleValue(childElement(staticVideo, 0), "objectPosition"), "25% 75%", "static subject crop maps to object-position");

const keyframedVideo = renderedElement(frame.layers.find((layer) => layer.id === "clipKeyframed")?.element);
assertEqual(keyframedVideo.dataset.kavioSubjectX, "0.5", "keyframed subject crop interpolates x at local frame");
assertEqual(keyframedVideo.dataset.kavioSubjectY, "0.5", "keyframed subject crop interpolates y at local frame");
assertEqual(styleValue(childElement(keyframedVideo, 0), "objectPosition"), "50% 50%", "keyframed subject crop maps to object-position");

const shape = renderedElement(frame.layers.find((layer) => layer.id === "panel")?.element);
assertEqual(shape.dataset.kavioLayerType, "shape", "shape layer carries inspectable type");
assertEqual(shape.dataset.kavioShape, "rect", "shape layer records rectangle geometry");
assertEqual(styleValue(shape, "left"), "100px", "shape x position uses evaluated frame state");
assertEqual(styleValue(shape, "top"), "80px", "shape y position uses evaluated frame state");
assertEqual(styleValue(shape, "width"), "200px", "shape width uses resolved size");
assertEqual(styleValue(shape, "height"), "90px", "shape height uses resolved size");
assertEqual(styleValue(shape, "opacity"), "0.75", "shape opacity is applied");
assertEqual(styleValue(shape, "backgroundColor"), "#ff0055", "shape fill is applied");
assertEqual(styleValue(shape, "border"), "4px solid #ffffff", "shape stroke is applied");
assertEqual(styleValue(shape, "borderRadius"), "12px", "shape radius is applied");
assert(
  styleValue(shape, "transform").includes("rotate(15deg)") && styleValue(shape, "transform").includes("scale(1.25)"),
  "shape transform includes rotation and scale"
);

const text = renderedElement(frame.layers.find((layer) => layer.id === "headline")?.element);
assertEqual(text.textContent, "Hello\nKavio", "text content is rendered");
assertEqual(styleValue(text, "left"), "500px", "text x percentage resolves against width");
assertEqual(styleValue(text, "top"), "250px", "text y percentage resolves against height");
assertEqual(styleValue(text, "transformOrigin"), "50% 50%", "text transform origin follows center anchor");
assert(
  styleValue(text, "transform").includes("translate(-50%, -50%)"),
  "text transform offsets the element by its anchor"
);
assertEqual(styleValue(text, "opacity"), "0.5", "text opacity uses local keyframe evaluation");
assertEqual(styleValue(text, "fontFamily"), "Inter", "text font family is applied");
assertEqual(styleValue(text, "fontSize"), "64px", "text font size is applied");
assertEqual(styleValue(text, "fontWeight"), "800", "text font weight is applied");
assertEqual(styleValue(text, "fontStyle"), "italic", "text font style is applied");
assertEqual(styleValue(text, "color"), "#ffffff", "text color is applied");
assertEqual(styleValue(text, "lineHeight"), "1.1", "text line height is applied");
assertEqual(styleValue(text, "letterSpacing"), "1.5px", "text letter spacing is applied");
assertEqual(styleValue(text, "whiteSpace"), "pre-wrap", "text wrapping is applied");
assertEqual(styleValue(text, "overflowWrap"), "break-word", "wrapped text can break long words");
assertEqual(styleValue(text, "textAlign"), "center", "text alignment is applied");
assertEqual(styleValue(text, "backgroundColor"), "#00000080", "text background is applied");
assertEqual(styleValue(text, "padding"), "8px", "text padding is applied");
assertEqual(customStyleValue(text, "-webkit-line-clamp"), "2", "text maxLines clamp is applied");
assertEqual(customStyleValue(text, "-webkit-text-stroke"), "2px #111111", "text stroke is applied");
assertEqual(styleValue(text, "textShadow"), "0px 4px 12px #000000", "text shadow is applied");

const image = renderedElement(frame.layers.find((layer) => layer.id === "logo")?.element);
assertEqual(image.dataset.kavioLayerType, "image", "image layer carries inspectable type");
assertEqual(image.dataset.kavioAsset, "logo", "image layer carries asset id");
assertEqual(image.dataset.kavioFit, "contain", "image fit mode is inspectable");
assertEqual(styleValue(image, "width"), "120px", "image explicit width is applied");
assertEqual(styleValue(image, "height"), "60px", "image missing height is resolved from decoded intrinsic ratio");
assertEqual(styleValue(childElement(image, 0), "objectFit"), "contain", "image element applies object-fit");

const caption = renderedElement(frame.layers.find((layer) => layer.id === "caption")?.element);
assertEqual(caption.dataset.kavioCaptionVisible, "true", "caption uses evaluated cue visibility");
assertEqual(caption.dataset.kavioCaptionCueIndex, "0", "caption exposes evaluated cue index");
assertEqual(caption.dataset.kavioCaptionHighlightMode, "word", "caption exposes evaluated highlight mode");
assertEqual(styleValue(caption, "left"), "500px", "caption bottom safe area centers horizontally");
assertEqual(styleValue(caption, "top"), "460px", "caption bottom safe area applies vertical inset");
assertEqual(styleValue(caption, "width"), "860px", "caption safe area applies responsive width");
const activeWord = caption.children.find(
  (child): child is FakeElement => "dataset" in child && child.dataset.kavioCaptionWordActive === "true"
);
if (!activeWord) {
  throw new Error("caption renders active word highlight from core state");
}
assertEqual(activeWord.textContent, "from", "caption active word follows local frame state");
assertEqual(styleValue(activeWord, "color"), "#ffd400", "caption active word applies highlight color");

const staticLabel = renderedElement(frame.layers.find((layer) => layer.id === "staticLabel")?.element);
const motionLabel = renderedElement(frame.layers.find((layer) => layer.id === "motionLabel")?.element);
const nextFrame = await renderer.renderFrame(16);
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "panel")?.element) === shape, "static shape element is reused between frames");
assertEqual(nextFrame.layers.find((layer) => layer.id === "panel")?.localFrame, 16, "reused layers still report the requested local frame");
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "logo")?.element) === image, "static image element is reused between frames");
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "staticLabel")?.element) === staticLabel, "plain text element is reused between frames");
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "headline")?.element) !== text, "keyframed text still rerenders between frames");
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "motionLabel")?.element) !== motionLabel, "text motion still rerenders between frames");
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "clipStatic")?.element) !== staticVideo, "video still rerenders between frames");
assert(renderedElement(nextFrame.layers.find((layer) => layer.id === "caption")?.element) !== caption, "caption still rerenders between frames");

const maskTransitionFrame = await renderer.renderFrame(32);
const gridTransition = maskTransitionFrame.layers.find((entry) => entry.id === "gridTransition")?.element;
assert(gridTransition !== undefined, "grid transition layer renders during its entrance");
assert(
  customStyleValue(gridTransition, "mask-image").includes("linear-gradient"),
  "grid wipe applies a deterministic CSS mask"
);
const whipTransitionFrame = await renderer.renderFrame(30);
const whipTransition = whipTransitionFrame.layers.find((entry) => entry.id === "whipTransition")?.element;
assert(whipTransition !== undefined, "camera whip layer renders at its first frame");
assert(styleValue(whipTransition, "filter").includes("blur(14px)"), "camera whip applies blur at the first frame");
assert(styleValue(whipTransition, "transform").includes("skewY(-10deg)"), "camera whip applies directional skew");
const diagonalTransition = maskTransitionFrame.layers.find((entry) => entry.id === "diagonalTransition")?.element;
assert(diagonalTransition !== undefined, "diagonal wipe layer renders during its entrance");
assert(styleValue(diagonalTransition, "clipPath").startsWith("polygon("), "diagonal wipe applies a deterministic polygon clip");
const grayscaleTransition = whipTransitionFrame.layers.find((entry) => entry.id === "grayscaleTransition")?.element;
assert(grayscaleTransition !== undefined, "grayscale dissolve layer renders at its first frame");
assert(styleValue(grayscaleTransition, "filter").includes("grayscale(1)"), "grayscale dissolve applies a deterministic CSS filter");

const seriesFrame = await renderer.renderFrame(24);
const seriesPrevious = renderedElement(seriesFrame.layers.find((entry) => entry.id === "seriesA")?.element);
const seriesNext = renderedElement(seriesFrame.layers.find((entry) => entry.id === "seriesB")?.element);
assertEqual(seriesPrevious.dataset.kavioTransitionSeries, "true", "transition series renders the outgoing clip through the overlap evaluator");
assertEqual(seriesPrevious.dataset.kavioTransitionRole, "previous", "transition series labels the outgoing clip role");
assertEqual(seriesPrevious.dataset.kavioTransitionType, "push", "transition series exposes the transition type");
assertEqual(seriesNext.dataset.kavioTransitionSeries, "true", "transition series renders the incoming clip through the overlap evaluator");
assertEqual(seriesNext.dataset.kavioTransitionRole, "next", "transition series labels the incoming clip role");
assert(styleValue(seriesNext, "left") !== "260px", "incoming transition-series clip uses evaluated transition position");

const seriesLinearFrame = await renderer.renderFrame(25);
const seriesLinearPrevious = renderedElement(seriesLinearFrame.layers.find((entry) => entry.id === "seriesA")?.element);
const seriesLinearNext = renderedElement(seriesLinearFrame.layers.find((entry) => entry.id === "seriesB")?.element);
assert(seriesLinearPrevious !== seriesPrevious, "outgoing track-transition layers rerender within the overlap");
assert(seriesLinearNext !== seriesNext, "incoming track-transition layers rerender within the overlap");
assertEqual(styleValue(seriesLinearPrevious, "left"), "-100px", "outgoing transition-series DOM uses linear default timing");
assertEqual(styleValue(seriesLinearNext, "left"), "1060px", "incoming transition-series DOM uses linear default timing");

const seriesLastOverlapFrame = await renderer.renderFrame(29);
assertEqual(
  styleValue(renderedElement(seriesLastOverlapFrame.layers.find((entry) => entry.id === "seriesA")?.element), "left"),
  "-900px",
  "outgoing transition-series clip reaches its final position on the last overlap frame"
);
assertEqual(
  styleValue(renderedElement(seriesLastOverlapFrame.layers.find((entry) => entry.id === "seriesB")?.element), "left"),
  "260px",
  "incoming transition-series clip reaches its resting position on the last overlap frame"
);
const seriesAfterOverlapFrame = await renderer.renderFrame(30);
assert(
  !seriesAfterOverlapFrame.layers.some((entry) => entry.id === "seriesA"),
  "completed outgoing transition-series clips stay hidden for their remaining active frames"
);
assert(
  seriesAfterOverlapFrame.layers.some((entry) => entry.id === "seriesB"),
  "incoming transition-series clips remain visible after the overlap"
);
const seriesAfterOverlap = renderedElement(seriesAfterOverlapFrame.layers.find((entry) => entry.id === "seriesB")?.element);
const seriesSettledFrame = await renderer.renderFrame(31);
assert(
  renderedElement(seriesSettledFrame.layers.find((entry) => entry.id === "seriesB")?.element) !== seriesAfterOverlap,
  "track-transition participants remain dynamic after the overlap"
);

const boundaryDocument = new FakeDocument();
const boundaryRenderer = createBrowserRenderer({ document: boundaryDocument as unknown as Document });
await boundaryRenderer.loadComposition({
  version: schemaVersion,
  composition: { width: 200, height: 100, fps: 25, durationFrames: 16 },
  assets: {},
  exports: [{ name: "preview", format: "png-sequence", width: 200, height: 100 }],
  layers: [
    {
      id: "fade",
      type: "shape",
      shape: "rect",
      startFrame: 5,
      durationFrames: 7,
      opacity: 0.8,
      transitionIn: { type: "fade", durationFrames: 3 },
      transitionOut: { type: "fade", durationFrames: 3 }
    },
    {
      id: "zoom",
      type: "shape",
      shape: "rect",
      startFrame: 5,
      durationFrames: 7,
      scale: 2,
      transitionIn: { type: "zoom", durationFrames: 3, amount: 0.2 }
    },
    {
      id: "pan",
      type: "shape",
      shape: "rect",
      startFrame: 5,
      durationFrames: 7,
      position: { x: 20, y: 40 },
      keyframes: { x: [{ frame: 0, value: 20 }, { frame: 2, value: 120 }] }
    },
    {
      id: "still",
      type: "shape",
      shape: "rect",
      startFrame: 5,
      durationFrames: 7,
      position: { x: 5, y: 5 }
    }
  ]
});
assertEqual((await boundaryRenderer.renderFrame(4)).layers.length, 0, "layers are absent before their inclusive start frame");
const boundaryStart = await boundaryRenderer.renderFrame(5);
const boundaryStill = renderedElement(boundaryStart.layers.find((entry) => entry.id === "still")?.element);
const boundaryFade = renderedElement(boundaryStart.layers.find((entry) => entry.id === "fade")?.element);
assertEqual(
  styleValue(boundaryFade, "opacity"),
  "0",
  "fade entrance begins transparent on the inclusive start frame"
);
assert(
  styleValue(renderedElement(boundaryStart.layers.find((entry) => entry.id === "zoom")?.element), "transform").includes("scale(2.4)"),
  "zoom entrance multiplies authored scale on the inclusive start frame"
);
assertEqual(
  styleValue(renderedElement(boundaryStart.layers.find((entry) => entry.id === "pan")?.element), "left"),
  "20px",
  "pan keyframes evaluate from layer-local frame zero"
);
const boundaryEntranceEnd = await boundaryRenderer.renderFrame(7);
assert(
  renderedElement(boundaryEntranceEnd.layers.find((entry) => entry.id === "still")?.element) === boundaryStill,
  "static layers reuse DOM across the same inclusive boundary frames"
);
assert(
  renderedElement(boundaryEntranceEnd.layers.find((entry) => entry.id === "fade")?.element) !== boundaryFade,
  "transitioning layers rebuild DOM across the same inclusive boundary frames"
);
assertEqual(
  styleValue(renderedElement(boundaryEntranceEnd.layers.find((entry) => entry.id === "fade")?.element), "opacity"),
  "0.8",
  "fade entrance reaches authored opacity on its final frame"
);
assert(
  styleValue(renderedElement(boundaryEntranceEnd.layers.find((entry) => entry.id === "zoom")?.element), "transform").includes("scale(2)"),
  "zoom entrance reaches authored scale on its final frame"
);
assertEqual(
  styleValue(renderedElement(boundaryEntranceEnd.layers.find((entry) => entry.id === "pan")?.element), "left"),
  "120px",
  "pan keyframes reach their final position at the authored local frame"
);
const boundaryEnd = await boundaryRenderer.renderFrame(11);
assertEqual(
  styleValue(renderedElement(boundaryEnd.layers.find((entry) => entry.id === "fade")?.element), "opacity"),
  "0",
  "fade exit reaches transparent on the final active frame"
);
assertEqual((await boundaryRenderer.renderFrame(12)).layers.length, 0, "layers are absent at the exclusive end frame");

await renderer.loadComposition(composition);
const reloadedPanel = renderedElement((await renderer.renderFrame(15)).layers.find((entry) => entry.id === "panel")?.element);
assert(reloadedPanel !== shape, "loading a composition discards cached DOM from the previous load");

const verticalPreview = createExportPreviewComposition(composition, "vertical");
assertEqual(verticalPreview.exportIndex, 1, "export preview resolves selected export by name");
assertEqual(verticalPreview.composition.composition.width, 360, "export preview uses selected export width");
assertEqual(verticalPreview.composition.composition.height, 640, "export preview uses selected export height");
assertEqual(verticalPreview.composition.exports.length, 1, "export preview isolates selected export preset");
assertEqual(composition.composition.width, 1000, "export preview does not mutate the source composition");
const overriddenPanel = verticalPreview.composition.layers.find((layer) => layer.id === "panel");
if (!overriddenPanel || overriddenPanel.type !== "shape") {
  throw new Error("export preview retains overridden shape layer");
}
assertEqual(overriddenPanel.position?.x, 20, "export preview applies layer override position");
assertEqual(overriddenPanel.size?.height, 160, "export preview applies layer override size");
assertEqual(nextPreviewFrame(39, 1, 40, true), 0, "preview frame stepping loops by default");
assertEqual(nextPreviewFrame(39, 1, 40, false), null, "preview frame stepping can stop at the end");

const previewRoot = document.createElement("div");
const controlsRoot = document.createElement("div");
document.body.append(previewRoot, controlsRoot);
const preview = createBrowserPreviewController({
  document: document as unknown as Document,
  root: previewRoot as unknown as HTMLElement,
  controlsRoot: controlsRoot as unknown as HTMLElement,
  loop: true
});
await preview.loadComposition(composition);
assertEqual(preview.state.width, 1000, "preview controller loads default export width");
assertEqual(preview.state.durationFrames, 40, "preview controller tracks duration");
assert(preview.controls !== null, "preview controller installs DOM controls");
assertEqual(controlsRoot.children.length, 1, "preview controls are mounted into controls root");

await preview.setFrame(15);
assertEqual(preview.state.frame, 15, "preview controller scrubs to a requested frame");
await preview.setFrame(999);
assertEqual(preview.state.frame, 39, "preview controller clamps scrubbed frames");
await preview.step(1);
assertEqual(preview.state.frame, 0, "preview controller frame stepping loops when enabled");
preview.play();
assertEqual(preview.state.playing, true, "preview controller exposes play state");
preview.pause();
assertEqual(preview.state.playing, false, "preview controller exposes paused state");

preview.setSafeZonesVisible(true);
const stageWithSafeZones = childElement(previewRoot, 0);
assert(
  stageWithSafeZones.querySelector("[data-kavio-preview-safe-zones='true']") !== null,
  "preview controller can show safe-zone overlay"
);
preview.setSafeZonesVisible(false);
assert(
  stageWithSafeZones.querySelector("[data-kavio-preview-safe-zones='true']") === null,
  "preview controller can hide safe-zone overlay"
);

await preview.setPreviewExport("vertical");
assertEqual(preview.state.exportName, "vertical", "preview controller tracks selected export");
assertEqual(preview.state.width, 360, "preview controller applies selected export width");
assertEqual(preview.state.height, 640, "preview controller applies selected export height");
const verticalStage = childElement(previewRoot, 0);
assertEqual(styleValue(verticalStage, "width"), "360px", "preview controller renders selected export aspect width");
assertEqual(styleValue(verticalStage, "height"), "640px", "preview controller renders selected export aspect height");
preview.destroy();
assertEqual(controlsRoot.children.length, 0, "preview controller removes controls on destroy");

// Render-harness captures must not paint video layers: ffmpeg supplies video
// as the base/pip planes, so browser-rendered video would double-composite.
const overlayDocument = new FakeDocument();
const overlayRenderer = createBrowserRenderer({
  document: overlayDocument as unknown as Document,
  renderVideoLayers: false
});
await overlayRenderer.loadComposition(composition);
const overlayFrame = await overlayRenderer.renderFrame(15);
assert(
  overlayFrame.layers.every((layer) => renderedElement(layer.element).dataset.kavioLayerType !== "video"),
  "renderVideoLayers:false omits video layers from rendered frames"
);
assert(overlayFrame.layers.length < frame.layers.length, "renderVideoLayers:false renders fewer layers than the full frame");
assert(
  overlayFrame.layers.some((layer) => renderedElement(layer.element).dataset.kavioLayerType === "text"),
  "renderVideoLayers:false still renders non-video layers"
);

const harnessHtml = createRenderHarnessHtml({ width: 1080, height: 1920, fps: 30, durationFrames: 30 });
assert(harnessHtml.includes("renderVideoLayers: false"), "harness installs the runtime without video layers");
assert(harnessHtml.includes("importmap"), "harness html declares an importmap");
assert(harnessHtml.includes("@kitsra/kavio-core"), "harness maps the core module");
assert(harnessHtml.includes("/composition.json"), "harness fetches composition json");
assert(harnessHtml.includes("installBrowserRendererRuntime"), "harness installs the runtime");
assert(harnessHtml.includes("__kavioReady"), "harness signals readiness");
assert(harnessHtml.includes("1080px"), "harness sizes the stage to the composition");

console.log("Browser renderer preview controls, video, image, caption, font, text, and shape self-checks passed.");
console.log("Browser renderer render-harness html self-check passed.");
