import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  builtinEffects,
  effectFamilies,
  effectVariationPatch,
} from "../src/builtin-effects";
import {
  initialProject,
  validateProject,
  makeLayer,
  resolveEffectInstance,
} from "../src/model";
import {
  effectCollections,
  effectForApplication,
  libraryEffect,
  applyEffectToLayers,
  effectEngine,
} from "../src/effect-bundle";
import { forkEffect } from "../src/editor/effect-draft";
import { EffectLibrary } from "../server/effect-library";
import { EffectSettingsDialog } from "../src/editor/EffectSettingsDialog";
import { EffectPresetPicker } from "../src/editor/EffectPresetPicker";

const source = builtinEffects.find((effect) => effect.id === "color-flash")!;

test("library recipes stay original while historical instances keep their appearance", () => {
  const customized = { ...source, tint: 0.75, name: "Old project edit" };
  const project = validateProject({
    ...initialProject,
    effects: [customized],
    tracks: undefined,
    layers: [
      {
        ...makeLayer("scene", "Existing"),
        effects: [{ effectId: source.id, enabled: true, amount: 1 }],
      },
      makeLayer("scene", "New"),
    ],
  });
  assert.deepEqual(
    effectCollections(project, []).library.find(
      (effect) => effect.id === source.id,
    ),
    source,
  );
  assert.deepEqual(effectForApplication(project, [], source.id), source);
  const applied = applyEffectToLayers(project, source, [project.layers[1].id]);
  assert.deepEqual(applied.layers[0], project.layers[0]);
  assert.equal(
    resolveEffectInstance(applied.layers[1].effects[0], applied.effects)!.tint,
    source.tint,
  );
});

test("forks persist independently of imported originals and retain named starting points", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-fork-"));
  try {
    const store = new EffectLibrary(dir);
    const imported = await store.import({
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(source),
      name: source.name,
      effect: { ...source, presetFamilyId: source.id },
    });
    const original = structuredClone(imported);
    const fork = forkEffect(imported.bundle.effect, "user-fork-test");
    const patch = effectVariationPatch(fork, "memory-red-flash")!;
    const saved = await store.save({
      ...imported.bundle,
      name: fork.name,
      effect: { ...fork, ...patch },
    });
    const edited = { ...saved.bundle.effect, tint: 0.37 };
    await store.syncProjectEffects([edited]);
    const entries = await new EffectLibrary(dir).list();
    assert.deepEqual(
      entries.find((entry) => entry.id === imported.id),
      original,
    );
    assert.equal(
      entries.find((entry) => entry.id === saved.id)!.bundle.effect.tint,
      0.37,
    );
    assert.ok(libraryEffect(imported.bundle.effect.id, entries));
    assert.equal(libraryEffect(fork.id, entries), undefined);
    assert.equal(
      entries.find((entry) => entry.id === saved.id)!.bundle.effect
        .presetFamilyId,
      source.id,
    );
    assert.equal(
      effectVariationPatch(edited, "memory-red-flash")!.passes![0].color,
      "#fa162a",
    );
    assert.notEqual(fork.id, source.id);
    assert.throws(() => forkEffect(source, source.id), /new effect ID/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preset selection replaces all parameters, permits further edits and can reset the same preset again", () => {
  const before = structuredClone(effectFamilies);
  const fork = forkEffect(source, "user-flash-copy");
  const patch = effectVariationPatch(fork, "memory-red-flash")!;
  const draft = { ...fork, ...patch, tint: 0.4 };
  draft.passes![0].color = "#123456";
  const reset = {
    ...draft,
    ...effectVariationPatch(draft, "memory-red-flash"),
  };
  assert.equal(reset.passes![0].color, "#fa162a");
  assert.equal(reset.tint, source.tint);
  assert.equal(reset.id, fork.id);
  assert.equal(reset.name, fork.name);
  assert.deepEqual(effectFamilies, before);
  const html = renderToStaticMarkup(
    React.createElement(EffectPresetPicker, { effect: draft, onChange() {} }),
  );
  assert.match(html, /Choose a preset/);
  assert.doesNotMatch(html, /Custom/);
});

test("library inspection offers Fork without name editing, deletion or saving", () => {
  const html = renderToStaticMarkup(
    React.createElement(EffectSettingsDialog, {
      name: source.name,
      busy: false,
      error: "",
      mode: "library",
      onFork() {},
      onDelete() {},
      onNameChange() {},
      onClose() {},
      onSave() {},
      children: React.createElement("input", { defaultValue: source.name }),
    }),
  );
  assert.match(html, /<fieldset disabled/);
  assert.match(html, /aria-label="Fork effect"/);
  assert.doesNotMatch(
    html,
    /Export effect|Delete from My effects|aria-label="Effect name"/,
  );
  assert.doesNotMatch(html, /Save changes/);
});

test("deleting a personal preset persists across project sync and leaves timeline instances intact", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-effect-delete-"));
  try {
    const store = new EffectLibrary(dir);
    const saved = await store.save({
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(source),
      name: source.name,
      effect: forkEffect(source, "user-delete-test"),
    });
    const project = applyEffectToLayers(initialProject, saved.bundle.effect, [
      initialProject.layers[0].id,
    ]);
    const before = structuredClone(project);
    await store.delete(saved.bundle.effect.id);
    assert.deepEqual(await store.list(), []);
    const reopened = new EffectLibrary(dir);
    assert.deepEqual(await reopened.syncProjectEffects(project.effects), []);
    assert.deepEqual(await reopened.list(), []);
    assert.deepEqual(
      validateProject(JSON.parse(JSON.stringify(project))),
      before,
    );
    const instance = project.layers[0].effects.find(
      (item) => item.effectId === saved.bundle.effect.id,
    )!;
    assert.deepEqual(
      resolveEffectInstance(instance, project.effects),
      saved.bundle.effect,
    );
    const imported = await reopened.import(saved.bundle);
    await assert.rejects(
      reopened.delete(imported.bundle.effect.id),
      /Only effects in My effects/,
    );
    await assert.rejects(
      reopened.delete(source.id),
      /Only effects in My effects/,
    );
    const copied = await reopened.save(saved.bundle);
    assert.notEqual(copied.bundle.effect.id, saved.bundle.effect.id);
    assert.equal(
      (await reopened.syncProjectEffects(project.effects)).length,
      2,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("personal effect management buttons live in the header and are disabled during requests", () => {
  const html = renderToStaticMarkup(
    React.createElement(EffectSettingsDialog, {
      name: "My effect",
      mode: "personal",
      busy: true,
      error: "",
      onClose() {},
      onSave() {},
      onFork() {},
      onDelete() {},
      onNameChange() {},
      children: React.createElement("input"),
    }),
  );
  const header = html.split('class="effect-dialog-body"')[0];
  assert.match(header, /aria-label="Effect name"/);
  assert.doesNotMatch(header, /Rename effect/);
  assert.match(header, /disabled=""[^>]*aria-label="Fork effect"/);
  assert.match(header, /disabled=""[^>]*aria-label="Delete from My effects"/);
  assert.doesNotMatch(
    html.split('class="effect-dialog-body"')[1],
    /Fork effect|Delete from My effects/,
  );
});

test("applied instances expose no name input or preset management actions", () => {
  const html = renderToStaticMarkup(
    React.createElement(EffectSettingsDialog, {
      name: "Neon",
      mode: "instance",
      busy: false,
      error: "",
      onClose() {},
      onSave() {},
      onNameChange() {},
      onFork() {},
      onDelete() {},
      children: React.createElement("input", { "aria-label": "Glow strength" }),
    }),
  );
  assert.doesNotMatch(
    html,
    /aria-label="Effect name"|Fork effect|Delete from My effects/,
  );
  assert.match(html, /Save changes/);
  assert.match(html, /Glow strength/);
});
