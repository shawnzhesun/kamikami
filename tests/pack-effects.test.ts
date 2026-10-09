import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EffectSchema,
  layerAtTime,
  makeLayer,
  type Effect,
} from "../src/model";
import {
  builtinEffectCategory,
  effectVariationId,
  effectVariationPatch,
  packEffectFamilies,
  packEffects,
  titleEffects,
} from "../src/builtin-effects";
import { GraphicEffects } from "../src/GraphicEffects";
import { AnimatedText } from "../src/AnimatedText";
import { effectEngine } from "../src/effect-bundle";
import { revealControls, revealKinds } from "../src/TransitionGraphicEffects";
import { TextEffectSchema } from "../src/text-effects";
import {
  odometerRolls,
  retypeText,
  sequenceStep,
  typeLoopText,
} from "../src/title-effects";

const looks = (cards: Effect[], families: typeof packEffectFamilies) =>
  cards.flatMap((card) => {
    const family = families.find((f) => f.id === card.id);
    return family
      ? family.variations.map((v) =>
          EffectSchema.parse({ ...card, ...v.parameters }),
        )
      : [card];
  });
const markup = (effect: Effect, time: number, amount = 1) =>
  renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer: {
        ...makeLayer("image", "I"),
        duration: 5,
        effects: [{ effectId: effect.id, amount, enabled: true }],
      },
      effects: [effect],
      time,
      children: "x",
    }),
  );

test("eleven visual cards with thirty looks, all v7, categorized and named", () => {
  assert.equal(packEffects.length, 11);
  const all = looks(packEffects, packEffectFamilies);
  assert.equal(all.length, 30);
  for (const kind of revealKinds) assert.ok(revealControls[kind], kind);
  for (const card of packEffects) {
    assert.notEqual(builtinEffectCategory(card.id), "Basics");
    if (packEffectFamilies.some((f) => f.id === card.id))
      assert.notEqual(effectVariationId(card), "custom", card.id);
  }
  for (const effect of all) {
    assert.equal(effectEngine(effect), "kamikami-visual-v7", effect.id);
    for (const time of [0, 0.3, 0.7, 2.5, 4.8])
      assert.ok(
        !/NaN|Infinity/.test(markup(effect, time)),
        `${effect.id} @ ${time}`,
      );
  }
});

test("reveals are hidden at full strength, open at zero, and partial between", () => {
  for (const effect of looks(packEffects, packEffectFamilies)) {
    const p = effect.passes?.[0];
    if (!p || p.timing !== "in") continue;
    // After the transition the pass is inactive: no filter wraps the element.
    assert.ok(!markup(effect, 3).includes("url(#"), `${effect.id} settles`);
    assert.match(
      markup(effect, 0.3),
      /feComposite[^>]*operator="in"/,
      effect.id,
    );
  }
  assert.ok(!markup(packEffects[0], 0.3, 0).includes("url(#"));
});

test("3D card moves pivot on their edge and survive variation changes", () => {
  const card = packEffects.find((e) => e.id === "card-3d")!;
  const layer = {
    ...makeLayer("image", "I"),
    duration: 5,
    effects: [{ effectId: card.id, amount: 1, enabled: true }],
  };
  const start = layerAtTime(layer, [card], 0);
  assert.equal(start.originX, -1);
  assert.ok(start.rotateY > 80);
  assert.equal(layerAtTime(layer, [card], 2).rotateY, 0);
  const roll = effectVariationPatch(card, "card-corner-roll")!;
  assert.deepEqual(roll.origin, { x: -1, y: 1 });
  const swap = effectVariationPatch(card, "card-swap-back")!;
  assert.equal(swap.origin, undefined, "variations without a pivot clear it");
});

test("line-sequence text helpers: retype, type loop, rotator steps and odometer", () => {
  const retype = TextEffectSchema.parse({ kind: "retype", seconds: 1 });
  assert.equal(retypeText("Draft\nFinal", retype, 0, 5).text, "Draft");
  assert.equal(retypeText("Draft\nFinal", retype, 2, 5).text, "Final");
  assert.match(retypeText("Draft\nFinal", retype, 0.5, 5).text, /^F/);
  const loop = TextEffectSchema.parse({ kind: "typeloop", speed: 1 });
  assert.equal(typeLoopText("One\nTwo", loop, 0, 4).text, "");
  assert.equal(typeLoopText("One\nTwo", loop, 1, 4).text, "One");
  assert.equal(
    typeLoopText("One\nTwo", loop, 3.9, 4).text,
    "Two",
    "the last line stays",
  );
  assert.ok(
    typeLoopText("One\nTwo", loop, 1.95, 4).text.length < 3,
    "deletes before the next line",
  );
  const step = sequenceStep(
    3,
    TextEffectSchema.parse({ kind: "rotate", seconds: 0.6 }),
    2.1,
    6,
  );
  assert.equal(step.index, 1);
  assert.equal(step.previous, 0);
  assert.ok(step.progress > 0 && step.progress < 1);
  const odo = TextEffectSchema.parse({ kind: "odometer", seconds: 2 });
  const final = odometerRolls("1,250 fans", odo, 3, 6);
  assert.deepEqual(
    [...final.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
    [1, 2, 5, 0],
  );
  const mid = odometerRolls("1,250 fans", odo, 0.5, 6);
  assert.ok([...mid.values()].every((v) => v >= 0 && v < 10.0001));
});

test("new text kinds render on title cards without NaN", () => {
  const kinds = [
    "blurrise",
    "karaoke",
    "shimmer",
    "prism",
    "bubbles",
    "flap",
    "roll",
    "odometer",
    "retype",
    "rotate",
    "typeloop",
    "morph",
  ];
  for (const card of titleEffects.filter((e) => kinds.includes(e.text!.kind))) {
    for (const time of [0, 0.4, 1.1, 2.3, 5]) {
      const html = renderToStaticMarkup(
        React.createElement(AnimatedText, {
          layer: {
            ...makeLayer("title", "T"),
            text: "Design 2026\nMotion 1,250\nStory",
            duration: 6,
            effects: [{ effectId: card.id, amount: 1, enabled: true }],
          },
          effects: [card],
          time,
        }),
      );
      assert.ok(!/NaN|Infinity/.test(html), `${card.id} @ ${time}`);
    }
  }
});
