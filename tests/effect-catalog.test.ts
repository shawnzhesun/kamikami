import test from "node:test";
import assert from "node:assert/strict";
import { builtinEffects, getEffectFamily } from "../src/builtin-effects";
import { applyEffectToLayers } from "../src/effect-bundle";
import {
  catalogEntries,
  describeEffect,
  findEffects,
  FindEffectsSchema,
} from "../src/effect-catalog";
import { effectRole, targetMismatch } from "../src/effect-roles";
import { EffectSchema, initialProject, validateProject } from "../src/model";
import { editorTools } from "../server/editor-tools";

const entries = catalogEntries();

test("find_effects lists every card compactly and filters by role, fit and element", () => {
  const all = findEffects(entries, { limit: 200, offset: 0 });
  assert.equal(all.total, builtinEffects.length);
  assert.equal(all.next, 200);
  assert.ok(all.roles, "first page explains the roles");
  // Compact: the whole catalog without variation lists is a small fraction of
  // the full definitions.
  const compact = JSON.stringify(
    findEffects(entries, { limit: 200, includeVariations: false }),
  ).length;
  assert.ok(compact < JSON.stringify(builtinEffects).length / 2);
  const overlays = findEffects(entries, { role: "overlay", limit: 200 });
  assert.ok(overlays.effects.every((e) => e.role === "overlay"));
  // An element type only returns cards that can apply to it.
  for (const elementType of ["title", "image", "video"] as const) {
    const fits = findEffects(entries, { elementType, limit: 200 });
    const all2 = findEffects(entries, { elementType, limit: 200, offset: 200 });
    for (const row of [...fits.effects, ...all2.effects]) {
      const effect = builtinEffects.find((e) => e.id === row.id)!;
      assert.equal(targetMismatch(effect, elementType), null, row.id);
    }
  }
  const forPictures = findEffects(entries, {
    elementType: "image",
    limit: 200,
  });
  assert.ok(!forPictures.effects.some((e) => e.fits === "text"));
  // Query words match names, feels and variation names.
  const balloon = findEffects(entries, { query: "thought" });
  assert.ok(balloon.effects.some((e) => e.id === "overlay-balloon"));
  const comic = findEffects(entries, { role: "overlay", feel: "comic" });
  assert.deepEqual(comic.effects.map((e) => e.id).sort(), [
    "overlay-badge",
    "overlay-balloon",
    "overlay-focuslines",
    "overlay-shake",
  ]);
  assert.throws(() => FindEffectsSchema.parse({ role: "sideways" }));
});

test("describe_effect explains fit, settings, shapes and variations for every card", () => {
  for (const effect of builtinEffects) {
    const d = describeEffect(entries, effect.id) as Record<string, unknown>;
    assert.equal(d.role, effectRole(effect).role, effect.id);
    assert.ok(d.fitsDescription && d.notFor, effect.id);
    const settings = d.settings as { path: string; range?: string }[];
    assert.ok(Array.isArray(settings), effect.id);
    assert.doesNotMatch(JSON.stringify(d), /NaN|Infinity/, effect.id);
  }
  const balloon = describeEffect(entries, "overlay-balloon") as {
    overlayKind: { variants: string[] };
    settings: { path: string; range?: string; meaning?: string }[];
    variations: {
      id: string;
      changes: { overlay?: Record<string, unknown> };
    }[];
  };
  assert.deepEqual(balloon.overlayKind.variants, [
    "0 = Speech",
    "1 = Thought",
    "2 = Shout",
    "3 = Whisper",
  ]);
  const label = balloon.settings.find((s) => s.path === "overlay.label")!;
  assert.equal(label.meaning, "Words");
  const stroke = balloon.settings.find((s) => s.path === "overlay.stroke")!;
  assert.match(stroke.range!, /marker \| pencil/);
  // Variations read as patches of what changes.
  const thought = balloon.variations.find(
    (v) => v.id === "ov-balloon-thought",
  )!;
  assert.deepEqual(thought.changes, { overlay: { label: "Hmm…", variant: 1 } });
  // Text cards show what the kind uses, not every text setting.
  const spring = describeEffect(entries, "kinetic-spring") as {
    settings: { path: string }[];
    notFor: string;
  };
  assert.ok(spring.settings.some((s) => s.path === "text.distance"));
  assert.ok(!spring.settings.some((s) => s.path === "text.cursor"));
  assert.match(spring.notFor, /images/);
  // Variation IDs resolve to their card; unknown IDs say what to do.
  assert.equal(
    (describeEffect(entries, "ov-balloon-shout") as { id: string }).id,
    "overlay-balloon",
  );
  assert.throws(() => describeEffect(entries, "nope"), /find_effects/);
});

test("apply_effect can apply a named variation as the instance's settings", () => {
  const p = validateProject(initialProject);
  const title = p.layers.find((l) => l.type === "title")!;
  const card = builtinEffects.find((e) => e.id === "overlay-balloon")!;
  const family = getEffectFamily(card.id)!;
  const shout = family.variations.find((v) => v.id === "ov-balloon-shout")!;
  const settings = EffectSchema.parse({ ...card, ...shout.parameters });
  const next = applyEffectToLayers(p, card, [title.id], settings);
  const instance = next.layers
    .find((l) => l.id === title.id)!
    .effects.find((i) => i.effectId === card.id)!;
  assert.equal(instance.settings!.overlay!.variant, 2);
  assert.equal(instance.settings!.overlay!.label, "WHAT?!");
  // The shared definition stays the card itself.
  assert.equal(next.effects.find((e) => e.id === card.id)!.overlay!.variant, 0);
});

test("the assistant and MCP expose the catalog tools", () => {
  const names = editorTools.map((t) => t.name);
  for (const name of ["find_effects", "describe_effect", "apply_effect"])
    assert.ok(names.includes(name), name);
  const apply = editorTools.find((t) => t.name === "apply_effect")!;
  assert.ok("variationId" in apply.input);
  for (const t of editorTools)
    if (t.name === "find_effects" || t.name === "describe_effect")
      assert.equal(t.access, "read");
});
