import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  initialProject,
  makeLayer,
  validateProject,
  resolveEffectInstance,
  layerAtTime,
  EffectSchema,
  type Project,
} from "../src/model";
import { remotionSceneEffects } from "../src/builtin-effects";
import {
  applyEffectToLayers,
  EffectBundleSchema,
  effectEngine,
} from "../src/effect-bundle";
import {
  applyEffectDraft,
  applyInstanceEffectDraft,
} from "../src/editor/effect-draft";
import { splitClips } from "../src/editor/editing";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
import { AnimatedText } from "../src/AnimatedText";
import { GraphicEffects } from "../src/GraphicEffects";
import { projectJson } from "../src/project-files";
import { EditHistory } from "../src/history";

const preset = EffectSchema.parse({
  ...remotionSceneEffects.find((effect) => effect.id === "text-neon")!,
  channels: [
    {
      property: "x",
      curve: "linear",
      from: 0,
      to: 100,
      frequency: 1,
      phase: 0,
    },
  ],
  passes: [
    {
      kind: "flash",
      color: "#ff0000",
      secondary: "#000000",
      strength: 0.5,
      size: 0.5,
      speed: 1,
      angle: 0,
      timing: "constant",
      seconds: 0.5,
      seed: 17,
    },
  ],
});
function setup() {
  const project = validateProject({
    ...initialProject,
    tracks: undefined,
    effects: [preset],
    layers: [
      {
        ...makeLayer("title", "First"),
        id: "first",
        text: "Title",
        duration: 6,
      },
      {
        ...makeLayer("title", "Second"),
        id: "second",
        text: "Title",
        duration: 6,
      },
    ],
  });
  return applyEffectToLayers(project, preset, ["first", "second"]);
}
const effective = (project: Project, index = 0) =>
  resolveEffectInstance(project.layers[index].effects[0], project.effects)!;
const textMarkup = (project: Project, index: number) =>
  renderToStaticMarkup(
    React.createElement(AnimatedText, {
      layer: project.layers[index],
      effects: project.effects,
      time: 1,
    }),
  );
const graphicsMarkup = (project: Project, index: number) =>
  renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer: project.layers[index],
      effects: project.effects,
      time: 1,
      children: React.createElement("span", null, "Title"),
    }),
  );

test("instance settings independently drive text, graphic passes and motion without mutating presets", () => {
  const project = setup(),
    before = structuredClone(project),
    original = effective(project);
  const draft = structuredClone(original);
  draft.name = "Green neon";
  draft.text!.color = "#00ff00";
  draft.channels[0].to = 400;
  draft.passes![0].color = "#0000ff";
  const next = applyInstanceEffectDraft(project, "first", draft, original);
  assert.deepEqual(project, before);
  assert.deepEqual(next.effects, project.effects);
  assert.deepEqual(next.layers[1], project.layers[1]);
  assert.notDeepEqual(
    next.layers[0].effects[0].settings,
    next.layers[1].effects[0].settings,
  );
  assert.notEqual(textMarkup(next, 0), textMarkup(project, 0));
  assert.equal(textMarkup(next, 1), textMarkup(project, 1));
  assert.notEqual(graphicsMarkup(next, 0), graphicsMarkup(project, 0));
  assert.equal(graphicsMarkup(next, 1), graphicsMarkup(project, 1));
  assert.notEqual(
    layerAtTime(next.layers[0], next.effects, 1).x,
    layerAtTime(next.layers[1], next.effects, 1).x,
  );
  assert.deepEqual(validateProject(JSON.parse(projectJson(next))), next);
  const history = new EditHistory<Project>();
  history.record(project);
  assert.deepEqual(history.undo(next), project);
  assert.deepEqual(history.redo(project), next);
});

test("preset changes affect future uses; existing snapshots and reapplying the preset stay unchanged", () => {
  const project = setup();
  const nextPreset = { ...preset, text: { ...preset.text!, color: "#00ff00" } };
  const updated = applyEffectDraft(project, nextPreset, project.effects[0]);
  assert.deepEqual(updated.layers, project.layers);
  assert.deepEqual(
    applyEffectToLayers(updated, nextPreset, ["first"]),
    updated,
  );
  const without = validateProject({
    ...updated,
    layers: updated.layers.map((layer) =>
      layer.id === "second" ? { ...layer, effects: [] } : layer,
    ),
  });
  const reapplied = applyEffectToLayers(without, nextPreset, ["second"]);
  assert.equal(effective(reapplied).text!.color, preset.text!.color);
  assert.equal(effective(reapplied, 1).text!.color, "#00ff00");
});

test("version-1 projects migrate independently with identical appearance and retain custom snapshots", () => {
  const project = setup();
  const legacy = {
    ...project,
    version: 1,
    layers: project.layers.map((layer) => ({
      ...layer,
      effects: layer.effects.map(
        ({ settings: _settings, ...instance }) => instance,
      ),
    })),
  };
  const migrated = validateProject(legacy);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.layers, project.layers);
  assert.notEqual(
    migrated.layers[0].effects[0].settings,
    migrated.layers[1].effects[0].settings,
  );
  assert.deepEqual(
    layerAtTime(legacy.layers[0], legacy.effects, 1),
    layerAtTime(migrated.layers[0], migrated.effects, 1),
  );
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(migrated))),
    migrated,
  );
  assert.throws(() => validateProject({ ...legacy, version: 999 }));
});

test("split, duplicate and portable exports keep the instance look and edits remain independent", () => {
  const project = setup(),
    original = effective(project);
  const local = applyInstanceEffectDraft(
    project,
    "first",
    { ...original, text: { ...original.text!, color: "#00ff00" } },
    original,
  );
  const split = splitClips(local, ["first"], 48, () => "split").project;
  const right = split.layers.find((layer) => layer.id === "split")!;
  assert.deepEqual(right.effects, local.layers[0].effects);
  const duplicate = applyAgentEdit(
    local,
    AgentCommandSchema.parse({
      action: "duplicate_layers",
      layerIds: ["first"],
      expectedRevision: "test",
    }),
    [],
  );
  const copy = duplicate.layers.find(
    (layer) => !["first", "second"].includes(layer.id),
  )!;
  assert.deepEqual(copy.effects, local.layers[0].effects);
  const changed = applyInstanceEffectDraft(
    duplicate,
    copy.id,
    { ...effective(local), tint: 0.3 },
    effective(local),
  );
  assert.deepEqual(
    changed.layers.find((layer) => layer.id === "first"),
    local.layers[0],
  );
  const effect = effective(local);
  const bundle = EffectBundleSchema.parse({
    format: "frameforge-effect",
    version: 1,
    engine: effectEngine(effect),
    name: effect.name,
    effect,
  });
  assert.equal(bundle.effect.text!.color, "#00ff00");
});

test("instance commands are scoped and reject stale drafts, missing targets and invalid parameters", () => {
  const project = setup(),
    original = effective(project);
  const next = applyAgentEdit(
    project,
    AgentCommandSchema.parse({
      action: "update_effect_instance",
      layerId: "first",
      effectId: preset.id,
      patch: { text: { ...original.text!, color: "#00ff00" } },
      expectedRevision: "test",
    }),
    [],
  );
  assert.equal(effective(next).text!.color, "#00ff00");
  assert.deepEqual(next.layers[1], project.layers[1]);
  assert.deepEqual(next.effects, project.effects);
  assert.throws(
    () => applyInstanceEffectDraft(next, "first", original, original),
    /changed while settings were open/,
  );
  assert.throws(
    () => applyInstanceEffectDraft(project, "missing", original, original),
    /removed/,
  );
  assert.throws(() =>
    applyInstanceEffectDraft(
      project,
      "first",
      { ...original, tint: 3 },
      original,
    ),
  );
  const concurrentlyChanged = validateProject({
    ...project,
    layers: project.layers.map((layer) => ({
      ...layer,
      effects: layer.effects.map((instance) => ({
        ...instance,
        amount: 0.4,
        enabled: false,
      })),
    })),
  });
  const saved = applyInstanceEffectDraft(
    concurrentlyChanged,
    "first",
    { ...original, tint: 0.2 },
    original,
  );
  assert.equal(saved.layers[0].effects[0].amount, 0.4);
  assert.equal(saved.layers[0].effects[0].enabled, false);
});
