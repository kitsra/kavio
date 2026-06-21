import { asset, clip, crop, exportPreset, prop, text, video } from "@kitsra/kavio-builder";

const headline = prop("headline", {
  type: "string",
  default: "New collection is live",
  maxLength: 80
});
const clipUrl = prop("clipUrl", {
  type: "url",
  required: true
});
const logoUrl = prop("logoUrl", {
  type: "url",
  required: true
});

const mainClip = asset.video("mainClip", clipUrl);
const logo = asset.image("logo", logoUrl);

const composition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 240,
  background: "#000000"
});

composition
  .props(headline, clipUrl, logoUrl)
  .assets(mainClip, logo)
  .add(
    clip("background-video", {
      asset: mainClip,
      startFrame: 0,
      durationFrames: 240,
      fit: "cover",
      crop: crop.subject({
        x: 0.48,
        y: 0.44,
        keyframes: [
          { frame: 0, x: 0.42, y: 0.44 },
          { frame: 120, x: 0.58, y: 0.46 }
        ],
        source: "manual"
      })
    }),
    text("headline", {
      text: headline,
      startFrame: 20,
      durationFrames: 100,
      position: {
        x: 540,
        y: 360
      },
      anchor: "center",
      style: {
        fontFamily: "Inter",
        fontSize: 72,
        fontWeight: 800,
        color: "#FFFFFF",
        align: "center"
      }
    })
  )
  .exports(...exportPreset.social());

export const json = composition.toJSON();

console.log(JSON.stringify(json, null, 2));
