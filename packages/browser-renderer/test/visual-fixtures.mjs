#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserRenderer } from "../dist/index.js";

const UPDATE_FLAG = "--update-visual-fixtures";
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = resolve(__dirname, "../../../examples/visual-fixtures/fixed-frame");
const framesPath = resolve(fixtureDirectory, "frames.json");
const expectedPath = resolve(fixtureDirectory, "browser-renderer.dom-snapshot.json");

const styleProperties = [
  "position",
  "boxSizing",
  "left",
  "top",
  "opacity",
  "zIndex",
  "width",
  "height",
  "maxWidth",
  "overflow",
  "overflowWrap",
  "background",
  "backgroundColor",
  "border",
  "borderRadius",
  "transform",
  "transformOrigin",
  "whiteSpace",
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "padding",
  "display",
  "textShadow",
  "objectFit",
  "objectPosition",
  "pointerEvents",
  "userSelect"
];

class FakeStyle {
  constructor() {
    Object.defineProperty(this, "customProperties", {
      enumerable: false,
      value: new Map()
    });
  }

  setProperty(name, value) {
    this.customProperties.set(name, value);
  }

  getPropertyValue(name) {
    return this.customProperties.get(name) ?? "";
  }
}

class FakeTextNode {
  constructor(textContent) {
    this.nodeType = 3;
    this.textContent = textContent;
  }
}

class FakeElement {
  #textContent = "";

  constructor(ownerDocument, tagName) {
    this.nodeType = 1;
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.style = new FakeStyle();
    this.children = [];
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map((child) => child.textContent).join("");
    }

    return this.#textContent;
  }

  set textContent(value) {
    this.#textContent = String(value);
    this.children.splice(0, this.children.length);
  }

  append(...children) {
    this.#textContent = "";
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.#textContent = "";
    this.children.splice(0, this.children.length, ...children);
  }
}

class FakeImageElement extends FakeElement {
  constructor(ownerDocument) {
    super(ownerDocument, "img");
    this.alt = "";
    this.decoding = "auto";
    this.draggable = true;
    this.complete = true;
    this.naturalWidth = 320;
    this.naturalHeight = 160;
    this.src = "";
  }

  async decode() {
    return undefined;
  }
}

class FakeFontFaceSet {
  constructor() {
    this.ready = Promise.resolve(this);
  }

  add(face) {
    return face;
  }

  delete() {
    return true;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement(this, "body");
    this.fonts = new FakeFontFaceSet();
    this.defaultView = {};
  }

  createElement(tagName) {
    return tagName.toLowerCase() === "img" ? new FakeImageElement(this) : new FakeElement(this, tagName);
  }

  createTextNode(text) {
    return new FakeTextNode(text);
  }

  querySelector(selector) {
    if (selector !== "[data-kavio-runtime-root='true']") {
      return null;
    }

    return findElement(this.body, (element) => element.dataset.kavioRuntimeRoot === "true");
  }
}

const updateExpected = process.argv.includes(UPDATE_FLAG);
const frameSpec = await readJson(framesPath);
const compositionPath = resolve(fixtureDirectory, frameSpec.composition);
const composition = await readJson(compositionPath);
const actual = await renderFixtureSnapshot(frameSpec, composition);
const actualJson = stableJson(actual);

if (updateExpected) {
  await writeFile(expectedPath, actualJson);
  console.log(`Updated visual fixture snapshot: ${expectedPath}`);
} else {
  const expectedJson = await readFile(expectedPath, "utf8");
  if (actualJson !== expectedJson) {
    throw new Error(formatSnapshotMismatch(expectedJson, actualJson));
  }

  console.log(`Visual fixture snapshot matched ${frameSpec.frames.length} fixed frames.`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function renderFixtureSnapshot(spec, document) {
  const fakeDocument = new FakeDocument();
  const renderer = createBrowserRenderer({ document: fakeDocument });
  const loaded = await renderer.loadComposition(document);
  await renderer.ready;

  const frames = [];
  for (const frameNumber of spec.frames) {
    const renderedFrame = await renderer.renderFrame(frameNumber);
    frames.push(snapshotFrame(renderedFrame, fakeDocument));
  }

  return {
    name: spec.name,
    description: spec.description,
    composition: {
      width: loaded.width,
      height: loaded.height,
      fps: loaded.fps,
      durationFrames: loaded.durationFrames,
      background: document.composition.background ?? "transparent"
    },
    frames
  };
}

function snapshotFrame(frame, fakeDocument) {
  const stage = getCurrentStage(fakeDocument);

  return {
    frame: frame.frame,
    width: frame.width,
    height: frame.height,
    stage: snapshotElement(stage),
    layers: frame.layers.map((layer) => ({
      id: layer.id,
      type: layer.type,
      localFrame: layer.localFrame,
      evaluation: normalizeValue(layer.evaluation),
      element: snapshotElement(layer.element)
    }))
  };
}

function getCurrentStage(fakeDocument) {
  const root = findElement(fakeDocument.body, (element) => element.dataset.kavioRuntimeRoot === "true");
  const stage = root?.children.find((child) => child instanceof FakeElement && child.dataset.kavioStage === "true");
  if (!(stage instanceof FakeElement)) {
    throw new Error("Expected the fake document to contain a rendered Kavio stage.");
  }

  return stage;
}

function snapshotElement(element) {
  if (element instanceof FakeTextNode) {
    return {
      nodeType: "text",
      textContent: element.textContent
    };
  }

  return {
    nodeType: "element",
    tagName: element.tagName.toLowerCase(),
    dataset: sortObject(element.dataset),
    style: snapshotStyle(element.style),
    textContent: element.textContent,
    children: element.children.map((child) => snapshotElement(child))
  };
}

function snapshotStyle(style) {
  const properties = {};
  for (const property of styleProperties) {
    const value = style[property];
    if (value !== undefined && value !== "") {
      properties[property] = value;
    }
  }

  for (const [property, value] of [...style.customProperties.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (value !== "") {
      properties[property] = value;
    }
  }

  return properties;
}

function findElement(element, predicate) {
  if (predicate(element)) {
    return element;
  }

  for (const child of element.children) {
    if (child instanceof FakeElement) {
      const match = findElement(child, predicate);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function normalizeValue(value) {
  if (typeof value === "number") {
    return normalizeNumber(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return sortObject(
      Object.fromEntries(
        Object.entries(value)
          .filter(([, entryValue]) => entryValue !== undefined)
          .map(([key, entryValue]) => [key, normalizeValue(entryValue)])
      )
    );
  }

  return value;
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Object.is(value, -0) ? 0 : Math.round(value * 1_000_000) / 1_000_000;
}

function stableJson(value) {
  return `${JSON.stringify(sortObject(value), null, 2)}\n`;
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortObject(entryValue)])
    );
  }

  return value;
}

function formatSnapshotMismatch(expectedJson, actualJson) {
  const expectedLines = expectedJson.split("\n");
  const actualLines = actualJson.split("\n");
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  for (let index = 0; index < maxLines; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return [
        "Visual fixture snapshot did not match.",
        `First differing line: ${index + 1}`,
        `Expected: ${expectedLines[index] ?? "<missing>"}`,
        `Actual:   ${actualLines[index] ?? "<missing>"}`,
        `Regenerate intentionally with: node packages/browser-renderer/test/visual-fixtures.mjs ${UPDATE_FLAG}`
      ].join("\n");
    }
  }

  return "Visual fixture snapshot did not match.";
}
