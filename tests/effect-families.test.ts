import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  allBuiltinEffects,
  videoPlaybackEffects,
  remotionSceneEffects,
  motionEffects,
  builtinEffects,
  legacyBuiltinEffects,
  effectFamilies,
  getEffectFamily,
  effectVariationId,
  effectVariationPatch,
  effectSearchText,
} from "../src/builtin-effects";
import {
  EffectSchema,
  initialProject,
  layerAtTime,
  makeLayer,
  validateProject,
} from "../src/model";
import {
  effectCollections,
  applyEffectToLayers,
  effectEngine,
  EffectBundleSchema,
} from "../src/effect-bundle";
import { EffectLibrary } from "../server/effect-library";

test("gallery retains the consolidation and appends only the new video operations", () => {
  assert.equal(legacyBuiltinEffects.length, 36);
  assert.equal(
    builtinEffects.length,
    30 +
      videoPlaybackEffects.length +
      remotionSceneEffects.length +
      motionEffects.length,
  );
  assert.equal(
    new Set(allBuiltinEffects.map((e) => e.id)).size,
    allBuiltinEffects.length,
  );
  const before = structuredClone(initialProject);
  const { library } = effectCollections(initialProject, []);
  assert.equal(library.length, builtinEffects.length);
  for (const family of effectFamilies) {
    assert.equal(library.filter((e) => e.id === family.id).length, 1);
    for (const v of family.variations) {
      assert.ok(!library.some((e) => e.id === v.id));
      const original = legacyBuiltinEffects.find((e) => e.id === v.id)!;
      assert.deepEqual(
        allBuiltinEffects.find((e) => e.id === v.id),
        original,
      );
      assert.ok(
        effectSearchText(library.find((e) => e.id === family.id)!).includes(
          original.name.toLowerCase(),
        ),
      );
      assert.equal(getEffectFamily(v.id)?.id, family.id);
    }
  }
  assert.deepEqual(initialProject, before);
});

test("family variations preserve original active passes, their order, and evaluated motion", () => {
  for (const family of effectFamilies) {
    const base = builtinEffects.find((e) => e.id === family.id)!;
    assert.equal(effectVariationId(base), family.variations[0].id);
    for (const variation of family.variations) {
      const original = legacyBuiltinEffects.find((e) => e.id === variation.id)!;
      const updated = EffectSchema.parse({
        ...base,
        ...effectVariationPatch(base, variation.id),
      });
      assert.equal(effectVariationId(updated), variation.id);
      assert.equal(effectVariationId(original), variation.id);
      assert.deepEqual(
        updated.passes?.filter((p) => p.strength > 0),
        original.passes ?? [],
      );
      const layer = { ...makeLayer("image", "Drawing"), duration: 6 };
      for (const amount of [0, 0.5, 1, 2])
        for (const enabled of [false, true])
          for (const t of [0, 0.25, 2.5, 6]) {
            const evaluate = (effect: typeof base) =>
              layerAtTime(
                {
                  ...layer,
                  effects: [{ effectId: effect.id, enabled, amount }],
                },
                [effect],
                t,
              );
            assert.deepEqual(
              evaluate(updated),
              evaluate(original),
              variation.name,
            );
          }
      const bundle = EffectBundleSchema.parse({
        format: "frameforge-effect",
        version: 1,
        engine: effectEngine(updated),
        name: updated.name,
        effect: updated,
      });
      assert.deepEqual(
        EffectBundleSchema.parse(JSON.parse(JSON.stringify(bundle))).effect,
        updated,
      );
      const applied = applyEffectToLayers(initialProject, updated, [
        initialProject.layers[0].id,
      ]);
      assert.deepEqual(
        validateProject(JSON.parse(JSON.stringify(applied))),
        applied,
      );
    }
  }
});

test("variation edits preserve names and references, detect custom parameters, and cannot mutate defaults", () => {
  const flash = {
    ...builtinEffects.find((e) => e.id === "color-flash")!,
    name: "My flash",
    description: "My description",
  };
  const defaults = structuredClone(effectFamilies);
  const patch = effectVariationPatch(flash, "memory-red-flash")!;
  const red = { ...flash, ...patch };
  assert.equal(red.name, flash.name);
  assert.equal(red.description, flash.description);
  assert.equal(red.id, flash.id);
  assert.equal(effectVariationId(red), "memory-red-flash");
  assert.equal(red.passes![0].color, "#fa162a");
  assert.equal(red.passes![1].strength, 0);
  assert.equal(red.passes![1].timing, "in");
  patch.passes![0].color = "#123456";
  assert.equal(effectVariationId(red), "custom");
  assert.deepEqual(effectFamilies, defaults);
  assert.equal(effectVariationPatch(flash, "memory-sunset"), undefined);
  assert.equal(
    effectVariationPatch({ ...flash, id: "unrelated" }, "memory-red-flash"),
    undefined,
  );
});

test("legacy projects and saved effects stay intact and legacy presets do not leak into My effects", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-families-"));
  try {
    const store = new EffectLibrary(dir);
    assert.deepEqual(await store.syncProjectEffects(legacyBuiltinEffects), []);
    for (let index = 0; index < builtinEffects.length; index += 40)
      assert.deepEqual(
        await store.syncProjectEffects(builtinEffects.slice(index, index + 40)),
        [],
      );
    const old = legacyBuiltinEffects.find((e) => e.id === "memory-red-flash")!;
    const project = applyEffectToLayers(initialProject, old, [
      initialProject.layers[0].id,
    ]);
    const before = structuredClone(project);
    effectCollections(project, []);
    assert.deepEqual(project, before);
    const saved = await store.save({
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(old),
      name: old.name,
      effect: old,
    });
    assert.notEqual(saved.bundle.effect.id, old.id);
    assert.deepEqual(saved.bundle.effect.passes, old.passes);
    const imported = await store.import(saved.bundle);
    const entries = await store.syncProjectEffects(project.effects);
    assert.equal(entries.length, 2);
    const collections = effectCollections(project, entries);
    assert.equal(collections.mine[0].id, saved.id);
    assert.ok(
      collections.library.some((e) => e.id === imported.bundle.effect.id),
    );
    assert.equal(collections.library.length, builtinEffects.length + 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
