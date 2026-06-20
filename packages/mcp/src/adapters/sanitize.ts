import type { JsonSchema } from "../types.js";

const GEMINI_UNSUPPORTED_KEYS = new Set(["$schema", "$id", "additionalProperties"]);

/** Strip JSON Schema keys that Gemini's function-declaration subset rejects. */
export function stripForGemini(schema: JsonSchema): JsonSchema {
  return strip(schema) as JsonSchema;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strip);
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (GEMINI_UNSUPPORTED_KEYS.has(key)) {
        continue;
      }
      output[key] = strip(nested);
    }
    return output;
  }
  return value;
}
