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

test("agent edits: font switches snap to real faces and bring imported fonts along", () => {
  const p = applyAgentEdit(
    structuredClone(initialProject),
    AgentCommandSchema.parse({
      action: "add_text",
      text: "Hi",
      expectedRevision: "a",
    }),
    [],
  );
  const id = p.layers.at(-1)!.id;
  const impact = {
    id: "custom-0123456789abcdef01234567",
    family: "Impact",
    category: "Sans serif" as const,
    variants: [
      {
        src: "/fonts/imported/" + "a".repeat(64) + ".ttf",
        weightMin: 400,
        weightMax: 400,
        style: "normal" as const,
      },
    ],
  };
  const edit = (patch: Record<string, unknown>, library = [impact]) =>
    applyAgentEdit(
      {
        ...p,
        layers: p.layers.map((l) =>
          l.id === id
            ? { ...l, fontWeight: 800, fontStyle: "italic" as const }
            : l,
        ),
      },
      AgentCommandSchema.parse({
        action: "update_layer",
        layerId: id,
        patch,
        expectedRevision: "b",
      }),
      [],
      [],
      library,
    );
  const next = edit({ fontId: impact.id });
  const title = next.layers.find((l) => l.id === id)!;
  assert.deepEqual(
    [title.fontWeight, title.fontStyle],
    [400, "normal"],
    "nearest face",
  );
  assert.deepEqual(
    next.fonts?.map((f) => f.id),
    [impact.id],
    "imported font joins the project",
  );
  // An explicit weight the font lacks is still an error, and unknown fonts fail.
  assert.throws(
    () => edit({ fontId: impact.id, fontWeight: 800 }),
    /Unsupported weight/,
  );
  assert.throws(() => edit({ fontId: impact.id }, []), /font/i);
});

test("agent edits: effect patches merge sections; add_media takes a source offset", () => {
  let p = structuredClone(initialProject);
  const title = p.layers.find((l) => l.type === "title")!;
  p = applyAgentEdit(
    p,
    AgentCommandSchema.parse({
      action: "create_effect",
      effect: {
        id: "beat",
        name: "Beat",
        text: {
          kind: "pulse",
          seconds: 1,
          stagger: 0.2,
          unit: "word",
          tempo: 100,
        },
      },
      expectedRevision: "a",
    }),
    [],
  );
  p = {
    ...p,
    layers: p.layers.map((l) =>
      l.id === title.id
        ? { ...l, effects: [{ effectId: "beat", amount: 1, enabled: true }] }
        : l,
    ),
  };
  const next = applyAgentEdit(
    p,
    AgentCommandSchema.parse({
      action: "update_effect_instance",
      layerId: title.id,
      effectId: "beat",
      patch: { text: { tempo: 128 } },
      expectedRevision: "b",
    }),
    [],
  );
  const settings = next.layers.find((l) => l.id === title.id)!.effects[0]
    .settings!;
  assert.equal(settings.text!.tempo, 128);
  assert.equal(settings.text!.kind, "pulse", "the rest of the section stays");
  assert.throws(() =>
    AgentCommandSchema.parse({
      action: "update_effect",
      effectId: "beat",
      patch: { bogus: 1 },
      expectedRevision: "c",
    }),
  );
  const song = {
    src: "/media/song.m4a",
    name: "song.m4a",
    type: "audio" as const,
    size: 1,
    duration: 30,
    width: null,
    height: null,
    peaks: [],
    missing: false,
  };
  const placed = applyAgentEdit(
    next,
    AgentCommandSchema.parse({
      action: "add_media",
      src: song.src,
      offset: 10,
      expectedRevision: "d",
    }),
    [song.src],
    [song],
  ).layers.at(-1)!;
  assert.deepEqual(
    [placed.offset, placed.duration],
    [10, Math.min(20, next.duration)],
  );
  assert.throws(
    () =>
      applyAgentEdit(
        next,
        AgentCommandSchema.parse({
          action: "add_media",
          src: song.src,
          offset: 25,
          duration: 10,
          expectedRevision: "e",
        }),
        [song.src],
        [song],
      ),
    /source duration/,
  );
});
