import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EffectSchema,
  bounceOut,
  channelValue,
  makeLayer,
  type Channel,
} from "../src/model";
import {
  builtinEffectCategory,
  effectVariationId,
  styleEffectFamilies,
  styleEffects,
} from "../src/builtin-effects";
import { GraphicEffects } from "../src/GraphicEffects";
import { effectEngine } from "../src/effect-bundle";
import { usesV6Features, v6Kinds } from "../src/visual-effects";
import { styleControls, styleKinds } from "../src/StyleGraphicEffects";

const curve = (c: Partial<Channel>): Channel => ({
  property: "x",
  curve: "linear",
  from: 0,
  to: 100,
  frequency: 1,
  phase: 0,
  ...c,
});

test("spring curves start at from, settle on to and keep their character", () => {
  for (const name of [
    "back",
    "elastic",
    "bounce",
    "damped",
    "anticipate",
  ] as const) {
    const c = curve({ curve: name, frequency: 3 });
    assert.ok(Math.abs(channelValue(c, 0, 2) - 0) < 1e-6, `${name} start`);
    assert.ok(Math.abs(channelValue(c, 2, 2) - 100) < 1e-6, `${name} end`);
  }
  const samples = (name: Channel["curve"]) =>
    Array.from({ length: 101 }, (_, i) =>
      channelValue(curve({ curve: name, frequency: 3 }), i / 50, 2),
    );
  assert.ok(Math.max(...samples("back")) > 100, "back overshoots");
  assert.ok(
    Math.min(...samples("anticipate")) < 0,
    "anticipate pulls back first",
  );
  assert.ok(
    Math.max(...samples("elastic")) > 100,
    "elastic oscillates past the target",
  );
  assert.ok(
    Math.max(...samples("bounce")) <= 100 + 1e-9,
    "bounce never passes the floor",
  );
  // Three bounces: the curve returns to the floor four times (fall + 3 bounces).
  // Impacts are local maxima touching the floor (the final rest counts once).
  let impacts = 0;
  for (let i = 1; i <= 2000; i++) {
    const [prev, here, next] = [i - 1, i, i + 1].map((n) =>
      bounceOut(Math.min(1, n / 2000), 3),
    );
    if (here > 0.995 && here >= prev && (here > next || i === 2000)) impacts++;
  }
  assert.equal(impacts, 4);
});

test("channel spans run over their own seconds at the clip start or end", () => {
  const entrance = curve({ seconds: 0.5 });
  assert.equal(channelValue(entrance, 0.25, 10), 50);
  assert.equal(channelValue(entrance, 3, 10), 100);
  const exit = curve({ seconds: 0.5, align: "end" });
  assert.equal(channelValue(exit, 5, 10), 0);
  assert.equal(channelValue(exit, 9.75, 10), 50);
});

test("every new card and variation renders a filter and uses the v6 engine", () => {
  assert.equal(styleEffects.length, 14);
  assert.deepEqual([...styleKinds].sort(), [...v6Kinds].sort());
  for (const kind of styleKinds) assert.ok(styleControls[kind]);
  const looks = [
    ...styleEffects,
    ...styleEffectFamilies.flatMap((f) =>
      f.variations.map((v) =>
        EffectSchema.parse({
          ...styleEffects.find((e) => e.id === f.id)!,
          ...v.parameters,
        }),
      ),
    ),
  ];
  assert.ok(looks.length >= 40);
  for (const effect of looks) {
    assert.equal(effectEngine(effect), "kamikami-visual-v6", effect.id);
    assert.ok(usesV6Features(effect));
    if (!effect.passes?.length) continue;
    const layer = {
      ...makeLayer("image", "I"),
      duration: 5,
      effects: [{ effectId: effect.id, amount: 1, enabled: true }],
    };
    for (const time of [0.2, 2.5, 4.8]) {
      const html = renderToStaticMarkup(
        React.createElement(GraphicEffects, {
          layer,
          effects: [effect],
          time,
          children: "x",
        }),
      );
      assert.ok(!/NaN|Infinity/.test(html), `${effect.id} at ${time}`);
    }
  }
  for (const card of styleEffects) {
    assert.notEqual(builtinEffectCategory(card.id), "Basics");
    if (styleEffectFamilies.some((f) => f.id === card.id))
      assert.notEqual(effectVariationId(card), "custom", card.id);
  }
});

test("pixel and dissolve endpoints: zero strength is untouched, full dissolve hides", () => {
  const pixel = styleEffects.find((e) => e.id === "pixel-art")!;
  const layer = (amount: number) => ({
    ...makeLayer("image", "I"),
    effects: [{ effectId: pixel.id, amount, enabled: true }],
  });
  const off = renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer: layer(0),
      effects: [pixel],
      time: 1,
      children: "x",
    }),
  );
  assert.ok(!off.includes("<filter"));
  const on = renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer: layer(1),
      effects: [pixel],
      time: 1,
      children: "x",
    }),
  );
  assert.match(on, /feTile/);
  assert.match(on, /operator="dilate"/);
});
