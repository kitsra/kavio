import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  asset,
  camera,
  cinematic,
  exportPreset,
  image,
  keyframes,
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
} from "@kitsra/kavio-builder";
import type { KavioDocument } from "@kitsra/kavio-schema";

const width = 1080;
const height = 1920;
const fps = 30;
const durationFrames = 1080;
const outputUrl = new URL("../generated/all-motions-demo.json", import.meta.url);

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
const logoLockup = asset.image("kavioLockup", absoluteAsset("../../../site/assets/brand/kavio-frame-stack-lockup.png"));
const siteHome = asset.image("siteHome", absoluteAsset("../assets/screenshots/home.png"));
const siteDocs = asset.image("siteDocs", absoluteAsset("../assets/screenshots/docs.png"));
const sitePackages = asset.image("sitePackages", absoluteAsset("../assets/screenshots/packages.png"));
const screenshots = [siteHome, siteDocs, sitePackages] as const;

const layers: LayerBuilder[] = [];
const add = (...items: LayerBuilder[]): void => {
  layers.push(...items);
};

function absoluteAsset(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function screenshot(index: number): typeof siteHome {
  return screenshots[index % screenshots.length] ?? siteHome;
}

function sectionBackplate(id: string, title: string, startFrame: number, duration: number): void {
  add(
    shape(`${id}-backplate`, {
      startFrame,
      durationFrames: duration,
      x: 0,
      y: 0,
      width,
      height,
      fill: colors.ink,
      z: 0
    }),
    text(`${id}-title`, {
      text: title,
      startFrame,
      durationFrames: duration,
      x: 88,
      y: 92,
      width: 904,
      z: 30,
      style: typeStyle(46, colors.white, "left", 800),
      ...textMotion.rise({ durationFrames: 22, easing: "outCubic" })
    } as never)
  );
}

function gridPosition(index: number, columns: number, originX: number, originY: number, cellWidth: number, cellHeight: number) {
  return {
    x: originX + (index % columns) * cellWidth,
    y: originY + Math.floor(index / columns) * cellHeight
  };
}

function motionCard(
  id: string,
  label: string,
  startFrame: number,
  duration: number,
  x: number,
  y: number,
  transitionIn: TransitionDefinition,
  color: string
): void {
  const delay = Math.min((Number(id.match(/\d+$/)?.[0] ?? 0) % 10) * 2, 18);
  add(
    shape(`${id}-card`, {
      startFrame: startFrame + delay,
      durationFrames: duration - delay,
      x,
      y,
      width: 252,
      height: 124,
      fill: color,
      radius: 8,
      opacity: 0.9,
      z: 8,
      transitionIn,
      transitionOut: transition.fade({ durationFrames: 10, easing: "inCubic" })
    }),
    shape(`${id}-edge`, {
      startFrame: startFrame + delay,
      durationFrames: duration - delay,
      x,
      y,
      width: 252,
      height: 124,
      fill: "transparent",
      stroke: { color: colors.line, width: 2 },
      radius: 8,
      z: 9
    }),
    text(`${id}-label`, {
      text: label,
      startFrame: startFrame + delay,
      durationFrames: duration - delay,
      x: x + 22,
      y: y + 38,
      width: 208,
      z: 10,
      style: typeStyle(28, colors.white, "center", 800),
      transitionIn: transition.blurDissolve({ durationFrames: 12, amount: 8, easing: "outCubic" })
    })
  );
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

function addNativeSection(id: string, title: string, items: typeof nativeTransitions, startFrame: number): void {
  sectionBackplate(id, title, startFrame, 120);
  items.forEach((item, index) => {
    const { x, y } = gridPosition(index, 3, 116, 300, 300, 185);
    motionCard(`${id}-${index}`, item.label, startFrame + 12, 96, x, y, item.transitionIn, item.color);
  });
}

function addIntro(): void {
  sectionBackplate("intro", "Kavio motion system", 0, 90);
  add(
    image("intro-icon", {
      asset: logoIcon,
      startFrame: 4,
      durationFrames: 82,
      x: 540,
      y: 485,
      width: 300,
      height: 300,
      anchor: "center",
      fit: "contain",
      z: 8,
      ...cinematic.logoSting({ durationFrames: 28 })
    }),
    text("intro-copy", {
      text: "Native transitions, text motion, camera movement, masks, timing, and cinematic recipes in one vertical promo.",
      startFrame: 18,
      durationFrames: 68,
      x: 540,
      y: 760,
      width: 820,
      anchor: "center",
      z: 10,
      style: typeStyle(42, colors.white, "center", 800),
      ...textMotion.blurIn({ durationFrames: 28, amount: 12 })
    } as never),
    shape("intro-line", {
      startFrame: 38,
      durationFrames: 44,
      x: 260,
      y: 1000,
      width: 560,
      height: 6,
      fill: colors.cyan,
      radius: 3,
      z: 9,
      keyframes: {
        scale: keyframes([
          [0, 0.001, "outCubic"],
          [24, 1]
        ]),
        opacity: keyframes([
          [0, 0.4, "outCubic"],
          [24, 1]
        ])
      } as never
    })
  );
}

function addCameraSection(): void {
  const startFrame = 450;
  const duration = 150;
  sectionBackplate("camera", "Cinematic camera helpers", startFrame, duration);

  const cameraMoveDuration = 116;
  const cameraMoves: Array<{ label: string; frames: (x: number, y: number) => KeyframeMap }> = [
    { label: "Ken Burns", frames: (x, y) => camera.kenBurns({ durationFrames: cameraMoveDuration, fromScale: 1, toScale: 1.18, restingX: x, restingY: y, amount: 24 }) },
    { label: "Push in", frames: () => camera.pushIn({ durationFrames: cameraMoveDuration, fromScale: 0.92, toScale: 1.14 }) },
    { label: "Pull back", frames: () => camera.pullBack({ durationFrames: cameraMoveDuration, fromScale: 1.18, toScale: 0.96 }) },
    { label: "Pan", frames: (x) => camera.pan({ durationFrames: cameraMoveDuration, fromX: x - 18, toX: x + 18, scale: 1.03 }) },
    { label: "Tilt", frames: (_x, y) => camera.tilt({ durationFrames: cameraMoveDuration, fromY: y - 14, toY: y + 14, scale: 1.03 }) },
    { label: "Parallax", frames: (x, y) => camera.parallax({ durationFrames: cameraMoveDuration, restingX: x, restingY: y, amount: 24 }) },
    { label: "Orbit", frames: (x, y) => camera.orbitLite({ durationFrames: cameraMoveDuration, restingX: x, restingY: y, amount: 20, verticalAmount: 10 }) },
    { label: "Handheld", frames: (x, y) => camera.handheld({ durationFrames: cameraMoveDuration, restingX: x, restingY: y, amount: 6, seed: 24 }) },
    { label: "Crash zoom", frames: () => camera.crashZoom({ durationFrames: cameraMoveDuration, fromScale: 0.92, overshootScale: 1.32, toScale: 1.05 }) },
    { label: "Dolly zoom", frames: (x, y) => camera.dollyZoomLite({ durationFrames: cameraMoveDuration, restingX: x, restingY: y, fromScale: 1, toScale: 1.16, amount: 20 }) }
  ];

  cameraMoves.forEach((move, index) => {
    const { x, y } = gridPosition(index, 2, 124, 270, 430, 245);
    const imageX = x + 170;
    const imageY = y + 79;
    add(
      shape(`camera-${index}-frame`, {
        startFrame: startFrame + 12,
        durationFrames: duration - 24,
        x,
        y,
        width: 340,
        height: 190,
        fill: colors.card,
        radius: 8,
        stroke: { color: colors.line, width: 2 },
        z: 8,
        transitionIn: transition.zoom({ durationFrames: 16, amount: 0.9, easing: "outCubic" })
      }),
      image(`camera-${index}-image`, {
        asset: screenshot(index),
        startFrame: startFrame + 16,
        durationFrames: duration - 34,
        x: imageX,
        y: imageY,
        width: 312,
        height: 130,
        anchor: "center",
        z: 9,
        fit: "cover",
        keyframes: move.frames(imageX, imageY) as never
      }),
      text(`camera-${index}-label`, {
        text: move.label,
        startFrame: startFrame + 18,
        durationFrames: duration - 36,
        x: x + 18,
        y: y + 148,
        width: 304,
        z: 10,
        style: typeStyle(24, colors.white, "center", 800)
      })
    );
  });
}

function addTextMotionSection(): void {
  const startFrame = 600;
  sectionBackplate("text-motion", "Text motion presets", startFrame, 120);

  const textRows = [
    { label: "Rise", options: textMotion.rise({ durationFrames: 22 }) },
    { label: "Blur in", options: textMotion.blurIn({ durationFrames: 22, amount: 16 }) },
    { label: "Type on", options: textMotion.typeOn({ durationFrames: 60 }) },
    { label: "Cascade", options: textMotion.cascade({ durationFrames: 44, staggerFrames: 4 }) },
    { label: "Scramble", options: textMotion.scramble({ durationFrames: 44, seed: 12 }) },
    { label: "Highlight sweep", options: textMotion.highlightSweep({ durationFrames: 54, color: colors.yellow }) },
    { label: "Tracking in", options: textMotion.trackingIn({ durationFrames: 42, amount: 18 }) }
  ];

  textRows.forEach((row, index) => {
    add(
      shape(`text-motion-${index}-rail`, {
        startFrame: startFrame + index * 4 + 12,
        durationFrames: 92 - index * 4,
        x: 112,
        y: 288 + index * 182,
        width: 856,
        height: 112,
        fill: index % 2 === 0 ? colors.card : colors.cardAlt,
        radius: 8,
        stroke: { color: colors.line, width: 2 },
        z: 7
      }),
      text(`text-motion-${index}`, {
        text: row.label,
        startFrame: startFrame + index * 4 + 14,
        durationFrames: 90 - index * 4,
        x: 158,
        y: 316 + index * 182,
        width: 764,
        z: 10,
        style: typeStyle(42, colors.white, "left", 800),
        ...row.options
      } as never)
    );
  });
}

function addMasksAndTimingSection(): void {
  const startFrame = 720;
  const duration = 120;
  sectionBackplate("masks", "Masks and timing primitives", startFrame, duration);

  const masks = [
    { label: "Shape mask", source: { kind: "shape", shape: "circle" } },
    { label: "Procedural mask", source: { kind: "procedural", type: "scanlines", seed: 22, frequency: 14, resolution: { width: 250, height: 340 } } },
    { label: "Asset alpha mask", source: { kind: "asset", asset: "siteHome", mode: "alpha", resolution: { width: 390, height: 844 } } }
  ];

  masks.forEach((maskConfig, index) => {
    const { x, y } = gridPosition(index, 3, 94, 295, 330, 0);
    add(
      image(`mask-${index}-image`, {
        asset: screenshot(index),
        startFrame: startFrame + 12,
        durationFrames: duration - 24,
        x,
        y,
        width: 280,
        height: 470,
        fit: "cover",
        z: 8,
        mask: { source: maskConfig.source },
        transitionIn: transition.expandMask({ durationFrames: 22, shape: index === 1 ? "diamond" : "circle", easing: "outCubic" })
      }),
      text(`mask-${index}-label`, {
        text: maskConfig.label,
        startFrame: startFrame + 16,
        durationFrames: duration - 28,
        x,
        y: y + 492,
        width: 280,
        z: 10,
        style: typeStyle(24, colors.white, "center", 800)
      })
    );
  });

  const timingChips = [
    { label: "Tween", transitionIn: transition.fade({ durationFrames: 16, timing: timing.tween({ durationFrames: 16, easing: "outQuad" }) }) },
    { label: "Spring", transitionIn: transition.zoom({ durationFrames: 18, timing: timing.spring({ durationFrames: 18, stiffness: 220, damping: 22 }) }) },
    { label: "Steps", transitionIn: transition.slide({ durationFrames: 18, direction: "up", timing: timing.steps({ durationFrames: 18, steps: 5 }) }) },
    {
      label: "Sequence",
      transitionIn: transition.blurDissolve({
        durationFrames: 18,
        timing: timing.sequence([{ durationFrames: 9, timing: timing.tween({ easing: "inQuad" }) }, { durationFrames: 9, timing: timing.tween({ easing: "outCubic" }) }])
      })
    },
    { label: "Stagger", transitionIn: transition.wipe({ durationFrames: 18, direction: "right", timing: timing.stagger({ childCount: 5, childIndex: 2, eachFrames: 3, from: "center", timing: timing.tween({ easing: "outCubic" }) }) }) }
  ];

  timingChips.forEach((chip, index) => {
    const { x, y } = gridPosition(index, 5, 90, 1072, 180, 0);
    add(
      shape(`timing-${index}-chip`, {
        startFrame: startFrame + 16 + index * 3,
        durationFrames: duration - 28 - index * 3,
        x,
        y,
        width: 150,
        height: 78,
        fill: [colors.cyan, colors.mint, colors.coral, colors.yellow, colors.pink][index],
        radius: 8,
        z: 9,
        transitionIn: chip.transitionIn
      }),
      text(`timing-${index}-label`, {
        text: chip.label,
        startFrame: startFrame + 18 + index * 3,
        durationFrames: duration - 30 - index * 3,
        x: x + 8,
        y: y + 22,
        width: 134,
        z: 10,
        style: typeStyle(20, colors.black, "center", 800)
      })
    );
  });
}

function addSeriesAndCinematicSection(): void {
  const startFrame = 840;
  const duration = 180;
  sectionBackplate("series", "Transition series and cinematic recipes", startFrame, duration);

  add(
    image("series-home", {
      asset: siteHome,
      startFrame: startFrame + 12,
      durationFrames: 74,
      x: 152,
      y: 276,
      width: 776,
      height: 438,
      fit: "cover",
      z: 8,
      transitionIn: transition.zoom({ durationFrames: 18, amount: 0.9, easing: "outCubic" })
    }),
    image("series-docs", {
      asset: siteDocs,
      startFrame: startFrame + 48,
      durationFrames: 74,
      x: 152,
      y: 276,
      width: 776,
      height: 438,
      fit: "cover",
      z: 9
    }),
    image("series-packages", {
      asset: sitePackages,
      startFrame: startFrame + 92,
      durationFrames: 74,
      x: 152,
      y: 276,
      width: 776,
      height: 438,
      fit: "cover",
      z: 10,
      transitionOut: transition.dip({ durationFrames: 16, color: colors.black, easing: "inOutCubic" })
    }),
      text("series-label", {
      text: "Track-aware transitions keep clips timed without visual collisions.",
      startFrame: startFrame + 18,
      durationFrames: duration - 36,
      x: 156,
      y: 740,
      width: 768,
      z: 12,
      style: typeStyle(28, colors.muted, "center", 700),
      ...textMotion.rise({ durationFrames: 18 })
    } as never)
  );

  const recipes = [
    { label: "zoomPush", preset: cinematic.zoomPush({ durationFrames: 14 }) },
    { label: "whipPan", preset: cinematic.whipPan({ durationFrames: 14 }) },
    { label: "filmFlash", preset: cinematic.filmFlash({ durationFrames: 14, color: colors.white }) },
    { label: "dreamyBlur", preset: cinematic.dreamyBlur({ durationFrames: 14 }) },
    { label: "broadcastDip", preset: cinematic.broadcastDip({ durationFrames: 14, color: colors.black }) },
    { label: "irisOpen", preset: cinematic.irisOpen({ durationFrames: 14 }) },
    { label: "flipCard", preset: cinematic.flipCard({ durationFrames: 14 }) },
    { label: "glitchCut", preset: cinematic.glitchCut({ durationFrames: 14 }) },
    { label: "lightLeak", preset: cinematic.lightLeak({ durationFrames: 14, color: colors.yellow }) },
    { label: "kenBurns", preset: cinematic.kenBurns({ durationFrames: 40 }) },
    { label: "logoSting", preset: cinematic.logoSting({ durationFrames: 14 }) },
    { label: "productReveal", preset: cinematic.productReveal({ durationFrames: 14 }) },
    { label: "socialHook", preset: cinematic.socialHook({ durationFrames: 14 }) },
    { label: "titleSequence", preset: cinematic.titleSequence({ durationFrames: 14 }) },
    { label: "endCard", preset: cinematic.endCard({ durationFrames: 14 }) }
  ];

  recipes.forEach((recipe, index) => {
    const { x, y } = gridPosition(index, 3, 104, 870, 300, 126);
    const chipOptions: Record<string, unknown> = {
      startFrame: startFrame + 34 + index * 2,
      durationFrames: duration - 48 - index * 2,
      x,
      y,
      width: 260,
      height: 78,
      fill: index % 2 === 0 ? colors.card : colors.cardAlt,
      radius: 8,
      stroke: { color: colors.line, width: 2 },
      z: 9,
      transitionIn: recipe.preset.transitionIn ?? transition.fade({ durationFrames: 14, easing: "outCubic" })
    };
    if (recipe.preset.transitionOut !== undefined) {
      chipOptions.transitionOut = recipe.preset.transitionOut;
    }

    add(
      shape(`recipe-${index}-chip`, chipOptions as never),
      text(`recipe-${index}-label`, {
        text: recipe.label,
        startFrame: startFrame + 36 + index * 2,
        durationFrames: duration - 50 - index * 2,
        x: x + 18,
        y: y + 22,
        width: 224,
        z: 10,
        style: typeStyle(22, colors.white, "center", 800)
      })
    );
  });
}

function addEndCard(): void {
  const startFrame = 1020;
  const duration = 60;
  const chips = ["Transitions", "Masks", "Text motion", "Camera", "Timing", "Cinematic"];
  const codeLines = [
    'video({ width: 1080, height: 1920 })',
    '.add(text("hook", { ...textMotion.scramble() }))',
    '.tracks(track("main", clips))',
    '.exports(exportPreset.instagramReels())'
  ];

  add(
    shape("end-backplate", {
      startFrame,
      durationFrames: duration,
      x: 0,
      y: 0,
      width,
      height,
      fill: colors.ink,
      z: 0
    }),
    shape("end-accent-cyan", {
      startFrame: startFrame + 4,
      durationFrames: duration - 4,
      x: 118,
      y: 236,
      width: 844,
      height: 8,
      fill: colors.cyan,
      radius: 4,
      z: 2,
      transitionIn: transition.wipe({ direction: "right", durationFrames: 16, easing: "outCubic" })
    }),
    shape("end-accent-coral", {
      startFrame: startFrame + 8,
      durationFrames: duration - 8,
      x: 208,
      y: 254,
      width: 664,
      height: 8,
      fill: colors.coral,
      radius: 4,
      z: 2,
      transitionIn: transition.wipe({ direction: "left", durationFrames: 16, easing: "outCubic" })
    }),
    image("end-icon", {
      asset: logoIcon,
      startFrame: startFrame + 6,
      durationFrames: duration - 6,
      x: 540,
      y: 390,
      width: 148,
      height: 148,
      anchor: "center",
      fit: "contain",
      z: 8,
      ...cinematic.logoSting({ durationFrames: 22 })
    }),
    text("end-brand", {
      text: "Kavio",
      startFrame: startFrame + 12,
      durationFrames: duration - 12,
      x: 540,
      y: 498,
      width: 720,
      anchor: "center",
      z: 9,
      style: typeStyle(116, colors.white, "center", 900),
      transitionIn: transition.fade({ durationFrames: 16, easing: "outCubic" })
    }),
    text("end-headline", {
      text: "Programmable video, rendered from JSON.",
      startFrame: startFrame + 18,
      durationFrames: duration - 18,
      x: 540,
      y: 660,
      width: 840,
      anchor: "center",
      z: 9,
      style: typeStyle(42, colors.white, "center", 800),
      transitionIn: transition.fade({ durationFrames: 14, easing: "outCubic" })
    }),
    text("end-subcopy", {
      text: "Author transitions, masks, camera moves, text motion, and render-ready exports as data.",
      startFrame: startFrame + 22,
      durationFrames: duration - 22,
      x: 540,
      y: 735,
      width: 800,
      anchor: "center",
      z: 9,
      style: typeStyle(28, colors.muted, "center", 700),
      transitionIn: transition.fade({ durationFrames: 12, easing: "outCubic" })
    }),
    shape("end-code-panel", {
      startFrame: startFrame + 26,
      durationFrames: duration - 26,
      x: 130,
      y: 1040,
      width: 820,
      height: 280,
      fill: colors.card,
      stroke: { color: colors.line, width: 2 },
      radius: 8,
      z: 7,
      transitionIn: transition.zoom({ durationFrames: 14, amount: 0.92, easing: "outCubic" })
    }),
    text("end-cta", {
      text: "github.com/Kitsra/Kavio",
      startFrame: startFrame + 34,
      durationFrames: duration - 34,
      x: 540,
      y: 1440,
      width: 760,
      anchor: "center",
      z: 10,
      style: typeStyle(34, colors.yellow, "center", 900),
      transitionIn: transition.fade({ durationFrames: 12, easing: "outCubic" })
    })
  );

  chips.forEach((label, index) => {
    const x = 150 + (index % 3) * 265;
    const y = 840 + Math.floor(index / 3) * 96;
    add(
      shape(`end-chip-${index}`, {
        startFrame: startFrame + 24 + index * 2,
        durationFrames: duration - 24 - index * 2,
        x,
        y,
        width: 220,
        height: 58,
        fill: [colors.cyan, colors.mint, colors.pink, colors.coral, colors.yellow, colors.cardAlt][index],
        radius: 8,
        z: 8,
        transitionIn: transition.zoom({ durationFrames: 12, amount: 0.82, easing: "outBack" })
      }),
      text(`end-chip-label-${index}`, {
        text: label,
        startFrame: startFrame + 26 + index * 2,
        durationFrames: duration - 26 - index * 2,
        x: x + 14,
        y: y + 16,
        width: 192,
        z: 9,
        style: typeStyle(20, index === 5 ? colors.white : colors.black, "center", 900)
      })
    );
  });

  codeLines.forEach((line, index) => {
    add(
      text(`end-code-line-${index}`, {
        text: line,
        startFrame: startFrame + 30 + index * 3,
        durationFrames: duration - 30 - index * 3,
        x: 178,
        y: 1084 + index * 54,
        width: 724,
        z: 10,
        style: {
          fontFamily: "Inter",
          fontSize: 25,
          fontWeight: 700,
          color: index === 0 ? colors.mint : index === 1 ? colors.yellow : colors.white,
          align: "left",
          lineHeight: 1.12
        },
        transitionIn: transition.slide({ direction: "up", durationFrames: 10, easing: "outCubic" })
      })
    );
  });
}

addIntro();
addNativeSection("native-a", "Native transitions: dissolve and movement", nativeTransitions.slice(0, 10), 90);
addNativeSection("native-b", "Native transitions: shape and distortion", nativeTransitions.slice(10, 19), 210);
addNativeSection("native-c", "Native transitions: cinematic wipes", nativeTransitions.slice(19), 330);
addCameraSection();
addTextMotionSection();
addMasksAndTimingSection();
addSeriesAndCinematicSection();
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
      title: "Kavio all motions promo demo",
      purpose: "Vertical self-promo demo covering native transitions, camera helpers, text motion, masks, timing, and cinematic recipes.",
      tags: ["promo", "motion", "transitions", "cinematic", "instagram-reels"]
    }
  }
)
  .assets(logoIcon, logoLockup, siteHome, siteDocs, sitePackages)
  .add(...layers)
  .tracks(
    track("website-series", [
      trackClip("home", { layerId: "series-home", startFrame: 852, durationFrames: 74 }),
      trackClip("docs", {
        layerId: "series-docs",
        startFrame: 888,
        durationFrames: 74,
        transitionFromPrevious: transition.push({ direction: "left", durationFrames: 18, easing: "outCubic" })
      }),
      trackClip("packages", {
        layerId: "series-packages",
        startFrame: 932,
        durationFrames: 74,
        transitionFromPrevious: transition.filmFlash({ color: colors.white, durationFrames: 16, easing: "outQuad" })
      })
    ])
  )
  .exports(
    exportPreset.instagramReels({
      name: "kavio-all-motions-demo",
      fps,
      background: colors.ink,
      crf: 18
    })
  )
  .toJSON() as KavioDocument;

const result = validate(composition);
if (!result.ok) {
  throw new Error(`All motions demo is invalid:\n${result.errors.map((error) => `${error.path}: ${error.message}`).join("\n")}`);
}

await mkdir(dirname(outputUrl.pathname), { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(composition, null, 2)}\n`);
process.stdout.write(`Wrote ${outputUrl.pathname}\n`);
