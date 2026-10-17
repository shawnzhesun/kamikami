import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtworkStack } from "../src/ArtworkLayer";
import {
  artBeat,
  artCamera,
  artKinds,
  makeArt,
  sliceBands,
  steppedTime,
  type Art,
} from "../src/artwork";
import { artEffects, builtinEffectCategory } from "../src/builtin-effects";
import { applyEffectToLayers, effectEngine } from "../src/effect-bundle";
import { EffectSample, effectPosterTime } from "../src/editor/EffectSample";
import {
  initialProject,
  layerAtTime,
  makeLayer,
  validateProject,
  type Effect,
} from "../src/model";

const stage = { width: 1920, height: 1080 };
const camera = (art: Art, time: number, projectTime = time) =>
  artCamera([{ art, amount: 1 }], time, projectTime, stage);

test("artwork cards cover every kind as a v8 Artwork category", () => {
  assert.equal(artEffects.length, 7);
  assert.deepEqual(
    [...new Set(artEffects.map((e) => e.art!.kind))].sort(),
    [...artKinds].sort(),
  );
  for (const effect of artEffects) {
    assert.equal(builtinEffectCategory(effect.id), "Artwork");
    assert.equal(effectEngine(effect), "kamikami-visual-v8", effect.id);
    const markup = renderToStaticMarkup(
      React.createElement(EffectSample, {
        effect,
        time: effectPosterTime(effect),
      }),
    );
    assert.doesNotMatch(markup, /NaN|undefined/, effect.id);
  }
});

test("beat hits count from the project start and decay between beats", () => {
  const punch = makeArt("punch", { tempo: 120 });
  assert.deepEqual(artBeat(punch, 1.26), {
    index: 2,
    since: 0.26,
    period: 0.5,
  });
  const peak = camera(punch, 0.03).scale;
  assert.ok(peak > 1.07, `peak ${peak}`);
  assert.ok(camera(punch, 0.45).scale < 1.02, "settles before the next beat");
  // Two clips that start at different times punch on the same project beats.
  const image = (start: number) => ({
    ...makeLayer("image", "Art"),
    start,
    effects: [{ effectId: "punch", amount: 1, enabled: true }],
  });
  const effect = {
    ...artEffects.find((e) => e.id === "art-punch")!,
    id: "punch",
  };
  const at = (start: number, projectTime: number) =>
    layerAtTime(image(start), [effect], projectTime - start).scale;
  assert.equal(at(0, 2.53).toFixed(5), at(1.7, 2.53).toFixed(5));
  // Strobe inverts only on the downbeat of each bar.
  const strobe = makeArt("strobe");
  assert.equal(camera(strobe, 0.02).invert, 1);
  assert.equal(camera(strobe, 0.52).invert, 0);
  assert.equal(camera(strobe, 2.02).invert, 1);
});

test("drift overscans and stays small; stutter holds whole steps", () => {
  const drift = makeArt("drift");
  for (let t = 0; t < 10; t += 0.37) {
    const v = camera(drift, t);
    assert.ok(Math.abs(v.x) < 1080 * drift.distance, `x ${v.x}`);
    assert.ok(v.scale > 1);
  }
  const uses = [{ art: makeArt("stutter", { count: 8 }), amount: 1 }];
  assert.equal(steppedTime(uses, 0.3), 0.25);
  assert.equal(steppedTime(uses, 0.374), 0.25);
  assert.equal(steppedTime(uses, 0.375), 0.375);
  assert.equal(steppedTime([], 0.3), 0.3);
  // An element with stutter (the card: 12 steps per second) holds its keyframes too.
  const layer = {
    ...makeLayer("image", "Art"),
    effects: [{ effectId: "stutter", amount: 1, enabled: true }],
    keyframes: {
      x: [
        { time: 0, value: 0, easing: "linear" as const },
        { time: 1, value: 800, easing: "linear" as const },
      ],
    },
  };
  const stutter = {
    ...artEffects.find((e) => e.id === "art-stutter")!,
    id: "stutter",
  };
  assert.equal(
    layerAtTime(layer, [stutter], 0.2).x,
    layerAtTime(layer, [stutter], 0.17).x,
  );
  assert.notEqual(
    layerAtTime(layer, [stutter], 0.17).x,
    layerAtTime(layer, [stutter], 0.26).x,
  );
});

test("copies trail behind and slices cut bands", () => {
  const render = (art: Art, time = 1.2) =>
    renderToStaticMarkup(
      React.createElement(ArtworkStack, {
        id: "a",
        uses: [{ art, amount: 1 }],
        t: time,
        time,
        projectTime: time,
        duration: 6,
        width: 1920,
        height: 1080,
        box: { width: 1200, height: 800 },
        start: 8.5,
        frameStyle: () => ({}),
        content: (t: number) =>
          React.createElement("i", { "data-t": t.toFixed(2) }),
      }),
    );
  const trail = render(makeArt("trail", { count: 2, seconds: 0.1 }));
  assert.equal(trail.match(/data-art-copy/g)?.length, 2);
  // Copies are drawn first, furthest lag first, then the element itself.
  assert.deepEqual(
    [...trail.matchAll(/data-t="([\d.]+)"/g)].map((m) => m[1]),
    ["1.00", "1.10", "1.20"],
  );
  assert.match(trail, /mix-blend-mode:screen/);
  assert.match(trail, /feColorMatrix/);
  const slices = render(makeArt("slices", { count: 5 }), 0.52);
  // One copy of the element; a filter moves its bands.
  assert.equal(slices.match(/<feOffset/g)?.length, 5);
  assert.equal(slices.match(/data-t=/g)?.length, 1);
  assert.match(slices, /filter:url\(#[^)]*-slices\)/);
  assert.equal(
    sliceBands(makeArt("slices", { timing: "in" }), 1, 5, 5, 6, 1080).every(
      (b) => b.x === 0,
    ),
    true,
    "slid-in bands settle",
  );
});

test("copies are for artwork; camera moves and overlays also work on text", () => {
  const p = validateProject({
    ...initialProject,
    layers: [...initialProject.layers],
  });
  const title = p.layers.find((l) => l.type === "title")!;
  const scene = p.layers.find((l) => l.type === "scene")!;
  const card = (id: string): Effect => artEffects.find((e) => e.id === id)!;
  assert.throws(
    () => applyEffectToLayers(p, card("art-trail"), [title.id]),
    /images, video, shapes and backdrops/,
  );
  const punched = applyEffectToLayers(p, card("art-punch"), [title.id]);
  assert.ok(punched.layers.find((l) => l.id === title.id)!.effects.length);
  const framed = applyEffectToLayers(p, card("art-slices"), [scene.id]);
  assert.equal(framed.effects.at(-1)!.art!.kind, "slices");
  assert.throws(
    () =>
      validateProject({
        ...framed,
        effects: framed.effects.map((e) =>
          e.art ? { ...e, art: { ...e.art, extra: 1 } } : e,
        ),
      }),
    /extra|Unrecognized/,
  );
});
