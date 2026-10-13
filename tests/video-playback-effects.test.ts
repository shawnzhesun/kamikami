import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  builtinEffects,
  styleEffects,
  titleEffects,
  packEffects,
  kineticEffects,
  lookEffects,
  artEffects,
  layoutEffects,
  overlayEffects,
  reversedEffects,
  videoPlaybackEffects,
  remotionSceneEffects,
  motionEffects,
  effectSearchText,
} from "../src/builtin-effects";
import {
  affineMaps,
  centeredMatrix,
  repeatRegions,
  samplePoint,
} from "../src/graphic-maps";
import {
  EffectSchema,
  initialProject,
  makeLayer,
  validateProject,
  type Effect,
} from "../src/model";
import { GraphicEffects } from "../src/GraphicEffects";
import { VisualPassSchema, type VisualPass } from "../src/visual-effects";
import {
  EffectBundleSchema,
  effectEngine,
  applyEffectToLayers,
} from "../src/effect-bundle";
import { splitClips } from "../src/editor/editing";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
const modes: [string, keyof VisualPass, string[]][] = [
  ["color-silhouette", "silhouetteStyle", ["fill", "outline"]],
  ["color-remap", "paletteMode", ["negative", "solarize", "posterize"]],
  ["motion-smear", "smearMode", ["zoom", "spin", "directional"]],
  [
    "image-repetition",
    "repeatMode",
    ["grid", "mirror", "kaleidoscope", "tunnel"],
  ],
  ["graphic-rings", "kind", ["rings"]],
  ["memory-signal-tear", "distortionMode", ["bands", "blocks", "wave"]],
  ["memory-hatch", "screenPattern", ["lines", "dots"]],
  ["memory-flecks", "particleStyle", ["paper", "burst"]],
];
const variants = modes.flatMap(([id, key, choices]) =>
  choices.map((choice) => {
    const effect = structuredClone(builtinEffects.find((e) => e.id === id)!);
    effect.passes![0] = VisualPassSchema.parse({
      ...effect.passes![0],
      [key]: choice,
    });
    return effect;
  }),
);

test("video adds four distinct operations and extends existing cards without duplicates", () => {
  assert.equal(videoPlaybackEffects.length, 4);
  assert.equal(
    builtinEffects.length,
    34 +
      remotionSceneEffects.length +
      motionEffects.length +
      styleEffects.length +
      titleEffects.length +
      packEffects.length +
      kineticEffects.length +
      lookEffects.length +
      artEffects.length +
      layoutEffects.length +
      overlayEffects.length +
      reversedEffects.length,
  );
  assert.equal(
    new Set(builtinEffects.map((e) => e.id)).size,
    builtinEffects.length,
  );
  const oldKinds = new Set(
    builtinEffects
      .filter((e) => !videoPlaybackEffects.includes(e))
      .flatMap((e) => e.passes?.map((p) => p.kind) ?? []),
  );
  for (const e of videoPlaybackEffects)
    assert.ok(!oldKinds.has(e.passes![0].kind));
  assert.ok(
    effectSearchText(
      builtinEffects.find((e) => e.id === "memory-flecks")!,
    ).includes("fireworks"),
  );
  assert.ok(
    effectSearchText(
      builtinEffects.find((e) => e.id === "memory-hatch")!,
    ).includes("diagonal print screen"),
  );
});

test("inverse sampling keeps zoom anchored and maps repeated tiles to the original picture", () => {
  const w = 1920,
    h = 1080;
  const zoom = centeredMatrix(w, h, 2, 0);
  const center = samplePoint(zoom, w / 2, h / 2);
  close(center[0], w / 2);
  close(center[1], h / 2);
  assert.deepEqual(samplePoint(zoom, 0, 0), [w / 4, h / 4]);
  const rotation = centeredMatrix(w, h, 1, Math.PI / 2);
  const p = samplePoint(rotation, w / 2 + 100, h / 2);
  close(p[0], w / 2);
  close(p[1], h / 2 + 100);
  const mirror = repeatRegions("mirror", 6, 0.3, 0, w, h);
  assert.equal(mirror.length, 2);
  assert.deepEqual(
    samplePoint(mirror[0].matrix, w * 0.2, h * 0.2),
    samplePoint(mirror[1].matrix, w * 0.8, h * 0.2),
  );
  for (const mode of ["grid", "tunnel"] as const)
    for (const region of repeatRegions(mode, 6, 0.4, 0, w, h)) {
      const [x, y, rw, rh] = region.bounds!;
      const q = samplePoint(region.matrix, x + rw / 2, y + rh / 2);
      close(q[0], w / 2);
      close(q[1], h / 2);
    }
  for (const count of [2, 3, 6, 11, 12]) {
    const sectors = repeatRegions("kaleidoscope", count, 0.3, 0, w, h);
    assert.ok(sectors.length >= 4 && sectors.length % 2 === 0);
    const step = (Math.PI * 2) / sectors.length;
    const point = (angle: number) => [
      w / 2 + 100 * Math.cos(angle),
      h / 2 + 100 * Math.sin(angle),
    ];
    const a = point(step / 3),
      b = point(2 * step - step / 3);
    const q = samplePoint(sectors[0].matrix, a[0], a[1]),
      r = samplePoint(sectors[1].matrix, b[0], b[1]);
    close(q[0], r[0]);
    close(q[1], r[1]);
  }
});

test("sampling maps stay finite and within a bounded displacement range at all resolutions", () => {
  for (const [w, h] of [
    [180, 96],
    [1920, 1080],
  ])
    for (const mode of ["grid", "mirror", "kaleidoscope", "tunnel"] as const)
      for (const count of [2, 12])
        for (const size of [0, 1]) {
          const regions = repeatRegions(mode, count, size, 0.5, w, h);
          const maps = affineMaps(regions, w, h);
          assert.ok(maps.scale > 0 && maps.scale < w * 8);
          assert.ok(regions.length <= 84);
          for (const uri of [maps.x, maps.y]) {
            assert.ok(uri.startsWith("data:image/svg+xml"));
            assert.doesNotMatch(
              decodeURIComponent(uri),
              /NaN|Infinity|undefined/,
            );
          }
        }
});

const base = { ...makeLayer("video", "Clip"), duration: 6 };
function render(
  effect: Effect,
  time: number,
  layer = {
    ...base,
    effects: [{ effectId: effect.id, amount: 1, enabled: true }],
  },
) {
  return renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer,
      effects: [effect],
      time,
      children: React.createElement("video", { src: "fixture.mp4" }),
    }),
  );
}

test("new modes render deterministically, mount one source, and keep split continuity", () => {
  for (const effect of variants) {
    for (const time of [0, 0.2, 1, 5.9]) {
      const html = render(effect, time);
      assert.doesNotMatch(html, /NaN|Infinity|undefined/);
      assert.equal((html.match(/<video /g) ?? []).length, 1);
      assert.equal(render(effect, time), html);
    }
    const layer = {
      ...base,
      effects: [{ effectId: effect.id, amount: 1, enabled: true }],
    };
    const split = splitClips(
      { ...initialProject, layers: [layer], effects: [effect] },
      [layer.id],
      72,
      () => "right",
    ).project.layers[1];
    assert.equal(render(effect, 4.5), render(effect, 1.5, split));
    for (const instance of [
      { effectId: effect.id, amount: 0, enabled: true },
      { effectId: effect.id, amount: 1, enabled: false },
    ]) {
      assert.equal(
        render(effect, 1, { ...base, effects: [instance] }),
        '<video src="fixture.mp4"></video>',
      );
    }
  }
});

test("new modes survive projects and bundles and reject older engines that would lose settings", () => {
  for (const effect of variants) {
    const parsed = EffectSchema.parse(effect);
    const project = applyEffectToLayers(initialProject, parsed, [
      initialProject.layers[0].id,
    ]);
    assert.deepEqual(
      validateProject(JSON.parse(JSON.stringify(project))),
      project,
    );
    const bundle = {
      format: "frameforge-effect",
      version: 1,
      engine: effectEngine(parsed),
      name: effect.name,
      effect: parsed,
    };
    assert.equal(bundle.engine, "kamikami-visual-v3");
    assert.deepEqual(
      EffectBundleSchema.parse(JSON.parse(JSON.stringify(bundle))).effect,
      parsed,
    );
    assert.throws(
      () =>
        EffectBundleSchema.parse({ ...bundle, engine: "kamikami-visual-v2" }),
      /newer engine/,
    );
  }
  const original = builtinEffects.find((e) => e.id === "memory-signal-tear")!;
  assert.equal(effectEngine(original), "kamikami-visual-v2");
  for (const patch of [
    { repeatMode: "unbounded" },
    { count: 100 },
    { count: 2.5 },
    { distortionMode: "javascript" },
  ]) {
    assert.throws(() =>
      VisualPassSchema.parse({ ...original.passes![0], ...patch }),
    );
  }
});
