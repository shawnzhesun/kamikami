import test from "node:test";
import assert from "node:assert/strict";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
import { initialProject, makeShape, validateProject } from "../src/model";
import { layerBounds } from "../src/editor/editing";
import { shapePath, shapePresets } from "../src/shapes";

/** Every coordinate pair in a path, for bounds checks. */
const points = (d: string) => {
  const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return numbers;
};

test("every preset draws a closed path inside its box", () => {
  for (const preset of shapePresets) {
    const d = shapePath(preset.shape);
    assert.match(d, /^M.*Z$/, preset.id);
    // Polygons and stars are stretched to fill their box exactly.
    if (preset.shape.kind === "polygon" || preset.shape.kind === "star") {
      const values = points(d);
      const xs = values.filter((_, i) => i % 2 === 0),
        ys = values.filter((_, i) => i % 2 === 1);
      assert.equal(Math.min(...xs), 0, preset.id);
      assert.equal(Math.max(...xs), preset.shape.width, preset.id);
      assert.equal(Math.min(...ys), 0, preset.id);
      assert.equal(Math.max(...ys), preset.shape.height, preset.id);
    }
  }
  // A star has twice as many vertices as points.
  const star = shapePath({ kind: "star", width: 100, height: 100, sides: 5 });
  assert.equal(star.split("L").length, 10);
  // Corner radius is limited to half the shorter side.
  assert.equal(
    shapePath({ kind: "rectangle", width: 100, height: 20, radius: 500 }),
    shapePath({ kind: "rectangle", width: 100, height: 20, radius: 10 }),
  );
});

test("shape elements validate, write version 3 and size the canvas selection", () => {
  const p = structuredClone(initialProject);
  const shape = makeShape(shapePresets[1].shape, "Card", "#4f8fd8");
  const next = validateProject({ ...p, layers: [...p.layers, shape] });
  assert.equal(next.version, 3, "older readers reject shapes");
  const saved = next.layers.at(-1)!;
  assert.equal(saved.type, "shape");
  assert.equal(saved.shape!.radius, 80);
  assert.equal(
    validateProject({ ...p, layers: p.layers }).version,
    2,
    "projects without shapes stay version 2",
  );
  const box = layerBounds(saved, next, 0, {
    width: saved.shape!.width,
    height: saved.shape!.height,
  });
  assert.equal(box.cx, next.width / 2);
  assert.throws(
    () =>
      validateProject({
        ...p,
        layers: [...p.layers, { ...shape, shape: undefined }],
      }),
    /needs shape geometry/,
  );
  assert.throws(
    () =>
      validateProject({
        ...p,
        layers: [...p.layers, { ...shape, id: "x", src: "/media/a.png" }],
      }),
    /cannot reference media/,
  );
  assert.throws(
    () =>
      validateProject({
        ...p,
        layers: [
          ...p.layers,
          { ...shape, id: "y", type: "image", src: "", shape: shape.shape },
        ],
      }),
    /Only shape elements/,
  );
});

test("the assistant adds and edits shapes like other elements", () => {
  const p = structuredClone(initialProject);
  const next = applyAgentEdit(
    p,
    AgentCommandSchema.parse({
      action: "add_shape",
      shape: { kind: "star", width: 300, height: 300, sides: 6 },
      color: "#f5c84c",
      x: -200,
      start: 1,
      duration: 3,
      expectedRevision: "a",
    }),
    [],
  );
  const star = next.layers.at(-1)!;
  assert.equal(star.type, "shape");
  assert.equal(star.name, "Star");
  assert.equal(star.color, "#f5c84c");
  assert.equal(star.x, -200);
  assert.deepEqual(next.layers.slice(0, -1), p.layers);
  const edited = applyAgentEdit(
    next,
    AgentCommandSchema.parse({
      action: "update_layer",
      layerId: star.id,
      patch: {
        shape: {
          ...star.shape!,
          filled: false,
          stroke: "#141414",
          strokeWidth: 12,
        },
        rotation: 15,
      },
      expectedRevision: "b",
    }),
    [],
  );
  assert.equal(edited.layers.at(-1)!.shape!.filled, false);
  assert.equal(edited.layers.at(-1)!.rotation, 15);
  assert.throws(() =>
    AgentCommandSchema.parse({
      action: "add_shape",
      shape: { kind: "blob", width: 1, height: 1 },
      expectedRevision: "c",
    }),
  );
});
