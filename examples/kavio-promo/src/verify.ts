import { stat } from "node:fs/promises";
import { runProcess } from "./process.js";

export interface VideoVerification {
  path: string;
  bytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  audioStreams: number;
}

const finalOutputPath = new URL("../../../dist/kavio-instagram-reel.mp4", import.meta.url).pathname;

export async function verifyPromoVideo(path = finalOutputPath): Promise<VideoVerification> {
  const info = await stat(path);
  const probe = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height:format=duration",
    "-of",
    "json",
    path
  ]);
  const parsed = JSON.parse(probe.stdout) as {
    streams?: { codec_type?: string; width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const streams = parsed.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio").length;
  const durationSeconds = Number(parsed.format?.duration ?? 0);
  const width = videoStream?.width ?? 0;
  const height = videoStream?.height ?? 0;

  if (!(durationSeconds >= 20 && durationSeconds <= 30)) {
    throw new Error(`Expected duration between 20 and 30 seconds, got ${durationSeconds}.`);
  }
  if (width !== 1080 || height !== 1920) {
    throw new Error(`Expected 1080x1920, got ${width}x${height}.`);
  }
  if (audioStreams !== 0) {
    throw new Error(`Expected no audio streams, got ${audioStreams}.`);
  }

  return {
    path,
    bytes: info.size,
    durationSeconds,
    width,
    height,
    audioStreams
  };
}
