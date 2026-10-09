import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  initialProject,
  layerAtTime,
  layerVolume,
  makeLayer,
  validateProject,
  type Layer,
  type Project,
} from "../src/model";
import {
  adjacentKeyframe,
  cubicBezier,
  keyframeValue,
  retimeKeyframes,
  setAnimated,
  setKeyframeEasing,
  setValueAt,
  toggleKeyframe,
  valueAt,
  visibleKeyframeTimes,
  type Keyframe,
} from "../src/keyframes";
import { splitClips, trimClip, translateLayers } from "../src/editor/editing";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
import { GraphicEffects } from "../src/GraphicEffects";
import { builtinEffects } from "../src/builtin-effects";
import { applyEffectToLayers } from "../src/effect-bundle";
import { applyInstanceEffectDraft } from "../src/editor/effect-draft";
import { resolveEffectInstanceAt } from "../src/effect-instance";
import { animatableParameters } from "../src/editor/effect-parameters";
import { projectJson } from "../src/project-files";

const key = (
  time: number,
  value: number,
  easing: Keyframe["easing"] = "linear",
) => ({
  time,
  value,
  easing,
});
const title = (patch: Partial<Layer> = {}): Layer => ({
  ...makeLayer("title", "Animated"),
  id: "t",
  duration: 4,
  ...patch,
});
const project = (layer: Layer): Project =>
  validateProject({ ...initialProject, layers: [layer] });

test("interpolation holds outside the keyed range and honors easing", () => {
  const track = [
    key(1, 0),
    key(2, 100, "hold"),
    key(3, 0, "ease-in-out"),
    key(4, 50),
  ];
  assert.equal(keyframeValue(track, 0), 0);
  assert.equal(keyframeValue(track, 1.5), 50);
  assert.equal(keyframeValue(track, 2.9), 100, "hold keeps the value");
  assert.equal(keyframeValue(track, 3), 0);
  assert.ok(keyframeValue([key(0, 0, "ease-in-out"), key(1, 1)], 0.25) < 0.25);
  assert.equal(keyframeValue(track, 99), 50);
  assert.ok(Math.abs(cubicBezier([0.42, 0, 0.58, 1], 0.5) - 0.5) < 1e-4);
  assert.equal(cubicBezier([0.33, 0, 0.67, 1], 0), 0);
  assert.equal(cubicBezier([0.33, 0, 0.67, 1], 1), 1);
});

test("stopwatch, auto-key, diamond toggle and navigation", () => {
  const target = { kind: "property", property: "x" } as const;
  let layer = title({ x: 10 });
  layer = setAnimated(layer, target, true, 0);
  assert.deepEqual(layer.keyframes?.x, [key(0, 10)]);
  // Editing at another time adds a keyframe (After Effects auto-key).
  layer = setValueAt(layer, target, 210, 2);
  assert.equal(layer.keyframes?.x?.length, 2);
  assert.equal(valueAt(layer, target, 1), 110);
  assert.equal(layerAtTime(layer, [], 1).x, 110);
  // Editing on an existing key updates it.
  layer = setValueAt(layer, target, 310, 2);
  assert.equal(layer.keyframes?.x?.[1].value, 310);
  layer = setKeyframeEasing(layer, target, 0, "hold");
  assert.equal(valueAt(layer, target, 1.9), 10);
  assert.equal(adjacentKeyframe(layer, 0, 1), 2);
  assert.equal(adjacentKeyframe(layer, 2, -1), 0);
  // Removing the last key returns to a static value.
  layer = toggleKeyframe(layer, target, 2);
  layer = toggleKeyframe(layer, target, 0);
  assert.equal(layer.keyframes, undefined);
  assert.equal(layer.x, 10);
  // Turning the stopwatch off keeps the playhead value.
  layer = setValueAt(setAnimated(title(), target, true, 0), target, 100, 2);
  layer = setAnimated(layer, target, false, 1);
  assert.equal(layer.keyframes, undefined);
  assert.equal(layer.x, 50);
});

test("keyframes survive moves, trims and splits on the animation clock", () => {
  const layer = title({
    start: 2,
    keyframes: { opacity: [key(0, 0), key(2, 1)] },
  });
  let p = project(layer);
  assert.equal(p.version, 3);
  const before = layerAtTime(p.layers[0], p.effects, 1).opacity;
  p = { ...p, layers: [{ ...p.layers[0], start: 5 }] };
  assert.equal(layerAtTime(p.layers[0], p.effects, 1).opacity, before);
  const trimmed = trimClip(p, "t", "left", 6, null).layers[0];
  assert.equal(layerAtTime(trimmed, p.effects, 0).opacity, before);
  const split = splitClips(project(layer), ["t"], 3 * 24, () => "right");
  const right = split.project.layers.find((l) => l.id === "right")!;
  assert.equal(layerAtTime(right, [], 0).opacity, 0.5);
  assert.deepEqual(visibleKeyframeTimes(right), [1]);
});

test("canvas drags key animated positions at the playhead", () => {
  const animated = title({ keyframes: { x: [key(0, 0), key(2, 100)] } });
  const p = project(animated);
  const moved = translateLayers(p, ["t"], 50, 0, 24).layers[0];
  assert.equal(moved.keyframes?.x?.find((k) => k.time === 1)?.value, 100);
  assert.equal(moved.x, animated.x, "static value is untouched");
  const still = translateLayers(project(title()), ["t"], 50, 0, 24).layers[0];
  assert.equal(still.x, 50);
  assert.equal(still.keyframes, undefined);
});

test("effect strength and numeric parameters can be keyframed", () => {
  const vignette = builtinEffects.find((e) => e.id === "memory-vignette")!;
  let p = applyEffectToLayers(project(title()), vignette, ["t"]);
  const parameters = animatableParameters(p.layers[0].effects[0].settings);
  assert.ok(parameters.some((x) => x.path === "passes.0.size"));
  assert.ok(!parameters.some((x) => x.path.endsWith("seed")));
  p = applyAgentEdit(
    p,
    AgentCommandSchema.parse({
      action: "set_keyframes",
      layerId: "t",
      effectId: "memory-vignette",
      parameter: "passes.0.size",
      keyframes: [key(0, 0), key(2, 1)],
      expectedRevision: "x",
    }),
    [],
  );
  p = applyAgentEdit(
    p,
    AgentCommandSchema.parse({
      action: "set_keyframes",
      layerId: "t",
      effectId: "memory-vignette",
      keyframes: [key(0, 0), key(1, 1)],
      expectedRevision: "x",
    }),
    [],
  );
  const instance = p.layers[0].effects[0];
  assert.equal(
    resolveEffectInstanceAt(instance, p.effects, 1)?.passes?.[0].size,
    0.5,
  );
  // Zero strength at t=0 skips the filter entirely.
  const at = (time: number) =>
    renderToStaticMarkup(
      React.createElement(GraphicEffects, {
        layer: p.layers[0],
        effects: p.effects,
        time,
        children: "x",
      }),
    );
  assert.ok(!at(0).includes("<filter id"));
  assert.ok(at(1).includes("feImage"));
  // Out-of-range values and unknown paths are rejected.
  assert.throws(() =>
    applyAgentEdit(
      p,
      AgentCommandSchema.parse({
        action: "set_keyframes",
        layerId: "t",
        effectId: "memory-vignette",
        parameter: "passes.0.size",
        keyframes: [key(0, 5)],
        expectedRevision: "x",
      }),
      [],
    ),
  );
  assert.throws(() =>
    applyAgentEdit(
      p,
      AgentCommandSchema.parse({
        action: "set_keyframes",
        layerId: "t",
        effectId: "memory-vignette",
        parameter: "passes.3.size",
        keyframes: [key(0, 0.5)],
        expectedRevision: "x",
      }),
      [],
    ),
  );
  // Editing settings that remove an animated pass prunes its track.
  const settings = p.layers[0].effects[0].settings!;
  const next = applyInstanceEffectDraft(
    p,
    "t",
    { ...settings, id: "memory-vignette", passes: [] },
    { ...settings, id: "memory-vignette" },
  );
  assert.equal(next.layers[0].effects[0].keyframes?.parameters, undefined);
  assert.ok(next.layers[0].effects[0].keyframes?.amount);
});

test("volume keyframes, retiming and versioned project files", () => {
  const audio: Layer = {
    ...makeLayer("audio", "Tone"),
    id: "a",
    duration: 4,
    keyframes: { volume: [key(0, 0), key(2, 1)] },
  };
  assert.equal(layerVolume(audio, [audio], 1), 0.5);
  assert.equal(layerVolume({ ...audio, muted: true }, [audio], 1), 0);
  assert.throws(() =>
    project({ ...title(), keyframes: { volume: [key(0, 1)] } }),
  );
  const retimed = retimeKeyframes(
    title({ keyframes: { x: [key(0, 0), key(2, 9)], y: [key(2, 3)] } }),
    2,
    3,
  );
  assert.deepEqual(
    retimed.keyframes?.x?.map((k) => k.time),
    [0, 3],
  );
  assert.deepEqual(
    retimed.keyframes?.y?.map((k) => k.time),
    [3],
  );
  const json = JSON.parse(
    projectJson(project(title({ keyframes: { x: [key(0, 1)] } }))),
  );
  assert.equal(json.version, 3);
  assert.equal(
    project(title()).version,
    2,
    "unanimated projects stay readable by v2 apps",
  );
});
