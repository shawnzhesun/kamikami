import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { animationEffects, builtinEffects } from "../src/builtin-effects";
import { GraphicEffects, screenCell } from "../src/GraphicEffects";
import { effectPosterTime, EffectSample } from "../src/editor/EffectSample";
import { visualFrame, VisualPassSchema } from "../src/visual-effects";
import {
  initialProject,
  makeLayer,
  layerAtTime,
  validateProject,
  type Layer,
} from "../src/model";
import {
  applyEffectToLayers,
  effectCollections,
  EffectBundleSchema,
  effectEngine,
} from "../src/effect-bundle";
import { splitClips } from "../src/editor/editing";
import { EffectLibrary } from "../server/effect-library";

test("new built-ins work in existing projects and portable bundles without changing the initial project", () => {
  const before = structuredClone(initialProject);
  assert.equal(animationEffects.length, 33);
  assert.equal(
    new Set(builtinEffects.map((e) => e.id)).size,
    builtinEffects.length,
  );
  assert.equal(
    effectCollections(initialProject, []).library.length,
    builtinEffects.length,
  );
  for (const effect of animationEffects) {
    const next = applyEffectToLayers(initialProject, effect, [
      initialProject.layers[0].id,
    ]);
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(next))), next);
    const bundle = {
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(effect),
      name: effect.name,
      effect,
    };
    assert.deepEqual(
      EffectBundleSchema.parse(JSON.parse(JSON.stringify(bundle))).effect,
      effect,
    );
    if (effectEngine(effect) === "kamikami-visual-v2") {
      assert.throws(
        () =>
          EffectBundleSchema.parse({
            ...bundle,
            engine: "frameforge-curves-v1",
          }),
        /require/,
      );
    }
  }
  assert.deepEqual(initialProject, before);
  assert.doesNotThrow(() => z.toJSONSchema(EffectBundleSchema));
});

test("built-ins do not populate My effects automatically; saved and imported copies retain their passes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-visual-effects-"));
  try {
    const library = new EffectLibrary(dir);
    for (let index = 0; index < builtinEffects.length; index += 40)
      assert.deepEqual(
        await library.syncProjectEffects(
          builtinEffects.slice(index, index + 40),
        ),
        [],
      );
    const effect = animationEffects.find((e) => e.id === "memory-crt")!;
    const saved = await library.save({
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(effect),
      name: effect.name,
      effect,
    });
    assert.notEqual(saved.bundle.effect.id, effect.id);
    const imported = await library.import(saved.bundle);
    assert.deepEqual(imported.bundle.effect.passes, effect.passes);
    assert.equal((await new EffectLibrary(dir).list()).length, 2);
    const custom = { ...initialProject.effects[0], id: "upgrade-test" };
    await library.syncProjectEffects([custom]);
    const upgraded = { ...custom, passes: effect.passes };
    await library.syncProjectEffects([upgraded]);
    const entries = await new EffectLibrary(dir).list();
    assert.equal(
      entries.find((e) => e.bundle.effect.id === custom.id)?.bundle.engine,
      "kamikami-visual-v2",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const base = {
  ...makeLayer("scene", "Drawing"),
  start: 0,
  duration: 6,
  effects: [],
};
function render(layer: Layer, time: number) {
  return renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer,
      effects: animationEffects,
      time,
      children: React.createElement("img", { src: "drawing.png" }),
    }),
  );
}

test("curves and procedural graphics preserve frame identity across a timeline split", () => {
  for (const effect of animationEffects) {
    const layer = {
      ...base,
      effects: [{ effectId: effect.id, enabled: true, amount: 1 }],
    };
    const project = {
      ...initialProject,
      duration: 6,
      layers: [layer],
      effects: [effect],
    };
    const { project: split } = splitClips(
      project,
      [layer.id],
      72,
      () => "split-copy",
    );
    for (const time of [3, 4.5, 5.9]) {
      assert.deepEqual(
        layerAtTime(layer, [effect], time),
        layerAtTime(split.layers[1], [effect], time - 3),
        effect.name,
      );
      assert.equal(
        render(layer, time),
        render(split.layers[1], time - 3),
        effect.name,
      );
    }
    assert.equal(render(layer, 1.25), render(layer, 1.25));
  }
});

test("zero amount and disabled effects are neutral; previews render finite values at clip boundaries", () => {
  for (const effect of animationEffects) {
    for (const instance of [
      { effectId: effect.id, enabled: true, amount: 0 },
      { effectId: effect.id, enabled: false, amount: 1 },
    ]) {
      const layer = { ...base, effects: [instance] };
      assert.deepEqual(
        layerAtTime(layer, [effect], 1.5),
        layerAtTime(base, [], 1.5),
      );
      assert.equal(render(layer, 1.5), render(base, 1.5));
    }
    for (const time of [0, effectPosterTime(effect), 5.999, 6]) {
      const html = renderToStaticMarkup(
        React.createElement(EffectSample, { effect, time }),
      );
      assert.doesNotMatch(html, /NaN|Infinity|undefined/);
      for (const pass of effect.passes ?? []) {
        const frame = visualFrame(pass, time, 6, 2);
        assert.ok(frame.strength >= 0 && frame.strength <= 1);
      }
    }
  }
});

test("transition envelopes reach their endpoints and pass schema rejects invalid values", () => {
  const pass = animationEffects.find((e) => e.id === "memory-white-flash")!
    .passes![0];
  assert.equal(visualFrame(pass, 0, 6, 1).strength, 1);
  assert.equal(visualFrame(pass, 1, 6, 1).strength, 0);
  assert.equal(visualFrame({ ...pass, timing: "out" }, 0, 6, 1).strength, 0);
  assert.equal(visualFrame({ ...pass, timing: "out" }, 6, 6, 1).strength, 1);
  assert.equal(visualFrame(pass, 0.1, 0.1, 1).strength, 0);
  for (const patch of [
    { color: "url(https://invalid)" },
    { seed: 0.5 },
    { speed: -1 },
    { seconds: 0 },
    { strength: 2 },
  ]) {
    assert.throws(() => VisualPassSchema.parse({ ...pass, ...patch }));
  }
});

test("line and dot screens repeat a small whole-pixel cell close to their settings", () => {
  // Chrome rasterizes every feImage again whenever its filter changes, so a
  // full-frame screen image stalled playback; the cell keeps it cheap.
  for (const [spacing, angle] of [
    [12.53, 0],
    [11.47, -35],
    [8, 63],
    [20, 90],
  ]) {
    const cell = screenCell("lines", spacing, angle, "#000000", 3.2);
    assert.ok(Number.isInteger(cell.width) && Number.isInteger(cell.height));
    assert.ok(cell.width * cell.height < 400 * 400);
    const turn = Number(cell.body.match(/rotate\(([^)]+)\)/)![1]);
    const bands = [...cell.body.matchAll(/M[^ ]+ ([^h]+)h/g)].map((m) => +m[1]);
    assert.ok(Math.abs(turn - angle) < 0.1, `${angle}° drew at ${turn}°`);
    assert.ok(Math.abs(bands[1] - bands[0] - spacing) / spacing < 0.005);
  }
  for (const angle of [0, 30, -35]) {
    const cell = screenCell("dots", 10, angle, "#000000");
    assert.ok(Number.isInteger(cell.width));
    const dots = [
      ...cell.body.matchAll(/cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g),
    ].map((m) => m.slice(1).map(Number));
    const has = (x: number, y: number) =>
      dots.some(([a, b]) => Math.abs(a - x) < 1e-6 && Math.abs(b - y) < 1e-6);
    // A dot cut by an edge also appears on the opposite edge.
    for (const [x, y, r] of dots)
      for (const [dx, dy] of [
        [cell.width, 0],
        [-cell.width, 0],
        [0, cell.height],
        [0, -cell.height],
      ]) {
        const [X, Y] = [x + dx, y + dy];
        if (X > -r && Y > -r && X < cell.width + r && Y < cell.height + r)
          assert.ok(has(X, Y), `${angle}°: no copy of the dot at ${x},${y}`);
      }
  }
});
