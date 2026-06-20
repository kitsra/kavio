import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createFfmpegRunner, renderComposition } from "@kavio/render";
import { captureWebsiteScreenshots } from "./capture-site.js";
import { buildPromoComposition, sceneTimings } from "./composition.js";
import { readPromoCopy, writePromoCopy } from "./copy.js";
import { runProcess } from "./process.js";
import { verifyPromoVideo } from "./verify.js";

const rootDist = new URL("../../../dist/", import.meta.url);
const finalOutput = new URL("kavio-instagram-reel.mp4", rootDist);
const intermediateOutput = new URL("../generated/kavio-instagram-reel-source.mp4", import.meta.url);
const compositionOutput = new URL("../generated/composition.json", import.meta.url);
const timingsOutput = new URL("../generated/timings.json", import.meta.url);

async function main(): Promise<void> {
  process.stdout.write("Collecting sourced promo copy...\n");
  await writePromoCopy();
  const copy = await readPromoCopy();

  process.stdout.write("Capturing local website screenshots...\n");
  const screenshots = await captureWebsiteScreenshots();
  process.stdout.write(`Captured ${screenshots.length} screenshots.\n`);

  process.stdout.write("Building Kavio composition...\n");
  const composition = buildPromoComposition(copy);
  await mkdir(dirname(compositionOutput.pathname), { recursive: true });
  await writeFile(compositionOutput, `${JSON.stringify(composition, null, 2)}\n`);
  await writeFile(timingsOutput, `${JSON.stringify(sceneTimings, null, 2)}\n`);
  process.stdout.write("Timing map:\n");
  for (const timing of sceneTimings) {
    process.stdout.write(`- ${timing.start}-${timing.end}: ${timing.label}\n`);
  }
  const ffmpegPath = (await runProcess("which", ["ffmpeg"])).stdout.trim();

  process.stdout.write("Rendering source MP4 with @kavio/render...\n");
  const result = await renderComposition(composition, {
    preset: "kavio-instagram-reel-source",
    outDir: dirname(intermediateOutput.pathname),
    outputName: "kavio-instagram-reel-source.mp4",
    ffmpegRunner: createFfmpegRunner({ resolveBinary: () => ffmpegPath })
  });

  if (!result.ok) {
    throw new Error(result.errors.map((error) => `[${error.code}] ${error.path ?? "(render)"}: ${error.message}`).join("\n"));
  }

  process.stdout.write("Stripping the silent audio stream for the final Reels deliverable...\n");
  await mkdir(rootDist, { recursive: true });
  await runProcess("ffmpeg", [
    "-y",
    "-i",
    result.outputPath,
    "-map",
    "0:v:0",
    "-c:v",
    "copy",
    "-an",
    finalOutput.pathname
  ]);

  const verification = await verifyPromoVideo(finalOutput.pathname);
  process.stdout.write(
    `Rendered ${verification.path}: ${verification.width}x${verification.height}, ${verification.durationSeconds.toFixed(
      2
    )}s, no audio.\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
