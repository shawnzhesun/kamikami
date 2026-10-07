import test from "node:test";
import assert from "node:assert/strict";
import { initialProject, makeLayer, validateProject } from "../src/model";
import { DEFAULT_FONT, fontFamilies, fontStack } from "../src/fonts";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
import { EditHistory } from "../src/history";
import { splitClips } from "../src/editor/editing";

test("older projects retain the original Arial appearance and new text defaults to Arial", () => {
  const legacy = JSON.parse(JSON.stringify(initialProject));
  for (const element of legacy.layers) delete element.fontFamily;
  const migrated = validateProject(legacy);
  assert.ok(
    migrated.layers.every((element) => element.fontFamily === DEFAULT_FONT),
  );
  assert.equal(fontStack(), "Arial, sans-serif");
  assert.equal(makeLayer("title", "New title").fontFamily, "Arial");
});

test("font selection survives saving, unrelated edits, splitting and Undo/Redo", () => {
  const before = structuredClone(initialProject);
  const command = AgentCommandSchema.parse({
    action: "update_layer",
    layerId: "title",
    patch: { fontFamily: "Georgia" },
    expectedRevision: "test",
  });
  const changed = applyAgentEdit(before, command, []);
  const restored = validateProject(JSON.parse(JSON.stringify(changed)));
  assert.equal(
    restored.layers.find((e) => e.id === "title")?.fontFamily,
    "Georgia",
  );
  assert.deepEqual(
    restored.layers.filter((e) => e.id !== "title"),
    before.layers.filter((e) => e.id !== "title"),
  );
  const moved = applyAgentEdit(
    restored,
    AgentCommandSchema.parse({
      action: "update_layer",
      layerId: "title",
      patch: { x: 10 },
      expectedRevision: "test",
    }),
    [],
  );
  assert.equal(
    moved.layers.find((e) => e.id === "title")?.fontFamily,
    "Georgia",
  );
  const split = splitClips(moved, ["title"], 48, () => "split-title").project;
  assert.equal(
    split.layers.find((e) => e.id === "split-title")?.fontFamily,
    "Georgia",
  );
  const history = new EditHistory<typeof before>();
  history.record(before);
  assert.deepEqual(history.undo(changed), before);
  assert.deepEqual(history.redo(before), changed);
});

test("supported font choices validate and unsupported font values are rejected", () => {
  for (const fontFamily of fontFamilies) {
    const project = validateProject({
      ...initialProject,
      layers: initialProject.layers.map((e) => ({ ...e, fontFamily })),
    });
    assert.equal(project.layers[0].fontFamily, fontFamily);
    assert.ok(fontStack(fontFamily).length > fontFamily.length);
  }
  assert.throws(() =>
    AgentCommandSchema.parse({
      action: "update_layer",
      layerId: "title",
      patch: { fontFamily: "url(https://example.com/font)" },
      expectedRevision: "test",
    }),
  );
});
