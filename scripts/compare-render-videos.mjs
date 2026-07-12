#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = `Usage:
  node scripts/compare-render-videos.mjs <reference> <candidate> [options]

Options:
  --min-ssim <-1..1>            Minimum whole-video SSIM.
  --min-psnr <dB>               Minimum whole-video average PSNR.
  --frame <seconds>             Compare a frame at this timestamp (repeatable).
  --min-frame-ssim <-1..1>      Minimum SSIM for every selected frame.
  --min-frame-psnr <dB>         Minimum PSNR for every selected frame.
  --json <path|->               Write compact JSON (use - for stdout).
  --markdown <path>             Write a human-readable summary.
  --reference-time <seconds>    Reference render wall time.
  --candidate-time <seconds>    Candidate render wall time.
  --self-check                  Run dependency-free unit checks.

Exit codes: 0 passed, 1 invalid/execution error, 2 threshold regression.
Set FFMPEG or FFPROBE to override the default tool names.`;

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes("--self-check")) {
    runSelfCheck();
    return 0;
  }

  const options = parseArgs(argv, env);
  const summary = await compareVideos(options);
  const json = `${JSON.stringify(summary)}\n`;

  if (options.jsonPath !== undefined) {
    if (options.jsonPath === "-") process.stdout.write(json);
    else await writeFile(options.jsonPath, json);
  }
  if (options.markdownPath !== undefined) {
    await writeFile(options.markdownPath, `${renderMarkdown(summary)}\n`);
  }
  if (options.jsonPath === undefined && options.markdownPath === undefined) {
    console.log(renderMarkdown(summary));
  }

  if (!summary.passed) {
    console.error(`Render comparison failed: ${summary.failures.map(formatFailure).join("; ")}`);
    return 2;
  }
  return 0;
}

export function parseArgs(argv, env = process.env) {
  const inputs = [];
  const parsed = {
    ffmpeg: env.FFMPEG ?? "ffmpeg",
    ffprobe: env.FFPROBE ?? "ffprobe",
    frameSeconds: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.jsonPath = needValue(argv, (index += 1), arg);
    else if (arg === "--markdown") parsed.markdownPath = needValue(argv, (index += 1), arg);
    else if (arg === "--reference-time") parsed.referenceTimeSeconds = parsePositive(needValue(argv, (index += 1), arg), arg);
    else if (arg === "--candidate-time") parsed.candidateTimeSeconds = parsePositive(needValue(argv, (index += 1), arg), arg);
    else if (arg === "--min-ssim") parsed.minSsim = parseRange(needValue(argv, (index += 1), arg), arg, -1, 1);
    else if (arg === "--min-psnr") parsed.minPsnrDb = parseNonNegative(needValue(argv, (index += 1), arg), arg);
    else if (arg === "--frame") parsed.frameSeconds.push(parseNonNegative(needValue(argv, (index += 1), arg), arg));
    else if (arg === "--min-frame-ssim") parsed.minFrameSsim = parseRange(needValue(argv, (index += 1), arg), arg, -1, 1);
    else if (arg === "--min-frame-psnr") parsed.minFramePsnrDb = parseNonNegative(needValue(argv, (index += 1), arg), arg);
    else if (arg.startsWith("--")) throw new UsageError(`Unknown option: ${arg}`);
    else inputs.push(arg);
  }

  if (inputs.length !== 2) throw new UsageError("Expected exactly two video paths.");
  if (parsed.frameSeconds.length === 0 && (parsed.minFrameSsim !== undefined || parsed.minFramePsnrDb !== undefined)) {
    throw new UsageError("Frame thresholds require at least one --frame timestamp.");
  }

  return { ...parsed, referencePath: resolve(inputs[0]), candidatePath: resolve(inputs[1]) };
}

export async function compareVideos(options) {
  const [referenceProbe, candidateProbe, ssim, psnr, frames] = await Promise.all([
    probeVideo(options.ffprobe, options.referencePath),
    probeVideo(options.ffprobe, options.candidatePath),
    runMetric(options.ffmpeg, "ssim", options.referencePath, options.candidatePath),
    runMetric(options.ffmpeg, "psnr", options.referencePath, options.candidatePath),
    Promise.all(options.frameSeconds.map((seconds) => compareFrame(options.ffmpeg, options.referencePath, options.candidatePath, seconds)))
  ]);

  return buildSummary({ ...options, referenceProbe, candidateProbe, ssim, psnr, frames });
}

async function probeVideo(ffprobe, path) {
  const result = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.find((entry) => entry.codec_type === "video");
  if (stream === undefined) throw new Error(`No video stream found in ${path}`);

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

async function compareFrame(ffmpeg, referencePath, candidatePath, seconds) {
  const [ssim, psnr] = await Promise.all([
    runMetric(ffmpeg, "ssim", referencePath, candidatePath, seconds),
    runMetric(ffmpeg, "psnr", referencePath, candidatePath, seconds)
  ]);
  return { seconds, ssim: ssim.all, psnrDb: psnr.averageDb };
}

async function runMetric(ffmpeg, metric, referencePath, candidatePath, seconds) {
  const seek = seconds === undefined ? [] : ["-ss", String(seconds)];
  const result = await run(ffmpeg, [
    "-hide_banner", "-nostats", ...seek, "-i", referencePath, ...seek, "-i", candidatePath,
    "-lavfi", `[0:v][1:v]${metric}`, ...(seconds === undefined ? [] : ["-frames:v", "1"]), "-f", "null", "-"
  ]);
  return metric === "ssim" ? parseSsim(result.stderr) : parsePsnr(result.stderr);
}

export function parseSsim(stderr) {
  const matches = [...stderr.matchAll(/All:(-?[0-9.]+)/g)];
  if (matches.length === 0) throw new Error("Could not parse SSIM from FFmpeg output.");
  return { all: round(Number(matches.at(-1)[1]), 6) };
}

export function parsePsnr(stderr) {
  const matches = [...stderr.matchAll(/average:(-?[0-9.]+|inf)/g)];
  if (matches.length === 0) throw new Error("Could not parse PSNR from FFmpeg output.");
  const value = matches.at(-1)[1];
  return { averageDb: value === "inf" ? "inf" : round(Number(value), 2) };
}

function buildSummary(input) {
  const thresholds = dropUndefined({
    minSsim: input.minSsim,
    minPsnrDb: input.minPsnrDb,
    minFrameSsim: input.minFrameSsim,
    minFramePsnrDb: input.minFramePsnrDb
  });
  const failures = evaluateThresholds(input, thresholds);
  const speedup = input.referenceTimeSeconds !== undefined && input.candidateTimeSeconds !== undefined
    ? round(input.referenceTimeSeconds / input.candidateTimeSeconds, 3) : undefined;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    passed: failures.length === 0,
    failures,
    thresholds,
    reference: dropUndefined({ path: input.referencePath, name: basename(input.referencePath), renderSeconds: input.referenceTimeSeconds, probe: input.referenceProbe }),
    candidate: dropUndefined({ path: input.candidatePath, name: basename(input.candidatePath), renderSeconds: input.candidateTimeSeconds, probe: input.candidateProbe }),
    comparison: dropUndefined({
      ssimAll: input.ssim.all,
      psnrAverageDb: input.psnr.averageDb,
      frames: input.frames.length === 0 ? undefined : input.frames,
      durationDeltaSeconds: delta(input.candidateProbe.durationSeconds, input.referenceProbe.durationSeconds),
      frameDelta: delta(input.candidateProbe.frames, input.referenceProbe.frames),
      speedup
    })
  };
}

function evaluateThresholds(input, thresholds) {
  const failures = [];
  check(failures, "video.ssimAll", input.ssim.all, thresholds.minSsim);
  check(failures, "video.psnrAverageDb", input.psnr.averageDb, thresholds.minPsnrDb);
  for (const frame of input.frames) {
    check(failures, "frame.ssim", frame.ssim, thresholds.minFrameSsim, frame.seconds);
    check(failures, "frame.psnrDb", frame.psnrDb, thresholds.minFramePsnrDb, frame.seconds);
  }
  return failures;
}

function check(failures, metric, actual, minimum, seconds) {
  if (minimum !== undefined && numericMetric(actual) < minimum) {
    failures.push(dropUndefined({ metric, seconds, actual, minimum }));
  }
}

function numericMetric(value) {
  return value === "inf" ? Number.POSITIVE_INFINITY : value;
}

function renderMarkdown(summary) {
  const lines = [
    "# Render Comparison", "", `Status: **${summary.passed ? "PASS" : "FAIL"}**`,
    `Reference: \`${summary.reference.name}\``, `Candidate: \`${summary.candidate.name}\``, "",
    "| Metric | Value |", "| --- | --- |", `| SSIM All | ${summary.comparison.ssimAll} |`,
    `| PSNR Average | ${summary.comparison.psnrAverageDb} dB |`,
    `| Reference Video | ${formatProbe(summary.reference.probe)} |`,
    `| Candidate Video | ${formatProbe(summary.candidate.probe)} |`
  ];
  for (const frame of summary.comparison.frames ?? []) {
    lines.push(`| Frame ${frame.seconds}s | SSIM ${frame.ssim}, PSNR ${frame.psnrDb} dB |`);
  }
  if (summary.reference.renderSeconds !== undefined && summary.candidate.renderSeconds !== undefined) {
    lines.push(`| Render Time | ${summary.reference.renderSeconds}s -> ${summary.candidate.renderSeconds}s |`, `| Speedup | ${summary.comparison.speedup}x |`);
  }
  if (summary.failures.length > 0) lines.push("", ...summary.failures.map((failure) => `- ${formatFailure(failure)}`));
  return lines.join("\n");
}

function formatFailure(failure) {
  const where = failure.seconds === undefined ? "" : ` at ${failure.seconds}s`;
  return `${failure.metric}${where} ${failure.actual} is below ${failure.minimum}`;
}

function formatProbe(probe) {
  return [
    probe.frames === undefined ? undefined : `${probe.frames} frames`,
    probe.frameRate === undefined ? undefined : `${probe.frameRate} fps`,
    probe.durationSeconds === undefined ? undefined : `${probe.durationSeconds}s`,
    probe.width === undefined || probe.height === undefined ? undefined : `${probe.width}x${probe.height}`
  ].filter(Boolean).join(", ");
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`${command} failed to start: ${error.message}`)));
    child.on("close", (code) => code === 0 ? resolveRun({ stdout, stderr }) : reject(new Error(`${command} exited ${code}.\n${stderr.trim()}`)));
  });
}

function needValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) throw new UsageError(`${flag} requires a value.`);
  return value;
}

function parsePositive(value, flag) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new UsageError(`${flag} must be a positive number.`);
  return round(number, 3);
}

function parseNonNegative(value, flag) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new UsageError(`${flag} must be zero or greater.`);
  return round(number, 3);
}

function parseRange(value, flag, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new UsageError(`${flag} must be between ${minimum} and ${maximum}.`);
  return number;
}

function parseRate(value) {
  if (typeof value !== "string" || value === "0/0") return undefined;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator)) return undefined;
  return Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : numerator;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== undefined) return number;
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

class UsageError extends Error {}

function runSelfCheck() {
  assert.deepEqual(parseSsim("SSIM Y:0.99 All:0.995476 (23.44)"), { all: 0.995476 });
  assert.deepEqual(parsePsnr("PSNR y:40.1 average:40.204 min:30.0 max:inf"), { averageDb: 40.2 });
  assert.deepEqual(parsePsnr("PSNR average:inf min:inf max:inf"), { averageDb: "inf" });
  assert.equal(round(parseRate("24000/1001"), 3), 23.976);
  assert.throws(() => parseArgs(["a", "b", "--min-ssim", "1.1"]), /between -1 and 1/);
  console.log("compare-render-videos self-check passed.");
}

const isDirect = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error instanceof UsageError ? `${error.message}\n\n${usage}` : error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
