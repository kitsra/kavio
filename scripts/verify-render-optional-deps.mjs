import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const renderPackagePath = `${rootDir}/packages/render/package.json`;
const renderPackage = JSON.parse(readFileSync(renderPackagePath, "utf8"));
const renderRequire = createRequire(renderPackagePath);
const optionalDependencies = renderPackage.optionalDependencies ?? {};

const missing = [];

for (const name of Object.keys(optionalDependencies)) {
  try {
    renderRequire.resolve(`${name}/package.json`);
  } catch {
    missing.push(name);
  }
}

if (missing.length > 0) {
  console.error(
    [
      `@kavio/render requires its optional packages to be installed before packing: ${missing.join(", ")}`,
      "Install dependencies with optional packages enabled:",
      "  corepack pnpm install --frozen-lockfile",
      "",
      "Do not use --no-optional or omit=optional when preparing npm packages."
    ].join("\n")
  );
  process.exit(1);
}

console.log(
  `@kavio/render optional packages installed: ${Object.keys(optionalDependencies).join(", ")}`
);
