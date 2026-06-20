import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildPromoComposition } from "./composition.js";
import { readPromoCopy, writePromoCopy } from "./copy.js";

export async function emitPromoComposition(): Promise<string> {
  await writePromoCopy();
  const copy = await readPromoCopy();
  const composition = buildPromoComposition(copy);
  const outputUrl = new URL("../generated/composition.json", import.meta.url);
  await mkdir(dirname(outputUrl.pathname), { recursive: true });
  await writeFile(outputUrl, `${JSON.stringify(composition, null, 2)}\n`);
  return outputUrl.pathname;
}

const path = await emitPromoComposition();
process.stdout.write(`Wrote ${path}\n`);
