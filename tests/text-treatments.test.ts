import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedText } from "../src/AnimatedText";
import { BackdropArt } from "../src/BackdropArt";
import {
  builtinEffectCategory,
  lookEffects as lookCards,
} from "../src/builtin-effects";
import { effectEngine } from "../src/effect-bundle";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
import {
  backdropPresets,
  isFinishKind,
  makeBackdropSettings,
} from "../src/backdrops";
import {
  effectSettings,
  initialProject,
  makeBackdrop,
  makeLayer,
  projectTracks,
  validateProject,
  type Effect,
} from "../src/model";
import { lookKinds, lookPaint } from "../src/text-looks";
import { TextEffectSchema } from "../src/text-effects";

const layer = {
  ...makeLayer("title", "Lyric"),
  text: "I remember\nthe color of dawn",
  start: 8.5,
  duration: 6,
};
const card = (id: string) => lookCards.find((e) => e.id === id)!;
const render = (effects: Effect[], time = 2) =>
  renderToStaticMarkup(
    React.createElement(AnimatedText, {
      layer: {
        ...layer,
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

test("treatment cards cover every treatment kind as a v8 Text treatments category", () => {
  assert.equal(lookCards.length, 23);
  assert.deepEqual(
    [...new Set(lookCards.map((e) => e.text!.kind))].sort(),
    [...lookKinds].sort(),
  );
  for (const effect of lookCards) {
    assert.equal(builtinEffectCategory(effect.id), "Text treatments");
    assert.equal(effectEngine(effect), "kamikami-visual-v8", effect.id);
  }
});

test("paint treatments combine shadows, strokes and fills; strength zero adds nothing", () => {
  const parse = (kind: string, patch = {}) =>
    TextEffectSchema.parse({ kind, ...patch });
  const extrude = lookPaint(
    [{ effect: parse("extrude"), amount: 1 }],
    "#ffffff",
    0,
  );
  assert.equal(extrude.textShadow!.split("em 0 ").length - 1, 14);
  const keyline = lookPaint(
    [{ effect: parse("keyline"), amount: 1 }],
    "#ffffff",
    0,
  );
  assert.equal(keyline.paintOrder, "stroke fill");
  const both = lookPaint(
    [
      { effect: parse("offset"), amount: 1 },
      { effect: parse("neontube"), amount: 1 },
    ],
    "#ffffff",
    0,
  );
  assert.equal(both.textShadow!.split(", ").length, 4, "shadows stack");
  const chrome = lookPaint(
    [{ effect: parse("chrome"), amount: 1 }],
    "#ffffff",
    0,
  );
  assert.match(String(chrome.backgroundImage), /linear-gradient/);
  assert.deepEqual(
    lookPaint([{ effect: parse("extrude"), amount: 0 }], "#fff", 0)
      .textShadow?.split(", ")
      .every((s) => s.startsWith("0.0000em 0.0000em")),
    true,
  );
});

test("copy treatments draw lagged ghosts, a reflection and cut halves", () => {
  const ghosts = render([card("look-ghosts")]);
  assert.match(ghosts, /data-text-copies/);
  // Two flat copies plus the main text, each rendering the lyric.
  assert.equal(ghosts.match(/>I remember/g)?.length, 3);
  assert.match(ghosts, /color:#16f4d4/);
  const cut = render([card("look-cut-shift")]);
  assert.equal(cut.match(/clip-path:polygon\(/g)?.length, 2);
  assert.equal(
    cut.match(/top:[\d.]+%;height:0.022em/g)?.length,
    2,
    "one cut line per line",
  );
  assert.match(render([card("look-reflection")]), /scaleY\(-0.72\)/);
});

test("decorations: brackets, label, ticker, plates and the accent word", () => {
  assert.equal(
    render([card("look-brackets")]).match(/border-top:|border-bottom:/g)
      ?.length,
    4,
  );
  // The label shows an index and the clip's start time once typed in.
  assert.match(render([card("look-label")]), /No\.\d\d {2}· {2}00:08\.50/);
  const custom = {
    ...card("look-label"),
    text: { ...card("look-label").text!, label: "TRACK 03" },
  };
  assert.match(render([custom]), /TRACK 03/);
  assert.equal(
    (
      render([card("look-ticker")]).match(
        /I remember the color of dawn {3}\/ {3}/g,
      ) ?? []
    ).length > 4,
    true,
  );
  const plates = render([card("look-word-plates")]);
  // Six words, six plates, knocked-out letters.
  assert.equal(plates.match(/data-kinetic-word=/g)?.length, 6);
  assert.match(plates, /color:#141414/);
  const accent = render([card("look-accent")]);
  // "remember" is the longest word: 8 accent letters.
  assert.equal(accent.match(/color:#f5c84c/g)?.length, 8);
});

test("backdrops validate as v3 full-frame elements and every preset renders", () => {
  for (const preset of backdropPresets) {
    const markup = renderToStaticMarkup(
      React.createElement(BackdropArt, {
        backdrop: preset.backdrop,
        t: 1.5,
        width: 640,
        height: 360,
        id: "x",
      }),
    );
    assert.ok(markup.length > 80, preset.id);
    assert.equal(
      preset.backdrop.blend !== "normal",
      isFinishKind(preset.backdrop.kind),
      `${preset.id}: finishes blend`,
    );
  }
  const p = structuredClone(initialProject);
  const element = makeBackdrop(backdropPresets[1].backdrop, "Rings");
  const next = validateProject({ ...p, layers: [...p.layers, element] });
  assert.equal(next.version, 3);
  assert.throws(
    () =>
      validateProject({
        ...p,
        layers: [...p.layers, { ...element, backdrop: undefined }],
      }),
    /needs backdrop settings/,
  );
  // Backgrounds land on a new bottom layer, finishes on a new top layer.
  const edit = (kind: string) =>
    applyAgentEdit(
      p,
      AgentCommandSchema.parse({
        action: "add_backdrop",
        backdrop: { kind },
        expectedRevision: "a",
      }),
      [],
    );
  const bg = edit("halftone"),
    fin = edit("grain");
  const bgEl = bg.layers.at(-1)!,
    finEl = fin.layers.at(-1)!;
  assert.equal(projectTracks(bg)[0].id, bgEl.trackId);
  assert.equal(projectTracks(fin).at(-1)!.id, finEl.trackId);
  assert.deepEqual([bgEl.start, bgEl.duration], [0, p.duration]);
  assert.equal(finEl.backdrop!.blend, "overlay");
  assert.equal(
    bgEl.backdrop!.secondary,
    makeBackdropSettings("halftone").secondary,
  );
});
