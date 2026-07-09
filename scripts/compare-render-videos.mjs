#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const usage = `Usage:
  node scripts/compare-render-videos.mjs <reference.mp4> <candidate.mp4> [options]

Options:
  --json <path>                 Write JSON summary.
  --markdown <path>             Write Markdown summary.
  --reference-time <seconds>    Reference render wall time.
  --candidate-time <seconds>    Candidate render wall time.
  --self-check                  Run parser/formatter self-checks.

Set FFMPEG or FFPROBE to override the default tool names.`;

try {
  if (process.argv.includes("--self-check")) {
    runSelfCheck();
  } else {
    const options = parseArgs(process.argv.slice(2));
    const summary = await compareVideos(options);
    const markdown = renderMarkdown(summary);

    if (options.jsonPath !== undefined) {
      await writeFile(options.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
    }
    if (options.markdownPath !== undefined) {
      await writeFile(options.markdownPath, `${markdown}\n`);
    }
    if (options.jsonPath === undefined && options.markdownPath === undefined) {
      console.log(markdown);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(argv) {
  const inputs = [];
  const parsed = {
    ffmpeg: process.env.FFMPEG ?? "ffmpeg",
    ffprobe: process.env.FFPROBE ?? "ffprobe"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      parsed.jsonPath = needValue(argv, (index += 1), arg);
    } else if (arg === "--markdown") {
      parsed.markdownPath = needValue(argv, (index += 1), arg);
    } else if (arg === "--reference-time") {
      parsed.referenceTimeSeconds = parseSeconds(needValue(argv, (index += 1), arg), arg);
    } else if (arg === "--candidate-time") {
      parsed.candidateTimeSeconds = parseSeconds(needValue(argv, (index += 1), arg), arg);
    } else if (arg.startsWith("--")) {
      fail(`Unknown option: ${arg}`);
    } else {
      inputs.push(arg);
    }
  }

  if (inputs.length !== 2) {
    fail("Expected exactly two video paths.");
  }

  return {
    ...parsed,
    referencePath: resolve(inputs[0]),
    candidatePath: resolve(inputs[1])
  };
}

async function compareVideos(options) {
  const [referenceProbe, candidateProbe, ssim, psnr] = await Promise.all([
    probeVideo(options.ffprobe, options.referencePath),
    probeVideo(options.ffprobe, options.candidatePath),
    runMetric(options.ffmpeg, "ssim", options.referencePath, options.candidatePath),
    runMetric(options.ffmpeg, "psnr", options.referencePath, options.candidatePath)
  ]);

  return buildSummary({
    referencePath: options.referencePath,
    candidatePath: options.candidatePath,
    referenceProbe,
    candidateProbe,
    ssim,
    psnr,
    referenceTimeSeconds: options.referenceTimeSeconds,
    candidateTimeSeconds: options.candidateTimeSeconds
  });
}

async function probeVideo(ffprobe, path) {
  const result = await run(ffprobe, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    path
  ]);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.find((entry) => entry.codec_type === "video");
  if (stream === undefined) {
    throw new Error(`No video stream found in ${path}`);
  }

  const durationSeconds = firstFiniteNumber(stream.duration, data.format?.duration);
  const frameRate = parseRate(stream.avg_frame_rate) ?? parseRate(stream.r_frame_rate);
  const frames = firstFiniteNumber(stream.nb_frames, stream.nb_read_frames);

  return dropUndefined({
    codec: stream.codec_name,
    width: finiteNumber(stream.width),
    height: finiteNumber(stream.height),
    frames: frames === undefined ? undefined : Math.round(frames),
    frameRate: frameRate === undefined ? undefined : round(frameRate, 3),
    durationSeconds: durationSeconds === undefined ? undefined : round(durationSeconds, 3),
    bitRate: finiteNumber(stream.bit_rate ?? data.format?.bit_rate)
  });
}

async function runMetric(ffmpeg, metric, referencePath, candidatePath) {
  const result = await run(ffmpeg, [
    "-hide_banner",
    "-nostats",
    "-i",
    referencePath,
    "-i",
    candidatePath,
    "-lavfi",
    `[0:v][1:v]${metric}`,
    "-f",
    "null",
    "-"
  ]);

  return metric === "ssim" ? parseSsim(result.stderr) : parsePsnr(result.stderr);
}

function parseSsim(stderr) {
  const match = stderr.match(/All:([0-9.]+)/);
  if (match === null) {
    throw new Error("Could not parse SSIM from FFmpeg output.");
  }
  return { all: round(Number(match[1]), 6) };
}

function parsePsnr(stderr) {
  const match = stderr.match(/average:([0-9.]+|inf)/);
  if (match === null) {
    throw new Error("Could not parse PSNR from FFmpeg output.");
  }
  return { averageDb: match[1] === "inf" ? "inf" : round(Number(match[1]), 2) };
}

function buildSummary(input) {
  const speedup =
    input.referenceTimeSeconds !== undefined && input.candidateTimeSeconds !== undefined
      ? round(input.referenceTimeSeconds / input.candidateTimeSeconds, 3)
      : undefined;

  return {
    generatedAt: new Date().toISOString(),
    reference: dropUndefined({
      path: input.referencePath,
      name: basename(input.referencePath),
      renderSeconds: input.referenceTimeSeconds,
      probe: input.referenceProbe
    }),
    candidate: dropUndefined({
      path: input.candidatePath,
      name: basename(input.candidatePath),
      renderSeconds: input.candidateTimeSeconds,
      probe: input.candidateProbe
    }),
    comparison: dropUndefined({
      ssimAll: input.ssim.all,
      psnrAverageDb: input.psnr.averageDb,
      durationDeltaSeconds: delta(input.candidateProbe.durationSeconds, input.referenceProbe.durationSeconds),
      frameDelta: delta(input.candidateProbe.frames, input.referenceProbe.frames),
      speedup
    })
  };
}

function renderMarkdown(summary) {
  const lines = [
    "# Render Comparison",
    "",
    `Reference: \`${summary.reference.name}\``,
    `Candidate: \`${summary.candidate.name}\``,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| SSIM All | ${summary.comparison.ssimAll} |`,
    `| PSNR Average | ${summary.comparison.psnrAverageDb} dB |`,
    `| Reference Video | ${formatProbe(summary.reference.probe)} |`,
    `| Candidate Video | ${formatProbe(summary.candidate.probe)} |`
  ];

  if (summary.reference.renderSeconds !== undefined && summary.candidate.renderSeconds !== undefined) {
    lines.push(`| Render Time | ${summary.reference.renderSeconds}s -> ${summary.candidate.renderSeconds}s |`);
    lines.push(`| Speedup | ${summary.comparison.speedup}x |`);
  }

  return lines.join("\n");
}

function formatProbe(probe) {
  return [
    probe.frames === undefined ? undefined : `${probe.frames} frames`,
    probe.frameRate === undefined ? undefined : `${probe.frameRate} fps`,
    probe.durationSeconds === undefined ? undefined : `${probe.durationSeconds}s`,
    probe.width === undefined || probe.height === undefined ? undefined : `${probe.width}x${probe.height}`
  ]
    .filter(Boolean)
    .join(", ");
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => reject(new Error(`${command} failed to start: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited ${code}.\n${stderr.trim()}`));
      }
    });
  });
}

function needValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    fail(`${flag} requires a value.`);
  }
  return value;
}

function parseSeconds(value, flag) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    fail(`${flag} must be a positive number of seconds.`);
  }
  return round(seconds, 3);
}

function parseRate(value) {
  if (typeof value !== "string" || value === "0/0") {
    return undefined;
  }
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator)) {
    return undefined;
  }
  return Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : numerator;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== undefined) {
      return number;
    }
  }
  return undefined;
}

function delta(left, right) {
  return left === undefined || right === undefined ? undefined : round(left - right, 3);
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function dropUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function fail(message) {
  console.error(`${message}\n\n${usage}`);
  process.exit(1);
}

function runSelfCheck() {
  assert.deepEqual(parseSsim("SSIM Y:0.99 U:0.99 V:0.99 All:0.995476 (23.44)"), { all: 0.995476 });
  assert.deepEqual(parsePsnr("PSNR y:40.1 u:41.2 v:42.3 average:40.204 min:30.0 max:inf"), {
    averageDb: 40.2
  });
  assert.deepEqual(parsePsnr("PSNR y:inf u:inf v:inf average:inf min:inf max:inf"), { averageDb: "inf" });
  assert.equal(round(parseRate("24000/1001"), 3), 23.976);

  const summary = buildSummary({
    referencePath: "/tmp/production.mp4",
    candidatePath: "/tmp/kavio.mp4",
    referenceProbe: { frames: 720, frameRate: 30, durationSeconds: 24, width: 1080, height: 1920 },
    candidateProbe: { frames: 720, frameRate: 30, durationSeconds: 24, width: 1080, height: 1920 },
    ssim: { all: 0.995476 },
    psnr: { averageDb: 40.2 },
    referenceTimeSeconds: 12.09,
    candidateTimeSeconds: 8.96
  });

  assert.equal(summary.comparison.speedup, 1.349);
  assert.match(renderMarkdown(summary), /SSIM All \| 0\.995476/);
  console.log("compare-render-videos self-check passed.");
}
