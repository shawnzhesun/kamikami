import test from "node:test";
import assert from "node:assert/strict";
import { initialProject } from "../src/model";
import { allBuiltinEffects } from "../src/builtin-effects";
import { applyEffectDraft } from "../src/editor/effect-draft";
import { EditHistory } from "../src/history";

test("effect drafts stay isolated and saving is one undoable definition change", () => {
  const project = structuredClone(initialProject);
  const before = structuredClone(project);
  const original = project.effects[0];
  const draft = structuredClone(original);
  draft.name = "  Edited effect  ";
  draft.tint = 0.35;
  draft.channels[0].from = 0.5;
  assert.deepEqual(project, before);
  const next = applyEffectDraft(project, draft, original);
  assert.deepEqual(project, before);
  assert.equal(next.effects[0].name, "Edited effect");
  assert.equal(next.effects[0].tint, 0.35);
  assert.deepEqual(next.layers, project.layers);
  const history = new EditHistory<typeof project>();
  history.record(project);
  assert.deepEqual(history.undo(next), before);
  assert.deepEqual(history.redo(before), next);
});

test("saving an unused library definition adds it only on save", () => {
  const project = structuredClone(initialProject);
  const library = allBuiltinEffects.find(
    (effect) => !project.effects.some((item) => item.id === effect.id),
  )!;
  const draft = structuredClone(library);
  draft.tint = 0.4;
  const next = applyEffectDraft(project, draft, undefined);
  assert.equal(next.effects.length, project.effects.length + 1);
  assert.deepEqual(next.effects.at(-1), draft);
  assert.notEqual(library.tint, draft.tint);
  assert.ok(!project.effects.some((effect) => effect.id === draft.id));
});

test("saving preserves unrelated edits and rejects stale or invalid definitions", () => {
  const project = structuredClone(initialProject);
  const original = project.effects[0];
  const draft = { ...original, name: "New name" };
  const latest = { ...project, name: "Other project edit" };
  assert.equal(applyEffectDraft(latest, draft, original).name, latest.name);
  const changed = {
    ...project,
    effects: project.effects.map((effect) =>
      effect.id === original.id ? { ...effect, tint: 0.7 } : effect,
    ),
  };
  assert.throws(
    () => applyEffectDraft(changed, draft, original),
    /changed while settings were open/,
  );
  assert.throws(
    () => applyEffectDraft({ ...project, effects: [] }, draft, original),
    /changed while settings were open/,
  );
  assert.throws(
    () => applyEffectDraft(project, { ...draft, name: "  " }, original),
    /Enter an effect name/,
  );
  assert.throws(() =>
    applyEffectDraft(project, { ...draft, tint: 2 }, original),
  );
});
