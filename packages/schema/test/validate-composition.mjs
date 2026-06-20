import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrateComposition, migrateComposition01To01, validateComposition } from "../dist/index.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

async function readFixture(name) {
  return JSON.parse(await readFile(join(fixtureRoot, name), "utf8"));
}

const validComposition = await readFixture("valid-basic.json");

assert.deepEqual(validateComposition(validComposition), { ok: true, errors: [] });
assert.equal(migrateComposition01To01(validComposition), validComposition);
assert.equal(migrateComposition(validComposition), validComposition);
assert.equal(migrateComposition(validComposition, { fromVersion: "0.1", toVersion: "0.1" }), validComposition);

const invalidComposition = await readFixture("invalid-validation.json");
const invalidResult = validateComposition(invalidComposition);
assert.equal(invalidResult.ok, false);

assert.deepEqual(
  invalidResult.errors.map(({ code, path }) => ({ code, path })),
  [
    { code: "PROP_TYPE_MISMATCH", path: "props.headline.default" },
    { code: "SCHEMA_ASSET_TYPE_MISMATCH", path: "layers[0].asset" },
    { code: "SCHEMA_FRAME_RANGE_INVALID", path: "layers[0]" },
    { code: "SCHEMA_DUPLICATE_LAYER_ID", path: "layers[1].id" },
    { code: "SCHEMA_UNKNOWN_ASSET_REFERENCE", path: "layers[1].asset" },
    { code: "SCHEMA_KEYFRAME_VALUE_TYPE", path: "layers[1].keyframes.opacity[1].value" },
    { code: "SCHEMA_INVALID_EASING", path: "layers[1].keyframes.opacity[1].easing" },
    { code: "SCHEMA_KEYFRAMES_UNSORTED", path: "layers[1].keyframes.opacity[1].frame" },
    { code: "SCHEMA_INVALID_FIELD", path: "layers[2].style.fontSize" },
    { code: "SCHEMA_INVALID_FIELD", path: "exports[0].width" },
    { code: "SCHEMA_UNSUPPORTED_EXPORT_CODEC", path: "exports[0].codec" },
    { code: "PROP_UNDECLARED_PLACEHOLDER", path: "layers[2].text" }
  ]
);

assert.equal(
  invalidResult.errors.every((error) => error.stage === "validation" && error.retryable === false),
  true
);
