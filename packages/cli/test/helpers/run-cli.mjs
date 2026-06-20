import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const helperDir = dirname(fileURLToPath(import.meta.url));

export const packageRoot = resolve(helperDir, "../..");
export const fixturesDir = resolve(packageRoot, "test/fixtures");

export function fixturePath(name) {
  return resolve(fixturesDir, name);
}

export function runCli(args, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawnCliProcess(args, options);

    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolveResult({ status, signal, stdout: child.stdoutText, stderr: child.stderrText });
    });
  });
}

export function spawnCli(args, options = {}) {
  return spawnCliProcess(args, options);
}

export function waitForStdout(spawned, pattern, timeoutMs = 5000) {
  return new Promise((resolveMatch, reject) => {
    const existingMatch = pattern.exec(spawned.stdoutText);

    if (existingMatch) {
      resolveMatch(existingMatch);
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for stdout to match ${pattern}.`));
    }, timeoutMs);

    function onData() {
      const match = pattern.exec(spawned.stdoutText);

      if (match) {
        cleanup();
        resolveMatch(match);
      }
    }

    function onClose(status, signal) {
      cleanup();
      reject(new Error(`Process exited before stdout matched ${pattern}; status=${status}; signal=${signal}.`));
    }

    function cleanup() {
      clearTimeout(timeout);
      spawned.stdout.off("data", onData);
      spawned.off("close", onClose);
    }

    spawned.stdout.on("data", onData);
    spawned.on("close", onClose);
  });
}

function spawnCliProcess(args, options = {}) {
  const child = spawn(process.execPath, [resolve(packageRoot, "dist/index.js"), ...args], {
    cwd: options.cwd ?? packageRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "0"
    }
  });

  child.stdoutText = "";
  child.stderrText = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    child.stdoutText += chunk;
  });
  child.stderr.on("data", (chunk) => {
    child.stderrText += chunk;
  });

  return child;
}
