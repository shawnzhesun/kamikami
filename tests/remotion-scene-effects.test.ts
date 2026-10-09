import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AnimatedText } from "../src/AnimatedText";
import { GraphicEffects } from "../src/GraphicEffects";
import {
  builtinEffects,
  remotionSceneEffects,
  builtinEffectCategory,
} from "../src/builtin-effects";
import {
  TextEffectSchema,
  textUnitFrame,
  textUnits,
  scrambledText,
} from "../src/text-effects";
import {
  effectEngine,
  EffectBundleSchema,
  applyEffectToLayers,
} from "../src/effect-bundle";
import {
  makeLayer,
  initialProject,
  validateProject,
  type Effect,
  type Layer,
} from "../src/model";
import { splitClips } from "../src/editor/editing";
import { EffectSample, effectPosterTime } from "../src/editor/EffectSample";
import { EffectLibrary } from "../server/effect-library";

const title = {
  ...makeLayer("title", "Title"),
  text: "Title 日本語 e\u0301 👨‍👩‍👧‍👦\nSecond line",
  duration: 6,
};
const renderText = (
  effect: Effect,
  time: number,
  base: Layer = title,
  amount = 1,
  enabled = true,
) =>
  renderToStaticMarkup(
    React.createElement(AnimatedText, {
      layer: { ...base, effects: [{ effectId: effect.id, amount, enabled }] },
      effects: [effect],
      time,
    }),
  );

test("scene-inspired recipes add seven distinct cards without changing old definitions", () => {
  assert.equal(remotionSceneEffects.length, 7);
  assert.equal(builtinEffects.length, 57);
  assert.equal(
    new Set(builtinEffects.map((effect) => effect.id)).size,
    builtinEffects.length,
  );
  assert.equal(remotionSceneEffects.filter((effect) => effect.text).length, 6);
  const before = structuredClone(initialProject);
  for (const effect of remotionSceneEffects) {
    assert.equal(
      builtinEffectCategory(effect.id),
      effect.text ? "Typography" : "Transitions",
    );
    const target = initialProject.layers.find(
      (layer) => layer.type === "title",
    )!;
    const next = applyEffectToLayers(initialProject, effect, [target.id]);
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(next))), next);
    const bundle = {
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(effect),
      name: effect.name,
      effect,
    };
    assert.equal(bundle.engine, "kamikami-visual-v4");
    assert.deepEqual(
      EffectBundleSchema.parse(JSON.parse(JSON.stringify(bundle))).effect,
      effect,
    );
    for (const engine of [
      "frameforge-curves-v1",
      "kamikami-visual-v2",
      "kamikami-visual-v3",
    ])
      assert.throws(
        () => EffectBundleSchema.parse({ ...bundle, engine }),
        /newer engine/,
      );
    if (effect.text)
      assert.throws(
        () =>
          applyEffectToLayers(initialProject, effect, [
            initialProject.layers[0].id,
          ]),
        /only.*text/,
      );
  }
  assert.deepEqual(initialProject, before);
});

test("text timing reaches a readable endpoint, respects amount and supports Unicode graphemes", () => {
  assert.deepEqual(textUnits("Ae\u0301👨‍👩‍👧‍👦", "character"), [
    "A",
    "e\u0301",
    "👨‍👩‍👧‍👦",
  ]);
  assert.deepEqual(textUnits("One  two\nthree", "word"), [
    "One",
    "  ",
    "two",
    "\n",
    "three",
  ]);
  for (const kind of ["typewriter", "scramble", "stagger"] as const) {
    const effect = TextEffectSchema.parse({ kind });
    for (const count of [1, 5, 100])
      for (let i = 0; i < count; i++) {
        const end = textUnitFrame(effect, 0.3, i, count, 0.3);
        assert.equal(end.opacity, 1);
        assert.equal(end.scramble, false);
        assert.equal(end.y, 0);
        assert.equal(end.rotateX, 0);
        assert.equal(end.scale, 1);
        const neutral = textUnitFrame(effect, 0, i, count, 6, 0);
        assert.equal(neutral.opacity, 1);
        assert.equal(neutral.scramble, false);
      }
  }
  const wave = TextEffectSchema.parse({ kind: "wave", distance: 2 });
  assert.ok(Math.abs(textUnitFrame(wave, 0.3, 4, 10, 6).y) <= 2);
  assert.equal(scrambledText(" ", 1, 0, 1, 1), " ");
  assert.equal(
    scrambledText("Title", 1, 0, 0.2, 1),
    scrambledText("Title", 1, 0, 0.2, 1),
  );
  assert.notEqual(
    scrambledText("Title", 1, 0, 0.2, 1),
    scrambledText("Title", 2, 0, 0.2, 1),
  );
  assert.throws(() => TextEffectSchema.parse({ kind: "stagger", stagger: 1 }));
  assert.throws(() =>
    TextEffectSchema.parse({ kind: "wave", speed: Infinity }),
  );
});

test("all text modes are deterministic, preserve source text, remain neutral when disabled and continue through splits", () => {
  const variants = remotionSceneEffects
    .filter((effect) => effect.text)
    .flatMap((effect) => {
      if (effect.text!.kind !== "stagger") return [effect];
      return (["rise", "flip", "pop"] as const).flatMap((style) =>
        (["character", "word"] as const).map((unit) => ({
          ...effect,
          text: { ...effect.text!, style, unit },
        })),
      );
    });
  for (const effect of variants) {
    for (const time of [0, 0.1, 0.75, 1.5, 5.9]) {
      const markup = renderText(effect, time);
      assert.equal(markup, renderText(effect, time));
      assert.doesNotMatch(markup, /NaN|Infinity|undefined/);
      assert.ok(markup.includes("Title") || markup.includes("aria-label="));
    }
    const plain = renderToStaticMarkup(
      React.createElement(React.Fragment, null, title.text),
    );
    assert.equal(renderText(effect, 0.2, title, 0), plain);
    assert.equal(renderText(effect, 0.2, title, 1, false), plain);
    assert.equal(renderText(effect, 0.2, { ...title, type: "image" }), plain);
    const layer = {
      ...title,
      effects: [{ effectId: effect.id, amount: 1, enabled: true }],
    };
    const project = validateProject({
      ...initialProject,
      tracks: undefined,
      layers: [layer],
      effects: [effect],
    });
    const right = splitClips(project, [layer.id], 12, () => "right").project
      .layers[1];
    assert.equal(renderText(effect, 1.2), renderText(effect, 0.7, right));
    assert.equal(layer.text, title.text);
  }
});

test("title thumbnails use Title, and transition masks keep one source and neutral endpoints", () => {
  for (const effect of builtinEffects.filter(
    (effect) =>
      effect.text ||
      effect.channels.some((channel) => channel.property === "letterSpacing") ||
      effect.passes?.some((pass) => pass.kind === "shatter"),
  )) {
    const html = renderToStaticMarkup(
      React.createElement(EffectSample, {
        effect,
        time: effectPosterTime(effect),
      }),
    );
    assert.ok(html.includes("Title"));
    assert.doesNotMatch(html, /MEMORY/);
  }
  const blinds = remotionSceneEffects.find(
    (effect) => effect.id === "blinds-reveal",
  )!;
  for (const direction of ["horizontal", "vertical"] as const) {
    const effect = {
      ...blinds,
      passes: [{ ...blinds.passes![0], blindsDirection: direction }],
    };
    const layer = {
      ...makeLayer("video", "Clip"),
      duration: 6,
      effects: [{ effectId: effect.id, amount: 1, enabled: true }],
    };
    const render = (time: number) =>
      renderToStaticMarkup(
        React.createElement(GraphicEffects, {
          layer,
          effects: [effect],
          time,
          children: React.createElement("video", { src: "fixture.mp4" }),
        }),
      );
    assert.equal((render(0.2).match(/<video /g) ?? []).length, 1);
    assert.match(
      decodeURIComponent(render(0)),
      /<rect[^>]*(?:width|height)="0"/,
    );
    assert.doesNotMatch(render(2), /filter="url|filter:url/);
    assert.notEqual(render(0.1), render(0.5));
  }
});

test("new recipes persist, export and import with text parameters intact", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-scene-effects-"));
  try {
    const library = new EffectLibrary(dir);
    for (const effect of remotionSceneEffects) {
      const saved = await library.save({
        format: "frameforge-effect",
        version: 1,
        engine: effectEngine(effect),
        name: effect.name,
        effect,
      });
      const imported = await library.import(saved.bundle);
      assert.deepEqual(imported.bundle.effect.text, effect.text);
      assert.deepEqual(imported.bundle.effect.passes, effect.passes);
    }
    assert.equal(
      (await new EffectLibrary(dir).list()).length,
      remotionSceneEffects.length * 2,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
