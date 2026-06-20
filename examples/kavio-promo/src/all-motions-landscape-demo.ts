import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  asset,
  camera,
  cinematic,
  exportPreset,
  image,
  shape,
  text,
  textMotion,
  timing,
  track,
  trackClip,
  transition,
  validate,
  video,
  type KeyframeMap,
  type LayerBuilder,
  type TransitionDefinition
} from "@kavio/builder";
import type { KavioDocument } from "@kavio/schema";

const width = 1920;
const height = 1080;
const fps = 30;
const durationFrames = 900;
const outputUrl = new URL("../generated/all-motions-demo-landscape.json", import.meta.url);

const colors = {
  ink: "#0b1020",
  card: "#172034",
  cardAlt: "#142333",
  line: "#2b3658",
  cyan: "#52d6ff",
  mint: "#5ff0b2",
  coral: "#ff7a70",
  yellow: "#ffd66b",
  pink: "#f59bff",
  white: "#f8fbff",
  muted: "#a8b3c7",
  black: "#030712"
} as const;

const logoIcon = asset.image("kavioIcon", absoluteAsset("../../../site/assets/brand/kavio-frame-stack-icon.png"));
const siteHome = asset.image("siteHome", absoluteAsset("../assets/screenshots/home.png"));
const siteDocs = asset.image("siteDocs", absoluteAsset("../assets/screenshots/docs.png"));
const sitePackages = asset.image("sitePackages", absoluteAsset("../assets/screenshots/packages.png"));
const screenshots = [siteHome, siteDocs, sitePackages] as const;
const layers: LayerBuilder[] = [];

const add = (...items: LayerBuilder[]): void => {
  layers.push(...items);
};

const nativeTransitions: Array<{ label: string; transitionIn: TransitionDefinition; color: string }> = [
  { label: "Fade", transitionIn: transition.fade({ durationFrames: 18, easing: "outCubic" }), color: colors.card },
  { label: "Slide", transitionIn: transition.slide({ durationFrames: 18, direction: "left", easing: "outCubic" }), color: "#15334f" },
  { label: "Wipe", transitionIn: transition.wipe({ durationFrames: 18, direction: "right", easing: "outCubic" }), color: "#3a2c62" },
  { label: "Crossfade", transitionIn: transition.crossfade({ durationFrames: 18, easing: "outCubic" }), color: "#253351" },
  { label: "Zoom", transitionIn: transition.zoom({ durationFrames: 18, amount: 0.72, easing: "outBack" }), color: "#214047" },
  { label: "Push", transitionIn: transition.push({ durationFrames: 18, direction: "left", easing: "outCubic" }), color: "#53312f" },
  { label: "Spin", transitionIn: transition.spin({ durationFrames: 18, amount: 0.75, easing: "outCubic" }), color: "#4a3157" },
  { label: "Rotate", transitionIn: transition.rotate({ durationFrames: 18, amount: 48, easing: "outCubic" }), color: "#493b20" },
  { label: "Flip", transitionIn: transition.flip({ durationFrames: 18, axis: "y", easing: "outCubic" }), color: "#2d3d26" },
  { label: "Blur", transitionIn: transition.blurDissolve({ durationFrames: 18, amount: 18, easing: "outCubic" }), color: "#273550" },
  { label: "Color", transitionIn: transition.colorDissolve({ durationFrames: 18, color: colors.white, easing: "outQuad" }), color: "#533339" },
  { label: "Dip", transitionIn: transition.dip({ durationFrames: 18, color: colors.black, easing: "inOutCubic" }), color: "#222938" },
  { label: "Iris", transitionIn: transition.iris({ durationFrames: 18, shape: "circle", easing: "outCubic" }), color: "#254154" },
  { label: "Stretch", transitionIn: transition.stretch({ durationFrames: 18, axis: "x", amount: 1.25, easing: "outCubic" }), color: "#3e344e" },
  { label: "Squeeze", transitionIn: transition.squeeze({ durationFrames: 18, axis: "y", amount: 0.52, easing: "outCubic" }), color: "#453136" },
  { label: "Clock", transitionIn: transition.clockWipe({ durationFrames: 18, easing: "outCubic" }), color: "#2a3d52" },
  { label: "Bars", transitionIn: transition.barWipe({ durationFrames: 18, direction: "up", easing: "outCubic" }), color: "#433d25" },
  { label: "Grid", transitionIn: transition.gridWipe({ durationFrames: 18, easing: "outCubic" }), color: "#293d38" },
  { label: "Tiles", transitionIn: transition.tileReveal({ durationFrames: 18, easing: "outCubic" }), color: "#3a3355" },
  { label: "Radial blur", transitionIn: transition.radialBlur({ durationFrames: 18, intensity: 18, easing: "outCubic" }), color: "#314155" },
  { label: "Zoom blur", transitionIn: transition.zoomBlur({ durationFrames: 18, intensity: 24, easing: "outCubic" }), color: "#253d46" },
  { label: "Book flip", transitionIn: transition.bookFlip({ durationFrames: 18, direction: "left", easing: "outCubic" }), color: "#523b2d" },
  { label: "Page curl", transitionIn: transition.pageCurlLite({ durationFrames: 18, direction: "right", easing: "outCubic" }), color: "#45394f" },
  { label: "Skew slide", transitionIn: transition.skewSlide({ durationFrames: 18, direction: "right", intensity: 16, easing: "outCubic" }), color: "#32404f" },
  { label: "Mask", transitionIn: transition.expandMask({ durationFrames: 18, shape: "diamond", easing: "outCubic" }), color: "#37442b" },
  { label: "Letterbox", transitionIn: transition.letterboxReveal({ durationFrames: 18, amount: 0.22, easing: "outCubic" }), color: "#273345" },
  { label: "Film flash", transitionIn: transition.filmFlash({ durationFrames: 18, color: colors.white, easing: "outQuad" }), color: "#4d3a35" },
  { label: "Whip", transitionIn: transition.cameraWhip({ durationFrames: 18, direction: "left", easing: "inOutCubic" }), color: "#2e3e51" }
];

addIntro();
addNativeTransitions();
addCameraAndText();
addMasksSeriesAndRecipes();
addEndCard();

const composition = video(
  {
    width,
    height,
    fps,
    durationFrames,
    background: colors.ink,
    colorSpace: "srgb"
  },
  {
    metadata: {
      title: "Kavio all motions landscape demo",
      purpose: "Landscape companion render for the Kavio motion system promo.",
      tags: ["promo", "motion", "landscape", "transitions", "cinematic"]
    }
  }
)
  .assets(logoIcon, siteHome, siteDocs, sitePackages)
  .add(...layers)
  .tracks(
    track("landscape-series", [
      trackClip("home", { layerId: "series-home", startFrame: 546, durationFrames: 90 }),
      trackClip("docs", {
        layerId: "series-docs",
        startFrame: 600,
        durationFrames: 90,
        transitionFromPrevious: transition.push({ direction: "left", durationFrames: 24, easing: "outCubic" })
      }),
      trackClip("packages", {
        layerId: "series-packages",
        startFrame: 654,
        durationFrames: 66,
        transitionFromPrevious: transition.filmFlash({ color: colors.white, durationFrames: 20, easing: "outQuad" })
      })
    ])
  )
  .exports(
    exportPreset.landscape({
      name: "kavio-all-motions-landscape",
      fps,
      background: colors.ink,
      crf: 18
    })
  )
  .toJSON() as KavioDocument;

const result = validate(composition);
if (!result.ok) {
  throw new Error(`Landscape demo is invalid:\n${result.errors.map((error) => `${error.path}: ${error.message}`).join("\n")}`);
}

await mkdir(dirname(outputUrl.pathname), { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(composition, null, 2)}\n`);
process.stdout.write(`Wrote ${outputUrl.pathname}\n`);

function absoluteAsset(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function screenshot(index: number): typeof siteHome {
  return screenshots[index % screenshots.length] ?? siteHome;
}

function typeStyle(fontSize: number, color: string, align: "left" | "center" | "right", fontWeight = 700) {
  return {
    fontFamily: "Inter",
    fontSize,
    fontWeight,
    color,
    align,
    lineHeight: 1.08
  };
}

function sectionTitle(id: string, label: string, startFrame: number, duration: number): void {
  add(
    shape(`${id}-bg`, { startFrame, durationFrames: duration, x: 0, y: 0, width, height, fill: colors.ink, z: 0 }),
    text(`${id}-title`, {
      text: label,
      startFrame,
      durationFrames: duration,
      x: 96,
      y: 64,
      width: 1180,
      z: 20,
      style: typeStyle(52, colors.white, "left", 900),
      ...textMotion.rise({ durationFrames: 18 })
    } as never)
  );
}

function addIntro(): void {
  const startFrame = 0;
  const duration = 150;
  add(
    shape("intro-bg", { startFrame, durationFrames: duration, x: 0, y: 0, width, height, fill: colors.ink, z: 0 }),
    shape("intro-top-line", {
      startFrame: startFrame + 8,
      durationFrames: duration - 16,
      x: 96,
      y: 92,
      width: 620,
      height: 8,
      fill: colors.cyan,
      radius: 4,
      z: 2,
      transitionIn: transition.wipe({ direction: "right", durationFrames: 14, easing: "outCubic" })
    }),
    text("intro-kicker", {
      text: "Kavio motion system",
      startFrame: startFrame + 10,
      durationFrames: duration - 20,
      x: 96,
      y: 124,
      width: 660,
      z: 4,
      style: typeStyle(34, colors.white, "left", 900),
      transitionIn: transition.fade({ durationFrames: 12, easing: "outCubic" })
    }),
    image("intro-icon", {
      asset: logoIcon,
      startFrame: startFrame + 10,
      durationFrames: duration - 20,
      x: 304,
      y: 500,
      width: 210,
      height: 210,
      anchor: "center",
      fit: "contain",
      z: 6,
      ...cinematic.logoSting({ durationFrames: 24 })
    }),
    text("intro-headline", {
      text: "Transitions, masks, text motion,\ncamera movement, timing, and cinematic recipes.",
      startFrame: startFrame + 24,
      durationFrames: duration - 34,
      x: 520,
      y: 310,
      width: 1080,
      z: 8,
      style: typeStyle(56, colors.white, "left", 900),
      transitionIn: transition.fade({ durationFrames: 18, easing: "outCubic" })
    } as never),
    text("intro-subtitle", {
      text: "The same JSON-first motion system in a landscape promo format.",
      startFrame: startFrame + 46,
      durationFrames: duration - 56,
      x: 524,
      y: 570,
      width: 940,
      z: 8,
      style: typeStyle(30, colors.muted, "left", 700),
      transitionIn: transition.fade({ durationFrames: 14, easing: "outCubic" })
    })
  );

  ["Native transitions", "Camera", "Masks", "Text motion"].forEach((label, index) => {
    add(
      shape(`intro-chip-${index}`, {
        startFrame: startFrame + 58 + index * 3,
        durationFrames: duration - 68 - index * 3,
        x: 524 + index * 254,
        y: 680,
        width: 210,
        height: 56,
        fill: [colors.cyan, colors.mint, colors.yellow, colors.pink][index],
        radius: 8,
        z: 8,
        transitionIn: transition.zoom({ durationFrames: 12, amount: 0.88, easing: "outBack" })
      }),
      text(`intro-chip-${index}-label`, {
        text: label,
        startFrame: startFrame + 60 + index * 3,
        durationFrames: duration - 70 - index * 3,
        x: 538 + index * 254,
        y: 697,
        width: 182,
        z: 9,
        style: typeStyle(19, colors.black, "center", 900)
      })
    );
  });
}

function addNativeTransitions(): void {
  const startFrame = 150;
  const duration = 180;
  sectionTitle("native", "All native transitions", startFrame, duration);
  nativeTransitions.forEach((item, index) => {
    const x = 94 + (index % 7) * 254;
    const y = 204 + Math.floor(index / 7) * 122;
    const delay = Math.min(index * 2, 24);
    add(
      shape(`native-${index}`, {
        startFrame: startFrame + 12 + delay,
        durationFrames: duration - 20 - delay,
        x,
        y,
        width: 208,
        height: 76,
        fill: item.color,
        stroke: { color: colors.line, width: 2 },
        radius: 8,
        z: 6,
        transitionIn: item.transitionIn
      }),
      text(`native-${index}-label`, {
        text: item.label,
        startFrame: startFrame + 14 + delay,
        durationFrames: duration - 22 - delay,
        x: x + 12,
        y: y + 24,
        width: 184,
        z: 8,
        style: typeStyle(20, colors.white, "center", 900)
      })
    );
  });
}

function addCameraAndText(): void {
  const startFrame = 330;
  const duration = 180;
  sectionTitle("camera-text", "Camera helpers and kinetic type", startFrame, duration);

  const cameraMoveDuration = 138;
  const cameraMoves: Array<{ label: string; frames: (x: number, y: number) => KeyframeMap }> = [
    { label: "Ken Burns", frames: (x, y) => camera.kenBurns({ durationFrames: cameraMoveDuration, restingX: x, restingY: y, amount: 20 }) },
    { label: "Push in", frames: () => camera.pushIn({ durationFrames: cameraMoveDuration, fromScale: 0.92, toScale: 1.14 }) },
    { label: "Pan", frames: (x) => camera.pan({ durationFrames: cameraMoveDuration, fromX: x - 18, toX: x + 18, scale: 1.03 }) },
    { label: "Handheld", frames: (x, y) => camera.handheld({ durationFrames: cameraMoveDuration, restingX: x, restingY: y, amount: 6, seed: 44 }) }
  ];

  cameraMoves.forEach((move, index) => {
    const x = 98 + index * 310;
    const imageX = x + 130;
    const imageY = 380;
    add(
      shape(`camera-${index}-frame`, {
        startFrame: startFrame + 14,
        durationFrames: duration - 34,
        x,
        y: 236,
        width: 260,
        height: 278,
        fill: colors.card,
        stroke: { color: colors.line, width: 2 },
        radius: 8,
        z: 6,
        transitionIn: transition.zoom({ durationFrames: 14, amount: 0.9, easing: "outCubic" })
      }),
      image(`camera-${index}-image`, {
        asset: screenshot(index),
        startFrame: startFrame + 18,
        durationFrames: duration - 42,
        x: imageX,
        y: imageY,
        width: 226,
        height: 134,
        anchor: "center",
        fit: "cover",
        z: 7,
        keyframes: move.frames(imageX, imageY) as never
      }),
      text(`camera-${index}-label`, {
        text: move.label,
        startFrame: startFrame + 20,
        durationFrames: duration - 44,
        x: x + 18,
        y: 470,
        width: 224,
        z: 8,
        style: typeStyle(20, colors.white, "center", 900)
      })
    );
  });

  const textRows = [
    { label: "Type on", options: textMotion.typeOn({ durationFrames: 54 }) },
    { label: "Scramble", options: textMotion.scramble({ durationFrames: 40, seed: 28 }) },
    { label: "Highlight sweep", options: textMotion.highlightSweep({ durationFrames: 48, color: colors.yellow }) },
    { label: "Tracking in", options: textMotion.trackingIn({ durationFrames: 42, amount: 14 }) }
  ];

  textRows.forEach((row, index) => {
    add(
      shape(`text-row-${index}`, {
        startFrame: startFrame + 16 + index * 4,
        durationFrames: duration - 28 - index * 4,
        x: 1390,
        y: 218 + index * 108,
        width: 410,
        height: 72,
        fill: index % 2 === 0 ? colors.card : colors.cardAlt,
        stroke: { color: colors.line, width: 2 },
        radius: 8,
        z: 6
      }),
      text(`text-row-${index}-label`, {
        text: row.label,
        startFrame: startFrame + 18 + index * 4,
        durationFrames: duration - 30 - index * 4,
        x: 1422,
        y: 236 + index * 108,
        width: 350,
        z: 7,
        style: typeStyle(28, colors.white, "left", 900),
        ...row.options
      } as never)
    );
  });
}

function addMasksSeriesAndRecipes(): void {
  const startFrame = 510;
  const duration = 210;
  sectionTitle("masks-series", "Masks, transition series, and cinematic recipes", startFrame, duration);
  const masks = [
    { label: "Shape", source: { kind: "shape", shape: "circle" } },
    { label: "Procedural", source: { kind: "procedural", type: "scanlines", seed: 11, frequency: 14, resolution: { width: 260, height: 160 } } },
    { label: "Asset alpha", source: { kind: "asset", asset: "siteHome", mode: "alpha", resolution: { width: 390, height: 844 } } }
  ];

  masks.forEach((mask, index) => {
    add(
      image(`mask-${index}`, {
        asset: screenshot(index),
        startFrame: startFrame + 12,
        durationFrames: duration - 24,
        x: 96 + index * 300,
        y: 238,
        width: 250,
        height: 250,
        fit: "cover",
        z: 6,
        mask: { source: mask.source },
        transitionIn: transition.expandMask({ durationFrames: 18, shape: index === 1 ? "diamond" : "circle", easing: "outCubic" })
      }),
      text(`mask-${index}-label`, {
        text: mask.label,
        startFrame: startFrame + 18,
        durationFrames: duration - 30,
        x: 96 + index * 300,
        y: 514,
        width: 250,
        z: 8,
        style: typeStyle(20, colors.white, "center", 900)
      })
    );
  });

  add(
    image("series-home", { asset: siteHome, startFrame: startFrame + 36, durationFrames: 90, x: 1030, y: 246, width: 430, height: 242, fit: "cover", z: 6 }),
    image("series-docs", { asset: siteDocs, startFrame: startFrame + 90, durationFrames: 90, x: 1030, y: 246, width: 430, height: 242, fit: "cover", z: 7 }),
    image("series-packages", { asset: sitePackages, startFrame: startFrame + 144, durationFrames: 66, x: 1030, y: 246, width: 430, height: 242, fit: "cover", z: 8 }),
    text("series-caption", {
      text: "trackClip(... transitionFromPrevious)",
      startFrame: startFrame + 36,
      durationFrames: duration - 30,
      x: 1006,
      y: 516,
      width: 480,
      z: 9,
      style: typeStyle(22, colors.muted, "center", 800)
    })
  );

  ["zoomPush", "whipPan", "filmFlash", "dreamyBlur", "glitchCut", "endCard"].forEach((label, index) => {
    add(
      shape(`recipe-${index}`, {
        startFrame: startFrame + 18 + index * 3,
        durationFrames: duration - 30 - index * 3,
        x: 1540,
        y: 206 + index * 64,
        width: 270,
        height: 46,
        fill: index % 2 === 0 ? colors.card : colors.cardAlt,
        stroke: { color: colors.line, width: 2 },
        radius: 8,
        z: 6,
        transitionIn: transition.blurDissolve({ durationFrames: 12, amount: 10, easing: "outCubic" })
      }),
      text(`recipe-${index}-label`, {
        text: label,
        startFrame: startFrame + 20 + index * 3,
        durationFrames: duration - 32 - index * 3,
        x: 1560,
        y: 218 + index * 64,
        width: 230,
        z: 8,
        style: typeStyle(18, colors.white, "center", 900)
      })
    );
  });
}

function addEndCard(): void {
  const startFrame = 720;
  const duration = 180;
  sectionTitle("end", "Ship motion as data", startFrame, duration);
  add(
    image("end-icon", {
      asset: logoIcon,
      startFrame: startFrame + 8,
      durationFrames: duration - 8,
      x: 320,
      y: 424,
      width: 160,
      height: 160,
      anchor: "center",
      fit: "contain",
      z: 8,
      ...cinematic.logoSting({ durationFrames: 22 })
    }),
    text("end-brand", {
      text: "Kavio",
      startFrame: startFrame + 14,
      durationFrames: duration - 14,
      x: 440,
      y: 346,
      width: 420,
      z: 9,
      style: typeStyle(104, colors.white, "left", 900),
      transitionIn: transition.fade({ durationFrames: 16, easing: "outCubic" })
    }),
    text("end-headline", {
      text: "Programmable video, rendered from JSON.",
      startFrame: startFrame + 20,
      durationFrames: duration - 20,
      x: 440,
      y: 480,
      width: 650,
      z: 9,
      style: typeStyle(38, colors.white, "left", 900),
      transitionIn: transition.fade({ durationFrames: 14, easing: "outCubic" })
    }),
    shape("end-code-panel", {
      startFrame: startFrame + 24,
      durationFrames: duration - 24,
      x: 1160,
      y: 270,
      width: 590,
      height: 280,
      fill: colors.card,
      stroke: { color: colors.line, width: 2 },
      radius: 8,
      z: 7,
      transitionIn: transition.zoom({ durationFrames: 14, amount: 0.92, easing: "outCubic" })
    }),
    text("end-code", {
      text: 'transition.push({ direction: "left" })\ntextMotion.scramble({ seed: 42 })\ntrackClip("scene-b", { transitionFromPrevious })',
      startFrame: startFrame + 30,
      durationFrames: duration - 30,
      x: 1204,
      y: 326,
      width: 502,
      z: 8,
      style: typeStyle(21, colors.mint, "left", 800),
      transitionIn: transition.slide({ direction: "up", durationFrames: 12, easing: "outCubic" })
    }),
    text("end-cta", {
      text: "github.com/Kitsra/Kavio",
      startFrame: startFrame + 34,
      durationFrames: duration - 34,
      x: 440,
      y: 610,
      width: 640,
      z: 9,
      style: typeStyle(30, colors.yellow, "left", 900),
      transitionIn: transition.fade({ durationFrames: 12, easing: "outCubic" })
    })
  );
}
