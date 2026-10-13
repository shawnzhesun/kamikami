import test from "node:test";
import assert from "node:assert/strict";
import { EditorBridge } from "../server/editor-bridge";
import {
  AgentCommandSchema,
  applyAgentEdit,
  reorderLayers,
} from "../src/agent-protocol";
import { initialProject } from "../src/model";

test("agent mutations preserve unrelated content and reject invalid layers/sources/order", () => {
  const p = structuredClone(initialProject),
    command = AgentCommandSchema.parse({
      action: "add_text",
      text: "Hello",
      expectedRevision: "a",
    });
  const next = applyAgentEdit(p, command, []);
  assert.equal(next.layers.length, p.layers.length + 1);
  assert.deepEqual(next.layers.slice(0, -1), p.layers);
  const changed = applyAgentEdit(
    next,
    AgentCommandSchema.parse({
      action: "update_layer",
      layerId: next.layers.at(-1)!.id,
      patch: { x: 80 },
      expectedRevision: "b",
    }),
    [],
  );
  assert.equal(changed.layers.at(-1)!.x, 80);
  assert.throws(
    () =>
      applyAgentEdit(
        p,
        AgentCommandSchema.parse({
          action: "update_layer",
          layerId: "missing",
          patch: { x: 1 },
          expectedRevision: "c",
        }),
        [],
      ),
    /Element not found/,
  );
  assert.throws(
    () =>
      applyAgentEdit(
        p,
        AgentCommandSchema.parse({
          action: "update_layer",
          layerId: p.layers[0].id,
          patch: { src: "/media/invented.png" },
          expectedRevision: "c",
        }),
        [],
      ),
    /existing source/,
  );
  assert.throws(() => reorderLayers(p, [p.layers[0].id]), /every layer/);
  const reversed = reorderLayers(p, p.layers.map((l) => l.id).reverse());
  assert.deepEqual(reversed.layers, [...p.layers].reverse());
  assert.deepEqual(p, initialProject);
  assert.throws(() =>
    AgentCommandSchema.parse({
      action: "update_layer",
      layerId: p.layers[0].id,
      patch: { x: 99999 },
      expectedRevision: "c",
    }),
  );
});
test("bridge tracks actual sessions, gives commands only to the primary editor, and validates replies", async () => {
  let now = 1000;
  const b = new EditorBridge(() => now);
  const a = b.connect("test-client", "1");
  assert.equal(b.status().clients[0].name, "test-client");
  await assert.rejects(
    b.request(a.id, { action: "get_project" }),
    /Open KamiKami/,
  );
  assert.equal(b.poll("editor-a").primary, true);
  assert.equal(b.poll("editor-b").primary, false);
  const request = b.request(a.id, { action: "get_project" }),
    batch = b.poll("editor-a");
  assert.equal(batch.requests.length, 1);
  assert.equal(b.poll("editor-a").requests.length, 0);
  assert.throws(
    () => b.reply("editor-b", batch.requests[0].id, {}),
    /does not belong/,
  );
  b.reply("editor-a", batch.requests[0].id, { revision: "a:0" });
  assert.deepEqual(await request, { revision: "a:0" });
  now += 16000;
  assert.equal(b.status().clients.length, 0);
  assert.equal(b.status().editorConnected, false);
});
test("bridge times out abandoned requests and removes queued edits on disconnect", async () => {
  const b = new EditorBridge(() => Date.now(), 30),
    a = b.connect("test", "1");
  b.poll("editor");
  await assert.rejects(
    b.request(a.id, { action: "get_project" }),
    /did not acknowledge/,
  );
  const pending = b.request(a.id, { action: "get_project" });
  b.disconnect(a.id);
  await assert.rejects(pending, /disconnected/);
  assert.equal(b.poll("editor").requests.length, 0);
});
