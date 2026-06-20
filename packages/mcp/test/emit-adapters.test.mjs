import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const binPath = join(dirname(fileURLToPath(import.meta.url)), "../dist/bin.js");

function run(args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], { cwd });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise(code));
  });
}

test("emit-adapters writes three valid provider files", async () => {
  const out = await mkdtemp(join(tmpdir(), "kavio-adapters-"));
  const code = await run(["emit-adapters", "--out", out]);
  assert.equal(code, 0);
  for (const file of ["anthropic.tools.json", "openai.tools.json", "gemini.tools.json"]) {
    const parsed = JSON.parse(await readFile(join(out, file), "utf8"));
    assert.ok(Array.isArray(parsed) ? parsed.length > 0 : parsed.length !== 0 || parsed[0]);
  }
});

test("emit-adapters requires --out", async () => {
  const code = await run(["emit-adapters"]);
  assert.notEqual(code, 0);
});
