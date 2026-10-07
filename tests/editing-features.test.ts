import test from "node:test";
import assert from "node:assert/strict";
import {
  initialProject,
  makeLayer,
  validateProject,
  layerAtTime,
  layerVolume,
} from "../src/model";
import {
  hitBounds,
  moveClips,
  splitClips,
  trimClip,
  translateLayers,
} from "../src/editor/editing";

const fixture = () => ({
  ...structuredClone(initialProject),
  layers: [
    {
      ...makeLayer("video", "Sample"),
      id: "clip",
      src: "/media/sample.mp4",
      start: 2,
      duration: 8,
      offset: 1,
      effects: [
        { effectId: initialProject.effects[0].id, amount: 1, enabled: true },
      ],
    },
  ],
});
test("version 1 projects migrate effect timing and audio defaults", () => {
  const old = JSON.parse(JSON.stringify(initialProject));
  for (const l of old.layers) {
    delete l.effectOffset;
    delete l.effectDuration;
    delete l.muted;
    delete l.solo;
  }
  const migrated = validateProject(old);
  assert.equal(migrated.layers[0].effectOffset, 0);
  assert.equal(migrated.layers[0].effectDuration, 0);
  assert.equal(migrated.layers[0].muted, false);
  assert.equal(migrated.layers[0].solo, false);
});
test("split preserves source frames and effect continuity on both sides", () => {
  const p = fixture(),
    { project, selected } = splitClips(p, ["clip"], 5 * 24, () => "right");
  validateProject(project);
  const [left, right] = project.layers;
  assert.deepEqual(selected, ["clip", "right"]);
  assert.equal(left.duration, 3);
  assert.equal(right.start, 5);
  assert.equal(right.offset, 4);
  assert.equal(right.duration, 5);
  for (const t of [0, 1, 2.5])
    assert.deepEqual(
      layerAtTime(left, p.effects, t),
      layerAtTime(p.layers[0], p.effects, t),
    );
  for (const t of [0, 1, 4.9])
    assert.deepEqual(
      layerAtTime(right, p.effects, t),
      layerAtTime(p.layers[0], p.effects, t + 3),
    );
});
test("trim keeps the opposite edge and source/effect offsets, and can restore a trim", () => {
  const p = fixture();
  const trimmed = trimClip(p, "clip", "left", 4);
  validateProject(trimmed);
  const l = trimmed.layers[0];
  assert.equal(l.start, 4);
  assert.equal(l.duration, 6);
  assert.equal(l.offset, 3);
  assert.equal(l.effectOffset, 2);
  assert.deepEqual(
    layerAtTime(l, p.effects, 1),
    layerAtTime(p.layers[0], p.effects, 3),
  );
  const restored = trimClip(trimmed, "clip", "left", 0);
  assert.equal(restored.layers[0].start, 2);
  assert.equal(restored.layers[0].offset, 1);
});
test("trim honors source/project ends and minimum lengths including legacy tenth-second clips", () => {
  let p = fixture();
  assert.equal(trimClip(p, "clip", "right", 14, 10).layers[0].duration, 9);
  assert.equal(trimClip(p, "clip", "right", 3, 10).layers[0].duration, 1);
  p.layers[0].duration = 0.1;
  const short = trimClip(p, "clip", "left", 99);
  validateProject(short);
  assert.ok(short.layers[0].start >= 0);
  assert.ok(short.layers[0].duration >= 0.1 - 1e-9);
});
test("group moves preserve spacing and clamp the whole selection, with snapping", () => {
  const p = fixture();
  p.layers.push({ ...p.layers[0], id: "second", start: 7, duration: 2 });
  const moved = moveClips(p, ["clip", "second"], 100, false, 0, 0);
  assert.equal(moved.layers[0].start, 7);
  assert.equal(moved.layers[1].start, 12);
  validateProject(moved);
  const snapped = moveClips(p, ["second"], -0.9, true, 0.2, 6);
  assert.equal(snapped.layers[1].start, 6);
  const visual = translateLayers(p, ["clip", "second"], 3000, 0);
  assert.equal(visual.layers[0].x, 1920);
  assert.equal(visual.layers[1].x, 1920);
});
test("rotated canvas bounds select only points inside the rendered rectangle", () => {
  const b = {
    width: 100,
    height: 20,
    cx: 100,
    cy: 100,
    rotation: 90,
    scale: 2,
  };
  assert.equal(hitBounds(100, 180, b), true);
  assert.equal(hitBounds(130, 100, b), false);
});
test("mute and solo affect audible layers without changing the stored volume", () => {
  const a = { ...makeLayer("audio", "A"), volume: 0.7 },
    b = { ...makeLayer("video", "B"), solo: true, volume: 0.4 };
  assert.equal(layerVolume(a, [a, b]), 0);
  assert.equal(layerVolume(b, [a, b]), 0.4);
  assert.equal(layerVolume({ ...b, muted: true }, [a, b]), 0);
  assert.equal(layerVolume(a, [a, { ...b, visible: false }]), 0.7);
  assert.equal(a.volume, 0.7);
});

test("an exact snap wins over a nearby competing edge", () => {
  const p = fixture();
  p.layers[0].duration = 2;
  p.layers.push({ ...p.layers[0], id: "other", start: 6.1, duration: 2 });
  const moved = moveClips(p, ["clip"], 2, true, 0.2, 4);
  assert.equal(moved.layers[0].start, 4);
});
