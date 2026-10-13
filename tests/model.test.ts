import test from "node:test";
import assert from "node:assert/strict";
import {
  initialProject,
  validateProject,
  channelValue,
  layerAtTime,
  type Channel,
} from "../src/model";
import { builtinEffects } from "../src/builtin-effects";
import { applyEffectToLayers } from "../src/effect-bundle";
test("starter project is valid", () => {
  assert.equal(validateProject(initialProject).duration, 15);
});
test("rejects external media and invalid effect references", () => {
  for (const src of [
    "https://example.com/a.mp4",
    "/media/../../secret.mp4",
    "file:///tmp/a.mp4",
  ]) {
    const p = structuredClone(initialProject);
    p.layers[0].src = src;
    assert.throws(() => validateProject(p));
  }
  const p = structuredClone(initialProject);
  p.layers[0].effects[0].effectId = "missing";
  assert.throws(() => validateProject(p));
});
test("rejects duplicate IDs and out-of-bounds clips", () => {
  const p = structuredClone(initialProject);
  p.layers.push(structuredClone(p.layers[0]));
  assert.throws(() => validateProject(p));
  const q = structuredClone(initialProject);
  q.layers[0].start = 10;
  assert.throws(() => validateProject(q));
});
test("effect curves are deterministic under arbitrary seek order", () => {
  const c: Channel = {
    property: "scale",
    curve: "sine",
    from: 1,
    to: 2,
    frequency: 1,
    phase: 0,
  };
  assert.equal(channelValue(c, 0, 15), 1);
  assert.equal(channelValue(c, 0.5, 15), 2);
  assert.equal(channelValue(c, 1, 15), 1);
  const a = layerAtTime(initialProject.layers[0], initialProject.effects, 3.5);
  layerAtTime(initialProject.layers[0], initialProject.effects, 12);
  assert.deepEqual(
    layerAtTime(initialProject.layers[0], initialProject.effects, 3.5),
    a,
  );
});
test("zero strength is neutral and disabled effects do not apply", () => {
  const l = structuredClone(initialProject.layers[0]);
  l.effects[0].amount = 0;
  assert.equal(layerAtTime(l, initialProject.effects, 15).scale, 1);
  l.effects[0].amount = 1;
  l.effects[0].enabled = false;
  assert.equal(layerAtTime(l, initialProject.effects, 15).scale, 1);
});
test("eased camera push reaches exact start and end values", () => {
  const c = initialProject.effects[0].channels[0];
  assert.equal(channelValue(c, 0, 15), 1);
  assert.equal(channelValue(c, 15, 15), 1.12);
});

test("an element holds up to 16 effects and says so plainly when full", () => {
  const p = validateProject(initialProject);
  const title = p.layers.find((l) => l.type === "title")!;
  const cards = builtinEffects.filter((e) => e.overlay).slice(0, 17);
  let next = p;
  for (const effect of cards.slice(0, 16 - title.effects.length))
    next = applyEffectToLayers(next, effect, [title.id]);
  assert.equal(next.layers.find((l) => l.id === title.id)!.effects.length, 16);
  const extra = cards[16];
  assert.throws(
    () => applyEffectToLayers(next, extra, [title.id]),
    (e: Error) =>
      e.message ===
      `“${title.name}” already has 16 effects, the most one element can hold. Remove one to add ${extra.name}.`,
  );
  // Re-applying an effect it already has is not a new one.
  const again = cards[0];
  assert.doesNotThrow(() => applyEffectToLayers(next, again, [title.id]));
  // Projects that arrive over the limit name the element in one sentence.
  const over = {
    ...next,
    effects: [...next.effects, extra],
    layers: next.layers.map((l) =>
      l.id === title.id
        ? {
            ...l,
            effects: [
              ...l.effects,
              { effectId: extra.id, amount: 1, enabled: true },
            ],
          }
        : l,
    ),
  };
  assert.throws(
    () => validateProject(over),
    (e: Error) =>
      e.message ===
        `“${title.name}”: An element can hold up to 16 effects. Remove one first.` &&
      !e.message.includes("{"),
  );
});
