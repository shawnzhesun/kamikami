import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AnalysisStore } from "../server/analysis/store";
import { AnalysisQueue } from "../server/analysis/queue";
import { ffmpegPath, run } from "../server/analysis/ffmpeg";
import { probeAsset } from "../server/analysis/probe";
import { probeSummary } from "../src/asset-analysis";

// Generated fixtures: 2 s test pattern, 1 s black, 2 s bars; tone, 1 s silence, tone.
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "kamikami-analysis-"));
  await mkdir(path.join(root, "media"));
  const ff = (args: string[]) =>
    run(ffmpegPath(), ["-v", "error", "-y", ...args]);
  await ff([
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=2:size=320x180:rate=30",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:duration=1:size=320x180:rate=30",
    "-f",
    "lavfi",
    "-i",
    "smptebars=duration=2:size=320x180:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=2",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=duration=1:sample_rate=44100",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:duration=2",
    "-filter_complex",
    "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];[3:a][4:a][5:a]concat=n=3:v=0:a=1[a]",
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    path.join(root, "media", "clip.mp4"),
  ]);
  await ff([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=330:duration=3",
    path.join(root, "media", "tone.wav"),
  ]);
  await ff([
    "-f",
    "lavfi",
    "-i",
    "color=c=red@0.5:size=64x48,format=rgba",
    "-frames:v",
    "1",
    path.join(root, "media", "dot.png"),
  ]);
  return root;
}

test("probe measures shots, black and frozen spans, loudness and silences", async () => {
  const root = await workspace();
  try {
    const video = await probeAsset(
      path.join(root, "media", "clip.mp4"),
      "video",
    );
    assert.ok(Math.abs(video.probe.duration! - 5) < 0.1);
    assert.equal(video.probe.video?.width, 320);
    assert.ok(Math.abs(video.probe.video!.fps! - 30) < 0.01);
    assert.equal(video.probe.audioTracks.length, 1);
    assert.deepEqual(
      video.visual!.shots.map((s) => Math.round(s.start)),
      [0, 2, 3],
    );
    assert.ok(
      video.visual!.black.some(
        ([a, b]) => Math.abs(a - 2) < 0.1 && Math.abs(b - 3) < 0.1,
      ),
    );
    assert.ok(video.visual!.freeze.length >= 1);
    assert.ok(
      video.audio!.silences.some(
        ([a, b]) => Math.abs(a - 2) < 0.1 && Math.abs(b - 3) < 0.1,
      ),
    );
    assert.ok(video.audio!.lufs! < -10 && video.audio!.lufs! > -40);
    assert.ok(
      video.audio!.activeRatio > 0.7 && video.audio!.activeRatio < 0.85,
    );
    assert.match(probeSummary(video), /5\.0s, 320×180 @ 30fps, 3 shots/);
    const image = await probeAsset(
      path.join(root, "media", "dot.png"),
      "image",
    );
    assert.equal(image.probe.duration, null);
    assert.equal(image.probe.video?.alpha, true);
    assert.equal(image.visual, undefined);
    const audio = await probeAsset(
      path.join(root, "media", "tone.wav"),
      "audio",
    );
    assert.equal(audio.probe.video, null);
    assert.equal(audio.audio!.silent, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("queue stores hash-keyed sidecars, reuses cached probes and resumes jobs", async () => {
  const root = await workspace();
  try {
    const store = new AnalysisStore(root);
    const queue = new AnalysisQueue(store, root);
    for (const src of ["/media/clip.mp4", "/media/tone.wav", "/media/dot.png"])
      queue.enqueue(src);
    await queue.idle();
    const index = await store.index();
    for (const src of [
      "/media/clip.mp4",
      "/media/tone.wav",
      "/media/dot.png",
    ]) {
      assert.equal(index[src].status, "ready", src);
      assert.match(index[src].sha256!, /^[a-f0-9]{64}$/);
      assert.ok(index[src].summary);
    }
    const sidecar = await store.read(index["/media/clip.mp4"].sha256!);
    const createdAt = sidecar!.provenance.probe.createdAt;
    // Same content: the cached probe is reused rather than recomputed.
    queue.enqueue("/media/clip.mp4");
    await queue.idle();
    assert.equal(
      (await store.read(index["/media/clip.mp4"].sha256!))!.provenance.probe
        .createdAt,
      createdAt,
    );
    // A pending job survives a restart.
    await writeFile(
      path.join(root, "analysis", "queue.json"),
      JSON.stringify([
        {
          id: "x",
          src: "/media/tone.wav",
          tier: "probe",
          status: "running",
          createdAt: "",
        },
      ]),
    );
    const resumed = new AnalysisQueue(store, root);
    await resumed.load();
    await resumed.idle();
    assert.ok(resumed.list().some((j) => j.id === "x" && j.status === "done"));
    assert.deepEqual(
      JSON.parse(
        await readFile(path.join(root, "analysis", "queue.json"), "utf8"),
      ),
      [],
    );
    // Missing files fail cleanly; cancel stops queued work.
    queue.enqueue("/media/missing.mp4");
    await queue.idle();
    assert.equal((await store.entry("/media/missing.mp4")).status, "error");
    const slow = new AnalysisQueue(store, root, [], 1);
    const a = slow.enqueue("/media/clip.mp4");
    const b = slow.enqueue("/media/tone.wav");
    slow.cancel(b.id);
    await slow.idle();
    assert.equal(a.status, "done");
    assert.equal(b.status, "canceled");
    assert.throws(() => queue.enqueue("../etc/passwd"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
