import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS,
  fadeGain,
  initialProject,
  layerAtTime,
  layerVolume,
  makeLayer,
  validateProject,
  type Layer,
  type Project,
} from "../src/model";
import {
  applyEditList,
  crossfade,
  detachAudio,
  cutSourceRanges,
  rippleDelete,
  rippleDeleteElements,
  rippleInsert,
  splitClips,
} from "../src/editor/editing";
import { AgentCommandSchema, applyAgentEdit } from "../src/agent-protocol";

const video = (
  id: string,
  start: number,
  duration: number,
  patch: Partial<Layer> = {},
): Layer => ({
  ...makeLayer("video", id),
  id,
  src: "/media/take.mp4",
  start,
  duration,
  trackId: "v",
  ...patch,
});
const base = (layers: Layer[], duration = 30): Project =>
  validateProject({
    ...initialProject,
    duration,
    tracks: [
      { id: "v", name: "Video" },
      { id: "t", name: "Titles" },
    ],
    layers,
  });
let n = 0;
const ids = () => `id${++n}`;

test("ripple delete trims, splits, removes and shifts while keeping source continuity", () => {
  const p = base([
    video("a", 0, 10),
    video("b", 10, 10, { offset: 10 }),
    {
      ...makeLayer("title", "Title"),
      id: "title",
      trackId: "t",
      start: 4,
      duration: 4,
    },
  ]);
  const next = rippleDelete(
    p,
    [
      [2, 3],
      [12, 14],
    ],
    undefined,
    ids,
  );
  assert.equal(next.duration, 27);
  const a = next.layers
    .filter((l) => l.src === "/media/take.mp4")
    .sort((x, y) => x.start - y.start);
  // a splits at 2–3: [0,2) then [2,9) from source 3; b loses 2 s and moves left.
  assert.deepEqual(
    a.map((l) => [l.start, l.duration, l.offset]),
    [
      [0, 2, 0],
      [2, 7, 3],
      [9, 2, 10],
      [11, 6, 14],
    ],
  );
  const right = a[1];
  // Effects and keyframes stay on the original clock across the cut.
  assert.equal(right.effectOffset, 3);
  assert.equal(right.effectDuration, 10);
  const title = next.layers.find((l) => l.id === "title")!;
  assert.deepEqual([title.start, title.duration], [3, 4]);
  // A range covering a whole clip removes it.
  assert.equal(
    rippleDelete(p, [[10, 20]]).layers.filter((l) => l.trackId === "v").length,
    1,
  );
  // Track-scoped ripples leave other layers (and the duration) alone.
  const scoped = rippleDelete(p, [[0, 5]], ["v"]);
  assert.equal(scoped.layers.find((l) => l.id === "title")!.start, 4);
  assert.equal(scoped.duration, 30);
  assert.doesNotThrow(() => validateProject(next));
});

test("ripple delete clips, ripple insert and cut source ranges", () => {
  const p = base([
    video("a", 0, 5),
    video("b", 5, 5, { offset: 5 }),
    video("c", 10, 5, { offset: 10 }),
  ]);
  const closed = rippleDeleteElements(p, ["b"]);
  assert.deepEqual(
    closed.layers.map((l) => [l.id, l.start]),
    [
      ["a", 0],
      ["c", 5],
    ],
  );
  const opened = rippleInsert(p, 7, 3, undefined, ids);
  const starts = opened.layers
    .map((l) => [l.start, l.duration, l.offset])
    .sort((x, y) => x[0] - y[0]);
  assert.deepEqual(starts, [
    [0, 5, 0],
    [5, 2, 5],
    [10, 3, 7],
    [13, 5, 10],
  ]);
  assert.equal(opened.duration, 33);
  // Source seconds map through the clip's offset: remove 6–7 s of "b" (timeline 6–7).
  const cut = cutSourceRanges(p, "b", [
    [6, 7],
    [100, 120],
  ]);
  assert.equal(cut.duration, 29);
  assert.deepEqual(
    cut.layers
      .map((l) => [l.start, l.duration, l.offset])
      .sort((x, y) => x[0] - y[0]),
    [
      [0, 5, 0],
      [5, 1, 5],
      [6, 3, 7],
      [9, 5, 10],
    ],
  );
});

test("apply edit list assembles ranges on one layer in one step", () => {
  const assets = [
    {
      src: "/media/take.mp4",
      name: "Take",
      type: "video" as const,
      duration: 60,
    },
    {
      src: "/media/still.png",
      name: "Still",
      type: "image" as const,
      duration: null,
    },
  ];
  const p = base([]);
  const { project, trackId, layerIds } = applyEditList(
    p,
    [
      { src: "/media/take.mp4", start: 2.52, end: 5.36 },
      { src: "/media/take.mp4", start: 10, end: 12 },
      { src: "/media/still.png", start: 0, end: 1.5, name: "Logo" },
    ],
    assets,
    { makeId: ids },
  );
  assert.equal(layerIds.length, 3);
  const placed = project.layers.filter((l) => l.trackId === trackId);
  assert.deepEqual(
    placed.map((l) => [l.start, l.offset]),
    [
      [0, 2.5],
      [2.875, 10],
      [4.875, 0],
    ],
  );
  assert.equal(placed[2].name, "Logo");
  assert.doesNotThrow(() => validateProject(project));
  // Overlapping an occupied layer needs replace.
  assert.throws(() =>
    applyEditList(
      project,
      [{ src: "/media/take.mp4", start: 0, end: 1 }],
      assets,
      { trackId },
    ),
  );
  const replaced = applyEditList(
    project,
    [{ src: "/media/take.mp4", start: 0, end: 1 }],
    assets,
    { trackId, replace: true },
  );
  assert.equal(
    replaced.project.layers.filter((l) => l.trackId === trackId).length,
    1,
  );
  // Via the agent protocol, as one command.
  const viaAgent = applyAgentEdit(
    p,
    AgentCommandSchema.parse({
      action: "apply_edit_list",
      ranges: [{ src: "/media/take.mp4", start: 0, end: 4 }],
      expectedRevision: "r",
    }),
    assets.map((a) => a.src),
    assets.map((a) => ({
      ...a,
      size: 1,
      missing: false,
      width: null,
      height: null,
      peaks: [],
    })),
  );
  assert.equal(viaAgent.layers.length, 1);
});

test("fades shape opacity and volume; audio edges de-click except across split pieces", () => {
  const clip = video("a", 0, 4, { fadeIn: 1, fadeOut: 2 });
  assert.equal(fadeGain(clip, 0.5), 0.5);
  assert.equal(fadeGain(clip, 2), 1);
  assert.equal(fadeGain(clip, 3.5), 0.25);
  assert.equal(layerAtTime(clip, [], 0.5).opacity, 0.5);
  assert.equal(layerVolume(clip, [clip], 0.5), 0.5);
  const plain = video("p", 0, 4);
  assert.ok(
    layerVolume(plain, [plain], 0.005) < 0.3,
    "edge ramp avoids clicks",
  );
  assert.equal(layerVolume(plain, [plain], 2), 1);
  const { project } = splitClips(base([plain]), ["p"], 48, () => "right");
  const [left, right] = project.layers;
  assert.equal(
    layerVolume(left, project.layers, left.duration - 0.001),
    1,
    "no dip at a split",
  );
  assert.equal(layerVolume(right, project.layers, 0.001), 1);
  // At 60 fps a one-frame gap is a real edge, so it keeps its de-click ramp.
  const gap = 1 / 60;
  const after = {
    ...right,
    id: "after",
    start: left.start + left.duration + gap,
    offset: left.offset + left.duration + gap,
  };
  assert.ok(layerVolume(after, [left, after], 0.001, 60) < 1);
  assert.equal(layerVolume(right, project.layers, 0.001, 60), 1);
});

test("crossfade overlaps clips using source handles and fades both", () => {
  const p = base([video("a", 0, 5), video("b", 5, 5, { offset: 8 })]);
  const next = crossfade(p, "a", "b", 1, () => 60);
  const a = next.layers.find((l) => l.id === "a")!;
  const b = next.layers.find((l) => l.id === "b")!;
  assert.deepEqual([b.start, b.duration, b.offset, b.fadeIn], [4, 6, 7, 1]);
  assert.equal(a.fadeOut, 1);
  assert.notEqual(b.trackId, a.trackId, "the overlap lives on another layer");
  assert.doesNotThrow(() => validateProject(next));
  // A free titles row above is not a picture track: a new track goes in between.
  const titled = crossfade(
    base([
      video("a", 0, 5),
      video("b", 5, 5, { offset: 8 }),
      {
        ...makeLayer("title", "Name"),
        id: "n",
        trackId: "t",
        start: 0,
        duration: 2,
      },
    ]),
    "a",
    "b",
    1,
    () => 60,
  );
  const moved = titled.layers.find((l) => l.id === "b")!;
  assert.notEqual(moved.trackId, "t");
  assert.deepEqual(
    titled.tracks!.map((t) => t.id),
    ["v", moved.trackId, "t"],
  );
  assert.throws(
    () =>
      crossfade(
        base([video("a", 0, 5), video("b", 5, 5, { offset: 0 })]),
        "a",
        "b",
        1,
        () => 5,
      ),
    /source footage/,
  );
});

test("limits allow long, many-cut projects", () => {
  const layers = Array.from({ length: 300 }, (_, i) =>
    video(`c${i}`, i * 2, 2, { offset: i * 2 }),
  );
  assert.doesNotThrow(() => base(layers, 600));
  assert.equal(LIMITS.elements, 500);
  assert.doesNotThrow(() =>
    validateProject({ ...initialProject, duration: 3600 }),
  );
});

test("detach audio: extract any track, align it under the video and mute the video", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { ffmpegPath, extractAudioTrack, run } =
    await import("../server/analysis/ffmpeg");
  const { probeStreams, audioStats } = await import("../server/analysis/probe");
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-detach-"));
  try {
    // A two-track recording: 440 Hz "desktop" and a quieter 880 Hz "mic".
    await run(ffmpegPath(), [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=2:size=160x90",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:duration=2,volume=0.25",
      "-map",
      "0",
      "-map",
      "1",
      "-map",
      "2",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      path.join(dir, "two.mp4"),
    ]);
    assert.equal(
      (await probeStreams(path.join(dir, "two.mp4"))).audioTracks.length,
      2,
    );
    await extractAudioTrack(
      path.join(dir, "two.mp4"),
      path.join(dir, "mic.m4a"),
      1,
    );
    const mic = await audioStats(path.join(dir, "mic.m4a"), 2);
    const desktop = await audioStats(path.join(dir, "two.mp4"), 2, 0);
    assert.ok(
      mic.lufs! < desktop.lufs! - 6,
      "track 1 (the quieter mic) was extracted",
    );
    await assert.rejects(() =>
      extractAudioTrack(path.join(dir, "two.mp4"), path.join(dir, "x.m4a"), 5),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const p = base([video("a", 3, 5, { offset: 7, fadeIn: 0.5, volume: 0.8 })]);
  const { project, audioId } = detachAudio(p, "a", "/media/take-a0.m4a", ids);
  const v = project.layers.find((l) => l.id === "a")!;
  const a = project.layers.find((l) => l.id === audioId)!;
  assert.equal(v.muted, true);
  assert.deepEqual(
    [a.type, a.start, a.duration, a.offset, a.volume, a.fadeIn],
    ["audio", 3, 5, 7, 0.8, 0.5],
  );
  assert.notEqual(a.trackId, v.trackId);
  assert.doesNotThrow(() => validateProject(project));
  assert.throws(() => detachAudio(p, "missing", "/media/x.m4a"));
});

test("export loudness normalization reaches the target and keeps the video stream", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { ffmpegPath, normalizeLoudness, run } =
    await import("../server/analysis/ffmpeg");
  const { audioStats, probeStreams } = await import("../server/analysis/probe");
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-loud-"));
  try {
    const input = path.join(dir, "quiet.mp4");
    await run(ffmpegPath(), [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=6:size=160x90",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=500:duration=6,volume=0.05",
      "-shortest",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      input,
    ]);
    const before = await audioStats(input, 6);
    const output = path.join(dir, "loud.mp4");
    assert.equal(await normalizeLoudness(input, output, -14), true);
    const after = await audioStats(output, 6);
    assert.ok(before.lufs! < -30);
    assert.ok(Math.abs(after.lufs! + 14) < 1.5, `got ${after.lufs}`);
    assert.ok(after.truePeak! <= -1);
    assert.equal((await probeStreams(output)).video?.codec, "h264");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("projects accept preset frame rates and even resolutions, fixed after creation", () => {
  const vertical = validateProject({
    ...initialProject,
    width: 1080,
    height: 1920,
    fps: 29.97,
    exportLoudness: -14,
  });
  assert.equal(vertical.fps, 29.97);
  assert.throws(() => validateProject({ ...initialProject, fps: 33 }));
  assert.throws(() => validateProject({ ...initialProject, width: 1081 }));
  const next = applyAgentEdit(
    initialProject,
    AgentCommandSchema.parse({
      action: "set_project_settings",
      exportLoudness: -23,
      expectedRevision: "r",
    }),
    [],
  );
  assert.deepEqual(
    [next.width, next.height, next.fps, next.exportLoudness],
    [1920, 1080, 24, -23],
  );
  // No command can change the format, including a whole-project replace.
  assert.throws(
    () =>
      applyAgentEdit(
        initialProject,
        AgentCommandSchema.parse({
          action: "apply_project",
          project: { ...initialProject, fps: 60 },
          expectedRevision: "r",
        }),
        [],
      ),
    /fixed when a project is created/,
  );
  assert.throws(() =>
    AgentCommandSchema.parse({
      action: "set_project_settings",
      fps: 60,
      expectedRevision: "r",
    }),
  );
  // Depth travel scales with the frame instead of assuming 1920×1080.
  const wide = layerAtTime({ ...makeLayer("image", "i") }, [], 0, {
    width: 1080,
    height: 1920,
  });
  assert.equal(wide.x, 0);
});
