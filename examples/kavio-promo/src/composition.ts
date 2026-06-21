import {
  asset,
  exportPreset,
  image,
  keyframes,
  shape,
  text,
  validate,
  video,
  type AuthorValue,
  type KeyframeInput,
  type LayerBuilder
} from "@kitsra/kavio-builder";
import type { KavioDocument } from "@kitsra/kavio-schema";
import type { PromoCopy, PromoFeature } from "./copy.js";

const width = 1080;
const height = 1920;
const fps = 30;
const durationFrames = 810;

const colors = {
  ink: "#0d120f",
  panel: "#f4efdc",
  panelSoft: "#dfe7d4",
  moss: "#26382a",
  green: "#5f8d69",
  teal: "#68c3c8",
  amber: "#d9a441",
  coral: "#d76b55",
  white: "#ffffff",
  muted: "#b7c2b0",
  black: "#101410"
} as const;

const logoLockup = asset.image("kavioLogo", absoluteAsset("../../../site/assets/brand/kavio-frame-stack-lockup.png"));
const logoIcon = asset.image("kavioIcon", absoluteAsset("../../../site/assets/brand/kavio-frame-stack-icon.png"));
const siteHome = asset.image("siteHome", absoluteAsset("../assets/screenshots/home.png"));
const siteDocs = asset.image("siteDocs", absoluteAsset("../assets/screenshots/docs.png"));
const sitePackages = asset.image("sitePackages", absoluteAsset("../assets/screenshots/packages.png"));

export const sceneTimings = [
  { label: "Logo reveal", startFrame: 0, endFrame: 90, start: "00:00.0", end: "00:03.0" },
  { label: "Problem and promise", startFrame: 90, endFrame: 210, start: "00:03.0", end: "00:07.0" },
  { label: "Feature cards", startFrame: 210, endFrame: 510, start: "00:07.0", end: "00:17.0" },
  { label: "Mobile website proof", startFrame: 516, endFrame: 682, start: "00:17.2", end: "00:22.7" },
  { label: "Idea to final video", startFrame: 690, endFrame: 750, start: "00:23.0", end: "00:25.0" },
  { label: "Call to action", startFrame: 750, endFrame: 810, start: "00:25.0", end: "00:27.0" }
] as const;

export function buildPromoComposition(copy: PromoCopy): KavioDocument {
  const layers: LayerBuilder[] = [];
  const add = (...items: LayerBuilder[]): void => {
    layers.push(...items);
  };

  addBackground(layers);

  // Scene timing map:
  // 000-090: logo reveal
  // 090-210: problem and promise
  // 210-510: five sourced feature cards, held for readability
  // 516-682: local mobile website proof screenshots, one card at a time
  // 690-750: idea -> timeline -> final video positioning
  // 750-810: final call to action
  addLogoReveal(add, copy);
  addProblemPromise(add);
  copy.features.slice(0, 5).forEach((feature, index) => {
    addFeatureCard(add, feature, index, 210 + index * 60);
  });
  addWebsiteProof(add, copy);
  addFinalPositioning(add);
  addCallToAction(add, copy);

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
        title: "Kavio Instagram Reels promo",
        purpose: "Self-promo reel generated with the Kavio render pipeline.",
        tags: ["promo", "instagram-reels", "dogfood"]
      }
    }
  )
    .assets(logoLockup, logoIcon, siteHome, siteDocs, sitePackages)
    .add(...layers)
    .exports(
      exportPreset.instagramReels({
        name: "kavio-instagram-reel-source",
        fps,
        background: colors.ink,
        crf: 18
      })
    )
    .toJSON();

  const result = validate(composition);
  if (!result.ok) {
    throw new Error(`Promo composition is invalid:\n${result.errors.map((error) => `${error.path}: ${error.message}`).join("\n")}`);
  }

  return composition;
}

function addBackground(layers: LayerBuilder[]): void {
  layers.push(
    shape("background", {
      startFrame: 0,
      durationFrames,
      x: 0,
      y: 0,
      width,
      height,
      fill: colors.ink,
      z: 0
    }),
    shape("deep-panel", {
      startFrame: 0,
      durationFrames,
      x: 66,
      y: 156,
      width: 948,
      height: 1510,
      fill: "#111913",
      radius: 34,
      opacity: 0.72,
      z: 1
    }),
    shape("top-band", {
      startFrame: 0,
      durationFrames,
      x: -120,
      y: 138,
      width: 1320,
      height: 18,
      fill: colors.green,
      opacity: 0.5,
      rotation: -5,
      z: 1
    }),
    shape("bottom-band", {
      startFrame: 0,
      durationFrames,
      x: -120,
      y: 1664,
      width: 1320,
      height: 18,
      fill: colors.coral,
      opacity: 0.5,
      rotation: -5,
      z: 1
    }),
    text("ambient-code-a", {
      text: '"composition": { "fps": 30, "durationFrames": 810 }',
      startFrame: 0,
      durationFrames,
      x: 94,
      y: 1710,
      width: 890,
      opacity: 0.18,
      z: 2,
      style: mono(25, colors.muted, "left")
    }).animate(
      "y",
      keyframes([
        [0, 1710],
        [durationFrames - 1, 1690]
      ])
    ),
    text("ambient-code-b", {
      text: 'render({ preset: "instagram-reels-9x16" })',
      startFrame: 0,
      durationFrames,
      x: 94,
      y: 1760,
      width: 890,
      opacity: 0.14,
      z: 2,
      style: mono(25, colors.muted, "left")
    })
  );
}

function addLogoReveal(add: (...items: LayerBuilder[]) => void, copy: PromoCopy): void {
  const start = 0;
  const duration = 90;
  add(
    fade(
      image("intro-logo", {
        asset: logoIcon,
        startFrame: start,
        durationFrames: duration,
        x: 540,
        y: 610,
        width: 280,
        height: 280,
        anchor: "center",
        fit: "contain",
        z: 10
      }).animate(
        "scale",
        keyframes([
          [0, 0.86, "outCubic"],
          [26, 1],
          [duration - 1, 1.02]
        ])
      ),
      duration,
      1,
      16,
      16
    ),
    fade(
      text("intro-title", {
        text: copy.title,
        startFrame: start + 12,
        durationFrames: duration - 12,
        x: 540,
        y: 900,
        width: 840,
        anchor: "center",
        z: 11,
        style: headline(96, colors.white, "center")
      }),
      duration - 12,
      1,
      12,
      12
    ),
    fade(
      text("intro-subtitle", {
        text: copy.subtitle,
        startFrame: start + 25,
        durationFrames: duration - 25,
        x: 540,
        y: 1028,
        width: 760,
        anchor: "center",
        z: 11,
        style: body(40, colors.panelSoft, "center")
      }),
      duration - 25,
      1,
      12,
      12
    ),
    fade(
      shape("intro-accent", {
        startFrame: start + 34,
        durationFrames: duration - 34,
        x: 365,
        y: 1086,
        width: 350,
        height: 8,
        radius: 8,
        fill: colors.amber,
        z: 11
      }),
      duration - 34,
      1,
      8,
      12
    )
  );
}

function addProblemPromise(add: (...items: LayerBuilder[]) => void): void {
  const start = 90;
  const duration = 120;
  add(
    fade(
      text("promise-one", {
        text: "Create videos with code",
        startFrame: start,
        durationFrames: duration,
        x: 94,
        y: 330,
        width: 900,
        z: 15,
        style: headline(78, colors.white, "left")
      }).animate(
        "y",
        keyframes([
          [0, 365, "outCubic"],
          [20, 330],
          [duration - 1, 318]
        ])
      ),
      duration,
      1,
      12,
      14
    ),
    fade(
      text("promise-two", {
        text: "Automate edits\nBuild repeatable workflows",
        startFrame: start + 28,
        durationFrames: duration - 28,
        x: 94,
        y: 520,
        width: 860,
        z: 15,
        style: body(48, colors.panelSoft, "left")
      }),
      duration - 28,
      1,
      12,
      14
    ),
    ...codeBlock("promise-code-a", start + 12, 88, 900, [
      "const reel = video({ width: 1080, height: 1920 })",
      "  .add(text(\"headline\", { startFrame: 24 }))",
      "  .exports(exportPreset.instagramReels());"
    ]),
    ...timelineBlock("promise-timeline", start + 44, 76, 1030)
  );
}

function addFeatureCard(
  add: (...items: LayerBuilder[]) => void,
  feature: PromoFeature,
  index: number,
  start: number
): void {
  const duration = 60;
  const accent = [colors.teal, colors.amber, colors.coral, colors.green][index % 4] ?? colors.teal;
  const cardX = 90;
  const cardY = 506;
  const cardW = 900;
  const cardH = 480;

  add(
    fade(
      shape(`feature-card-${index}`, {
        startFrame: start,
        durationFrames: duration,
        x: cardX,
        y: cardY,
        width: cardW,
        height: cardH,
        fill: colors.panel,
        radius: 22,
        z: 20
      }).animate(
        "x",
        keyframes([
          [0, cardX + 58, "outCubic"],
          [16, cardX],
          [duration - 1, cardX - 18]
        ])
      ),
      duration,
      1,
      8,
      8
    ),
    fade(
      shape(`feature-accent-${index}`, {
        startFrame: start,
        durationFrames: duration,
        x: cardX,
        y: cardY,
        width: 18,
        height: cardH,
        fill: accent,
        radius: 18,
        z: 21
      }),
      duration,
      1,
      8,
      8
    ),
    fade(
      text(`feature-index-${index}`, {
        text: `0${index + 1}`,
        startFrame: start,
        durationFrames: duration,
        x: cardX + 60,
        y: cardY + 62,
        width: 160,
        z: 22,
        style: mono(34, colors.green, "left")
      }),
      duration,
      1,
      8,
      8
    ),
    fade(
      text(`feature-headline-${index}`, {
        text: feature.headline,
        startFrame: start + 4,
        durationFrames: duration - 4,
        x: cardX + 60,
        y: cardY + 150,
        width: 760,
        z: 22,
        style: headline(64, colors.black, "left")
      }),
      duration - 4,
      1,
      8,
      8
    ),
    fade(
      text(`feature-line-${index}`, {
        text: feature.line,
        startFrame: start + 10,
        durationFrames: duration - 10,
        x: cardX + 60,
        y: cardY + 268,
        width: 760,
        z: 22,
        style: body(36, colors.moss, "left")
      }),
      duration - 10,
      1,
      8,
      8
    ),
    fade(
      text(`feature-source-${index}`, {
        text: feature.source,
        startFrame: start + 16,
        durationFrames: duration - 16,
        x: cardX + 60,
        y: cardY + 398,
        width: 760,
        z: 22,
        style: mono(24, colors.green, "left")
      }),
      duration - 16,
      0.82,
      8,
      8
    )
  );
}

function addWebsiteProof(add: (...items: LayerBuilder[]) => void, copy: PromoCopy): void {
  const start = 516;
  add(
    fade(
      text("proof-title", {
        text: "Proof from the repo",
        startFrame: start,
        durationFrames: 166,
        x: 94,
        y: 260,
        width: 890,
        z: 25,
        style: headline(70, colors.white, "left")
      }),
      166,
      1,
      12,
      18
    ),
    ...proofShot("proof-home", siteHome.id, copy.proofLabels[0] ?? "Kavio site", 522, 305, 520, colors.teal, 54),
    ...proofShot("proof-docs", siteDocs.id, copy.proofLabels[1] ?? "Docs", 576, 305, 520, colors.amber, 54),
    ...proofShot("proof-packages", sitePackages.id, copy.proofLabels[2] ?? "Packages", 630, 305, 520, colors.coral, 54)
  );
}

function addFinalPositioning(add: (...items: LayerBuilder[]) => void): void {
  const words = [
    { text: "From idea", y: 360 },
    { text: "to timeline", y: 540 },
    { text: "to final video", y: 720 },
    { text: "all programmable", y: 900 }
  ] as const;

  words.forEach((word, index) => {
    add(
      fade(
        text(`positioning-${index}`, {
          text: word.text,
          startFrame: 690 + index * 15,
          durationFrames: 60 - index * 4,
          x: 540,
          y: word.y,
          width: 860,
          anchor: "center",
          z: 32,
          style: headline(index === 3 ? 70 : 76, index === 3 ? colors.amber : colors.white, "center")
        }).animate(
          "scale",
          keyframes([
            [0, 0.94, "outCubic"],
            [14, 1],
            [52 - index * 4, 1.02]
          ])
        ),
        60 - index * 4,
        1,
        10,
        14
      )
    );
  });

  add(
    ...timelineBlock("final-timeline", 704, 40, 1195),
    fade(
      image("final-icon", {
        asset: logoIcon,
        startFrame: 710,
        durationFrames: 36,
        x: 540,
        y: 1430,
        width: 210,
        height: 210,
        anchor: "center",
        fit: "contain",
        z: 34
      }).animate(
        "rotation",
        keyframes([
          [0, -4, "outCubic"],
          [18, 0],
          [35, 4]
        ])
      ),
      36,
      1,
      12,
      12
    )
  );
}

function addCallToAction(add: (...items: LayerBuilder[]) => void, copy: PromoCopy): void {
  const start = 750;
  const duration = 60;
  add(
    fade(
      image("cta-logo", {
        asset: logoIcon,
        startFrame: start,
        durationFrames: duration,
        x: 540,
        y: 455,
        width: 300,
        height: 300,
        anchor: "center",
        fit: "contain",
        z: 40
      }),
      duration,
      1,
      10,
      0
    ),
    fade(
      text("cta-title", {
        text: "Build with Kavio",
        startFrame: start + 8,
        durationFrames: duration - 8,
        x: 540,
        y: 800,
        width: 860,
        anchor: "center",
        z: 41,
        style: headline(82, colors.white, "center")
      }),
      duration - 8,
      1,
      10,
      0
    ),
    fade(
      text("cta-url", {
        text: copy.repoUrl,
        startFrame: start + 18,
        durationFrames: duration - 18,
        x: 540,
        y: 920,
        width: 860,
        anchor: "center",
        z: 41,
        style: mono(34, colors.panelSoft, "center")
      }),
      duration - 18,
      1,
      10,
      0
    ),
    fade(
      text("cta-subtitle", {
        text: "Programmable video editing for developers",
        startFrame: start + 26,
        durationFrames: duration - 26,
        x: 540,
        y: 1160,
        width: 760,
        anchor: "center",
        z: 41,
        style: body(38, colors.muted, "center")
      }),
      duration - 26,
      1,
      8,
      0
    )
  );
}

function codeBlock(id: string, startFrame: number, duration: number, y: number, lines: readonly string[]): LayerBuilder[] {
  const group = shape(`${id}-panel`, {
    startFrame,
    durationFrames: duration,
    x: 94,
    y,
    width: 892,
    height: 300,
    fill: "#0f1712",
    stroke: { color: "#36513c", width: 2 },
    radius: 20,
    z: 16
  });
  fade(group, duration, 1, 10, 12);

  const codeLayers = lines.map((line, index) =>
    fade(
      text(`${id}-line-${index}`, {
        text: line,
        startFrame: startFrame + 8 + index * 9,
        durationFrames: duration - 8 - index * 9,
        x: 136,
        y: y + 66 + index * 62,
        width: 810,
        z: 17,
        style: mono(28, index === 1 ? colors.amber : colors.panelSoft, "left")
      }),
      duration - 8 - index * 9,
      1,
      8,
      10
    )
  );

  return [group, ...codeLayers];
}

function timelineBlock(id: string, startFrame: number, duration: number, y: number): LayerBuilder[] {
  const layers = [
    fade(
      shape(`${id}-panel`, {
        startFrame,
        durationFrames: duration,
        x: 118,
        y,
        width: 844,
        height: 260,
        fill: colors.panel,
        radius: 24,
        z: 18
      }),
      duration,
      1,
      10,
      12
    )
  ];

  const rows = [
    { label: "video", color: colors.teal, x: 278, w: 568 },
    { label: "headline", color: colors.amber, x: 330, w: 310 },
    { label: "exports", color: colors.coral, x: 278, w: 176 }
  ] as const;

  rows.forEach((row, index) => {
    const rowY = y + 62 + index * 58;
    const barDuration = duration - 8 - index * 5;
    const holdFrame = Math.max(19, barDuration - 1);
    layers.push(
      fade(
        text(`${id}-label-${index}`, {
          text: row.label,
          startFrame,
          durationFrames: duration,
          x: 158,
          y: rowY - 8,
          width: 120,
          z: 19,
          style: mono(24, colors.moss, "left")
        }),
        duration,
        1,
        8,
        10
      ),
      fade(
        shape(`${id}-track-${index}`, {
          startFrame,
          durationFrames: duration,
          x: 278,
          y: rowY,
          width: 600,
          height: 16,
          fill: "#cfd8c4",
          radius: 12,
          z: 19
        }),
        duration,
        1,
        8,
        10
      ),
      fade(
        shape(`${id}-bar-${index}`, {
          startFrame: startFrame + 8 + index * 5,
          durationFrames: barDuration,
          x: row.x,
          y: rowY - 7,
          width: row.w,
          height: 30,
          fill: row.color,
          radius: 16,
          z: 20
        }).animate(
          "scale",
          keyframes([
            [0, 0.84, "outCubic"],
            [18, 1],
            [holdFrame, 1]
          ])
        ),
        barDuration,
        1,
        8,
        10
      )
    );
  });

  return layers;
}

function proofShot(
  id: string,
  assetId: string,
  label: string,
  startFrame: number,
  x: number,
  y: number,
  accent: string,
  duration: number
): LayerBuilder[] {
  const cardW = 470;
  const cardH = 820;
  const layers = [
    fade(
      shape(`${id}-shadow`, {
        startFrame,
        durationFrames: duration,
        x: x + 16,
        y: y + 16,
        width: cardW,
        height: cardH,
        fill: "#000000",
        radius: 26,
        opacity: 0.32,
        z: 26
      }),
      duration,
      0.32,
      10,
      14
    ),
    fade(
      shape(`${id}-frame`, {
        startFrame,
        durationFrames: duration,
        x,
        y,
        width: cardW,
        height: cardH,
        fill: colors.panel,
        radius: 26,
        z: 27
      }).animate(
        "x",
        keyframes([
          [0, x + 62, "outCubic"],
          [18, x],
          [duration - 1, x - 18]
        ])
      ),
      duration,
      1,
      10,
      14
    ),
    fade(
      shape(`${id}-accent`, {
        startFrame,
        durationFrames: duration,
        x: x + 26,
        y: y + 28,
        width: 120,
        height: 10,
        fill: accent,
        radius: 10,
        z: 28
      }),
      duration,
      1,
      10,
      14
    ),
    fade(
      image(`${id}-image`, {
        asset: assetId,
        startFrame: startFrame + 4,
        durationFrames: duration - 4,
        x: x + 26,
        y: y + 62,
        width: cardW - 52,
        height: 620,
        fit: "cover",
        z: 28
      }),
      duration - 4,
      1,
      10,
      14
    ),
    fade(
      text(`${id}-label`, {
        text: label,
        startFrame: startFrame + 12,
        durationFrames: duration - 12,
        x: x + 34,
        y: y + 708,
        width: cardW - 68,
        z: 29,
        style: body(30, colors.moss, "left")
      }),
      duration - 12,
      1,
      8,
      12
    )
  ];

  return layers;
}

function fade(layer: LayerBuilder, duration: number, target = 1, inFrames = 10, outFrames = 10): LayerBuilder {
  const last = Math.max(1, duration - 1);
  const inEnd = Math.min(last, Math.max(1, inFrames));
  const outStart = outFrames <= 0 ? last : Math.max(inEnd + 1, last - outFrames);
  const frames: KeyframeInput[] =
    outFrames <= 0
      ? [
          [0, 0, "outCubic"],
          [inEnd, target]
        ]
      : [
          [0, 0, "outCubic"],
          [inEnd, target],
          [outStart, target],
          [last, 0]
        ];
  return layer.animate("opacity", keyframes(frames));
}

function headline(fontSize: number, color: string, align: "left" | "center"): Record<string, AuthorValue> {
  return {
    fontFamily: "Arial",
    fontSize,
    fontWeight: 860,
    color,
    align,
    lineHeight: 0.96,
    letterSpacing: 0,
    maxLines: 3,
    wrap: true,
    shadow: { color: "#00000066", x: 0, y: 8, blur: 24 }
  };
}

function body(fontSize: number, color: string, align: "left" | "center"): Record<string, AuthorValue> {
  return {
    fontFamily: "Arial",
    fontSize,
    fontWeight: 650,
    color,
    align,
    lineHeight: 1.16,
    letterSpacing: 0,
    maxLines: 3,
    wrap: true
  };
}

function mono(fontSize: number, color: string, align: "left" | "center"): Record<string, AuthorValue> {
  return {
    fontFamily: "monospace",
    fontSize,
    fontWeight: 700,
    color,
    align,
    lineHeight: 1.18,
    letterSpacing: 0,
    maxLines: 4,
    wrap: true
  };
}

function absoluteAsset(relativePath: string): string {
  return new URL(relativePath, import.meta.url).pathname;
}
