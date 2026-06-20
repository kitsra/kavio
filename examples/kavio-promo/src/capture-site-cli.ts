import { captureWebsiteScreenshots } from "./capture-site.js";

const captures = await captureWebsiteScreenshots();
process.stdout.write(`Captured ${captures.length} local site screenshots.\n`);
