import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedText } from "../src/AnimatedText";
import { builtinEffectCategory, layoutEffects } from "../src/builtin-effects";
import { effectEngine } from "../src/effect-bundle";
import { textGeometry } from "../src/kinetic-type";
import { allTextKinds, TextEffectSchema } from "../src/text-effects";
import { layoutFrames, layoutKinds } from "../src/text-layouts";
import { effectSettings, makeLayer, type Effect } from "../src/model";

const TEXT = "I remember\nthe color of dawn";
const geometry = textGeometry(TEXT);
const frames = (kind: string, time: number, patch = {}, amount = 1) =>
  layoutFrames(TextEffectSchema.parse({ kind, unit: "word", ...patch }), {
    time,
    duration: 6,
    amount,
    geometry,
    hold: 1,
    keyWord: 1,
  });
// Where each word's center ends up, in em from the block center.
const placed = (kind: string, time: number, patch = {}) =>
  frames(kind, time, patch).words.map((f, i) => ({
    x: geometry.words[i].x + f.x,
    y: geometry.words[i].y + f.y,
    scale: f.scale,
    opacity: f.opacity,
  }));

test("layout cards are v8 Kinetic layouts and every text kind is unique", () => {
  assert.equal(layoutEffects.length, 10);
  assert.deepEqual(
    [...new Set(layoutEffects.map((e) => e.text!.kind))].sort(),
    [...layoutKinds].sort(),
  );
  for (const e of layoutEffects) {
    assert.equal(builtinEffectCategory(e.id), "Kinetic layouts");
    assert.equal(effectEngine(e), "kamikami-visual-v8");
  }
  assert.equal(new Set(allTextKinds).size, allTextKinds.length);
});

test("geometry centers each line in the block", () => {
  const line1 = geometry.words.filter((w) => w.line === 1);
  const line0 = geometry.words.filter((w) => w.line === 0);
  const span = (ws: typeof line0) =>
    (ws[0].x - ws[0].w / 2 + ws.at(-1)!.x + ws.at(-1)!.w / 2) / 2;
  assert.ok(Math.abs(span(line0)) < 1e-9);
  assert.ok(Math.abs(span(line1)) < 1e-9);
});

test("the slam stack justifies rows to one width and stacks them without gaps", () => {
  const end = placed("slamstack", 5, { seconds: 1.6, stagger: 0.7 });
  const widths = end.map((p, i) => geometry.words[i].w * p.scale);
  const max = Math.max(...widths);
  // Short words are capped; the rest share the widest row's width.
  for (const [i, w] of widths.entries())
    if (end[i].scale < 3) assert.ok(Math.abs(w - max) < 1e-6 || w < max);
  for (let i = 1; i < end.length; i++) assert.ok(end[i].y > end[i - 1].y);
  assert.ok(end.every((p) => p.opacity === 1 && Math.abs(p.x) < 1e-9));
  // At strength zero the line is left exactly as it was.
  const none = frames("slamstack", 5, {}, 0).words;
  assert.ok(none.every((f) => f.x === 0 && f.y === 0 && f.scale === 1));
});

test("key word and giant word: one word dominates, the rest stay readable", () => {
  const split = placed("keyword", 5);
  assert.ok(split[1].scale > 1.4);
  assert.ok(split.every((p, i) => i === 1 || p.scale < 0.7));
  assert.ok(split[0].y < 0 && split[2].y > 0, "before above, after below");
  const giant = frames("giant", 5, { secondary: "#123456" });
  assert.deepEqual([...giant.behind], [1]);
  assert.match(giant.words[1].clip!, /^inset\(/);
  assert.equal(giant.words[1].tint!.color, "#123456");
  assert.equal(giant.words[0].scale, 1);
});

test("swap shows one word per beat, then assembles the line", () => {
  const during = placed("swap", 0.6, { tempo: 120 });
  assert.deepEqual(
    during.map((p) => p.opacity),
    [0, 1, 0, 0, 0, 0],
  );
  assert.ok(Math.abs(during[1].x) < 1e-9 && during[1].scale > 1);
  const after = frames("swap", 6, { tempo: 120, seconds: 0.5 }).words;
  assert.ok(after.every((f) => Math.abs(f.x) < 1e-6 && f.opacity === 1));
});

test("band reveal sweeps a block and shows words once it passes them", () => {
  const mid = frames("bandhide", 0.5, { seconds: 1 });
  assert.equal(mid.marks.length, 1);
  const x = mid.marks[0].x;
  mid.words.forEach((f, i) =>
    assert.equal(f.opacity, geometry.words[i].x < x ? 1 : 0),
  );
  assert.equal(frames("bandhide", 2, { seconds: 1 }).marks.length, 0);
});

test("layouts render as word wrappers and stack with kinetic motion", () => {
  const card = (id: string) => layoutEffects.find((e) => e.id === id)!;
  const render = (effects: Effect[], time: number) =>
    renderToStaticMarkup(
      React.createElement(AnimatedText, {
        layer: {
          ...makeLayer("title", "Lyric"),
          text: TEXT,
          effects: effects.map((e) => ({
            effectId: e.id,
            amount: 1,
            enabled: true,
            settings: effectSettings(e),
          })),
        },
        effects,
        time,
      }),
    );
  for (const effect of layoutEffects)
    for (const time of [0, 0.4, 1.2, 4])
      assert.doesNotMatch(render([effect], time), /NaN/, effect.id);
  const giant = render([card("layout-giant")], 3);
  assert.equal(giant.match(/data-kinetic-word=/g)?.length, 6);
  assert.match(giant, /isolation:isolate/);
  assert.match(giant, /z-index:-1/);
});
