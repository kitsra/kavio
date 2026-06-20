declare const process: {
  cwd(): string;
  exitCode?: number;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
};

declare module "node:child_process" {
  export interface ChildProcess {
    stdout?: { on(event: "data", listener: (chunk: unknown) => void): void };
    stderr?: { on(event: "data", listener: (chunk: unknown) => void): void };
    on(event: "error", listener: (error: Error) => void): void;
    on(event: "close", listener: (code: number | null) => void): void;
  }

  export function spawn(command: string, args: readonly string[], options?: { cwd?: string; stdio?: string }): ChildProcess;
}

declare module "node:fs/promises" {
  export function mkdir(path: string | URL, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function readFile(path: string | URL, encoding: "utf8"): Promise<string>;
  export function readFile(path: string | URL): Promise<Uint8Array>;
  export function writeFile(path: string | URL, data: string | Uint8Array): Promise<void>;
  export function stat(path: string | URL): Promise<{ size: number }>;
}

declare module "node:http" {
  export interface IncomingMessage {
    url?: string;
  }

  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(value?: string | Uint8Array): void;
  }

  export interface Server {
    address(): { port: number } | string | null;
    listen(port: number, hostname: string, callback: () => void): this;
    close(callback?: (error?: Error) => void): this;
  }

  export function createServer(handler: (request: IncomingMessage, response: ServerResponse) => void): Server;
}

declare module "node:module" {
  export function createRequire(url: string | URL): (id: string) => unknown;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function normalize(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
