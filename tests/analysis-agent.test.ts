import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  libraryDigest,
  searchAnalyses,
  sliceAnalysis,
} from "../server/analysis/query";
import { viewRange } from "../server/analysis/view";
import { ffmpegPath, ffprobePath, run } from "../server/analysis/ffmpeg";
import { AssistantService } from "../server/assistant";
import { EditorBridge } from "../server/editor-bridge";
import type { ModelReply, ModelRequest } from "../server/assistant-model";
import { initialProject } from "../src/model";
import type { AssetAnalysis } from "../src/asset-analysis";
import type { MediaAsset } from "../src/media";

const analysis: AssetAnalysis = {
  schema: 1,
  sha256: "a".repeat(64),
  type: "video",
  probe: {
    duration: 20,
    size: 1,
    video: {
      codec: "h264",
      width: 1920,
      height: 1080,
      fps: 30,
      rotation: 0,
      alpha: false,
    },
    audioTracks: [{ index: 0, codec: "aac", sampleRate: 48000, channels: 2 }],
  },
  audio: {
    lufs: -18,
    truePeak: -1,
    silent: false,
    silences: [
      [4, 5],
      [15, 16],
    ],
    activeRatio: 0.9,
  },
  visual: {
    shots: [
      { i: 0, start: 0, end: 8, caption: "Woman at a desk" },
      { i: 1, start: 8, end: 20, caption: "City skyline at dusk" },
    ],
    black: [],
    freeze: [],
    samples: [
      { t: 4, caption: "Woman at a desk", text: "" },
      { t: 14, caption: "City skyline at dusk", text: "OPEN" },
    ],
  },
  transcript: {
    language: "english",
    text: "welcome to the studio today we talk about light",
    segments: [
      { start: 1, end: 4, text: "Welcome to the studio." },
      { start: 9, end: 14, text: "Today we talk about light." },
    ],
    words: [
      { t: "Welcome", s: 1, e: 1.4 },
      { t: "to", s: 1.4, e: 1.5 },
      { t: "Today", s: 9, e: 9.4 },
    ],
  },
  summary: {
    text: "Interview intro in a studio, then a skyline.",
    tags: ["interview", "city"],
  },
  provenance: {
    probe: { analyzer: "ffmpeg", version: "probe-1.0.0", createdAt: "" },
  },
};
const asset = (
  src: string,
  name: string,
  type: MediaAsset["type"] = "video",
): MediaAsset => ({
  src,
  name,
  type,
  size: 1,
  missing: false,
  duration: 20,
  width: 1920,
  height: 1080,
  peaks: [],
});

test("analysis slices by section and time; search finds timestamped hits; digest is compact", () => {
  const overview = sliceAnalysis(analysis) as {
    summary: string;
    counts: { words: number };
  };
  assert.equal(
    overview.summary,
    "Interview intro in a studio, then a skyline.",
  );
  assert.equal(overview.counts.words, 3);
  const later = sliceAnalysis(analysis, "transcript", 8, 20) as {
    transcript: { text: string }[];
  };
  assert.deepEqual(
    later.transcript.map((s) => s.text),
    ["Today we talk about light."],
  );
  const words = sliceAnalysis(analysis, "words", 0, 2) as {
    words: { t: string }[];
  };
  assert.deepEqual(
    words.words.map((w) => w.t),
    ["Welcome", "to"],
  );
  const audio = sliceAnalysis(analysis, "audio", 10, 20) as {
    audio: { silences: number[][] };
  };
  assert.deepEqual(audio.audio.silences, [[15, 16]]);
  const results = searchAnalyses("skyline light", [
    { asset: asset("/media/a.mp4", "Interview"), analysis },
    { asset: asset("/media/b.png", "Logo", "image"), analysis: null },
  ]);
  assert.equal(results.length, 1);
  assert.ok(results[0].hits.some((h) => h.where === "frame" && h.start === 14));
  assert.ok(
    results[0].hits.some((h) => h.where === "transcript" && h.start === 9),
  );
  assert.deepEqual(
    searchAnalyses("logo", [
      { asset: asset("/media/b.png", "Logo", "image"), analysis: null },
    ])[0].hits[0].where,
    "name",
  );
  const digest = libraryDigest(
    [
      asset("/media/a.mp4", "Interview"),
      asset("/media/b.png", "Logo", "image"),
      { ...asset("/media/c.mp4", "Gone"), deleted: true },
    ],
    {
      "/media/a.mp4": { status: "ready", summary: "Interview intro." },
      "/media/b.png": { status: "queued" },
    },
  );
  assert.equal(digest.split("\n").length, 2);
  assert.match(
    digest,
    /\/media\/a\.mp4 "Interview" video: Interview intro\.$/m,
  );
  assert.match(digest, /\[analysis: queued\]/);
});

test("range views render frames over a waveform for video, audio and images", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-view-test-"));
  const font = path.resolve("public/fonts/builtin/DejaVuSans-Bold.ttf");
  try {
    const ff = (args: string[]) =>
      run(ffmpegPath(), ["-v", "error", "-y", ...args]);
    await ff([
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=4:size=320x180:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=4",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      path.join(dir, "v.mp4"),
    ]);
    await ff(["-f", "lavfi", "-i", "sine=duration=3", path.join(dir, "a.wav")]);
    await ff([
      "-f",
      "lavfi",
      "-i",
      "color=c=green:size=100x60",
      "-frames:v",
      "1",
      path.join(dir, "i.png"),
    ]);
    const size = async (file: string) => {
      const { stdout } = await run(ffprobePath(), [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        file,
      ]);
      return stdout.trim();
    };
    await viewRange(
      path.join(dir, "v.mp4"),
      "video",
      0.5,
      3.5,
      path.join(dir, "v.png"),
      font,
      { frames: 8 },
    );
    assert.equal(await size(path.join(dir, "v.png")), "1280,480"); // 2 rows of frames + waveform
    await viewRange(
      path.join(dir, "a.wav"),
      "audio",
      0,
      3,
      path.join(dir, "a.png"),
      font,
    );
    assert.equal(await size(path.join(dir, "a.png")), "640,120");
    await viewRange(
      path.join(dir, "i.png"),
      "image",
      0,
      0,
      path.join(dir, "i-view.png"),
      font,
    );
    assert.equal(await size(path.join(dir, "i-view.png")), "320,180");
    assert.equal(
      (await readFile(path.join(dir, "v.png"))).subarray(1, 4).toString(),
      "PNG",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("assistant shows the analysis estimate and only runs model tiers after approval", async () => {
  const data = await mkdtemp(path.join(tmpdir(), "kamikami-analysis-agent-"));
  const bridge = new EditorBridge();
  bridge.poll("editor");
  const timer = setInterval(() => {
    for (const request of bridge.poll("editor").requests)
      bridge.reply("editor", request.id, {
        project: structuredClone(initialProject),
        revision: "editor:0",
        selectedLayerIds: [],
        frame: 0,
      });
  }, 3);
  const local: { route: string; body?: string }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const route = String(url).replace("http://127.0.0.1:4318", "");
    local.push({
      route,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json" },
      });
    if (route.startsWith("/api/analysis/digest"))
      return json({
        digest: '- /media/a.mp4 "Interview" video: Interview intro.',
      });
    if (route.startsWith("/api/analysis/estimate"))
      return json({
        tier: "balanced",
        estimate: {
          assets: 1,
          frames: 12,
          sheets: 1,
          images: 0,
          transcriptionMinutes: 0,
          modelCalls: 2,
          uploadsTo: "api.test",
        },
      });
    if (route.startsWith("/api/analysis/run"))
      return json({ jobs: [{ id: "j", status: "queued" }] });
    return json({});
  }) as typeof fetch;
  let inputs: string[] = [];
  let round = 0;
  const model = async (r: ModelRequest): Promise<ModelReply> => {
    inputs = r.input.map((i) => JSON.stringify(i));
    if (round++ % 2 === 0)
      return {
        items: [
          {
            type: "function_call",
            call_id: `c${round}`,
            name: "analyze_assets",
            arguments: JSON.stringify({ tier: "balanced" }),
          },
        ],
        calls: [
          {
            id: `c${round}`,
            name: "analyze_assets",
            arguments: JSON.stringify({ tier: "balanced" }),
          },
        ],
      };
    return {
      items: [{ role: "assistant", content: "ok" } as never],
      calls: [],
    };
  };
  const service = new AssistantService(bridge, data, model, fetcher);
  service.configure({ model: "m", apiKey: "k" });
  const until = async (f: () => boolean) => {
    const end = Date.now() + 5000;
    while (!f()) {
      if (Date.now() > end) throw new Error("timed out");
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  try {
    await service.start({
      text: "Analyze my footage",
      selectedLayerIds: [],
      frame: 0,
    });
    await until(() => !!service.state().confirmation);
    assert.match(
      service.state().confirmation!.description,
      /12 frames in 1 contact sheets.*sent to api\.test/,
    );
    assert.ok(
      inputs.some((i) => i.includes("Media library (analysis digest")),
      "digest reaches the model",
    );
    service.approve(service.state().confirmation!.id, false);
    await until(() => !service.state().active);
    assert.ok(
      !local.some((c) => c.route === "/api/analysis/run"),
      "declined: nothing runs",
    );
    await service.start({
      text: "Analyze my footage",
      selectedLayerIds: [],
      frame: 0,
    });
    await until(() => !!service.state().confirmation);
    service.approve(service.state().confirmation!.id, true);
    await until(() => !service.state().active);
    const runCall = local.find((c) => c.route === "/api/analysis/run");
    assert.ok(runCall);
    assert.deepEqual(
      (({ tier, confirmed, allowUpload }) => ({
        tier,
        confirmed,
        allowUpload,
      }))(JSON.parse(runCall!.body!)),
      { tier: "balanced", confirmed: true, allowUpload: true },
    );
  } finally {
    service.stop();
    clearInterval(timer);
    await service.flush();
    await rm(data, { recursive: true, force: true });
  }
});
