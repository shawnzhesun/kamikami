import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DepthSchema,
  FieldSchema,
  ParticleSchema,
  depthFrame,
  fieldFrames,
  particleFrames,
  particleFrame,
  projectDepth,
} from "../src/motion";
import {
  motionEffects,
  motionEffectFamilies,
  builtinEffects,
  effectVariationPatch,
} from "../src/builtin-effects";
import {
  EffectSchema,
  initialProject,
  makeLayer,
  validateProject,
  layerAtTime,
  resolveEffectInstance,
} from "../src/model";
import {
  TextEffectSchema,
  textUnitFrame,
  textUnits,
  scrambledText,
} from "../src/text-effects";
import { AnimatedText } from "../src/AnimatedText";
import { GraphicEffects } from "../src/GraphicEffects";
import { EffectSample, effectPosterTime } from "../src/editor/EffectSample";
import { depthParticleSvg } from "../src/SpatialGraphicEffects";
import {
  applyEffectToLayers,
  effectEngine,
  EffectBundleSchema,
} from "../src/effect-bundle";
import {
  applyInstanceEffectDraft,
  forkEffect,
} from "../src/editor/effect-draft";
import { splitClips, layerBounds, hitBounds } from "../src/editor/editing";
import { visualFrame } from "../src/visual-effects";
import { api } from "../src/media";

const base = (id: string) => builtinEffects.find((e) => e.id === id)!;
const variation = (id: string, preset: string) =>
  EffectSchema.parse({
    ...base(id),
    ...effectVariationPatch(base(id), preset),
  });
const renderText = (
  effects: ReturnType<typeof base>[],
  time: number,
  text = "Title 日本語 é 👨‍👩‍👧‍👦",
) =>
  renderToStaticMarkup(
    React.createElement(AnimatedText, {
      layer: {
        ...makeLayer("title", "Test"),
        duration: 6,
        text,
        effects: effects.map((e) => ({
          effectId: e.id,
          amount: 1,
          enabled: true,
        })),
      },
      effects,
      time,
    }),
  );

test("motion presets add only two cards, remain independent and support forked starting points", () => {
  assert.deepEqual(
    motionEffects.map((e) => e.id),
    ["text-glitch", "depth-motion"],
  );
  const before = JSON.stringify(motionEffectFamilies);
  for (const family of motionEffectFamilies)
    for (const preset of family.variations) {
      const effect = variation(family.id, preset.id);
      const fork = forkEffect(effect, `copy-${preset.id}`);
      assert.deepEqual(
        effectVariationPatch(fork, preset.id),
        effectVariationPatch(effect, preset.id),
      );
      const bundle = EffectBundleSchema.parse({
        format: "frameforge-effect",
        version: 1,
        engine: effectEngine(effect),
        name: effect.name,
        effect,
      });
      assert.deepEqual(
        EffectBundleSchema.parse(JSON.parse(JSON.stringify(bundle))),
        bundle,
      );
      const sample = renderToStaticMarkup(
        React.createElement(EffectSample, {
          effect,
          time: effectPosterTime(effect),
        }),
      );
      assert.doesNotMatch(sample, /NaN|Infinity/);
      if (effect.text) assert.match(sample, /Title/);
    }
  assert.equal(JSON.stringify(motionEffectFamilies), before);
});

test("projection and depth motion have finite near clipping, focus and settled endpoints", () => {
  const settings = DepthSchema.parse({ from: 3, to: 0, x: 0.2, blur: 8 });
  const start = depthFrame(settings, 0, 6),
    end = depthFrame(settings, 3, 6);
  assert.ok(start.scale < end.scale);
  assert.equal(end.scale, 1);
  assert.equal(end.x, 0);
  assert.equal(end.blur, 0);
  assert.equal(depthFrame(settings, 3, 6, 0).scale, 1);
  assert.equal(depthFrame(settings, 3, 6, 0).opacity, 1);
  const near = projectDepth(1, 1, -1);
  assert.equal(near.opacity, 0);
  assert.ok(Object.values(near).every(Number.isFinite));
  const float = DepthSchema.parse({ mode: "float", seconds: 4 });
  assert.deepEqual(depthFrame(float, 0, 6), depthFrame(float, 4, 6));
  assert.throws(() => DepthSchema.parse({ from: -2 }));
});

test("text glitches are seeded, preserve graphemes and settle completely after an entrance", () => {
  const effect = TextEffectSchema.parse({
    kind: "glitch",
    speed: 3,
    seconds: 1,
    glitch: {
      timing: "entrance",
      affected: 1,
      substitute: true,
      alphabet: "日本語✨",
    },
  });
  const a = textUnitFrame(effect, 0.05, 2, 12, 6);
  assert.ok(a.scramble);
  assert.notEqual(a.x, 0);
  assert.ok(a.rgb > 0);
  assert.deepEqual(textUnitFrame(effect, 0.05, 2, 12, 6), a);
  const end = textUnitFrame(effect, 1.1, 2, 12, 6);
  assert.equal(end.scramble, false);
  assert.equal(end.opacity, 1);
  assert.equal(end.x, 0);
  assert.equal(end.slice, 0);
  const zero = textUnitFrame(effect, 0.05, 2, 12, 6, 0);
  assert.equal(zero.opacity, 1);
  assert.equal(zero.x, 0);
  assert.equal(zero.rgb, 0);
  assert.equal(textUnits("é👨‍👩‍👧‍👦日本", "character").length, 4);
  assert.equal(scrambledText(" ", 17, 1, 1, 1, "日本"), " ");
  assert.ok(["日", "本"].includes(scrambledText("語", 17, 1, 1, 1, "日本")));
  const glitch = { ...base("text-glitch"), text: effect };
  for (const colorId of ["text-gradient", "text-neon"]) {
    const html = renderText([base(colorId), glitch], 0.05);
    assert.match(html, /data-text-fill/);
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.match(renderText([base(colorId), glitch], 2), /日本語/);
  }
});

test("depth text entries and exits use stable order and reach readable / hidden endpoints", () => {
  for (const style of ["depth", "scatter", "spiral"] as const) {
    const text = TextEffectSchema.parse({
      kind: "stagger",
      style,
      motion: { order: "random" },
    });
    assert.equal(textUnitFrame(text, 0, 1, 8, 6).opacity, 0);
    const end = textUnitFrame(text, 2, 1, 8, 6);
    assert.equal(end.opacity, 1);
    assert.equal(end.x, 0);
    assert.equal(end.scale, 1);
    const out = {
      ...text,
      motion: { ...text.motion!, direction: "out" as const },
    };
    assert.equal(textUnitFrame(out, 0, 1, 8, 6).opacity, 1);
    assert.equal(textUnitFrame(out, 6, 1, 8, 6).opacity, 0);
  }
});

test("particle and object fields can be sought out of order, sorted in depth, and bounded", () => {
  for (const mode of ["drift", "burst", "tunnel", "vortex"] as const) {
    const config = ParticleSchema.parse({
      mode,
      count: 128,
      emitter: "sphere",
      trails: 0.5,
    });
    const middle = particleFrames(config, 2.15, 71);
    particleFrames(config, 500, 71);
    particleFrames(config, 0, 71);
    assert.deepEqual(particleFrames(config, 2.15, 71), middle);
    assert.notDeepEqual(particleFrames(config, 2.15, 72), middle);
    assert.ok(middle.every((p, i) => i === 0 || middle[i - 1].z >= p.z));
    assert.ok(
      middle.every(
        (p) =>
          Object.values(p).every(Number.isFinite) &&
          p.opacity >= 0 &&
          p.opacity <= 1,
      ),
    );
  }
  for (const mode of ["volume", "tunnel", "orbit"] as const) {
    const f = FieldSchema.parse({ mode, count: 16, faceCamera: false });
    const frames = fieldFrames(f, 1, 71);
    assert.deepEqual(fieldFrames(f, 1, 71), frames);
    assert.notDeepEqual(fieldFrames(f, 2, 71), frames);
    assert.ok(frames.every((p) => Object.values(p).every(Number.isFinite)));
    assert.ok(frames.every((p, i) => i === 0 || frames[i - 1].z >= p.z));
  }
  assert.throws(() => ParticleSchema.parse({ count: 100000 }));
  assert.throws(() => FieldSchema.parse({ count: 100000 }));
  const sphere = ParticleSchema.parse({
    emitter: "sphere",
    mode: "burst",
    velocity: 0,
    turbulence: 0,
    gravity: 0,
  });
  for (let i = 0; i < 20; i++) {
    const p = particleFrame(sphere, 0, 17, i);
    const unproject = 1 + p.z;
    assert.ok(
      Math.abs(
        (p.x * unproject) ** 2 +
          (p.y * unproject) ** 2 +
          ((2 * p.z) / sphere.depth - 1) ** 2 -
          1,
      ) < 1e-9,
    );
  }
});

test("canvas hits follow the projected plane and ignore elements hidden at the near plane", () => {
  const effect = variation("depth-motion", "depth-fly-past");
  const layer = {
    ...makeLayer("image", "Card"),
    effects: [{ effectId: effect.id, enabled: true, amount: 1 }],
  };
  const project = { ...initialProject, effects: [effect] };
  const hidden = layerBounds(layer, project, 48, { width: 600, height: 300 });
  assert.equal(hitBounds(hidden.cx, hidden.cy, hidden), false);
  const box = {
    width: 600,
    height: 300,
    cx: 960,
    cy: 540,
    scale: 1.4,
    rotation: 24,
    rotateX: 30,
    rotateY: -55,
    perspective: 1800,
  };
  const projectPoint = (x: number, y: number) => {
    const rx = (box.rotateX * Math.PI) / 180,
      ry = (box.rotateY * Math.PI) / 180,
      rz = (box.rotation * Math.PI) / 180;
    const xx = x * Math.cos(ry);
    const yy = x * Math.sin(ry) * Math.sin(rx) + y * Math.cos(rx);
    const z = -x * Math.sin(ry) * Math.cos(rx) + y * Math.sin(rx);
    const scale = box.scale / (1 - z / box.perspective);
    return [
      box.cx + (xx * Math.cos(rz) - yy * Math.sin(rz)) * scale,
      box.cy + (xx * Math.sin(rz) + yy * Math.cos(rz)) * scale,
    ];
  };
  for (const [x, y, expected] of [
    [280, 140, true],
    [-280, -140, true],
    [310, 0, false],
    [0, -160, false],
  ] as const) {
    const [px, py] = projectPoint(x, y);
    assert.equal(hitBounds(px, py, box), expected);
  }
});

test("object fields sample a single media source; particles can escape source alpha", () => {
  const effect = variation("image-repetition", "repetition-volume");
  const layer = {
    ...makeLayer("video", "Video"),
    effects: [{ effectId: effect.id, enabled: true, amount: 1 }],
  };
  const render = (e: typeof effect) =>
    renderToStaticMarkup(
      React.createElement(GraphicEffects, {
        layer,
        effects: [e],
        time: 1,
        children: React.createElement("video", { src: "test.mp4" }),
      }),
    );
  const html = render(effect);
  assert.equal((html.match(/<video /g) ?? []).length, 1);
  assert.match(html, /object0/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  const particles = variation("memory-flecks", "particles-depth-burst");
  const pLayer = {
    ...layer,
    effects: [{ effectId: particles.id, enabled: true, amount: 1 }],
  };
  const particleMarkup = (e: typeof particles) =>
    renderToStaticMarkup(
      React.createElement(GraphicEffects, {
        layer: pLayer,
        effects: [e],
        time: 1,
        children: React.createElement("span", null, "Title"),
      }),
    );
  assert.doesNotMatch(particleMarkup(particles), /in2="SourceAlpha"/);
  const clipped = {
    ...particles,
    passes: [
      {
        ...particles.passes![0],
        particles: { ...particles.passes![0].particles!, clipToSource: true },
      },
    ],
  };
  assert.match(particleMarkup(clipped), /in2="SourceAlpha"/);
  const field = variation("image-repetition", "repetition-glyphs");
  assert.match(
    renderText([field, base("text-gradient")], 1),
    /aria-label="Title 日本語/,
  );
  const stacked = { ...field, passes: [...field.passes!, ...field.passes!] };
  const stackedLayer = {
    ...makeLayer("title", "Title"),
    effects: [{ effectId: stacked.id, enabled: true, amount: 1 }],
  };
  assert.match(
    renderToStaticMarkup(
      React.createElement(GraphicEffects, {
        layer: stackedLayer,
        effects: [stacked],
        time: 1,
        children: "Title",
      }),
    ),
    /object0/,
  );
});

test("new settings persist independently and retain phase through splits", () => {
  for (const effect of [
    base("depth-motion"),
    base("text-glitch"),
    variation("memory-flecks", "particles-dust"),
    variation("image-repetition", "repetition-orbit"),
  ]) {
    let project = validateProject({
      ...initialProject,
      tracks: undefined,
      layers: [
        { ...makeLayer("title", "First"), id: "first", duration: 6 },
        { ...makeLayer("title", "Second"), id: "second", duration: 6 },
      ],
    });
    project = applyEffectToLayers(project, effect, ["first", "second"]);
    const original = resolveEffectInstance(
      project.layers[0].effects[0],
      project.effects,
    )!;
    const edited = applyInstanceEffectDraft(
      project,
      "first",
      { ...original, tint: 0.4 },
      original,
    );
    assert.equal(edited.layers[1].effects[0].settings!.tint, original.tint);
    assert.deepEqual(
      validateProject(JSON.parse(JSON.stringify(edited))),
      edited,
    );
    const split = splitClips(edited, ["first"], 48, () => "right").project;
    const right = split.layers.find((l) => l.id === "right")!;
    assert.deepEqual(
      layerAtTime(edited.layers[0], edited.effects, 3),
      layerAtTime(right, split.effects, 1),
    );
    const draw = (layer: typeof right, t: number) =>
      renderToStaticMarkup(
        React.createElement(AnimatedText, {
          layer,
          effects: split.effects,
          time: t,
        }),
      );
    assert.equal(draw(edited.layers[0], 3), draw(right, 1));
    const pass = original.passes?.find((p) => p.particles);
    if (pass) {
      const renderParticles = (layer: typeof right, time: number) => {
        const f = visualFrame(
          pass,
          time + layer.effectOffset,
          layer.effectDuration || layer.duration,
          1,
        );
        return depthParticleSvg(pass, f.time, f.strength, 1920, 1080);
      };
      assert.equal(
        renderParticles(edited.layers[0], 3),
        renderParticles(right, 1),
      );
    }
  }
});

test("v5 bundles reject older engines and stale services cannot strip instance-only motion", async () => {
  const effect = base("depth-motion");
  assert.equal(effectEngine(effect), "kamikami-visual-v5");
  assert.equal(
    effectEngine({
      ...base("text-stagger"),
      text: TextEffectSchema.parse({ kind: "stagger", unit: "title" }),
    }),
    "kamikami-visual-v5",
  );
  assert.throws(() =>
    EffectBundleSchema.parse({
      format: "frameforge-effect",
      version: 1,
      engine: "kamikami-visual-v4",
      name: effect.name,
      effect,
    }),
  );
  const originalFetch = globalThis.fetch;
  let engine = "kamikami-visual-v4";
  const requests: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    requests.push(String(url));
    return Response.json(
      String(url) === "/api/health"
        ? { projectVersion: 2, effectLibraryVersion: 2, effectEngine: engine }
        : { ok: true },
    );
  }) as typeof fetch;
  try {
    const project = {
      ...initialProject,
      layers: [{ effects: [{ settings: { depth: effect.depth } }] }],
    };
    await assert.rejects(
      api("/api/render", "POST", { project }),
      /outdated.*Restart/,
    );
    assert.deepEqual(requests, ["/api/health"]);
    engine = "kamikami-visual-v5";
    await api("/api/render", "POST", { project });
    assert.equal(requests.at(-1), "/api/render");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
