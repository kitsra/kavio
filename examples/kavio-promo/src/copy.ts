import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface PromoFeature {
  headline: string;
  line: string;
  source: string;
}

export interface PromoCopy {
  title: string;
  subtitle: string;
  repoUrl: string;
  proofLabels: readonly string[];
  features: readonly PromoFeature[];
  sources: readonly string[];
}

const copyPath = new URL("../assets/promo-copy.json", import.meta.url);

export async function collectPromoCopy(): Promise<PromoCopy> {
  const [readme, rendering, builder, siteHome, preview, packageJson] = await Promise.all([
    readText("../../../README.md"),
    readText("../../../docs/rendering.md"),
    readText("../../../docs/builder.md"),
    readText("../../../site/index.html"),
    readText("../../../docs/preview.md"),
    readText("../../../package.json")
  ]);

  assertIncludes(readme, "JSON-first programmable video engine", "README.md");
  assertIncludes(readme, "TypeScript builder", "README.md");
  assertIncludes(readme, "browser preview runtime", "README.md");
  assertIncludes(readme, "MCP server", "README.md");
  assertIncludes(rendering, "captures browser-rendered overlay frames with Playwright", "docs/rendering.md");
  assertIncludes(builder, "TypeScript authoring layer", "docs/builder.md");
  assertIncludes(builder, "exportPreset.instagramReels", "docs/builder.md");
  assertIncludes(siteHome, "Portable video templates", "site/index.html");
  assertIncludes(siteHome, "Frame-based timeline", "site/index.html");
  assertIncludes(preview, "Frame scrubber", "docs/preview.md");

  const parsedPackage = JSON.parse(packageJson) as { repository?: { url?: string } };
  const repoUrl = normalizeRepoUrl(parsedPackage.repository?.url);

  return {
    title: "Kavio",
    subtitle: "Programmable video editing",
    repoUrl,
    proofLabels: [
      "Portable video templates",
      "Author once, expand across formats",
      "Docs, examples, packages"
    ],
    features: [
      {
        headline: "JSON-first templates",
        line: "Portable compositions for automated video workflows.",
        source: "README.md"
      },
      {
        headline: "Frame-based timeline",
        line: "Deterministic timing for preview, exports, and jobs.",
        source: "site/index.html"
      },
      {
        headline: "TypeScript builder",
        line: "Generate canonical Kavio JSON from code.",
        source: "docs/builder.md"
      },
      {
        headline: "Browser preview",
        line: "Scrub frames and inspect export overrides.",
        source: "docs/preview.md"
      },
      {
        headline: "Render pipeline",
        line: "Browser capture plus FFmpeg MP4 output.",
        source: "docs/rendering.md"
      },
      {
        headline: "CLI, MCP, social",
        line: "Validate, plan, render, and target Reels output.",
        source: "README.md + docs/builder.md"
      }
    ],
    sources: ["README.md", "docs/rendering.md", "docs/builder.md", "docs/preview.md", "site/index.html", "package.json"]
  };
}

export async function writePromoCopy(copy?: PromoCopy): Promise<PromoCopy> {
  const promoCopy = copy ?? (await collectPromoCopy());
  await mkdir(dirname(copyPath.pathname), { recursive: true });
  await writeFile(copyPath, `${JSON.stringify(promoCopy, null, 2)}\n`);
  return promoCopy;
}

export async function readPromoCopy(): Promise<PromoCopy> {
  return JSON.parse(await readFile(copyPath, "utf8")) as PromoCopy;
}

function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function assertIncludes(haystack: string, needle: string, source: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${source} to contain "${needle}".`);
  }
}

function normalizeRepoUrl(value: string | undefined): string {
  if (!value) {
    return "github.com/Kitsra/Kavio";
  }
  return value.replace(/^git\+/, "").replace(/^https?:\/\//, "").replace(/\.git$/, "");
}
