import test from "node:test";
import assert from "node:assert/strict";
import { EditHistory } from "../src/history";
import {
  durationChange,
  movedClipStart,
  validateNumericDraft,
} from "../src/editor-utils";
import { initialProject, validateProject } from "../src/model";

test("a focused typing session undoes and redoes as one operation", () => {
  const history = new EditHistory<string>();
  history.record("Title", "name");
  history.record("Title ", "name");
  history.record("Title Q", "name");
  assert.equal(history.undo("Title QA"), "Title");
  assert.equal(history.canUndo, false);
  assert.equal(history.redo("Title"), "Title QA");
});

test("separate field visits, discrete edits, and typing in another field stay separate", () => {
  const history = new EditHistory<number>();
  history.record(0, "name");
  history.endGroup();
  history.record(1, "name");
  history.record(2, "text");
  history.record(3);
  assert.equal(history.undo(4), 3);
  assert.equal(history.undo(3), 2);
  assert.equal(history.undo(2), 1);
  assert.equal(history.undo(1), 0);
});

test("a new edit after undo drops the redo branch and retains a new undo step", () => {
  const history = new EditHistory<string>();
  history.record("A", "name");
  assert.equal(history.undo("AB"), "A");
  history.record("A", "name");
  assert.equal(history.canRedo, false);
  assert.equal(history.undo("AC"), "A");
});

test("typing does not exhaust the history limit", () => {
  const history = new EditHistory<number>(2);
  history.record(-1);
  for (let i = 0; i < 100; i++) history.record(i, "text");
  assert.equal(history.undo(100), 0);
  assert.equal(history.undo(0), -1);
});

test("duration proposals leave the original untouched and identify affected clips", () => {
  const original = structuredClone(initialProject);
  const proposal = durationChange(original, 10);
  assert.equal(proposal.affected.length, 3);
  assert.deepEqual(original, initialProject);
  assert.equal(validateProject(proposal.next).duration, 10);
  assert.ok(proposal.next.layers.every((l) => l.duration === 10));
  const history = new EditHistory<typeof original>();
  history.record(original);
  assert.deepEqual(history.undo(proposal.next), original);
});

test("shortening handles clips entirely beyond the new end and leaves fitting clips intact", () => {
  const original = structuredClone(initialProject);
  original.layers[0] = { ...original.layers[0], start: 12, duration: 3 };
  original.layers[1].duration = 5;
  const proposal = durationChange(original, 10);
  assert.equal(proposal.affected.length, 2);
  assert.equal(proposal.next.layers[1], original.layers[1]);
  validateProject(proposal.next);
  assert.ok(proposal.next.layers.every((l) => l.start + l.duration <= 10.001));
});

test("extending a composition preserves the timing of existing clips", () => {
  const proposal = durationChange(initialProject, 30);
  assert.equal(proposal.affected.length, 0);
  assert.deepEqual(proposal.next.layers, initialProject.layers);
});

test("invalid numeric drafts have actionable errors instead of fallback values", () => {
  for (const draft of ["", " ", "abc", "Infinity", "-1", "12"]) {
    const result = validateNumericDraft(draft, 0, 10);
    assert.ok(result.error);
    assert.equal(result.value, undefined);
  }
  assert.deepEqual(validateNumericDraft("2.5", 0, 10), { value: 2.5 });
  assert.deepEqual(validateNumericDraft("0", 0, 10), { value: 0 });
  assert.deepEqual(validateNumericDraft("10", 0, 10), { value: 10 });
});

test("dragging snaps to frames while clamping clips to composition boundaries", () => {
  assert.equal(movedClipStart(0, -2, 5, 15, 24), 0);
  assert.equal(movedClipStart(0, 0.1, 5, 15, 24), 2 / 24);
  const start = movedClipStart(0, 20, 5.01, 15, 24);
  assert.equal(start, 9.99);
  assert.ok(start + 5.01 <= 15);
});
