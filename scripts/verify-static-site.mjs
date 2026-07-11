import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../site");
const htmlFiles = await walk(root);
const content = new Map(await Promise.all(htmlFiles.map(async (file) => [file, await readFile(file, "utf8")])));

for (const [file, html] of content) {
  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const reference = match[1];
    if (!reference || reference.startsWith("#") || /^[a-z]+:/i.test(reference) || reference.startsWith("//")) {
      continue;
    }
    const [pathPart, fragment] = reference.split("#", 2);
    const target = resolve(dirname(file), decodeURIComponent((pathPart ?? "").split("?", 1)[0]));
    await access(target);
    if (fragment && extname(target) === ".html") {
      const targetHtml = content.get(target) ?? await readFile(target, "utf8");
      assert.match(targetHtml, new RegExp(`\\bid=["']${escapeRegExp(fragment)}["']`), `${reference} from ${file} has no target`);
    }
  }
}

const requiredCoverage = {
  "docs/authoring.html": ["cover", "reveal", "diagonalWipe", "grayscaleDissolve", "corner"],
  "docs/api.html": ["cover()", "reveal()", "diagonalWipe()", "grayscaleDissolve()"],
  "docs/rendering.html": ["coverleft", "revealleft", "wipetl", "fadegrays", "renderSupport"],
  "docs/cli.html": ["renderSupport", "ffmpegDirect"],
  "docs/mcp.html": ["renderSupport", "ffmpegDirect"],
  "llms.txt": ["diagonalWipe", "grayscaleDissolve", "renderSupport"]
};

for (const [relativePath, terms] of Object.entries(requiredCoverage)) {
  const file = resolve(root, relativePath);
  const text = content.get(file) ?? await readFile(file, "utf8");
  for (const term of terms) {
    assert.ok(text.includes(term), `${relativePath} is missing ${term}`);
  }
}

console.log(`Static site verified: ${htmlFiles.length} HTML files, relative links, assets, and transition coverage.`);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else if (entry.name.endsWith(".html")) {
      files.push(path);
    }
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
