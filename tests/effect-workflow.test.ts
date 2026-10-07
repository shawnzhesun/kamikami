import { builtinEffects } from "../src/builtin-effects";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EffectBundleSchema,
  applyEffectToLayers,
  effectCollections,
} from "../src/effect-bundle";
import { EffectLibrary } from "../server/effect-library";
import { MediaLibrary } from "../server/media-library";
import { initialProject, makeLayer } from "../src/model";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
const effect = {
  ...initialProject.effects[0],
  id: "user-test",
  name: "Test effect",
};
const bundle = {
  format: "frameforge-effect",
  version: 1,
  engine: "frameforge-curves-v1",
  name: effect.name,
  author: "QA",
  license: "CC0-1.0",
  description: "Test",
  effect,
};
test("portable effects validate versions, reject executable payloads, remap collisions and persist", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-effects-"));
  try {
    const lib = new EffectLibrary(dir);
    const a = await lib.import(bundle),
      b = await lib.import(bundle);
    assert.notEqual(a.bundle.effect.id, b.bundle.effect.id);
    assert.equal(a.bundle.license, "CC0-1.0");
    assert.equal((await new EffectLibrary(dir).list()).length, 2);
    const c = await lib.import(a.bundle);
    assert.deepEqual(c.bundle.effect.channels, a.bundle.effect.channels);
    assert.throws(() => EffectBundleSchema.parse({ ...bundle, version: 99 }));
    assert.throws(() =>
      EffectBundleSchema.parse({ ...bundle, code: "eval('x')" }),
    );
    assert.throws(() =>
      EffectBundleSchema.parse({
        ...bundle,
        effect: { ...effect, shader: "x" },
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("effect application copies definitions, is idempotent and rejects audio and ID collisions", () => {
  const p = structuredClone(initialProject),
    id = p.layers[0].id;
  const next = applyEffectToLayers(p, effect, [id]);
  assert.equal(next.effects.length, p.effects.length + 1);
  assert.deepEqual(applyEffectToLayers(next, effect, [id]), next);
  assert.equal(
    p.layers[0].effects.some((e) => e.effectId === effect.id),
    false,
  );
  assert.throws(
    () => applyEffectToLayers(next, { ...effect, name: "Conflict" }, [id]),
    /conflicts/,
  );
  const audio = { ...makeLayer("audio", "Audio"), duration: 1 };
  assert.throws(
    () => applyEffectToLayers({ ...p, layers: [audio] }, effect, [audio.id]),
    /audio/,
  );
});
test("media trash retains source bytes, hides assets across reload and restores legacy imports", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-trash-"));
  try {
    await mkdir(path.join(dir, "media"));
    await writeFile(path.join(dir, "media", "legacy.png"), "test");
    const lib = new MediaLibrary(dir);
    await lib.setDeleted("/media/legacy.png", true);
    assert.equal((await lib.list()).length, 0);
    assert.equal((await new MediaLibrary(dir).list(true))[0].deleted, true);
    await lib.setDeleted("/media/legacy.png", false);
    assert.equal((await lib.list())[0].missing, false);
    await assert.rejects(
      lib.setDeleted("/media/../project.json", true),
      /Invalid/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("agent timeline tools preserve offsets and duration confirmation prevents silent trimming", () => {
  const p = structuredClone(initialProject);
  const id = p.layers[0].id;
  const run = (project: typeof p, command: Record<string, unknown>) =>
    applyAgentEdit(
      project,
      AgentCommandSchema.parse({ ...command, expectedRevision: "test" }),
      [],
    );
  const split = run(p, { action: "split_clips", layerIds: [id], frame: 48 });
  assert.equal(split.layers[1].effectOffset, 2);
  const trimmed = run(p, {
    action: "trim_clip",
    layerId: id,
    edge: "left",
    position: 1,
  });
  assert.equal(trimmed.layers[0].effectOffset, 1);
  const dup = run(p, { action: "duplicate_layers", layerIds: [id] });
  assert.equal(dup.layers.length, p.layers.length + 1);
  assert.notEqual(dup.layers[0].id, dup.layers[1].id);
  assert.throws(
    () => run(p, { action: "set_project_settings", duration: 1 }),
    /Confirm/,
  );
  assert.equal(
    run(p, { action: "set_project_settings", duration: 1, trimAffected: true })
      .duration,
    1,
  );
  assert.throws(
    () => run(p, { action: "delete_layers", layerIds: ["missing"] }),
    /not found/,
  );
});

test("agent creations and refinements persist in My effects without gallery duplicates", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-my-effects-"));
  try {
    const lib = new EffectLibrary(dir);
    const created = applyAgentEdit(
      initialProject,
      AgentCommandSchema.parse({
        action: "create_effect",
        effect,
        expectedRevision: "test",
      }),
      [],
    );
    let entries = await lib.syncProjectEffects(created.effects);
    assert.equal(entries.length, 1);
    const entryId = entries[0].id;
    assert.equal(entries[0].collection, "mine");
    assert.equal(entries[0].bundle.effect.id, effect.id);
    assert.equal(
      effectCollections(created, entries).library.length,
      builtinEffects.length,
    );
    const refined = applyAgentEdit(
      created,
      AgentCommandSchema.parse({
        action: "update_effect",
        effectId: effect.id,
        patch: { name: "Refined effect", tint: 0.5 },
        expectedRevision: "test",
      }),
      [],
    );
    const applied = applyEffectToLayers(refined, refined.effects.at(-1)!, [
      refined.layers[0].id,
    ]);
    entries = await lib.syncProjectEffects(applied.effects);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, entryId);
    assert.equal(entries[0].bundle.name, "Refined effect");
    assert.equal(entries[0].bundle.effect.tint, 0.5);
    const saved = await lib.save({
      ...entries[0].bundle,
      author: "Artist",
      license: "CC0-1.0",
    });
    assert.equal(saved.id, entryId);
    entries = await lib.syncProjectEffects(applied.effects);
    assert.equal(entries[0].bundle.author, "Artist");
    const imported = await lib.import(entries[0].bundle);
    assert.equal(imported.collection, "library");
    assert.notEqual(imported.bundle.effect.id, effect.id);
    const withImport = applyEffectToLayers(applied, imported.bundle.effect, [
      applied.layers[0].id,
    ]);
    entries = await lib.syncProjectEffects(withImport.effects);
    const collections = effectCollections(withImport, entries);
    assert.equal(collections.mine.length, 1);
    assert.equal(collections.library.length, builtinEffects.length + 1);
    assert.deepEqual(
      imported.bundle.effect.channels,
      saved.bundle.effect.channels,
    );
    assert.equal(imported.bundle.license, "CC0-1.0");
    // Project Undo/removal does not delete reusable saved entries.
    await lib.syncProjectEffects(initialProject.effects);
    assert.equal((await new EffectLibrary(dir).list()).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("legacy custom definitions migrate once without changing project IDs or old saved entries", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-effect-migration-"));
  try {
    const old = {
      id: "legacy-entry",
      savedAt: "2026-01-01",
      bundle: EffectBundleSchema.parse(bundle),
    };
    await writeFile(path.join(dir, "effects.json"), JSON.stringify([old]));
    const lib = new EffectLibrary(dir);
    const custom = {
      ...effect,
      id: "retro-tv-signal",
      name: "Retro TV Signal",
    };
    const project = {
      ...structuredClone(initialProject),
      effects: [...initialProject.effects, effect, custom],
    };
    const before = structuredClone(project);
    await lib.syncProjectEffects(project.effects);
    const entries = await lib.syncProjectEffects(project.effects);
    assert.deepEqual(project, before);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, "legacy-entry");
    assert.equal(entries[0].collection, "mine");
    assert.equal(entries[1].bundle.effect.id, "retro-tv-signal");
    assert.equal(effectCollections(project, entries).mine.length, 2);
    assert.equal(
      effectCollections(project, entries).library.length,
      builtinEffects.length,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("concurrent refinements keep one saved entry and invalid synchronization is atomic", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-effect-sync-"));
  try {
    const lib = new EffectLibrary(dir);
    await Promise.all([
      lib.syncProjectEffects([effect]),
      lib.syncProjectEffects([{ ...effect, tint: 0.2 }]),
      lib.syncProjectEffects([{ ...effect, tint: 0.4 }]),
    ]);
    assert.equal((await lib.list()).length, 1);
    assert.equal((await lib.list())[0].bundle.effect.tint, 0.4);
    await assert.rejects(lib.syncProjectEffects([{ ...effect, tint: 9 }]));
    assert.equal((await lib.list())[0].bundle.effect.tint, 0.4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
