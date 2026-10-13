import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedText, TextMetricsContext } from "../src/AnimatedText";
import {
  builtinEffectCategory,
  getEffectFamily,
  kineticEffects,
} from "../src/builtin-effects";
import { effectEngine } from "../src/effect-bundle";
import { effectPosterTime } from "../src/editor/EffectSample";
import {
  beatAt,
  holdEnvelope,
  isNeutralKinetic,
  kineticFrame,
  kineticKinds,
  kineticRole,
  textGeometry,
  wordKinds,
  type KineticEnv,
  type KineticUnit,
} from "../src/kinetic-type";
import { makeLayer, type Effect } from "../src/model";
import { TextEffectSchema, textEffectNames } from "../src/text-effects";
import { engineAtLeast, usesV8Features } from "../src/visual-effects";

const geometry = textGeometry("Night train\nhome");
const env = (kind: string, time: number, patch = {}, hold = 1): KineticEnv => ({
  effect: TextEffectSchema.parse({ kind, seconds: 1, stagger: 0.4, ...patch }),
  time,
  duration: 6,
  amount: 1,
  geometry,
  hold,
  color: "#ffffff",
});
const units = (word: boolean): KineticUnit[] =>
  word
    ? geometry.words.map((w, index) => ({
        index,
        count: geometry.words.length,
        ...w,
        inLine: index,
        lineLength: 2,
      }))
    : geometry.glyphs
        .filter((g) => g.word >= 0)
        .map((g, index, all) => ({ index, count: all.length, ...g }));

test("text geometry centers lines, words and glyphs on the block", () => {
  assert.equal(geometry.lines, 2);
  assert.equal(geometry.words.length, 3);
  // Graphemes plus the newline map 1:1 onto the rendered units.
  assert.equal(geometry.glyphs.length, "Night train\nhome".length);
  const first = geometry.words[0],
    second = geometry.words[1];
  assert.ok(first.x < 0 && second.x > first.x);
  assert.ok(
    Math.abs(
      geometry.glyphs[0].x + geometry.width / 2 - geometry.glyphs[0].w / 2,
    ) < 1e-9,
  );
  assert.equal(geometry.words[2].line, 1);
  assert.ok(geometry.words[2].y > first.y);
  // Measured advances replace the estimate when a canvas is available.
  const wide = textGeometry("ab", (s) => s.length * 2);
  assert.equal(wide.width, 4);
  assert.deepEqual(
    wide.glyphs.map((g) => g.x),
    [-1, 1],
  );
});

test("every kinetic kind rests outside its window and moves inside it", () => {
  for (const kind of kineticKinds) {
    const role = kineticRole(kind);
    const list = units(wordKinds.includes(kind));
    const at = (time: number, hold = 1) =>
      list.map((u) => kineticFrame(env(kind, time, {}, hold), u));
    if (role === "enter") {
      assert.ok(at(1.01).every(isNeutralKinetic), `${kind} settles`);
      assert.ok(!at(0.35).every(isNeutralKinetic), `${kind} moves`);
      // Played as an exit, the entrance runs backwards over the clip end.
      const exit = list.map((u) =>
        kineticFrame(env(kind, 5.65, { motion: { direction: "out" } }), u),
      );
      assert.ok(!exit.every(isNeutralKinetic), `${kind} exits`);
    } else if (role === "exit") {
      assert.ok(at(4.9).every(isNeutralKinetic), `${kind} waits`);
      assert.ok(!at(5.6).every(isNeutralKinetic), `${kind} leaves`);
    } else {
      assert.ok(
        at(1.3, 0).every(isNeutralKinetic),
        `${kind} waits for entrances`,
      );
      const moving = [1.1, 1.3, 1.62, 2.05].some(
        (t) => !at(t).every(isNeutralKinetic),
      );
      assert.ok(moving, `${kind} holds`);
    }
    // Strength zero is always the plain text.
    assert.ok(
      list.every((u) =>
        isNeutralKinetic(kineticFrame({ ...env(kind, 0.35), amount: 0 }, u)),
      ),
    );
    // Deterministic: the same frame twice.
    assert.deepEqual(at(0.4), at(0.4), kind);
  }
});

test("holds follow the tempo and wait for the element's entrances", () => {
  const beat = beatAt(
    TextEffectSchema.parse({ kind: "pulse", tempo: 90 }),
    1.5,
  );
  assert.equal(beat.len, 60 / 90);
  assert.equal(beat.index, 2);
  assert.ok(Math.abs(beat.since - (1.5 - 2 * (60 / 90))) < 1e-9);
  assert.equal(holdEnvelope(0.5, 1, 6), 0);
  assert.equal(holdEnvelope(2, 1, 6), 1);
  assert.equal(holdEnvelope(6, 1, 6), 0);
  assert.equal(holdEnvelope(4.5, 1, 4.5), 0, "stops before an exit");
  // The word that pulses steps through the line with the beat.
  const pulse = (time: number) =>
    units(true).findIndex(
      (u) => kineticFrame(env("pulse", time, { tempo: 60 }), u).scale > 1,
    );
  assert.deepEqual([pulse(1.05), pulse(2.05), pulse(3.05)], [1, 2, 0]);
});

test("kinetic cards are a v8 library category with posters that show motion", () => {
  assert.equal(kineticEffects.length, 48);
  assert.deepEqual(
    [...new Set(kineticEffects.map((e) => e.text!.kind))].sort(),
    [...kineticKinds].sort(),
  );
  for (const effect of kineticEffects) {
    assert.equal(builtinEffectCategory(effect.id), "Kinetic type");
    assert.equal(effectEngine(effect), "kamikami-visual-v8", effect.id);
    assert.ok(textEffectNames[effect.text!.kind]);
    const time = effectPosterTime(effect);
    assert.ok(time >= 0 && time <= 6, effect.id);
    const family = getEffectFamily(effect.id);
    if (family) assert.ok(family.variations.length > 1);
  }
  assert.ok(engineAtLeast("kamikami-visual-v8", "kamikami-visual-v7"));
  assert.ok(!engineAtLeast("kamikami-visual-v7", "kamikami-visual-v8"));
  // The new stagger orders and tempo also need the v8 engine.
  assert.ok(
    usesV8Features({
      text: { kind: "stagger", motion: { order: "center" } },
    }),
  );
  assert.ok(!usesV8Features({ text: { kind: "stagger" } }));
});

const layer = {
  ...makeLayer("title", "Title"),
  text: "Night train\nhome",
  duration: 6,
};
const render = (effect: Effect, time: number, measure = true) =>
  renderToStaticMarkup(
    React.createElement(
      TextMetricsContext.Provider,
      { value: measure ? (s: string) => s.length * 0.5 : null },
      React.createElement(AnimatedText, {
        layer: {
          ...layer,
          effects: [{ effectId: effect.id, amount: 1, enabled: true }],
        },
        effects: [effect],
        time,
      }),
    ),
  );
const card = (id: string) => kineticEffects.find((e) => e.id === id)!;

test("word kinds move rigid word wrappers; title kinds move the whole run", () => {
  const hinge = render(card("kinetic-hinge"), 0.3);
  assert.equal(hinge.match(/data-kinetic-word=/g)?.length, 3);
  assert.match(hinge, /transform-origin:0% 100%/);
  // Text is unchanged for screen readers.
  assert.match(hinge, /aria-label="Night train\nhome"/);
  const settled = render(card("kinetic-hinge"), 3);
  assert.doesNotMatch(settled, /rotate\(-?[1-9]/);
  const slamTitle = {
    ...card("kinetic-slam"),
    text: TextEffectSchema.parse({ kind: "slam", unit: "title", seconds: 1 }),
  };
  const whole = render(slamTitle, 0.4);
  assert.match(whole, /data-animated-text="run"[^>]*|transform:translate/);
  assert.equal(whole.match(/data-kinetic-word=/g), null);
});

test("glyph kinds substitute signs, clip reveals and draw trails", () => {
  const decode = render(card("kinetic-decode"), 0.6);
  // A cursor block, noisy signs ahead of it and resolved letters behind it.
  assert.match(decode, /border-radius:0.06em/);
  const rain = render(card("kinetic-rain"), 0.3);
  assert.ok((rain.match(/translate\(0em,-[0-9.]+em\)/g) ?? []).length >= 4);
  const brush = render(card("kinetic-brush"), 0.5);
  assert.match(brush, /clip-path:polygon\(/);
  // Without metrics the estimate keeps the motion working.
  assert.match(render(card("kinetic-shuffle"), 0.5, false), /translate\(/);
});
