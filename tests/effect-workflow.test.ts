import { builtinEffects } from "../src/builtin-effects";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EffectBundleSchema,
  EffectPackSchema,
  applyEffectToLayers,
  effectCollections,
  importSummary,
  makeEffectPack,
  parseEffectFile,
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
    // Shared effects are free to share; older files' licenses are dropped.
    assert.equal("license" in a.bundle, false);
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
test("effect application snapshots recipes, is idempotent and rejects audio", () => {
  const p = structuredClone(initialProject),
    id = p.layers[0].id;
  const next = applyEffectToLayers(p, effect, [id]);
  assert.equal(next.effects.length, p.effects.length + 1);
  assert.deepEqual(applyEffectToLayers(next, effect, [id]), next);
  assert.equal(
    p.layers[0].effects.some((e) => e.effectId === effect.id),
    false,
  );
  assert.deepEqual(
    applyEffectToLayers(next, { ...effect, name: "New recipe" }, [id]),
    next,
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
    assert.equal("license" in imported.bundle, false);
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

const recipe = (id: string, name: string, patch = {}) => ({
  ...effect,
  id,
  name,
  ...patch,
});
test("packs carry several effects with their authors and need a fitting engine", () => {
  const slam = builtinEffects.find((e) => e.id === "kinetic-slam")!;
  const pack = makeEffectPack(
    {
      name: "  Night Shift: Vol. 2 ",
      author: "QA",
      description: "Test pack",
    },
    [
      { author: "QA", effect: recipe("a", "Sway") },
      { author: "Guest", effect: slam },
    ],
  );
  assert.equal(pack.id, "night-shift-vol-2");
  assert.equal(pack.name, "Night Shift: Vol. 2");
  // The newest engine any effect needs.
  assert.equal(pack.engine, "kamikami-visual-v8");
  assert.deepEqual(Object.keys(pack.effects[0]), ["effect"]);
  assert.equal(pack.effects[1].author, "Guest");
  const read = parseEffectFile(JSON.parse(JSON.stringify(pack)));
  assert.equal(read.pack?.id, "night-shift-vol-2");
  assert.equal(read.bundles.length, 2);
  assert.equal(read.bundles[0].author, "QA");
  assert.equal(read.bundles[1].author, "Guest");
  // Packs written with licenses still read, without them.
  const licensed = parseEffectFile({
    ...pack,
    license: "CC0-1.0",
    effects: pack.effects.map((e) => ({ ...e, license: "MIT" })),
  });
  assert.equal(licensed.bundles.length, 2);
  assert.equal("license" in licensed.pack!, false);
  assert.equal("license" in licensed.bundles[0], false);
  assert.equal("license" in JSON.parse(JSON.stringify(pack)), false);
  assert.equal(read.bundles[1].engine, "kamikami-visual-v8");
  // Single-effect bundles still read.
  assert.equal(parseEffectFile(bundle).bundles[0].name, "Test effect");
  assert.throws(() => parseEffectFile({ effects: [] }), /isn't a KamiKami/);
  assert.throws(() =>
    EffectPackSchema.parse({ ...pack, engine: "frameforge-curves-v1" }),
  );
  assert.throws(
    () =>
      EffectPackSchema.parse({
        ...pack,
        effects: [pack.effects[0], pack.effects[0]],
      }),
    /own ID/,
  );
  assert.throws(() => EffectPackSchema.parse({ ...pack, id: "Bad ID" }));
  assert.throws(() =>
    EffectPackSchema.parse({
      ...pack,
      effects: [{ effect: { ...slam, shader: "x" } }],
    }),
  );
  assert.throws(() =>
    makeEffectPack({ ...pack, name: " " }, [pack.effects[0]]),
  );
  assert.throws(() => makeEffectPack(pack, []), /at least one/);
});

test("importing a pack again updates it in place, and removed packs stay removed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-effect-packs-"));
  const info = {
    name: "Neon",
    author: "QA",
    description: "",
  };
  const terms = { author: "QA" };
  try {
    const lib = new EffectLibrary(dir);
    const v1 = makeEffectPack(info, [
      { ...terms, effect: recipe("glow", "Glow") },
      { ...terms, effect: recipe("buzz", "Buzz") },
    ]);
    const first = await lib.importFile(v1);
    assert.equal(first.pack?.id, "neon");
    assert.equal(first.imported.length, 2);
    assert.equal(importSummary(first), "Imported Neon (2 effects)");
    const glowId = first.imported[0].bundle.effect.id;
    assert.match(glowId, /^user-/);
    assert.equal(first.imported[0].packEffectId, "glow");

    const v2 = makeEffectPack({ ...info, description: "v2" }, [
      { ...terms, effect: recipe("glow", "Glow", { tint: 0.3 }) },
      { ...terms, effect: recipe("flare", "Flare") },
    ]);
    const second = await lib.importFile(v2);
    assert.equal(
      importSummary(second),
      "Updated Neon: 1 effect updated, 1 added, 1 removed",
    );
    let listed = await lib.list();
    assert.equal(listed.length, 2);
    const glow = listed.find((e) => e.packEffectId === "glow")!;
    assert.equal(glow.bundle.effect.id, glowId);
    assert.equal(glow.bundle.effect.tint, 0.3);
    assert.equal(glow.pack?.description, "v2");

    // A single bundle is never part of a pack.
    const single = await lib.importFile(bundle);
    assert.equal(single.pack, undefined);
    assert.equal(single.imported[0].pack, undefined);

    assert.deepEqual(await lib.removePack("neon"), {
      removed: 2,
      packId: "neon",
    });
    await assert.rejects(lib.removePack("neon"), /isn't installed/);
    // A project that used the pack doesn't bring its effects back as My effects.
    await lib.syncProjectEffects([glow.bundle.effect]);
    assert.deepEqual(
      (await lib.list()).map((e) => e.bundle.name),
      ["Test effect"],
    );
    // Importing it again restores the same IDs.
    const third = await lib.importFile(v2);
    assert.equal(third.imported[0].bundle.effect.id, glowId);
    assert.equal(importSummary(third), "Imported Neon (2 effects)");
    listed = await new EffectLibrary(dir).list();
    assert.equal(listed.length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("agents export several entries as one pack", () => {
  assert.ok(
    AgentCommandSchema.safeParse({
      action: "export_effect_bundle",
      userEffectIds: ["a", "b"],
      name: "Mine",
    }).success,
  );
  assert.equal(
    AgentCommandSchema.safeParse({
      action: "export_effect_bundle",
      userEffectIds: [],
    }).success,
    false,
  );
  const pack = makeEffectPack({ name: "P", author: "", description: "" }, [
    { author: "", effect: recipe("a", "A") },
  ]);
  for (const file of [bundle, pack])
    assert.ok(
      AgentCommandSchema.safeParse({
        action: "import_effect_bundle",
        bundle: file,
      }).success,
    );
});

test("libraries saved with licenses read without them", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-effect-licenses-"));
  try {
    const old = {
      id: "e1",
      savedAt: "2026-01-01",
      collection: "library",
      bundle: { ...bundle, license: "CC0-1.0" },
      pack: { id: "p", name: "P", author: "", description: "", license: "MIT" },
      packEffectId: "a",
    };
    await writeFile(path.join(dir, "effects.json"), JSON.stringify([old]));
    const [entry] = await new EffectLibrary(dir).list();
    assert.equal("license" in entry.bundle, false);
    assert.equal("license" in entry.pack!, false);
    assert.equal(entry.pack?.name, "P");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
