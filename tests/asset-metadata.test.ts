import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AnalysisStore } from "../server/analysis/store";
import { AnalysisQueue, type AnalysisStage } from "../server/analysis/queue";
import { writeMetadata } from "../server/analysis/metadata";
import { sliceAnalysis, searchAnalyses } from "../server/analysis/query";
import { ffmpegPath, run } from "../server/analysis/ffmpeg";
import { modelStages } from "../server/analysis/stages";
import {
  applyMetadata,
  entrySummary,
  keepManual,
  type AssetAnalysis,
} from "../src/asset-analysis";
import type { MediaAsset } from "../src/media";

const video: AssetAnalysis = {
  schema: 1,
  sha256: "b".repeat(64),
  type: "video",
  probe: { duration: 30, size: 1, video: null, audioTracks: [] },
  provenance: {},
};

test("manual metadata merges, validates times and types, and can be cleared", () => {
  const { analysis, fields } = applyMetadata(
    video,
    {
      summary: "Drone shot over a coastal town at sunrise.",
      tags: ["drone", "coast"],
      description: "Opens on the harbour. Pans left to the lighthouse.",
      scenes: [
        { start: 12, end: 40, title: "Lighthouse" },
        { start: 0, end: 12, title: "Harbour" },
      ],
      transcript: {
        segments: [{ start: 2, end: 4, text: "Welcome to the coast." }],
      },
    },
    "assistant",
    "2026-10-12T00:00:00.000Z",
  );
  assert.deepEqual(fields, ["summary", "description", "scenes", "transcript"]);
  // Sorted and clamped to the asset's 30 s.
  assert.deepEqual(
    analysis.scenes!.map((s) => [s.start, s.end]),
    [
      [0, 12],
      [12, 30],
    ],
  );
  assert.equal(analysis.transcript!.source, "manual");
  assert.equal(analysis.transcript!.text, "Welcome to the coast.");
  assert.equal(analysis.provenance["manual.summary"].model, "assistant");
  assert.equal(
    entrySummary(analysis),
    "Drone shot over a coastal town at sunrise.",
  );
  // Tags alone keep the summary text; a description alone becomes the digest line.
  const described = applyMetadata(
    video,
    {
      description: "A lighthouse at dusk. Waves below.",
    },
    "user",
  ).analysis;
  assert.equal(entrySummary(described), "A lighthouse at dusk.");
  assert.throws(
    () =>
      applyMetadata(
        video,
        { scenes: [{ start: 31, end: 32, title: "x" }] },
        "a",
      ),
    /after the asset ends/,
  );
  assert.throws(
    () => applyMetadata(video, { image: { caption: "x" } }, "a"),
    /Image descriptions are for image assets/,
  );
  assert.throws(
    () =>
      applyMetadata(
        { ...video, type: "image" },
        { sections: [{ start: 0, end: 1, label: "x" }] },
        "a",
      ),
    /Images have no timeline/,
  );
  const cleared = applyMetadata(
    analysis,
    { clear: ["scenes", "summary"] },
    "a",
  );
  assert.equal(cleared.analysis.scenes, undefined);
  assert.equal(cleared.analysis.provenance["manual.scenes"], undefined);
  assert.ok(cleared.analysis.description, "other fields stay");
  const overview = sliceAnalysis(analysis) as {
    manual: string[];
    analyzed: string[];
  };
  assert.deepEqual(overview.manual, [
    "summary",
    "description",
    "scenes",
    "transcript",
  ]);
  assert.deepEqual(overview.analyzed, []);
  const hits = searchAnalyses("lighthouse", [
    {
      asset: {
        src: "/media/a.mp4",
        name: "a.mp4",
        type: "video",
      } as MediaAsset,
      analysis,
    },
  ]);
  assert.ok(hits[0].hits.some((h) => h.where === "description"));
});

test("keepManual protects manual fields from analysis that started earlier", () => {
  const manual = applyMetadata(video, { summary: "Mine" }, "user").analysis;
  const computed: AssetAnalysis = {
    ...video,
    summary: { text: "Model summary", tags: [] },
    scenes: [{ start: 0, end: 30, title: "All" }],
    provenance: {
      summary: { analyzer: "summary", version: "1", createdAt: "x" },
    },
  };
  const merged = keepManual(manual, computed);
  assert.equal(merged.summary!.text, "Mine");
  assert.equal(merged.scenes![0].title, "All", "non-manual results land");
  assert.ok(merged.provenance["manual.summary"]);
  // A field cleared since the analysis started is not resurrected.
  const stale = keepManual(video, manual);
  assert.equal(stale.summary, undefined);
});

test("writing metadata probes new assets, survives later analysis and skips paid stages", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kamikami-metadata-"));
  try {
    await mkdir(path.join(root, "media"));
    await run(ffmpegPath(), [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3:size=160x90:rate=24",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      path.join(root, "media", "clip.mp4"),
    ]);
    const store = new AnalysisStore(root);
    const assets = [
      { src: "/media/clip.mp4", name: "clip.mp4", type: "video" },
      {
        src: "/media/gone.mp4",
        name: "gone.mp4",
        type: "video",
        deleted: true,
      },
    ] as MediaAsset[];
    const results = await writeMetadata({
      store,
      workspace: root,
      assets,
      author: "assistant",
      items: [
        {
          src: "/media/clip.mp4",
          summary: "Colour test pattern, 3 seconds.",
          tags: ["test"],
          scenes: [{ start: 0, end: 3, title: "Pattern" }],
        },
        { src: "/media/gone.mp4", summary: "x" },
        {
          src: "/media/clip.mp4",
          scenes: [{ start: 2, end: 1, title: "bad" }],
        },
        { src: "/media/clip.mp4", colour: "red" },
      ],
    });
    assert.deepEqual(
      results.map((r) => r.ok),
      [true, false, false, false],
    );
    assert.match(
      (results[1] as { error: string }).error,
      /Not in the media library/,
    );
    assert.match((results[2] as { error: string }).error, /end > start/);
    assert.match((results[3] as { error: string }).error, /colour/);
    const entry = await store.entry("/media/clip.mp4");
    assert.equal(entry.status, "ready");
    assert.equal(entry.summary, "Colour test pattern, 3 seconds.");
    const stored = (await store.read(entry.sha256!))!;
    assert.ok(stored.probe.duration! > 2.9, "the free probe ran first");
    // Later analysis: a stage that would rewrite the summary, and one that is skipped.
    let summarizeRuns = 0;
    const stages: AnalysisStage[] = [
      {
        name: "look",
        tiers: ["balanced"],
        async run(a) {
          return {
            ...a,
            summary: { text: "Model text", tags: [] },
            visual: a.visual && {
              ...a.visual,
              samples: [{ t: 1, caption: "bars", text: "" }],
            },
          };
        },
      },
      {
        name: "summary",
        tiers: ["balanced"],
        applies: (a) => !a.provenance["manual.summary"],
        async run(a) {
          summarizeRuns++;
          return a;
        },
      },
    ];
    const queue = new AnalysisQueue(store, root, stages);
    queue.enqueue("/media/clip.mp4", "balanced");
    await queue.idle();
    const after = (await store.read(entry.sha256!))!;
    assert.equal(after.summary!.text, "Colour test pattern, 3 seconds.");
    assert.equal(after.scenes![0].title, "Pattern");
    assert.equal(
      after.visual!.samples![0].caption,
      "bars",
      "analysis still adds frames",
    );
    assert.equal(summarizeRuns, 0, "no paid summary over a manual one");
    // The real model stages make the same choices.
    const real = modelStages({
      connection: () => null,
      settings: async () => ({
        transcriptionEnabled: true,
        autoTranscribe: false,
        transcriptionModel: "whisper-1",
        visionModel: "",
        defaultTier: "balanced",
        language: "en",
        consent: {},
      }),
      fontFile: "",
    });
    const byName = Object.fromEntries(real.map((s) => [s.name, s]));
    assert.equal(await byName.summary.applies!(after), false);
    const transcribed = applyMetadata(
      {
        ...after,
        audio: {
          lufs: -20,
          truePeak: -1,
          silent: false,
          silences: [],
          activeRatio: 1,
        },
        probe: {
          ...after.probe,
          audioTracks: [
            { index: 0, codec: "aac", sampleRate: 48000, channels: 2 },
          ],
        },
      },
      { transcript: { segments: [{ start: 0, end: 1, text: "Hi" }] } },
      "user",
    ).analysis;
    assert.equal(await byName.transcript.applies!(transcribed), false);
    assert.equal(
      (await store.entry("/media/clip.mp4")).summary,
      "Colour test pattern, 3 seconds.",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
