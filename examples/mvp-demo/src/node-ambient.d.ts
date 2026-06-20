declare module "node:child_process" {
  interface ReadableLike {
    on(event: "data", listener: (chunk: unknown) => void): void;
  }

  interface ChildProcessLike {
    stdout: ReadableLike | null;
    stderr: ReadableLike | null;
    on(event: "error", listener: (error: unknown) => void): void;
    on(event: "close", listener: (code: number | null) => void): void;
  }

  export function spawn(command: string, args: string[], options?: { stdio?: readonly string[] }): ChildProcessLike;
}

declare module "node:fs/promises" {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
  export function stat(path: string): Promise<{ size: number }>;
  export function writeFile(path: string, data: string): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}
