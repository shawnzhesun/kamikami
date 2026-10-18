import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EffectSchema, makeLayer, type Effect } from "../src/model";
import { GraphicEffects } from "../src/GraphicEffects";
import { EffectBundleSchema, effectEngine } from "../src/effect-bundle";
import { effectRole } from "../src/effect-roles";
import { builtinEffects } from "../src/builtin-effects";
import { usesV9Features, type VisualPass } from "../src/visual-effects";
import { grainCell, thresholdMap } from "../src/PrintGraphicEffects";
import { makeOverlay, overlayParts } from "../src/overlays";

const pass = (patch: Partial<VisualPass> = {}): VisualPass => ({
  kind: "riso",
  strength: 1,
  size: 0.4,
  speed: 0,
  color: "#f2ede3",
  secondary: "#0078bf",
  angle: 0,
  timing: "constant",
  seconds: 0.8,
  seed: 7,
  risoInks: ["#0078bf", "#ff48b0"],
  ...patch,
});
const riso = (patch: Partial<VisualPass> = {}): Effect =>
  EffectSchema.parse({
    id: "riso",
    name: "Riso",
    description: "",
    channels: [],
    color: "#ffffff",
    tint: 0,
    passes: [pass(patch)],
  });
const render = (effect: Effect, time = 1) =>
  renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer: {
        ...makeLayer("image", "Picture"),
        duration: 6,
        effects: [{ effectId: effect.id, amount: 1, enabled: true }],
      },
      effects: [effect],
      time,
      children: "x",
    }),
  );

test("a dot screen's inked area matches its coverage at any angle", () => {
  for (const angle of [0, 15, 45, 75, -30])
    for (const pitch of [4.6, 7, 11]) {
      const { size, threshold } = thresholdMap(pitch, angle);
      assert.ok(size >= pitch && size < pitch * 30, `${angle}° cell ${size}`);
      for (const coverage of [0.1, 0.3, 0.5, 0.7]) {
        const inked = threshold.filter((t) => t < coverage).length;
        assert.ok(
          Math.abs(inked / threshold.length - coverage) < 0.06,
          `${angle}° ${pitch}px at ${coverage}: ${inked / threshold.length}`,
        );
      }
      // One plate never prints a true solid: the corners between dots stay open.
      assert.ok(threshold.some((t) => t > 0.99));
    }
});

test("riso prints one plate per ink, with or without paper, and needs engine v9", () => {
  const two = render(riso());
  assert.doesNotMatch(two, /NaN|Infinity|undefined/);
  assert.equal(two.match(/<feTile/g)?.length, 3); // grain + two screens
  assert.match(two, /flood-color="#f2ede3"/); // paper
  assert.equal(two.match(/mode="multiply"/g)?.length, 3); // mottle + two inks
  const trio = render(
    riso({ risoInks: ["#0078bf", "#ff48b0", "#ffe800"], risoPaper: "clear" }),
  );
  assert.equal(trio.match(/<feTile/g)?.length, 4);
  assert.doesNotMatch(trio, /flood-color="#f2ede3"/);
  // Press wobble moves the plates between steps; a still press doesn't.
  const offsets = (html: string) => html.match(/<feOffset[^>]*>/g)!.join();
  assert.equal(offsets(render(riso(), 1)), offsets(render(riso(), 3)));
  assert.notEqual(
    offsets(render(riso({ speed: 4 }), 1)),
    offsets(render(riso({ speed: 4 }), 1.3)),
  );

  assert.equal(effectEngine(riso()), "kamikami-visual-v9");
  assert.ok(usesV9Features(riso()));
  assert.ok(!builtinEffects.some(usesV9Features));
  const bundle = {
    format: "frameforge-effect",
    version: 1,
    name: "Riso",
    effect: riso(),
  };
  assert.ok(
    EffectBundleSchema.safeParse({ ...bundle, engine: "kamikami-visual-v9" })
      .success,
  );
  assert.equal(
    EffectBundleSchema.safeParse({ ...bundle, engine: "kamikami-visual-v8" })
      .success,
    false,
  );
});

test("riso timing grows the dots in and prints them away, and sets the role", () => {
  const amplitude = (html: string) =>
    Number(html.match(/<feFuncA type="gamma" amplitude="([\d.e-]+)"/)![1]);
  const entrance = riso({ timing: "in", seconds: 1 });
  assert.equal(amplitude(render(entrance, 0)), 0);
  assert.equal(amplitude(render(entrance, 2)), 1);
  const exit = riso({ timing: "out", seconds: 1 });
  assert.equal(amplitude(render(exit, 1)), 1);
  assert.ok(amplitude(render(exit, 5.9)) < 0.05);
  assert.deepEqual(effectRole(entrance), { role: "in", feel: "Reveal" });
  assert.deepEqual(effectRole(exit), { role: "out", feel: "Conceal" });
  assert.deepEqual(effectRole(riso()), {
    role: "finish",
    feel: "Illustration",
  });
});

test("ink grain is a seeded, tileable patch that scales with the frame", () => {
  const a = grainCell(1, 7),
    b = grainCell(1, 7);
  assert.equal(a, b);
  assert.notEqual(grainCell(1, 8).href, a.href);
  assert.equal(grainCell(2, 7).size, a.size * 2);
});

test("halftone washes grow dots of one or two inks in every shape", () => {
  const box = { x: 0, y: 0, w: 6, h: 2 };
  const target = { kind: "text" as const, box, lines: [box], words: [box] };
  for (let variant = 0; variant < 4; variant++)
    for (const count of [1, 2]) {
      const o = makeOverlay("halftonewash", { variant, count });
      assert.deepEqual(overlayParts(o, 1, 0, 6, target as never), []);
      const parts = overlayParts(o, 1, 2, 6, target as never);
      assert.equal(parts.length, count, `shape ${variant}`);
      for (const part of parts) {
        assert.equal(part.blend, "multiply");
        assert.ok(part.behind);
        assert.doesNotMatch(part.d!, /NaN|Infinity/);
        const dots = part.d!.match(/M/g)!.length;
        assert.ok(dots > 20 && dots < 5000, `${dots} dots`);
      }
      const halfway = overlayParts(o, 1, 0.4, 6, target as never);
      assert.ok(halfway[0].d!.length < parts[0].d!.length);
    }
  assert.ok(usesV9Features({ overlay: makeOverlay("halftonewash", {}) }));
});
