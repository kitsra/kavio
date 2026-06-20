import { evaluateLayer, getCanvasDimensions, isLayerActive, resolvePoint } from "@kavio/core";
import type { CanvasDimensions, EvaluatedCaptionState, EvaluatedLayer, Size } from "@kavio/core";
import type {
  KavioCaptionLayer,
  KavioCaptionStyle,
  KavioDocument,
  KavioExportPreset,
  KavioFontAsset,
  KavioImageAsset,
  KavioLayer,
  KavioLayerOverride,
  KavioTextStyle,
  KavioVideoCrop
} from "@kavio/schema";

export interface BrowserRenderer {
  readonly ready: Promise<void>;
  loadComposition(composition: KavioDocument): Promise<LoadedComposition>;
  renderFrame(frame: number): Promise<RenderedFrame>;
}

export interface BrowserRendererOptions {
  document?: Document;
  root?: HTMLElement;
}

export interface BrowserRendererRuntime {
  readonly ready: Promise<void>;
  loadComposition(composition: KavioDocument): Promise<LoadedComposition>;
  renderFrame(frame: number): Promise<RenderedFrame>;
  createPreviewController(options?: BrowserPreviewControllerOptions): BrowserPreviewController;
}

export interface LoadedComposition {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
}

export interface RenderedFrame {
  frame: number;
  width: number;
  height: number;
  layers: RenderedLayer[];
}

export interface RenderedLayer {
  id: string;
  type: KavioLayer["type"];
  localFrame: number;
  element: HTMLElement;
  evaluation: EvaluatedLayer;
}

export type BrowserPreviewExportSelection = string | number | null | undefined;

export interface BrowserPreviewControllerOptions {
  document?: Document;
  root?: HTMLElement;
  controlsRoot?: HTMLElement;
  runtime?: BrowserRendererRuntime;
  loop?: boolean;
  frameStep?: number;
}

export interface BrowserPreviewLoadOptions {
  export?: BrowserPreviewExportSelection;
}

export interface BrowserPreviewState {
  frame: number;
  playing: boolean;
  safeZonesVisible: boolean;
  exportIndex: number | null;
  exportName: string | null;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
}

export interface BrowserPreviewController {
  readonly state: BrowserPreviewState;
  readonly controls: HTMLElement | null;
  loadComposition(composition: KavioDocument, options?: BrowserPreviewLoadOptions): Promise<LoadedComposition>;
  renderFrame(frame?: number): Promise<RenderedFrame>;
  setFrame(frame: number): Promise<RenderedFrame>;
  step(delta?: number): Promise<RenderedFrame>;
  play(): void;
  pause(): void;
  togglePlayback(force?: boolean): void;
  setSafeZonesVisible(visible: boolean): void;
  setPreviewExport(selection: BrowserPreviewExportSelection): Promise<LoadedComposition>;
  destroy(): void;
}

export interface ExportPreviewComposition {
  composition: KavioDocument;
  exportPreset: KavioExportPreset | null;
  exportIndex: number | null;
}

interface CompositionResources {
  readonly ready: Promise<void>;
  readonly fontFaces: FontFace[];
  readonly document?: Document;
}

interface RenderedContent {
  intrinsicSize?: Size;
}

declare global {
  interface Window {
    __kavio?: BrowserRendererRuntime;
  }
}

export function createBrowserRenderer(options: BrowserRendererOptions = {}): BrowserRenderer {
  let loaded: KavioDocument | undefined;
  let resources: CompositionResources = emptyCompositionResources();

  return {
    get ready() {
      return resources.ready;
    },
    async loadComposition(composition) {
      releaseCompositionResources(resources);
      loaded = cloneComposition(composition);
      resources = prepareCompositionResources(loaded, options);
      resources.ready.catch(() => undefined);
      return getLoadedComposition(loaded);
    },
    async renderFrame(frame) {
      if (!loaded) {
        throw new Error("No composition loaded.");
      }

      assertRenderableFrame(frame, loaded);
      await resources.ready;
      return renderCompositionFrame(loaded, frame, options);
    }
  };
}

export function installBrowserRendererRuntime(options: BrowserRendererOptions = {}): BrowserRendererRuntime {
  const host = getRuntimeHost(options.document);
  const renderer = createBrowserRenderer(options);
  const runtime: BrowserRendererRuntime = {
    get ready() {
      return renderer.ready;
    },
    loadComposition: (composition) => renderer.loadComposition(composition),
    renderFrame: (frame) => renderer.renderFrame(frame),
    createPreviewController: (controllerOptions) =>
      createBrowserPreviewController(
        withDefinedOptions<BrowserPreviewControllerOptions>({
          document: controllerOptions?.document ?? options.document,
          root: controllerOptions?.root ?? options.root,
          controlsRoot: controllerOptions?.controlsRoot,
          loop: controllerOptions?.loop,
          frameStep: controllerOptions?.frameStep,
          runtime
        })
      )
  };

  Object.defineProperty(host, "__kavio", {
    configurable: true,
    enumerable: false,
    value: runtime,
    writable: false
  });

  return runtime;
}

export interface RenderHarnessHtmlOptions {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
}

/**
 * Pure render-harness HTML generator (no Node APIs). Produces a page that maps
 * `@kavio/core` and the browser renderer to server-vendored module URLs, fetches
 * `/composition.json`, installs the runtime on `window.__kavio`, and signals
 * `window.__kavioReady`. Shared by the CLI `preview` command and the render
 * worker's `PlaywrightDriver` so preview and export paint the identical page.
 */
export function createRenderHarnessHtml(options: RenderHarnessHtmlOptions): string {
  const importmap = JSON.stringify({ imports: { "@kavio/core": "/vendor/core/index.js" } });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Kavio Render Harness</title>
  <script type="importmap">${importmap}</script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }
    #stage { width: ${options.width}px; height: ${options.height}px; position: relative; overflow: hidden; }
  </style>
</head>
<body>
  <div id="stage" data-kavio-runtime-root="true"></div>
  <script type="module">
    import { installBrowserRendererRuntime } from "/vendor/browser-renderer/index.js";
    const stage = document.getElementById("stage");
    const runtime = installBrowserRendererRuntime({ root: stage });
    const composition = await fetch("/composition.json").then((response) => response.json());
    await runtime.loadComposition(composition);
    window.__kavioReady = true;
  </script>
</body>
</html>
`;
}

export function createBrowserPreviewController(options: BrowserPreviewControllerOptions = {}): BrowserPreviewController {
  const runtime =
    options.runtime ??
    installBrowserRendererRuntime(withDefinedOptions<BrowserRendererOptions>({ document: options.document, root: options.root }));
  const loop = options.loop ?? true;
  const frameStep = Math.max(1, Math.trunc(options.frameStep ?? 1));
  let sourceComposition: KavioDocument | undefined;
  let previewComposition: KavioDocument | undefined;
  let playTimer: ReturnType<typeof setInterval> | undefined;

  const state: BrowserPreviewState = {
    frame: 0,
    playing: false,
    safeZonesVisible: false,
    exportIndex: null,
    exportName: null,
    width: 0,
    height: 0,
    fps: 30,
    durationFrames: 0
  };

  const controls = options.controlsRoot ? createPreviewControls(options.controlsRoot.ownerDocument) : null;
  if (controls && options.controlsRoot) {
    options.controlsRoot.replaceChildren(controls.element);
    controls.bind({
      onFrameInput: (frame) => {
        void setFrame(frame);
      },
      onPlayToggle: () => togglePlayback(),
      onSafeZoneToggle: (visible) => setSafeZonesVisible(visible),
      onExportChange: (selection) => {
        void setPreviewExport(selection);
      }
    });
  }

  async function loadComposition(
    composition: KavioDocument,
    loadOptions: BrowserPreviewLoadOptions = {}
  ): Promise<LoadedComposition> {
    pause();
    sourceComposition = cloneComposition(composition);
    const preview = createExportPreviewComposition(sourceComposition, loadOptions.export ?? 0);
    previewComposition = preview.composition;
    state.exportIndex = preview.exportIndex;
    state.exportName = preview.exportPreset?.name ?? null;
    const loaded = await runtime.loadComposition(previewComposition);
    updateLoadedState(loaded);
    state.frame = clampFrame(state.frame, state.durationFrames);
    updateControls();
    await renderFrame(state.frame);
    return loaded;
  }

  async function renderFrame(frame = state.frame): Promise<RenderedFrame> {
    assertPreviewLoaded(previewComposition);
    const nextFrame = clampFrame(frame, state.durationFrames);
    const rendered = await runtime.renderFrame(nextFrame);
    state.frame = rendered.frame;
    applyPreviewSafeZones(getPreviewRoot(options), state.safeZonesVisible, rendered);
    updateControls();
    return rendered;
  }

  async function setFrame(frame: number): Promise<RenderedFrame> {
    return renderFrame(frame);
  }

  async function step(delta = frameStep): Promise<RenderedFrame> {
    const next = nextPreviewFrame(state.frame, delta, state.durationFrames, loop);
    if (next === null) {
      pause();
      return renderFrame(state.frame);
    }

    return renderFrame(next);
  }

  function play(): void {
    assertPreviewLoaded(previewComposition);
    if (state.playing) {
      return;
    }

    state.playing = true;
    updateControls();
    const delay = Math.max(1, Math.round(1000 / Math.max(1, state.fps)));
    playTimer = setInterval(() => {
      void step(frameStep).catch(() => pause());
    }, delay);
  }

  function pause(): void {
    if (playTimer !== undefined) {
      clearInterval(playTimer);
      playTimer = undefined;
    }
    state.playing = false;
    updateControls();
  }

  function togglePlayback(force?: boolean): void {
    const shouldPlay = force ?? !state.playing;
    if (shouldPlay) {
      play();
    } else {
      pause();
    }
  }

  function setSafeZonesVisible(visible: boolean): void {
    state.safeZonesVisible = visible;
    if (state.durationFrames > 0) {
      applyPreviewSafeZones(getPreviewRoot(options), visible, {
        frame: state.frame,
        width: state.width,
        height: state.height,
        layers: []
      });
    }
    updateControls();
  }

  async function setPreviewExport(selection: BrowserPreviewExportSelection): Promise<LoadedComposition> {
    assertPreviewLoaded(sourceComposition);
    pause();
    const preview = createExportPreviewComposition(sourceComposition, selection);
    previewComposition = preview.composition;
    state.exportIndex = preview.exportIndex;
    state.exportName = preview.exportPreset?.name ?? null;
    const loaded = await runtime.loadComposition(previewComposition);
    updateLoadedState(loaded);
    state.frame = clampFrame(state.frame, state.durationFrames);
    updateControls();
    await renderFrame(state.frame);
    return loaded;
  }

  function destroy(): void {
    pause();
    applyPreviewSafeZones(getPreviewRoot(options), false, {
      frame: state.frame,
      width: state.width,
      height: state.height,
      layers: []
    });
    controls?.element.remove();
  }

  function updateLoadedState(loaded: LoadedComposition): void {
    state.width = loaded.width;
    state.height = loaded.height;
    state.fps = loaded.fps;
    state.durationFrames = loaded.durationFrames;
  }

  function updateControls(): void {
    controls?.update(state, sourceComposition?.exports ?? []);
  }

  return {
    state,
    controls: controls?.element ?? null,
    loadComposition,
    renderFrame,
    setFrame,
    step,
    play,
    pause,
    togglePlayback,
    setSafeZonesVisible,
    setPreviewExport,
    destroy
  };
}

export function createExportPreviewComposition(
  composition: KavioDocument,
  selection: BrowserPreviewExportSelection = 0
): ExportPreviewComposition {
  const exportIndex = findPreviewExportIndex(composition.exports, selection);
  const exportPreset = exportIndex === null ? null : (composition.exports[exportIndex] ?? null);
  const preview = cloneComposition(composition);

  if (!exportPreset) {
    return {
      composition: preview,
      exportPreset,
      exportIndex
    };
  }

  preview.composition.width = exportPreset.width;
  preview.composition.height = exportPreset.height;
  preview.composition.fps = exportPreset.fps ?? preview.composition.fps;
  preview.exports = [cloneJson(exportPreset)];
  if (exportPreset.layerOverrides) {
    preview.layers = preview.layers.map((layer) => applyPreviewLayerOverride(layer, exportPreset.layerOverrides?.[layer.id]));
  }

  return {
    composition: preview,
    exportPreset: cloneJson(exportPreset),
    exportIndex
  };
}

export function nextPreviewFrame(
  frame: number,
  delta: number,
  durationFrames: number,
  loop = true
): number | null {
  if (durationFrames <= 0) {
    return null;
  }

  const step = Math.trunc(delta);
  if (step === 0) {
    return clampFrame(frame, durationFrames);
  }

  const next = frame + step;
  if (next >= 0 && next < durationFrames) {
    return next;
  }

  if (!loop) {
    return null;
  }

  return ((next % durationFrames) + durationFrames) % durationFrames;
}

export function applyPreviewSafeZones(root: HTMLElement, visible: boolean, frame: RenderedFrame): void {
  removePreviewSafeZones(root);
  if (!visible) {
    return;
  }

  const stage = root.querySelector<HTMLElement>("[data-kavio-stage='true']");
  if (!stage) {
    return;
  }

  stage.append(createPreviewSafeZoneOverlay(stage.ownerDocument, frame.width, frame.height));
}

export function createPreviewSafeZoneOverlay(document: Document, width: number, height: number): HTMLElement {
  const overlay = document.createElement("div");
  overlay.dataset.kavioPreviewSafeZones = "true";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "2147483647";
  overlay.style.boxSizing = "border-box";

  const action = createSafeZoneBox(document, "action", width, height, 0.9, "rgba(0, 200, 255, 0.8)");
  const title = createSafeZoneBox(document, "title", width, height, 0.8, "rgba(255, 214, 0, 0.85)");
  overlay.replaceChildren(action, title);
  return overlay;
}

function renderCompositionFrame(
  composition: KavioDocument,
  frame: number,
  options: BrowserRendererOptions
): Promise<RenderedFrame> {
  const dimensions = getCanvasDimensions(composition.composition);
  const root = getRenderRoot(options);
  const stage = createStage(root, dimensions, composition.exports[0]?.background);
  const layerPromises = composition.layers
    .filter((layer) => isLayerActive(layer, frame))
    .map((layer, index) => renderLayer(stage.ownerDocument, composition, layer, index, frame, dimensions));

  return Promise.all(layerPromises).then(async (layers) => {
    stage.replaceChildren(...layers.map((layer) => layer.element));
    root.replaceChildren(stage);
    await waitForDocumentFonts(stage.ownerDocument);

    return {
      frame,
      width: dimensions.width,
      height: dimensions.height,
      layers
    };
  });
}

async function renderLayer(
  document: Document,
  composition: KavioDocument,
  layer: KavioLayer,
  index: number,
  frame: number,
  dimensions: CanvasDimensions
): Promise<RenderedLayer> {
  const evaluation = evaluateLayer(layer, frame, dimensions);
  const element = document.createElement("div");
  element.dataset.kavioLayerId = layer.id;
  element.dataset.kavioLayerType = layer.type;
  element.style.position = "absolute";
  element.style.boxSizing = "border-box";
  element.style.left = `${evaluation.position.x}px`;
  element.style.top = `${evaluation.position.y}px`;
  element.style.opacity = String(evaluation.opacity);
  element.style.zIndex = String(layer.z ?? index);

  applyEvaluatedSize(element, evaluation);
  const content = await applyLayerContent(document, element, composition, layer, evaluation, dimensions);
  const renderedSize = resolveRenderedSize(evaluation, content.intrinsicSize);
  applyRenderedSize(element, evaluation, renderedSize);
  applyLayerTransform(element, layer, evaluation, dimensions);

  return {
    id: layer.id,
    type: layer.type,
    localFrame: evaluation.localFrame,
    element,
    evaluation
  };
}

async function applyLayerContent(
  document: Document,
  element: HTMLElement,
  composition: KavioDocument,
  layer: KavioLayer,
  evaluation: EvaluatedLayer,
  dimensions: CanvasDimensions
): Promise<RenderedContent> {
  switch (layer.type) {
    case "text":
      element.textContent = layer.text;
      applyTextStyle(element, layer.style);
      return {};
    case "caption":
      applyCaptionContent(document, element, layer, evaluation.caption, dimensions);
      return {};
    case "shape":
      element.dataset.kavioShape = layer.shape;
      element.style.backgroundColor = layer.fill ?? "transparent";
      element.style.borderRadius = layer.radius === undefined ? "0" : `${layer.radius}px`;
      if (layer.stroke) {
        element.style.border = `${layer.stroke.width}px solid ${layer.stroke.color}`;
      } else {
        element.style.border = "0 solid transparent";
      }
      return {};
    case "image":
      return applyImageContent(document, element, composition, layer);
    case "video":
      return applyVideoContent(document, element, composition, layer, evaluation);
  }
}

function applyTextStyle(element: HTMLElement, style: KavioTextStyle | undefined): void {
  const wrap = style?.wrap !== false;
  element.style.whiteSpace = wrap ? "pre-wrap" : "pre";
  element.style.overflowWrap = wrap ? "break-word" : "normal";
  element.style.color = style?.color ?? "currentColor";
  element.style.fontFamily = style?.fontFamily ?? "sans-serif";
  element.style.fontSize = `${style?.fontSize ?? 16}px`;
  element.style.fontWeight = style?.fontWeight === undefined ? "400" : String(style.fontWeight);
  element.style.fontStyle = style?.fontStyle ?? "normal";
  element.style.lineHeight = style?.lineHeight === undefined ? "normal" : String(style.lineHeight);
  element.style.letterSpacing = style?.letterSpacing === undefined ? "normal" : `${style.letterSpacing}px`;
  element.style.textAlign = style?.align ?? "left";
  element.style.backgroundColor = style?.background ?? "transparent";
  element.style.padding = style?.padding === undefined ? "0" : `${style.padding}px`;

  if (style?.maxLines !== undefined && style.maxLines > 0) {
    element.style.display = "-webkit-box";
    element.style.overflow = "hidden";
    element.style.setProperty("-webkit-box-orient", "vertical");
    element.style.setProperty("-webkit-line-clamp", String(style.maxLines));
  } else {
    element.style.display = "block";
  }

  if (style?.stroke) {
    element.style.setProperty("-webkit-text-stroke", `${style.stroke.width}px ${style.stroke.color}`);
  } else {
    element.style.setProperty("-webkit-text-stroke", "0 transparent");
  }

  if (style?.shadow) {
    element.style.textShadow = `${style.shadow.x}px ${style.shadow.y}px ${style.shadow.blur}px ${style.shadow.color}`;
  } else {
    element.style.textShadow = "none";
  }
}

function createStage(root: HTMLElement, dimensions: CanvasDimensions, background: string | null | undefined): HTMLElement {
  const stage = root.ownerDocument.createElement("div");
  stage.dataset.kavioStage = "true";
  stage.style.position = "relative";
  stage.style.overflow = "hidden";
  stage.style.width = `${dimensions.width}px`;
  stage.style.height = `${dimensions.height}px`;
  stage.style.background = background === null || background === "transparent" ? "transparent" : (background ?? "transparent");
  return stage;
}

interface PreviewControlBindings {
  onFrameInput(frame: number): void;
  onPlayToggle(): void;
  onSafeZoneToggle(visible: boolean): void;
  onExportChange(selection: BrowserPreviewExportSelection): void;
}

interface PreviewControls {
  readonly element: HTMLElement;
  bind(bindings: PreviewControlBindings): void;
  update(state: BrowserPreviewState, exports: KavioExportPreset[]): void;
}

function createPreviewControls(document: Document): PreviewControls {
  const element = document.createElement("div");
  element.dataset.kavioPreviewControls = "true";
  element.style.display = "grid";
  element.style.gridTemplateColumns = "auto minmax(160px, 1fr) auto auto auto";
  element.style.gap = "8px";
  element.style.alignItems = "center";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.dataset.kavioPreviewControl = "play";

  const scrubber = document.createElement("input");
  scrubber.type = "range";
  scrubber.min = "0";
  scrubber.step = "1";
  scrubber.dataset.kavioPreviewControl = "scrubber";

  const frameOutput = document.createElement("output");
  frameOutput.dataset.kavioPreviewControl = "frame";

  const safeZonesLabel = document.createElement("label");
  safeZonesLabel.dataset.kavioPreviewControl = "safe-zones";
  const safeZones = document.createElement("input");
  safeZones.type = "checkbox";
  safeZonesLabel.append(safeZones);
  safeZonesLabel.append(document.createTextNode(" Safe zones"));

  const exportSelect = document.createElement("select");
  exportSelect.dataset.kavioPreviewControl = "export";

  element.replaceChildren(playButton, scrubber, frameOutput, safeZonesLabel, exportSelect);

  return {
    element,
    bind(bindings) {
      scrubber.addEventListener("input", () => bindings.onFrameInput(Number(scrubber.value)));
      playButton.addEventListener("click", () => bindings.onPlayToggle());
      safeZones.addEventListener("change", () => bindings.onSafeZoneToggle(safeZones.checked));
      exportSelect.addEventListener("change", () => {
        const value = exportSelect.value;
        bindings.onExportChange(value === "" ? null : Number(value));
      });
    },
    update(state, exports) {
      playButton.textContent = state.playing ? "Pause" : "Play";
      scrubber.max = String(Math.max(0, state.durationFrames - 1));
      scrubber.value = String(clampFrame(state.frame, state.durationFrames));
      frameOutput.textContent = `${state.frame + 1}/${Math.max(1, state.durationFrames)}`;
      safeZones.checked = state.safeZonesVisible;
      replaceExportOptions(document, exportSelect, exports, state.exportIndex);
    }
  };
}

function replaceExportOptions(
  document: Document,
  select: HTMLSelectElement,
  exports: KavioExportPreset[],
  selectedIndex: number | null
): void {
  const options = exports.map((preset, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${preset.name} (${preset.width}x${preset.height})`;
    option.selected = selectedIndex === index;
    return option;
  });

  select.replaceChildren(...options);
}

function createSafeZoneBox(
  document: Document,
  zone: string,
  width: number,
  height: number,
  scale: number,
  color: string
): HTMLElement {
  const box = document.createElement("div");
  const zoneWidth = Math.round(width * scale);
  const zoneHeight = Math.round(height * scale);
  box.dataset.kavioPreviewSafeZone = zone;
  box.style.position = "absolute";
  box.style.left = `${Math.round((width - zoneWidth) / 2)}px`;
  box.style.top = `${Math.round((height - zoneHeight) / 2)}px`;
  box.style.width = `${zoneWidth}px`;
  box.style.height = `${zoneHeight}px`;
  box.style.border = `1px dashed ${color}`;
  box.style.boxSizing = "border-box";
  return box;
}

function removePreviewSafeZones(root: HTMLElement): void {
  for (const overlay of root.querySelectorAll<HTMLElement>("[data-kavio-preview-safe-zones='true']")) {
    overlay.remove();
  }
}

function getPreviewRoot(options: BrowserPreviewControllerOptions): HTMLElement {
  if (options.root) {
    return options.root;
  }

  return getRenderRoot(withDefinedOptions<BrowserRendererOptions>({ document: options.document }));
}

function findPreviewExportIndex(exports: KavioExportPreset[], selection: BrowserPreviewExportSelection): number | null {
  if (selection === null || selection === undefined) {
    return null;
  }

  if (typeof selection === "number") {
    if (!Number.isInteger(selection) || selection < 0 || selection >= exports.length) {
      throw new Error(`Unknown export preset index "${selection}".`);
    }
    return selection;
  }

  const index = exports.findIndex((preset) => preset.name === selection);
  if (index < 0) {
    throw new Error(`Unknown export preset "${selection}".`);
  }
  return index;
}

function applyPreviewLayerOverride(layer: KavioLayer, override: KavioLayerOverride | undefined): KavioLayer {
  if (!override) {
    return layer;
  }

  return {
    ...layer,
    ...cloneJson(override),
    id: layer.id,
    type: layer.type
  } as KavioLayer;
}

function assertPreviewLoaded<T>(value: T | undefined): asserts value is T {
  if (!value) {
    throw new Error("No preview composition loaded.");
  }
}

function clampFrame(frame: number, durationFrames: number): number {
  if (durationFrames <= 0) {
    return 0;
  }

  if (!Number.isFinite(frame)) {
    return 0;
  }

  return Math.min(Math.max(0, Math.trunc(frame)), durationFrames - 1);
}

function emptyCompositionResources(): CompositionResources {
  return {
    ready: Promise.resolve(),
    fontFaces: []
  };
}

function prepareCompositionResources(composition: KavioDocument, options: BrowserRendererOptions): CompositionResources {
  const document = getOptionalRuntimeDocument(options);
  if (!document) {
    return emptyCompositionResources();
  }

  const fontFaces: FontFace[] = [];
  const ready = Promise.all([loadFontAssets(document, composition, fontFaces), preloadImageAssets(document, composition)]).then(
    () => undefined
  );

  return {
    ready,
    fontFaces,
    document
  };
}

function releaseCompositionResources(resources: CompositionResources): void {
  const fonts = resources.document?.fonts;
  if (!fonts) {
    return;
  }

  for (const face of resources.fontFaces) {
    fonts.delete(face);
  }
}

async function loadFontAssets(document: Document, composition: KavioDocument, fontFaces: FontFace[]): Promise<void> {
  const fontAssets = Object.values(composition.assets).filter((asset): asset is KavioFontAsset => asset.type === "font");
  if (fontAssets.length === 0) {
    await waitForDocumentFonts(document);
    return;
  }

  const fonts = document.fonts;
  const FontFaceConstructor = getFontFaceConstructor(document);
  if (!fonts || !FontFaceConstructor) {
    throw new Error("Font assets require the CSS Font Loading API to avoid silent system fallback.");
  }

  await Promise.all(
    fontAssets.map(async (asset) => {
      const face = new FontFaceConstructor(asset.family, `url("${escapeCssString(asset.src)}")`, fontDescriptors(asset));
      fonts.add(face);
      fontFaces.push(face);
      await face.load();
    })
  );
  await fonts.ready;
}

function getFontFaceConstructor(document: Document): typeof FontFace | undefined {
  return document.defaultView?.FontFace ?? (typeof FontFace === "undefined" ? undefined : FontFace);
}

function fontDescriptors(asset: KavioFontAsset): FontFaceDescriptors {
  const descriptors: FontFaceDescriptors = {};
  if (asset.weight !== undefined) {
    descriptors.weight = String(asset.weight);
  }
  if (asset.style !== undefined) {
    descriptors.style = asset.style;
  }
  return descriptors;
}

async function preloadImageAssets(document: Document, composition: KavioDocument): Promise<void> {
  await Promise.all(
    Object.entries(composition.assets)
      .filter((entry): entry is [string, KavioImageAsset] => entry[1].type === "image")
      .map(([assetId, asset]) => decodeImageSource(document, asset.src, `image asset "${assetId}"`))
  );
}

async function applyImageContent(
  document: Document,
  element: HTMLElement,
  composition: KavioDocument,
  layer: Extract<KavioLayer, { type: "image" }>
): Promise<RenderedContent> {
  const asset = composition.assets[layer.asset];
  if (!asset || asset.type !== "image") {
    throw new Error(`Image layer "${layer.id}" references missing image asset "${layer.asset}".`);
  }

  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "sync";
  image.draggable = false;
  image.src = asset.src;
  applyMediaPlaceholderContent(element, layer.asset, layer.fit);
  applyImageFit(image, layer.fit ?? "cover");
  element.replaceChildren(image);
  await decodeImageElement(image, `image asset "${layer.asset}"`);

  return {
    intrinsicSize: {
      width: image.naturalWidth,
      height: image.naturalHeight
    }
  };
}

function applyVideoContent(
  document: Document,
  element: HTMLElement,
  composition: KavioDocument,
  layer: Extract<KavioLayer, { type: "video" }>,
  evaluation: EvaluatedLayer
): RenderedContent {
  const asset = composition.assets[layer.asset];
  if (!asset || asset.type !== "video") {
    throw new Error(`Video layer "${layer.id}" references missing video asset "${layer.asset}".`);
  }

  const video = document.createElement("video");
  video.src = asset.src;
  video.muted = layer.muted ?? true;
  video.loop = asset.loop ?? false;
  video.preload = "auto";
  video.playsInline = true;
  video.dataset.kavioMediaType = "video";

  applyMediaPlaceholderContent(element, layer.asset, layer.fit);
  applyMediaFit(video, layer.fit ?? "cover");
  applyVideoCropPreview(element, video, layer.crop, evaluation.localFrame);
  element.replaceChildren(video);

  return {};
}

function applyMediaPlaceholderContent(
  element: HTMLElement,
  assetId: string,
  fit: Extract<KavioLayer, { type: "image" | "video" }>["fit"]
): void {
  element.dataset.kavioAsset = assetId;
  element.dataset.kavioFit = fit ?? "cover";
  element.style.overflow = "hidden";
}

function applyImageFit(image: HTMLImageElement, fit: NonNullable<Extract<KavioLayer, { type: "image" }>["fit"]>): void {
  applyMediaFit(image, fit);
}

function applyMediaFit(media: HTMLImageElement | HTMLVideoElement, fit: NonNullable<Extract<KavioLayer, { type: "image" | "video" }>["fit"]>): void {
  media.style.display = "block";
  media.style.width = "100%";
  media.style.height = "100%";
  media.style.objectFit = fit;
  media.style.objectPosition = "center center";
  media.style.pointerEvents = "none";
  media.style.userSelect = "none";
}

function applyVideoCropPreview(
  element: HTMLElement,
  video: HTMLVideoElement,
  crop: KavioVideoCrop | undefined,
  localFrame: number
): void {
  if (crop?.mode !== "subject") {
    element.dataset.kavioCropMode = crop?.mode ?? "center";
    return;
  }

  const focus = evaluateSubjectCropFocus(crop, localFrame);
  const xPercent = `${formatPercent(focus.x)}%`;
  const yPercent = `${formatPercent(focus.y)}%`;
  element.dataset.kavioCropMode = "subject";
  element.dataset.kavioSubjectX = formatUnit(focus.x);
  element.dataset.kavioSubjectY = formatUnit(focus.y);
  video.style.objectPosition = `${xPercent} ${yPercent}`;
}

function evaluateSubjectCropFocus(crop: Extract<KavioVideoCrop, { mode: "subject" }>, localFrame: number): { x: number; y: number } {
  const keyframes = [...(crop.keyframes ?? [])].sort((a, b) => a.frame - b.frame);
  if (keyframes.length === 0) {
    return {
      x: clampUnit(crop.x ?? 0.5),
      y: clampUnit(crop.y ?? 0.5)
    };
  }

  const first = keyframes[0]!;
  if (localFrame <= first.frame) {
    return { x: clampUnit(first.x), y: clampUnit(first.y) };
  }

  for (let index = 1; index < keyframes.length; index += 1) {
    const next = keyframes[index]!;
    if (localFrame <= next.frame) {
      const previous = keyframes[index - 1]!;
      const span = next.frame - previous.frame;
      const t = span <= 0 ? 1 : (localFrame - previous.frame) / span;
      return {
        x: clampUnit(lerp(previous.x, next.x, t)),
        y: clampUnit(lerp(previous.y, next.y, t))
      };
    }
  }

  const last = keyframes[keyframes.length - 1]!;
  return { x: clampUnit(last.x), y: clampUnit(last.y) };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

function formatUnit(value: number): string {
  return String(Number(value.toFixed(4)));
}

function formatPercent(value: number): string {
  return String(Number((value * 100).toFixed(4)));
}

async function decodeImageSource(document: Document, src: string, label: string): Promise<void> {
  const image = document.createElement("img");
  image.decoding = "sync";
  image.src = src;
  await decodeImageElement(image, label);
}

async function decodeImageElement(image: HTMLImageElement, label: string): Promise<void> {
  try {
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await waitForImageLoad(image);
    }
  } catch (error) {
    if (!image.complete || image.naturalWidth <= 0) {
      throw new Error(`Failed to decode ${label}.`, { cause: error });
    }
  }

  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error(`Failed to decode ${label}.`);
  }
}

function waitForImageLoad(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("Image load failed.")), { once: true });
  });
}

function applyCaptionContent(
  document: Document,
  element: HTMLElement,
  layer: KavioCaptionLayer,
  caption: EvaluatedCaptionState | undefined,
  dimensions: CanvasDimensions
): void {
  applyTextStyle(element, layer.style);
  applyCaptionLayout(element, layer, dimensions);

  if (!caption?.visible) {
    element.textContent = "";
    element.dataset.kavioCaptionVisible = "false";
    return;
  }

  element.dataset.kavioCaptionVisible = "true";
  element.dataset.kavioCaptionCueIndex = String(caption.cueIndex ?? "");
  element.dataset.kavioCaptionHighlightMode = caption.highlightMode;

  if (caption.highlightMode === "word" && caption.words.length > 0) {
    renderCaptionWords(document, element, caption, layer.style);
    return;
  }

  const text = wrapCaptionText(caption.lineText, layer.style);
  if (caption.highlightMode === "line") {
    const highlight = document.createElement("span");
    highlight.textContent = text;
    applyCaptionHighlightStyle(highlight, layer.style);
    element.replaceChildren(highlight);
    return;
  }

  element.textContent = text;
}

function applyCaptionLayout(element: HTMLElement, layer: KavioCaptionLayer, dimensions: CanvasDimensions): void {
  const style = layer.style;
  if (style?.maxCharsPerLine && style.maxCharsPerLine > 0) {
    element.style.maxWidth = `${style.maxCharsPerLine}ch`;
  }

  if (usesCaptionSafeArea(layer) && layer.size?.width === undefined) {
    element.style.width = `${Math.round(dimensions.width * 0.86)}px`;
  }
}

function renderCaptionWords(
  document: Document,
  element: HTMLElement,
  caption: EvaluatedCaptionState,
  style: KavioCaptionStyle | undefined
): void {
  const nodes: Node[] = [];
  caption.words.forEach((word, index) => {
    if (index > 0) {
      nodes.push(document.createTextNode(" "));
    }

    const span = document.createElement("span");
    span.textContent = word.text;
    span.dataset.kavioCaptionWordIndex = String(word.index);
    span.dataset.kavioCaptionWordState = word.state;
    if (word.active) {
      span.dataset.kavioCaptionWordActive = "true";
      applyCaptionHighlightStyle(span, style);
    }
    nodes.push(span);
  });

  element.replaceChildren(...nodes);
}

function applyCaptionHighlightStyle(element: HTMLElement, style: KavioCaptionStyle | undefined): void {
  const highlight = style?.highlight;
  element.style.color = highlight?.color ?? style?.color ?? "currentColor";
  if (highlight?.scale !== undefined && highlight.scale !== 1) {
    element.style.display = "inline-block";
    element.style.transform = `scale(${highlight.scale})`;
    element.style.transformOrigin = "center";
  }
}

function wrapCaptionText(text: string, style: KavioCaptionStyle | undefined): string {
  const maxChars = style?.maxCharsPerLine;
  const maxLines = style?.maxLines;
  const sourceLines = text.split(/\r\n?|\n/);
  const lines =
    maxChars && maxChars > 0
      ? sourceLines.flatMap((line) => wrapCaptionLine(line, maxChars))
      : sourceLines;

  return maxLines && maxLines > 0 ? lines.slice(0, maxLines).join("\n") : lines.join("\n");
}

function wrapCaptionLine(line: string, maxChars: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length <= maxChars || current.length === 0) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function applyEvaluatedSize(element: HTMLElement, evaluation: EvaluatedLayer): void {
  if (evaluation.size.width !== null) {
    element.style.width = `${evaluation.size.width}px`;
  }

  if (evaluation.size.height !== null) {
    element.style.height = `${evaluation.size.height}px`;
  }
}

function resolveRenderedSize(evaluation: EvaluatedLayer, intrinsicSize: Size | undefined): EvaluatedLayer["size"] {
  if (!intrinsicSize || intrinsicSize.width <= 0 || intrinsicSize.height <= 0) {
    return evaluation.size;
  }

  if (evaluation.size.width !== null && evaluation.size.height !== null) {
    return evaluation.size;
  }

  if (evaluation.size.width !== null) {
    return {
      width: evaluation.size.width,
      height: (intrinsicSize.height / intrinsicSize.width) * evaluation.size.width
    };
  }

  if (evaluation.size.height !== null) {
    return {
      width: (intrinsicSize.width / intrinsicSize.height) * evaluation.size.height,
      height: evaluation.size.height
    };
  }

  return intrinsicSize;
}

function applyRenderedSize(
  element: HTMLElement,
  evaluation: EvaluatedLayer,
  renderedSize: EvaluatedLayer["size"]
): void {
  if (evaluation.size.width === null && renderedSize.width !== null) {
    element.style.width = `${renderedSize.width}px`;
  }

  if (evaluation.size.height === null && renderedSize.height !== null) {
    element.style.height = `${renderedSize.height}px`;
  }
}

function applyLayerTransform(
  element: HTMLElement,
  layer: KavioLayer,
  evaluation: EvaluatedLayer,
  dimensions: CanvasDimensions
): void {
  if (layer.type === "caption" && usesCaptionSafeArea(layer)) {
    const placement = resolveCaptionSafeAreaPlacement(layer, dimensions);
    element.style.left = `${placement.position.x}px`;
    element.style.top = `${placement.position.y}px`;
    element.style.transformOrigin = `${placement.anchor.x * 100}% ${placement.anchor.y * 100}%`;
    element.style.transform = [
      `translate(${-placement.anchor.x * 100}%, ${-placement.anchor.y * 100}%)`,
      `rotate(${evaluation.rotation}deg)`,
      `scale(${evaluation.scale})`
    ].join(" ");
    return;
  }

  element.style.transformOrigin = `${evaluation.anchor.x * 100}% ${evaluation.anchor.y * 100}%`;
  element.style.transform = [
    `translate(${-evaluation.anchor.x * 100}%, ${-evaluation.anchor.y * 100}%)`,
    `rotate(${evaluation.rotation}deg)`,
    `scale(${evaluation.scale})`
  ].join(" ");
}

function usesCaptionSafeArea(layer: KavioCaptionLayer): boolean {
  return layer.position === undefined && layer.anchor === undefined;
}

function resolveCaptionSafeAreaPlacement(
  layer: KavioCaptionLayer,
  dimensions: CanvasDimensions
): { position: { x: number; y: number }; anchor: { x: number; y: number } } {
  const safeArea = layer.safeArea ?? "bottom";
  if (typeof safeArea === "object") {
    return {
      position: resolvePoint(safeArea, dimensions),
      anchor: { x: 0.5, y: 0.5 }
    };
  }

  const inset = Math.round(dimensions.height * 0.08);
  switch (safeArea) {
    case "top":
      return {
        position: { x: dimensions.width / 2, y: inset },
        anchor: { x: 0.5, y: 0 }
      };
    case "center":
      return {
        position: { x: dimensions.width / 2, y: dimensions.height / 2 },
        anchor: { x: 0.5, y: 0.5 }
      };
    case "bottom":
    default:
      return {
        position: { x: dimensions.width / 2, y: dimensions.height - inset },
        anchor: { x: 0.5, y: 1 }
      };
  }
}

async function waitForDocumentFonts(document: Document): Promise<void> {
  if (document.fonts) {
    await document.fonts.ready;
  }
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ");
}

function getRenderRoot(options: BrowserRendererOptions): HTMLElement {
  if (options.root) {
    return options.root;
  }

  const document = getRuntimeDocument(options.document);
  const existingRoot = document.querySelector<HTMLElement>("[data-kavio-runtime-root='true']");
  if (existingRoot) {
    return existingRoot;
  }

  if (!document.body) {
    throw new Error("Browser renderer requires a document body or an explicit root element.");
  }

  const root = document.createElement("div");
  root.dataset.kavioRuntimeRoot = "true";
  document.body.append(root);
  return root;
}

function getLoadedComposition(composition: KavioDocument): LoadedComposition {
  const dimensions = getCanvasDimensions(composition.composition);
  return {
    width: dimensions.width,
    height: dimensions.height,
    fps: composition.composition.fps,
    durationFrames: composition.composition.durationFrames
  };
}

function assertRenderableFrame(frame: number, composition: KavioDocument): void {
  if (!Number.isInteger(frame) || frame < 0) {
    throw new Error("Frame must be a non-negative integer.");
  }

  if (frame >= composition.composition.durationFrames) {
    throw new Error("Frame must be less than composition.durationFrames.");
  }
}

function cloneComposition(composition: KavioDocument): KavioDocument {
  return cloneJson(composition);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withDefinedOptions<T extends object>(options: Partial<{ [K in keyof T]: T[K] | undefined }>): T {
  const defined: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      defined[key] = value;
    }
  }

  return defined as T;
}

function getOptionalRuntimeDocument(options: BrowserRendererOptions): Document | undefined {
  if (options.root) {
    return options.root.ownerDocument;
  }

  if (options.document) {
    return options.document;
  }

  return typeof document === "undefined" ? undefined : document;
}

function getRuntimeHost(documentOverride: Document | undefined): Window {
  const defaultView = getRuntimeDocument(documentOverride).defaultView;
  if (defaultView) {
    return defaultView;
  }

  if (typeof window === "undefined") {
    throw new Error("Browser renderer runtime installation requires a Window.");
  }

  return window;
}

function getRuntimeDocument(documentOverride: Document | undefined): Document {
  if (documentOverride) {
    return documentOverride;
  }

  if (typeof document === "undefined") {
    throw new Error("Browser renderer requires a DOM document.");
  }

  return document;
}
