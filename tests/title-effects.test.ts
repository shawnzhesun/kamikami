import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EffectSchema, makeLayer, type Effect } from "../src/model";
import {
  builtinEffectCategory,
  effectVariationId,
  titleEffectFamilies,
  titleEffects,
} from "../src/builtin-effects";
import { AnimatedText } from "../src/AnimatedText";
import { TextEffectSchema } from "../src/text-effects";
import {
  countedText,
  neutralTitleFrame,
  titleControls,
  titleKinds,
  titleUnitFrame,
} from "../src/title-effects";
import { effectEngine } from "../src/effect-bundle";
import { applyEffectToLayers } from "../src/effect-bundle";
import { initialProject, validateProject } from "../src/model";

const looks = (): Effect[] =>
  titleEffects.flatMap((card) => {
    const family = titleEffectFamilies.find((f) => f.id === card.id);
    return family
      ? family.variations.map((v) =>
          EffectSchema.parse({ ...card, ...v.parameters }),
        )
      : [card];
  });
const render = (effect: Effect, time: number, text = "Motion Title 42") =>
  renderToStaticMarkup(
    React.createElement(AnimatedText, {
      layer: {
        ...makeLayer("title", "T"),
        text,
        duration: 6,
        effects: [{ effectId: effect.id, amount: 1, enabled: true }],
      },
      effects: [effect],
      time,
    }),
  );

test("thirty-three title looks on twenty-seven Typography cards, all v7 and named", () => {
  assert.equal(titleEffects.length, 27);
  assert.equal(looks().length, 33);
  for (const kind of titleKinds) assert.ok(titleControls[kind], kind);
  for (const card of titleEffects) {
    assert.equal(builtinEffectCategory(card.id), "Typography");
    assert.equal(effectEngine(card), "kamikami-visual-v7");
    if (titleEffectFamilies.some((f) => f.id === card.id))
      assert.notEqual(effectVariationId(card), "custom");
  }
});

test("every look renders without NaN and settles to plain, untransformed text", () => {
  for (const effect of looks()) {
    for (const time of [0, 0.1, 0.4, 0.9, 1.5])
      assert.ok(
        !/NaN|Infinity/.test(render(effect, time)),
        `${effect.id} @ ${time}`,
      );
    const kind = effect.text!.kind;
    // Continuous, whole-text and decorated looks have no neutral resting frame.
    if (
      [
        "circle", "count", "odometer", "shimmer", "retype", "rotate", "typeloop",
        "morph", "karaoke", "bubbles", "flap",
      ].includes(kind)
    )
      continue;
    // After the entrance, every unit is back to the neutral frame.
    for (let i = 0; i < 5; i++)
      assert.deepEqual(
        // +0 folds -0 so settled offsets compare equal to zero.
        JSON.parse(
          JSON.stringify(
            titleUnitFrame(effect.text!, effect.text!.seconds + 0.01, i, 5, 6),
          ),
        ),
        {
          ...neutralTitleFrame(),
          box:
            kind === "highlight"
              ? titleUnitFrame(effect.text!, 99, i, 5, 6).box
              : null,
          line: kind === "underline" ? 1 : null,
          draw: kind === "draw" ? 1 : null,
          tint: null,
          flap: null,
          roll: null,
          sweep:
            kind === "mask" &&
            (effect.text!.direction === "left" ||
              effect.text!.direction === "right")
              ? { progress: 1, from: effect.text!.direction }
              : null,
        },
        `${effect.id} unit ${i}`,
      );
  }
});

test("entrances start hidden or displaced; exits mirror them at the clip end", () => {
  const mask = TextEffectSchema.parse({
    kind: "mask",
    direction: "up",
    seconds: 1,
  });
  assert.ok(titleUnitFrame(mask, 0, 0, 3, 6).maskY > 1);
  const exit = TextEffectSchema.parse({
    kind: "mask",
    direction: "up",
    seconds: 1,
    motion: { direction: "out" },
  });
  assert.equal(titleUnitFrame(exit, 2, 0, 3, 6).maskY, 0);
  assert.ok(titleUnitFrame(exit, 6, 2, 3, 6).maskY > 1);
  const block = TextEffectSchema.parse({
    kind: "highlight",
    variant: "block",
    seconds: 1,
    stagger: 0,
  });
  assert.equal(
    titleUnitFrame(block, 0.25, 0, 1, 6).opacity,
    0,
    "covered text is hidden",
  );
  assert.equal(
    titleUnitFrame(block, 0.75, 0, 1, 6).opacity,
    1,
    "wipe reveals it",
  );
  // Strength zero leaves the text untouched.
  for (const effect of looks())
    if (!["circle", "count"].includes(effect.text!.kind)) {
      const f = titleUnitFrame(effect.text!, 0.1, 0, 4, 6, 0);
      assert.equal(f.opacity, 1, effect.id);
      assert.equal(f.maskY, 0, effect.id);
      assert.equal(f.blur, 0, effect.id);
    }
});

test("counting keeps separators and decimals; horizontal masks clip whole words", () => {
  const count = TextEffectSchema.parse({ kind: "count", seconds: 2 });
  assert.equal(countedText("1,250 fans · 98.6%", count, 0, 6), "0 fans · 0.0%");
  assert.equal(
    countedText("1,250 fans · 98.6%", count, 3, 6),
    "1,250 fans · 98.6%",
  );
  assert.match(
    countedText("Score 12,345,678", count, 1, 6),
    /^Score \d{1,3}(,\d{3})*$/,
  );
  const slide = titleEffects.find((e) => e.id === "title-mask-reveal")!;
  const settings = EffectSchema.parse({
    ...slide,
    text: TextEffectSchema.parse({
      kind: "mask",
      unit: "word",
      direction: "left",
      seconds: 1,
      stagger: 0,
    }),
  });
  const mid = render(settings, 0.15, "Hello");
  assert.match(mid, /clip-path:inset\(/);
  assert.doesNotMatch(render(settings, 2, "Hello"), /clip-path:inset\(-0\.3em/);
});

test("title effects apply only to text elements", () => {
  const project = validateProject({
    ...initialProject,
    layers: [{ ...makeLayer("image", "I"), id: "i", duration: 5 }],
  });
  assert.throws(() => applyEffectToLayers(project, titleEffects[0], ["i"]));
});

test("settings controls render for every title kind and expose its options", async () => {
  const { TitleEffectControls } =
    await import("../src/editor/TitleEffectControls");
  for (const kind of titleKinds) {
    const html = renderToStaticMarkup(
      React.createElement(TitleEffectControls, {
        text: TextEffectSchema.parse({ kind }),
        onChange: () => {},
      }),
    );
    if (titleControls[kind].direction) assert.match(html, /Direction/, kind);
    if (titleControls[kind].variant) assert.match(html, /Look/, kind);
    if (titleControls[kind].entrance) assert.match(html, /Duration/, kind);
  }
});
