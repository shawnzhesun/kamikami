import test from "node:test";
import assert from "node:assert/strict";
import {
  initialProject,
  validateProject,
  channelValue,
  layerAtTime,
  type Channel,
} from "../src/model";
test("starter project is valid", () => {
  assert.equal(validateProject(initialProject).duration, 15);
});
test("rejects external media and invalid effect references", () => {
  for (const src of [
    "https://example.com/a.mp4",
    "/media/../../secret.mp4",
    "file:///tmp/a.mp4",
  ]) {
    const p = structuredClone(initialProject);
    p.layers[0].src = src;
    assert.throws(() => validateProject(p));
  }
  const p = structuredClone(initialProject);
  p.layers[0].effects[0].effectId = "missing";
  assert.throws(() => validateProject(p));
});
test("rejects duplicate IDs and out-of-bounds clips", () => {
  const p = structuredClone(initialProject);
  p.layers.push(structuredClone(p.layers[0]));
  assert.throws(() => validateProject(p));
  const q = structuredClone(initialProject);
  q.layers[0].start = 10;
  assert.throws(() => validateProject(q));
});
test("effect curves are deterministic under arbitrary seek order", () => {
  const c: Channel = {
    property: "scale",
    curve: "sine",
    from: 1,
    to: 2,
    frequency: 1,
    phase: 0,
  };
  assert.equal(channelValue(c, 0, 15), 1);
  assert.equal(channelValue(c, 0.5, 15), 2);
  assert.equal(channelValue(c, 1, 15), 1);
  const a = layerAtTime(initialProject.layers[0], initialProject.effects, 3.5);
  layerAtTime(initialProject.layers[0], initialProject.effects, 12);
  assert.deepEqual(
    layerAtTime(initialProject.layers[0], initialProject.effects, 3.5),
    a,
  );
});
test("zero strength is neutral and disabled effects do not apply", () => {
  const l = structuredClone(initialProject.layers[0]);
  l.effects[0].amount = 0;
  assert.equal(layerAtTime(l, initialProject.effects, 15).scale, 1);
  l.effects[0].amount = 1;
  l.effects[0].enabled = false;
  assert.equal(layerAtTime(l, initialProject.effects, 15).scale, 1);
});
test("eased camera push reaches exact start and end values", () => {
  const c = initialProject.effects[0].channels[0];
  assert.equal(channelValue(c, 0, 15), 1);
  assert.equal(channelValue(c, 15, 15), 1.12);
});
