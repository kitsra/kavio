import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCatalog } from "../dist/catalog.js";
import { createServer } from "../dist/server.js";

const valid = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 30, background: "#000000" },
  assets: {},
  layers: [{ id: "t", type: "text", text: "hi", startFrame: 0, durationFrames: 30 }],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(createCatalog());
  const client = new Client({ name: "test", version: "0.0.0" }, { capabilities: {} });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test("tools/list returns the catalog tools", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  assert.ok(tools.find((t) => t.name === "validate_composition"));
});

test("tools/call validate works over the transport", async () => {
  const client = await connect();
  const res = await client.callTool({ name: "validate_composition", arguments: { document: valid } });
  assert.equal(res.isError ?? false, false);
});

test("tools/call surfaces validation errors as isError", async () => {
  const client = await connect();
  const bad = { ...valid, composition: { ...valid.composition, durationFrames: 0 } };
  const res = await client.callTool({ name: "validate_composition", arguments: { document: bad } });
  assert.equal(res.isError, true);
});

test("resources/list and prompts/list work", async () => {
  const client = await connect();
  assert.ok((await client.listResources()).resources.length >= 4);
  assert.ok((await client.listPrompts()).prompts.length >= 3);
});

test("prompts/get renders a prompt", async () => {
  const client = await connect();
  const res = await client.getPrompt({ name: "author_kavio_video", arguments: { brief: "a teaser" } });
  assert.ok(res.messages[0].content.text.includes("a teaser"));
});
