import test from "node:test";
import assert from "node:assert/strict";
import {
  frameUnit,
  initialProject,
  layerAtTime,
  makeLayer,
  type Effect,
} from "../src/model";
import { scaleShape, shapePresets } from "../src/shapes";
import { stationView } from "../src/Composition";

const slide: Effect = {
  ...initialProject.effects[0],
  id: "slide",
  channels: [
    {
      property: "x",
      curve: "linear",
      from: 400,
      to: 400,
      frequency: 1,
      phase: 0,
    },
    {
      property: "blur",
      curve: "linear",
      from: 10,
      to: 10,
      frequency: 1,
      phase: 0,
    },
  ],
  passes: [],
};
const element = {
  ...makeLayer("image", "i"),
  effects: [{ effectId: "slide", amount: 1, enabled: true }],
};

test("reference pixels scale with the frame's short side", () => {
  assert.equal(frameUnit({ width: 1920, height: 1080 }), 1);
  assert.equal(frameUnit({ width: 1080, height: 1920 }), 1);
  assert.equal(frameUnit({ width: 3840, height: 2160 }), 2);
  assert.equal(frameUnit({ width: 1280, height: 720 }), 2 / 3);
  const at = (width: number, height: number) =>
    layerAtTime(element, [slide], 1, { width, height });
  // 1080p is unchanged; 4K moves and blurs twice as many pixels.
  assert.equal(at(1920, 1080).x, 400);
  assert.equal(at(1080, 1920).x, 400);
  assert.equal(at(3840, 2160).x, 800);
  assert.equal(at(3840, 2160).blur, 20);
  assert.equal(at(3840, 2160).perspective, 3600);
});

test("new text and shape presets keep their share of the frame", () => {
  assert.equal(makeLayer("title", "t").fontSize, 86);
  assert.equal(
    makeLayer("title", "t", { width: 3840, height: 2160 }).fontSize,
    172,
  );
  const rect = shapePresets.find((p) => p.id === "rounded")!.shape;
  assert.deepEqual(scaleShape(rect, 2), {
    ...rect,
    width: 1280,
    height: 800,
    radius: 160,
  });
  assert.deepEqual(scaleShape(rect, 1), rect);
});

test("the station scene crops around its subject at every aspect ratio", () => {
  assert.deepEqual(stationView(1920, 1080), { x: 0, y: 0, w: 1920, h: 1080 });
  assert.deepEqual(stationView(3840, 2160), { x: 0, y: 0, w: 1920, h: 1080 });
  for (const [w, h] of [
    [1080, 1920],
    [1080, 1080],
    [1080, 1350],
    [2560, 1080],
  ]) {
    const v = stationView(w, h);
    assert.ok(Math.abs(v.w / v.h - w / h) < 1e-9, `${w}x${h} keeps its aspect`);
    assert.ok(v.x >= 0 && v.x + v.w <= 1920 && v.y >= 0 && v.y + v.h <= 1080);
    // The figure stands at x 1460 on the board.
    assert.ok(v.x < 1400 && v.x + v.w > 1520, `${w}x${h} shows the figure`);
  }
});
