import { writePromoCopy } from "./copy.js";

const copy = await writePromoCopy();
process.stdout.write(`Collected ${copy.features.length} sourced promo features.\n`);
