import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedText } from "../src/AnimatedText";
import { ArtworkStack } from "../src/ArtworkLayer";
import {
  builtinEffectCategory,
  getEffectFamily,
  overlayEffects,
} from "../src/builtin-effects";
import {
  applyEffectToLayers,
  EffectBundleSchema,
  effectEngine,
} from "../src/effect-bundle";
import { EffectSample, effectPosterTime } from "../src/editor/EffectSample";
import {
  initialProject,
  makeLayer,
  validateProject,
  EffectSchema,
  type Effect,
} from "../src/model";
import {
  makeOverlay,
  overlayFeelNames,
  overlayKinds,
  overlayParts,
  overlayProgress,
  overlaySpecs,
  type Overlay,
} from "../src/overlays";

const target = {
  box: { x: 0, y: 0, w: 4, h: 2 },
  key: { x: -0.8, y: -0.5, w: 2, h: 0.9 },
  lines: [
    { x: 0, y: -0.5, w: 4, h: 0.9 },
    { x: 0, y: 0.5, w: 2.5, h: 0.9 },
  ],
  unitPx: 60,
  start: 8.5,
};
const variants = overlayEffects.flatMap((effect) => {
  const family = getEffectFamily(effect.id);
  return family
    ? family.variations.map((v) =>
        EffectSchema.parse({ ...effect, ...v.parameters }),
      )
    : [effect];
});

const picture = {
  box: { x: 0, y: 0, w: 40, h: 22 },
  unitPx: 27,
  start: 3,
  room: { left: 4, right: 4, top: 6, bottom: 6 },
  peers: [[-30, -12]] as [number, number][],
};
const words = {
  ...target,
  words: [
    { x: -1.1, y: -0.5, w: 1.6, h: 0.9 },
    { x: 1.0, y: -0.5, w: 1.8, h: 0.9 },
    { x: 0, y: 0.5, w: 2.5, h: 0.9 },
  ],
  initial: { x: -1.6, y: -0.5, w: 0.5, h: 0.9 },
  text: "Your story\nstarts here",
  word: "story",
};
const finite = (parts: unknown, label: string) =>
  assert.doesNotMatch(JSON.stringify(parts), /NaN|null|Infinity/, label);

test("overlay cards cover every kind as v8 effects with finite previews", () => {
  assert.equal(overlayKinds.length, 75);
  assert.equal(overlayEffects.length, 76);
  assert.deepEqual(
    [...new Set(overlayEffects.map((e) => e.overlay!.kind))].sort(),
    [...overlayKinds].sort(),
  );
  assert.ok(variants.length >= 280, `${variants.length} variations`);
  for (const effect of variants) {
    assert.equal(builtinEffectCategory(effect.id), "Overlay");
    assert.equal(effectEngine(effect), "kamikami-visual-v8", effect.id);
    const markup = renderToStaticMarkup(
      React.createElement(EffectSample, {
        effect,
        time: effectPosterTime(effect),
      }),
    );
    assert.doesNotMatch(markup, /NaN|undefined|Infinity/, effect.id);
    for (const t of [target, words, picture])
      for (const time of [0, 0.2, 2, 5.9]) {
        const parts = overlayParts(effect.overlay!, 1, time, 6, t);
        finite(parts, `${effect.id} at ${time}`);
        // Keys name filters and masks, so they must be unique in a frame.
        assert.equal(
          new Set(parts.map((p) => p.key)).size,
          parts.length,
          `${effect.id} keys at ${time}`,
        );
        for (const part of parts)
          assert.ok(part.d || part.text !== undefined || part.paths, effect.id);
      }
  }
  // Every kind draws something once it's on, in every shape variant.
  for (const kind of overlayKinds) {
    const spec = overlaySpecs[kind];
    assert.ok(overlayFeelNames.includes(spec.feel as never), kind);
    assert.ok(spec.name && spec.description, kind);
    for (let v = 0; v < Math.max(1, spec.variants?.length ?? 0); v++) {
      const o = makeOverlay(kind, { variant: v, timing: "constant" });
      for (const t of [words, picture])
        assert.ok(overlayParts(o, 1, 2.3, 6, t).length > 0, `${kind} #${v}`);
    }
  }
  // The framing marks keep the IDs they had as artwork treatments.
  for (const id of ["art-print", "art-brackets", "art-label", "art-tape"])
    assert.ok(overlayEffects.some((e) => e.id === id));
});

test("shared line and fill styles restyle any kind", () => {
  const box = (patch: Partial<Overlay>) =>
    overlayParts(
      makeOverlay("box", { timing: "constant", ...patch }),
      1,
      2,
      6,
      words,
    );
  const plain = box({});
  assert.ok(plain[0].stroke && !plain[0].paths);
  for (const stroke of [
    "marker",
    "brush",
    "chalk",
    "pencil",
    "sketch",
    "double",
    "neon",
  ] as const) {
    const [part] = box({ stroke });
    assert.ok(part.paths?.length, stroke);
    finite(part, stroke);
  }
  // Tapered and marker strokes are filled outlines; rough strokes are lines.
  assert.ok(box({ stroke: "brush" })[0].paths![0].fill);
  assert.ok(box({ stroke: "pencil" })[0].paths!.every((p) => p.stroke));
  assert.ok(box({ stroke: "chalk" })[0].paths![0].grain);
  assert.ok(box({ stroke: "dashed" })[0].dash);
  // Seeded: an export frame matches its preview.
  assert.deepEqual(box({ stroke: "sketch" }), box({ stroke: "sketch" }));
  // An outline that encloses the words takes its fill behind them.
  const hatched = box({ fill: "hatch" });
  assert.equal(hatched.length, 2);
  assert.equal(hatched[0].behind, true);
  assert.equal(hatched[0].pattern!.style, "hatch");
  // Hand-drawn lines get hand-drawn hatching.
  const rough = box({ fill: "crosshatch", stroke: "pencil" });
  assert.ok(rough[0].paths?.length && !rough[0].pattern);
  // Solid shapes can become outlines or patterns.
  const print = (patch: Partial<Overlay>) =>
    overlayParts(
      makeOverlay("print", { timing: "constant", ...patch }),
      1,
      2,
      6,
      picture,
    )[0];
  assert.ok(print({}).fill && !print({}).stroke);
  assert.ok(!print({ fill: "none" }).fill && print({ fill: "none" }).stroke);
  assert.equal(print({ fill: "halftone" }).pattern!.style, "halftone");
  // Layer and blend overrides, fonts and capitals.
  assert.ok(box({ layer: "behind" }).every((p) => p.behind));
  assert.ok(box({ blend: "screen" }).every((p) => p.blend === "screen"));
  const label = overlayParts(
    makeOverlay("label", {
      timing: "constant",
      label: "Take {index}",
      caps: true,
      font: "serif",
    }),
    1,
    2,
    6,
    target,
  ).at(-1)!;
  assert.equal(label.text, "TAKE 01");
  assert.equal(label.font, "serif");
});

test("entrances, exits, loops and placement move any mark", () => {
  const at = (patch: Partial<Overlay>, time: number) =>
    overlayParts(
      makeOverlay("tick", { seconds: 1, ...patch }),
      1,
      time,
      6,
      target,
    );
  // The kind's own draw-on, or a whole-mark entrance.
  assert.ok(at({}, 0.3)[0].draw! < 1);
  const pop = at({ enter: "pop" }, 0.3)[0];
  assert.equal(pop.draw, 1);
  assert.match(pop.transform!, /scale\(/);
  assert.ok(at({ enter: "fade" }, 0.3)[0].opacity < 1);
  assert.ok(at({ enter: "wipe" }, 0.3)[0].clip!.w > 0);
  assert.equal(at({ enter: "pop" }, 0).length, 0);
  // Exits play the entrance backwards unless they have their own style.
  assert.match(at({ enter: "pop" }, 5.7)[0].transform!, /scale\(/);
  const slideOut = at({ enter: "pop", exit: "slide" }, 5.7)[0];
  assert.doesNotMatch(slideOut.transform!, /scale\(/);
  // Settled marks carry no extra motion.
  assert.equal(at({ enter: "pop" }, 3)[0].transform, at({}, 3)[0].transform);
  // Loops follow the tempo.
  const pulse = (time: number) =>
    at({ loop: "pulse", tempo: 60 }, time)[0].transform;
  assert.notEqual(pulse(2.02), pulse(2.6));
  assert.equal(pulse(2.02), pulse(3.02));
  // Placement nudges, turns and mirrors.
  assert.match(at({ offsetX: 2 }, 3)[0].transform!, /^translate\(2 0\)/);
  assert.match(at({ rotate: 30 }, 3)[0].transform!, /rotate\(30\)/);
  assert.match(at({ mirror: true }, 3)[0].transform!, /scale\(-1 1\)/);
  const callout = (mirror: boolean) =>
    overlayParts(
      makeOverlay("callout", { timing: "constant", mirror }),
      1,
      2,
      6,
      target,
    ).at(-1)!;
  // Mirrored labels move across but stay readable.
  assert.equal(callout(true).x, -callout(false).x!);
  assert.equal(callout(true).align, "end");
});

test("text-aware anchors repeat a mark over words, lines or the first letter", () => {
  const circles = overlayParts(
    makeOverlay("circle", { anchor: "words", seconds: 1, stagger: 0.5 }),
    1,
    1.2,
    6,
    words,
  );
  assert.equal(circles.length, 3);
  // Words draw one after another.
  assert.ok(
    circles[0].draw! > circles[1].draw! && circles[1].draw! > circles[2].draw!,
  );
  assert.match(circles[1].transform!, /^translate\(1 -0\.5\)/);
  const lines = overlayParts(
    makeOverlay("box", { anchor: "lines", timing: "constant" }),
    1,
    2,
    6,
    words,
  );
  assert.equal(lines.length, 2);
  const initial = overlayParts(
    makeOverlay("initial", { timing: "constant" }),
    1,
    2,
    6,
    words,
  );
  assert.ok(initial.length >= 2);
  // Letter effects use the element's own letters.
  const rain = overlayParts(makeOverlay("glyphrain"), 1, 2, 6, words);
  assert.ok(rain.every((p) => "Yourstorystartshere".includes(p.text!)));
  // Readouts name the key word; callouts can quote it.
  const callout = overlayParts(
    makeOverlay("callout", {
      anchor: "keyword",
      label: "“{word}”",
      timing: "constant",
    }),
    1,
    2,
    6,
    words,
  ).at(-1)!;
  assert.equal(callout.text, "“story”");
  // Threads reach the nearest other element; alone they follow the angle.
  const thread = (t: typeof picture) =>
    overlayParts(
      makeOverlay("thread", { timing: "constant", variant: 2 }),
      1,
      2,
      6,
      t,
    )[0].d!;
  assert.match(thread(picture), /^M-/);
  assert.notEqual(thread(picture), thread({ ...picture, peers: [] }));
});

test("marks draw on at the start, retract at the end, or land at the end", () => {
  const envelope = makeOverlay("circle", { seconds: 0.5 });
  assert.equal(overlayProgress(envelope, 0, 6), 0);
  assert.equal(overlayProgress(envelope, 3, 6), 1);
  assert.equal(overlayProgress(envelope, 6, 6), 0);
  assert.equal(overlayParts(envelope, 1, 0, 6, target).length, 0);
  const mid = overlayParts(envelope, 1, 0.25, 6, target)[0];
  assert.ok(mid.draw! > 0 && mid.draw! < 1, "drawing on");
  const strike = makeOverlay("strike", { timing: "out", seconds: 1 });
  assert.equal(overlayProgress(strike, 4.9, 6), 0);
  assert.equal(overlayProgress(strike, 5.7, 6), 1);
  assert.equal(overlayProgress(makeOverlay("speedlines"), 0, 6), 1);
  // Deterministic: the same frame always draws the same marks.
  const boil = makeOverlay("circle", { boil: 8, wobble: 0.8 });
  assert.deepEqual(
    overlayParts(boil, 1, 2.01, 6, target),
    overlayParts(boil, 1, 2.01, 6, target),
  );
  // A boiling line redraws on held frames.
  assert.notDeepEqual(
    overlayParts(boil, 1, 2.01, 6, target)[0].d,
    overlayParts(boil, 1, 2.2, 6, target)[0].d,
  );
});

test("anchors mark the key word or every line; auto placement finds room", () => {
  const circle = (o: Partial<Overlay>) =>
    overlayParts(makeOverlay("circle", o), 1, 3, 6, target)[0].transform;
  assert.equal(circle({}), "translate(0 0)");
  assert.equal(circle({ anchor: "keyword" }), "translate(-0.8 -0.5)");
  const lines = overlayParts(
    makeOverlay("underline", { anchor: "lines" }),
    1,
    3,
    6,
    target,
  );
  assert.equal(lines.length, 2);
  const arrow = (room?: typeof target & { room: unknown }) =>
    overlayParts(makeOverlay("arrow"), 1, 3, 6, room ?? target)[0].d!;
  const cramped = arrow({
    ...target,
    room: { left: 9, right: 0.5, top: 1, bottom: 1 },
  });
  // No room on the right: the arrow comes in from the left.
  assert.match(cramped, /^M-/);
  const label = overlayParts(
    makeOverlay("label", { count: 3 }),
    1,
    3,
    6,
    target,
  );
  assert.equal(label.at(-1)!.text, "No.03  ·  00:08.50");
  const dimension = overlayParts(makeOverlay("dimension"), 1, 3, 6, target);
  assert.equal(dimension.at(-1)!.text, "240 PX");
});

test("overlays render around text and pictures, behind or in front", () => {
  const card = (id: string) => overlayEffects.find((e) => e.id === id)!;
  const text = (effect: Effect) =>
    renderToStaticMarkup(
      React.createElement(AnimatedText, {
        layer: {
          ...makeLayer("title", "T"),
          text: "Midnight\nTrain",
          duration: 6,
          effects: [{ effectId: effect.id, amount: 1, enabled: true }],
        },
        effects: [effect],
        time: 3,
      }),
    );
  const highlight = text(card("overlay-highlight"));
  assert.match(highlight, /data-text-overlays/);
  assert.ok(
    highlight.indexOf('data-overlay="behind"') < highlight.indexOf("Midnight"),
  );
  assert.match(highlight, /mix-blend-mode:multiply/);
  const circled = text(card("overlay-circle"));
  assert.ok(circled.indexOf('data-overlay="front"') > circled.indexOf("Train"));
  assert.match(circled, /width:[\d.]+em/);
  const picture = (effect: Effect) =>
    renderToStaticMarkup(
      React.createElement(ArtworkStack, {
        id: "a",
        uses: [],
        overlays: [{ overlay: effect.overlay!, amount: 1 }],
        t: 2,
        time: 2,
        projectTime: 2,
        duration: 6,
        width: 1920,
        height: 1080,
        box: { width: 1200, height: 800 },
        start: 0,
        frameStyle: () => ({}),
        content: () => React.createElement("i", { "data-art": "" }),
      }),
    );
  const print = picture(card("art-print"));
  assert.ok(print.indexOf('data-overlay="behind"') < print.indexOf("data-art"));
  assert.match(print, /feDropShadow/);
  // Picture units are 2.5% of the short side: 1200 px is 1200 / 27 units.
  assert.match(print, /width:1200px;height:800px/);
  const brackets = picture(card("art-brackets"));
  assert.ok(
    brackets.indexOf('data-overlay="front"') > brackets.indexOf("data-art"),
  );
  // Overlays apply to every visual element, text included.
  const p = validateProject(initialProject);
  const title = p.layers.find((l) => l.type === "title")!;
  const scene = p.layers.find((l) => l.type === "scene")!;
  const both = applyEffectToLayers(p, card("overlay-circle"), [
    title.id,
    scene.id,
  ]);
  assert.equal(
    both.layers.filter((l) =>
      l.effects.some((i) => i.effectId === "overlay-circle"),
    ).length,
    2,
  );
});

test("saved framing decorations migrate to overlays in projects and bundles", () => {
  const p = validateProject(initialProject);
  const legacyArt = {
    id: "my-print",
    name: "Print",
    description: "",
    channels: [],
    color: "#ffffff",
    tint: 0,
    art: {
      kind: "print",
      color: "#efe4cc",
      secondary: "#16f4d4",
      strength: 1,
      tempo: 120,
      speed: 1,
      distance: 0.05,
      count: 2,
      angle: 0,
      seconds: 0.4,
      timing: "constant",
      direction: "horizontal",
      label: "",
      seed: 11,
    },
  };
  const legacyText = {
    id: "my-label",
    name: "Label",
    description: "",
    channels: [],
    color: "#ffffff",
    tint: 0,
    text: {
      kind: "label",
      seconds: 1,
      color: "#a5c3c0",
      label: "TRACK 03",
      seed: 17,
    },
  };
  const title = p.layers.find((l) => l.type === "title")!;
  const project = validateProject({
    ...p,
    effects: [...p.effects, legacyArt, legacyText],
    layers: p.layers.map((l) =>
      l.id === title.id
        ? {
            ...l,
            effects: [
              { effectId: "my-label", amount: 1, enabled: true },
              {
                effectId: "my-print",
                amount: 1,
                enabled: true,
                settings: (({ id: _id, ...rest }) => rest)(legacyArt),
              },
            ],
          }
        : l,
    ),
  });
  const print = project.effects.find((e) => e.id === "my-print")!;
  assert.equal(print.art, undefined);
  assert.equal(print.overlay!.kind, "print");
  assert.equal(print.overlay!.color, "#efe4cc");
  assert.equal(print.overlay!.pad, 2);
  const label = project.effects.find((e) => e.id === "my-label")!;
  assert.equal(label.text, undefined);
  assert.equal(label.overlay!.label, "TRACK 03");
  const instance = project.layers.find((l) => l.id === title.id)!.effects[1];
  assert.equal(instance.settings!.overlay!.kind, "print");
  const bundle = EffectBundleSchema.parse({
    format: "frameforge-effect",
    version: 1,
    engine: "kamikami-visual-v8",
    name: "Print",
    effect: legacyArt,
  });
  assert.equal(bundle.effect.overlay!.kind, "print");
});
