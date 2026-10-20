import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initialProject, makeLayer, type Project } from "../src/model";
import { chunkCount, chunkKeys, chunkRange } from "../src/preview-cache";
import { PreviewCache } from "../server/preview-cache";

const project: Project = {
  ...initialProject,
  duration: 10,
  fps: 24,
  tracks: [
    { id: "back", name: "Back" },
    { id: "front", name: "Front" },
    { id: "sound", name: "Sound" },
  ],
  layers: [
    {
      ...makeLayer("scene", "Full"),
      id: "full",
      trackId: "back",
      start: 0,
      duration: 10,
    },
    {
      ...makeLayer("title", "Early"),
      id: "early",
      trackId: "front",
      start: 0.5,
      duration: 1,
    },
    {
      ...makeLayer("title", "Late"),
      id: "late",
      trackId: "front",
      start: 6,
      duration: 3,
    },
    {
      ...makeLayer("audio", "Song"),
      id: "song",
      trackId: "sound",
      src: "/media/song.mp3",
      start: 0,
      duration: 10,
    },
  ],
};
const edit = (id: string, patch: object): Project => ({
  ...project,
  layers: project.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
});
const changed = (a: string[], b: string[]) =>
  a.flatMap((k, i) => (k === b[i] ? [] : [i]));

test("chunks cover every frame once", () => {
  const n = chunkCount(project);
  assert.equal(n, 5);
  assert.deepEqual(chunkRange(project, 0), [0, 47]);
  assert.deepEqual(chunkRange(project, n - 1), [192, 239]);
  const odd = { ...project, duration: 9.5 };
  assert.deepEqual(chunkRange(odd, chunkCount(odd) - 1), [192, 227]);
});

test("an edit invalidates only the chunks the element draws in", () => {
  const keys = chunkKeys(project);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys, chunkKeys(structuredClone(project)));
  assert.deepEqual(changed(keys, chunkKeys(edit("early", { x: 40 }))), [0]);
  assert.deepEqual(changed(keys, chunkKeys(edit("late", { x: 40 }))), [3, 4]);
  // Moving an element changes the chunks it leaves and the ones it enters.
  assert.deepEqual(
    changed(keys, chunkKeys(edit("early", { start: 4.5 }))),
    [0, 2],
  );
  assert.deepEqual(
    changed(keys, chunkKeys(edit("full", { opacity: 0.5 }))),
    [0, 1, 2, 3, 4],
  );
  // A blend changes how the element mixes with everything under it.
  assert.deepEqual(
    changed(keys, chunkKeys(edit("late", { blend: "multiply" }))),
    [3, 4],
  );
  // Hiding an element changes what draws.
  assert.deepEqual(
    changed(keys, chunkKeys(edit("late", { visible: false }))),
    [3, 4],
  );
  // Sound doesn't draw.
  assert.deepEqual(changed(keys, chunkKeys(edit("song", { volume: 0.2 }))), []);
  // Layer order is drawing order, where elements overlap.
  const reordered = { ...project, tracks: [...project.tracks!].reverse() };
  assert.deepEqual(changed(keys, chunkKeys(reordered)), [0, 3, 4]);
});

test("missing media and effect definitions are part of the key", () => {
  const video = {
    ...project,
    layers: [
      ...project.layers,
      {
        ...makeLayer("video", "Clip"),
        id: "clip",
        src: "/media/clip.mp4",
        start: 2,
        duration: 1,
      },
    ],
  };
  const keys = chunkKeys(video);
  assert.deepEqual(changed(keys, chunkKeys(video, ["/media/clip.mp4"])), [1]);
  const effect = project.effects[0];
  if (!effect) return;
  const withEffect = edit("late", {
    effects: [{ effectId: effect.id, enabled: true, amount: 1 }],
  });
  const before = chunkKeys(withEffect);
  const tweaked = {
    ...withEffect,
    effects: withEffect.effects.map((e) =>
      e.id === effect.id ? { ...e, name: e.name + " 2" } : e,
    ),
  };
  assert.deepEqual(changed(before, chunkKeys(tweaked)), [3, 4]);
});

test("the cache folder lives only as long as its service", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kamikami-cache-test-"));
  try {
    const crashed = path.join(root, "999999999"),
      running = path.join(root, String(process.ppid)),
      stray = path.join(root, "notes");
    for (const dir of [crashed, running, stray]) mkdirSync(dir);
    const cache = new PreviewCache({
      root,
      limitBytes: 1024,
      serveUrl: async () => "",
      browserExecutable: null,
      chromiumOptions: {},
      concurrency: 1,
      mediaOrigin: "",
      busy: () => false,
    });
    cache.open();
    assert.ok(existsSync(cache.dir));
    assert.ok(!existsSync(crashed), "a crashed service's frames are removed");
    assert.ok(!existsSync(stray));
    assert.ok(existsSync(running), "another running service keeps its frames");
    cache.removeSync();
    assert.ok(!existsSync(cache.dir));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
