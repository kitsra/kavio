import { spawn } from "node:child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export function runProcess(command: string, args: readonly string[], options: { cwd?: string } = {}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const spawnOptions = options.cwd === undefined ? { stdio: "pipe" } : { cwd: options.cwd, stdio: "pipe" };
    const child = spawn(command, args, spawnOptions);
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with ${String(code)}\n${stderr}`));
    });
  });
}
