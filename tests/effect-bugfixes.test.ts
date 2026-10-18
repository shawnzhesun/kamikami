import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EffectSchema,
  initialProject,
  layerAtTime,
  makeLayer,
  validateProject,
  type Effect,
  type Layer,
} from "../src/model";
import {
  builtinEffectCategory,
  builtinEffects,
  effectVariationId,
  getEffectFamily,
  motionEffectFamilies,
} from "../src/builtin-effects";
import { GraphicEffects } from "../src/GraphicEffects";
import { AnimatedText } from "../src/AnimatedText";
import { effectPosterTime } from "../src/editor/EffectSample";
import { fieldFrames, FieldSchema, DepthSchema } from "../src/motion";
import { splitClips, trimClip } from "../src/editor/editing";
import { TextEffectSchema } from "../src/text-effects";

const effect = (patch: Partial<Effect>): Effect =>
  EffectSchema.parse({
    id: "fx",
    name: "Fx",
    description: "",
    channels: [],
    color: "#ffffff",
    tint: 0,
    ...patch,
  });
const withEffects = (layer: Layer, effects: Effect[], amount = 1): Layer => ({
  ...layer,
  effects: effects.map((e) => ({
    effectId: e.id,
    amount,
    enabled: true,
    settings: { ...e, id: undefined } as never,
  })),
});
const markup = (layer: Layer, effects: Effect[], time = 0.5) =>
  renderToStaticMarkup(
    React.createElement(GraphicEffects, {
      layer,
      effects,
      time,
      children: "x",
    }),
  );
const pass = (kind: string, patch: Record<string, unknown> = {}) => ({
  kind,
  strength: 1,
  size: 0.5,
  speed: 0,
  color: "#ffffff",
  secondary: "#000000",
  angle: 0,
  timing: "constant",
  seconds: 1,
  seed: 1,
  ...patch,
});

test("multiplicative channels clamp per factor at strength above one", () => {
  const fades = ["a", "b"].map((id) =>
    effect({
      id,
      channels: [
        {
          property: "opacity",
          curve: "linear",
          from: 1,
          to: 0,
          frequency: 0,
          phase: 0,
        },
      ],
    }),
  );
  const layer = withEffects(
    { ...makeLayer("title", "T"), duration: 4 },
    fades,
    2,
  );
  assert.equal(layerAtTime(layer, fades, 4).opacity, 0);
});

test("depth tilt X is clamped like tilt Y", () => {
  const depth = effect({ depth: DepthSchema.parse({ tiltX: 80, tiltY: 80 }) });
  const v = layerAtTime(
    withEffects(makeLayer("image", "I"), [depth], 2),
    [depth],
    0,
  );
  assert.equal(v.rotateX, 90);
  assert.equal(v.rotateY, 90);
});

test("every family's untouched card matches a named variation", () => {
  for (const card of builtinEffects) {
    if (!getEffectFamily(card.id)) continue;
    assert.notEqual(effectVariationId(card), "custom", card.id);
  }
  assert.ok(motionEffectFamilies.length > 0);
});

test("gallery categories reuse shared names", () => {
  const counts = new Map<string, number>();
  for (const e of builtinEffects) {
    const c = builtinEffectCategory(e.id);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const [category, count] of counts)
    assert.ok(count > 1, `${category} has a single card`);
});

test("depth tunnel copies are invisible when they wrap", () => {
  const field = FieldSchema.parse({ mode: "tunnel", count: 20, size: 0.3 });
  let worst = 0;
  for (let frame = 0; frame < 24 * 12; frame++) {
    const a = fieldFrames(field, frame / 24, 17);
    const b = fieldFrames(field, (frame + 1) / 24, 17);
    for (const item of a) {
      const next = b.find((x) => x.id === item.id)!;
      worst = Math.max(worst, Math.abs(item.opacity - next.opacity));
    }
  }
  assert.ok(worst < 0.2, `opacity jumped by ${worst}`);
});

test("echo angle sets direction; grain and iris filters are well-formed", () => {
  const layer = makeLayer("image", "I");
  const down = effect({ passes: [pass("echo", { angle: 90 })] as never });
  const m = markup(withEffects(layer, [down]), [down]);
  const offsets = [
    ...m.matchAll(/<feOffset[^>]*dx="([^"]+)"[^>]*dy="([^"]+)"/g),
  ];
  assert.ok(offsets.length === 3);
  for (const [, dx, dy] of offsets) {
    assert.ok(Math.abs(Number(dx)) < 1e-6);
    assert.ok(Number(dy) > 0);
  }
  const grain = effect({ passes: [pass("grain")] as never });
  assert.match(
    markup(withEffects(layer, [grain]), [grain]),
    /<feBlend in="clipped" in2="SourceGraphic" mode="soft-light"/,
  );
  const iris = effect({ passes: [pass("iris", { strength: 0.3 })] as never });
  const irisMarkup = markup(withEffects(layer, [iris]), [iris]);
  assert.match(irisMarkup, /<filter[^>]*x="-960"/);
  assert.match(irisMarkup, /<feImage[^>]*x="-960"/);
});

test("pulse previews show the effect and long transitions stay in the loop", () => {
  const pulse = effect({
    passes: [pass("bloom", { timing: "pulse", speed: 1 })] as never,
  });
  assert.equal(effectPosterTime(pulse), 0);
  const long = effect({
    passes: [pass("iris", { timing: "in", seconds: 20 })] as never,
  });
  const t = effectPosterTime(long);
  assert.ok(t >= 0 && t <= 6);
  const out = effect({
    text: TextEffectSchema.parse({
      kind: "stagger",
      seconds: 20,
      motion: { direction: "out" },
    }),
  });
  assert.ok(effectPosterTime(out) >= 0);
});

test("gradient keeps an earlier neon glow", () => {
  const neon = effect({
    id: "n",
    text: TextEffectSchema.parse({ kind: "neon" }),
  });
  const gradient = effect({
    id: "g",
    text: TextEffectSchema.parse({ kind: "gradient" }),
  });
  const layer = withEffects({ ...makeLayer("title", "T"), text: "Hi" }, [
    neon,
    gradient,
  ]);
  const html = renderToStaticMarkup(
    React.createElement(AnimatedText, {
      layer,
      effects: [neon, gradient],
      time: 0.5,
    }),
  );
  assert.match(html, /text-shadow:0 0/);
});

test("right trims move a whole clip's exit timing but keep split timelines", () => {
  const p = validateProject({
    ...initialProject,
    layers: [{ ...makeLayer("title", "T"), id: "t", duration: 10 }],
  });
  assert.equal(trimClip(p, "t", "right", 6).layers[0].effectDuration, 0);
  const split = splitClips(p, ["t"], 4 * 24, () => "r").project;
  const left = trimClip(split, "t", "right", 3).layers.find(
    (l) => l.id === "t",
  )!;
  assert.equal(left.effectDuration, 10);
  const right = trimClip(split, "r", "right", 8).layers.find(
    (l) => l.id === "r",
  )!;
  assert.equal(right.effectDuration, 10);
});
