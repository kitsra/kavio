import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../dist/catalog.js";
import { toAnthropicTools } from "../dist/adapters/anthropic.js";
import { toOpenAITools } from "../dist/adapters/openai.js";
import { toGeminiTools } from "../dist/adapters/gemini.js";

const tools = createCatalog().tools;

test("anthropic adapter shape + parity", () => {
  const a = toAnthropicTools(tools);
  assert.equal(a.length, tools.length);
  assert.ok(a.every((t) => t.name && t.description && t.input_schema));
  assert.deepEqual(
    a.map((t) => t.name).sort(),
    tools.map((t) => t.name).sort()
  );
});

test("openai adapter shape", () => {
  const o = toOpenAITools(tools);
  assert.equal(o.length, tools.length);
  assert.ok(o.every((t) => t.type === "function" && t.function.name && t.function.parameters));
});

test("gemini adapter shape + sanitization", () => {
  const g = toGeminiTools(tools);
  assert.equal(g.length, 1);
  assert.equal(g[0].functionDeclarations.length, tools.length);
  const json = JSON.stringify(g);
  assert.ok(!json.includes("$schema"), "gemini strips $schema");
  assert.ok(!json.includes("additionalProperties"), "gemini strips additionalProperties");
});

test("anthropic retains additionalProperties (not sanitized)", () => {
  const json = JSON.stringify(toAnthropicTools(tools));
  assert.ok(json.includes("additionalProperties"), "anthropic keeps the original JSON Schema");
});
