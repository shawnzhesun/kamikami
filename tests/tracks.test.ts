import test from "node:test";
import assert from "node:assert/strict";
import {
  initialProject,
  validateProject,
  makeLayer,
  orderedElements,
  layerAtTime,
  type Project,
} from "../src/model";
import {
  addTrack,
  deleteTrack,
  updateTrack,
  reorderTracks,
  insertElement,
  moveElementsToTrack,
} from "../src/editor/tracks";
import { splitClips, trimClip } from "../src/editor/editing";
import { durationChange } from "../src/editor-utils";
import { EditHistory } from "../src/history";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";
const empty = (): Project =>
  validateProject({
    ...structuredClone(initialProject),
    layers: [],
    tracks: [
      { id: "a", name: "Picture" },
      { id: "b", name: "Sound" },
    ],
  });
const clip = (id: string, duration = 3) => ({
  ...makeLayer("title", id),
  id,
  duration,
});

test("legacy projects migrate without changing element identity, timing, effects or stack order", () => {
  const legacy = JSON.parse(JSON.stringify(initialProject));
  delete legacy.tracks;
  for (const e of legacy.layers) delete e.trackId;
  const migrated = validateProject(legacy);
  assert.equal(migrated.tracks?.length, legacy.layers.length);
  assert.deepEqual(
    orderedElements(migrated).map((e) => e.id),
    legacy.layers.map((e: { id: string }) => e.id),
  );
  migrated.layers.forEach((e, i) => {
    const { trackId, ...rest } = e;
    assert.deepEqual(rest, legacy.layers[i]);
    assert.ok(migrated.tracks?.some((t) => t.id === trackId));
  });
  assert.deepEqual(validateProject(migrated), migrated);
});
test("empty layers persist independently and renaming does not rename elements", () => {
  let p = addTrack(empty(), { id: "empty", name: "Empty" });
  p = insertElement(p, clip("Title"), "a", 0);
  p = updateTrack(p, { id: "a", name: "Foreground" });
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.tracks?.length, 3);
  assert.equal(restored.layers[0].name, "Title");
  assert.equal(restored.tracks?.[0].name, "Foreground");
  assert.throws(() => addTrack(p, { id: "a", name: "Duplicate" }), /unique/);
  assert.throws(
    () =>
      validateProject({
        ...p,
        layers: [{ ...p.layers[0], trackId: "missing" }],
      }),
    /unknown/,
  );
});
test("media insertion uses the requested frame and available gap, rejecting occupied or tiny gaps", () => {
  let p = insertElement(empty(), clip("later"), "a", 5);
  p = insertElement(p, clip("first", 10), "a", 1.02);
  assert.equal(p.layers[1].start, 1);
  assert.equal(p.layers[1].duration, 4);
  assert.throws(() => insertElement(p, clip("collision"), "a", 3), /occupied/);
  assert.throws(() => insertElement(p, clip("end"), "a", 14.96), /room/);
  const other = insertElement(p, clip("audio"), "b", 1);
  assert.equal(other.layers.length, 3);
});
test("cross-layer moves preserve source and effect settings and reject overlaps atomically", () => {
  let p = insertElement(
    empty(),
    {
      ...clip("one"),
      type: "video",
      src: "/media/sample.mp4",
      offset: 2,
      effectOffset: 3,
      effectDuration: 10,
    },
    "a",
    1,
  );
  const before = structuredClone(p);
  const moved = moveElementsToTrack(p, ["one"], "one", "b");
  assert.deepEqual({ ...moved.layers[0], trackId: "a" }, p.layers[0]);
  p = insertElement(p, clip("occupied"), "b", 1);
  assert.throws(() => moveElementsToTrack(p, ["one"], "one", "b"), /overlap/);
  assert.deepEqual(before.layers[0], p.layers[0]);
  assert.throws(
    () =>
      validateProject({
        ...p,
        layers: p.layers.map((e) => ({ ...e, trackId: "a" })),
      }),
    /overlap/,
  );
});
test("split elements stay on the same layer and preserve animation continuity", () => {
  const p = insertElement(
    empty(),
    {
      ...clip("video", 8),
      type: "video",
      src: "/media/sample.mp4",
      offset: 1,
      effects: [
        { effectId: initialProject.effects[0].id, amount: 1, enabled: true },
      ],
    },
    "a",
    0,
  );
  const { project } = splitClips(p, ["video"], 48, () => "right");
  const next = validateProject(project);
  assert.equal(next.tracks?.length, 2);
  assert.ok(next.layers.every((e) => e.trackId === "a"));
  assert.equal(next.layers[1].offset, 3);
  assert.deepEqual(
    layerAtTime(next.layers[1], next.effects, 1),
    layerAtTime(p.layers[0], p.effects, 3),
  );
  assert.throws(
    () => validateProject(trimClip(next, "video", "right", 4)),
    /overlap/,
  );
});
test("group moves preserve relative layer positions and reject falling outside the layer stack", () => {
  let p = addTrack(empty(), { id: "c", name: "Third" });
  p = insertElement(p, clip("one"), "a", 0);
  p = insertElement(p, clip("two"), "b", 5);
  const moved = moveElementsToTrack(p, ["one", "two"], "one", "b");
  assert.deepEqual(
    moved.layers.map((e) => e.trackId),
    ["b", "c"],
  );
  assert.throws(
    () => moveElementsToTrack(p, ["one", "two"], "one", "c"),
    /fit/,
  );
});
test("layer ordering determines rendering order regardless of when elements were created", () => {
  let p = insertElement(empty(), clip("upper"), "b", 0);
  p = insertElement(p, clip("lower"), "a", 0);
  assert.deepEqual(
    orderedElements(p).map((e) => e.id),
    ["lower", "upper"],
  );
  const reordered = reorderTracks(p, ["b", "a"]);
  assert.deepEqual(
    orderedElements(reordered).map((e) => e.id),
    ["upper", "lower"],
  );
  assert.deepEqual(reordered.layers, p.layers);
});
test("deleting a layer removes just its elements and Undo/Redo restores the complete layer", () => {
  let p = insertElement(empty(), clip("first"), "a", 0);
  p = insertElement(p, clip("second"), "a", 4);
  p = insertElement(p, clip("keep"), "b", 0);
  const history = new EditHistory<Project>();
  history.record(p);
  const next = deleteTrack(p, "a");
  assert.deepEqual(
    next.layers.map((e) => e.id),
    ["keep"],
  );
  assert.deepEqual(history.undo(next), p);
  assert.deepEqual(history.redo(p), next);
});
test("shortening removes later elements without stacking them at the new end", () => {
  let p = insertElement(empty(), clip("first", 4), "a", 0);
  p = insertElement(p, clip("later", 4), "a", 5);
  const proposal = durationChange(p, 2);
  const next = validateProject(proposal.next);
  assert.equal(next.layers.length, 1);
  assert.equal(next.layers[0].duration, 2);
  assert.equal(next.tracks?.length, 2);
  assert.equal(proposal.affected.length, 2);
});
test("agent track commands and element targeting share the same validations", () => {
  const run = (p: Project, command: object) =>
    applyAgentEdit(
      p,
      AgentCommandSchema.parse({ ...command, expectedRevision: "test" }),
      [],
    );
  let p = run(empty(), {
    action: "create_track",
    track: { id: "new", name: "New" },
  });
  p = run(p, {
    action: "add_text",
    trackId: "new",
    text: "Hello",
    duration: 2,
  });
  const id = p.layers[0].id;
  p = run(p, { action: "update_track", track: { id: "new", name: "Renamed" } });
  assert.equal(p.layers[0].text, "Hello");
  p = run(p, { action: "move_clips", layerIds: [id], trackId: "a", delta: 3 });
  assert.equal(p.layers[0].trackId, "a");
  assert.equal(p.layers[0].start, 3);
  assert.throws(
    () =>
      run(p, {
        action: "add_text",
        trackId: "a",
        text: "Overlap",
        start: 3,
        duration: 2,
      }),
    /overlap/,
  );
  p = run(p, { action: "delete_track", trackId: "a" });
  assert.equal(p.layers.length, 0);
});
