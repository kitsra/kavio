#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const expectedLicense = "Elastic-2.0";
const failures = [];

const packagePaths = ["package.json"];
for (const entry of await readdir(join(root, "packages"), { withFileTypes: true })) {
  if (entry.isDirectory()) {
    packagePaths.push(join("packages", entry.name, "package.json"));
  }
}

for (const packagePath of packagePaths.sort()) {
  const manifest = JSON.parse(await readFile(join(root, packagePath), "utf8"));
  if (manifest.license !== expectedLicense) {
    failures.push(`${packagePath} must declare "license": "${expectedLicense}".`);
  }
}

const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (!String(rootManifest.packageManager ?? "").startsWith("pnpm@")) {
  failures.push('package.json must declare a pnpm packageManager.');
}

const workspace = await readFile(join(root, "pnpm-workspace.yaml"), "utf8");
if (!workspace.includes("minimumReleaseAge: 4320")) {
  failures.push("pnpm-workspace.yaml must keep the package-age gate configured.");
}

const licenseText = await readFile(join(root, "LICENSE"), "utf8");
if (!licenseText.includes("Elastic License") || !licenseText.includes("2.0")) {
  failures.push("LICENSE must contain Elastic License 2.0 text.");
}

const readme = await readFile(join(root, "README.md"), "utf8");
if (!readme.includes("source-available") || !readme.includes("Elastic License 2.0")) {
  failures.push("README.md must describe Kavio as source-available under Elastic License 2.0.");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`Package metadata verified for ${packagePaths.length} manifests.`);
