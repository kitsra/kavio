declare module "node:fs/promises" {
  export function readFile(path: string | URL, encoding: "utf8"): Promise<string>;
}

declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
  }

  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(value?: string): void;
  }

  export interface Server {
    address(): { port: number } | string | null;
    listen(port: number, hostname: string, callback: () => void): this;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void
  ): Server;
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
}
