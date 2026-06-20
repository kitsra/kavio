import { verifyPromoVideo } from "./verify.js";

const verification = await verifyPromoVideo();
process.stdout.write(
  `Verified ${verification.path}: ${verification.width}x${verification.height}, ${verification.durationSeconds.toFixed(
    2
  )}s, audio streams ${verification.audioStreams}, ${verification.bytes} bytes.\n`
);
