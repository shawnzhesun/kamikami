import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AnalysisStore } from "../server/analysis/store";
import { AnalysisQueue } from "../server/analysis/queue";
import { ffmpegPath, run } from "../server/analysis/ffmpeg";
import {
  chunkPlan,
  estimate,
  modelStages,
  sampleTimes,
} from "../server/analysis/stages";
import { parseJson } from "../server/analysis/provider";
import {
  AnalysisSettingsSchema,
  type AnalysisSettings,
} from "../src/asset-analysis";

const font = path.resolve("public/fonts/builtin/DejaVuSans-Bold.ttf");
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "kamikami-stages-"));
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
    "smptebars=duration=13:size=320x180:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=15",
    "-filter_complex",
    "[0:v][1:v]concat=n=2:v=1:a=0[v]",
    "-map",
    "[v]",
    "-map",
    "2:a",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    path.join(root, "media", "clip.mp4"),
  ]);
  await ff([
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:size=200x120",
    "-frames:v",
    "1",
    path.join(root, "media", "pic.png"),
  ]);
  return root;
}

/** Fake OpenAI-compatible provider: records requests and answers each endpoint. */
function provider(options: { words?: boolean } = {}) {
  const calls: { path: string; body: string }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const pathName = new URL(String(url)).pathname;
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ path: pathName, body });
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (pathName.endsWith("/audio/transcriptions"))
      return json({
        language: "english",
        text: "hello world",
        segments: [{ start: 0.5, end: 1.5, text: " hello world" }],
        ...(options.words === false
          ? {}
          : {
              words: [
                { word: "hello", start: 0.5, end: 0.9 },
                { word: "world", start: 1, end: 1.5 },
              ],
            }),
      });
    const prompt = body;
    let text: string;
    const sheet = /contact sheet of (\d+) frames/.exec(prompt);
    if (sheet) {
      const first = Number(/#(\d+) /.exec(prompt)?.[1] ?? 0); // labels are drawn, not in the prompt
      void first;
      const n = Number(sheet[1]);
      text = JSON.stringify({
        frames: Array.from({ length: n }, (_, i) => ({
          n: i + 1,
          caption: `frame ${i + 1}`,
          text: "",
        })),
      });
    } else if (prompt.includes("Describe this image"))
      text =
        '```json\n{"caption":"A blue card","details":"Solid blue.","ocr":[],"colors":["#0000ff"],"subject":null,"safeTextRegion":"center","tags":["blue"]}\n```';
    else
      text = JSON.stringify({
        summary: "A test pattern clip with a tone.",
        tags: ["test"],
        scenes: [{ start: 0, end: 99, title: "All" }],
      });
    if (pathName.endsWith("/chat/completions"))
      return json({
        id: "c",
        object: "chat.completion",
        created: 1,
        model: "m",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: text },
          },
        ],
      });
    return json({
      id: "r",
      object: "response",
      created_at: 1,
      model: "m",
      status: "completed",
      error: null,
      incomplete_details: null,
      output: [
        {
          type: "message",
          id: "m",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
    });
  }) as typeof fetch;
  return { calls, fetcher };
}

const connection = {
  apiKey: "k",
  baseURL: "https://api.test/v1",
  model: "vision-model",
  apiMode: "responses" as const,
};
function setup(
  root: string,
  settings: Partial<AnalysisSettings>,
  fake = provider(),
  apiMode: "responses" | "chat" = "responses",
) {
  const store = new AnalysisStore(root);
  const parsed = AnalysisSettingsSchema.parse(settings);
  const queue = new AnalysisQueue(
    store,
    root,
    modelStages({
      connection: () => ({ ...connection, apiMode }),
      settings: async () => parsed,
      fontFile: font,
      fetcher: fake.fetcher,
    }),
    2,
  );
  return { store, queue, fake };
}

test("balanced analysis: contact-sheet captions, opt-in transcript and summary", async () => {
  const root = await workspace();
  try {
    const { store, queue, fake } = setup(root, {
      transcriptionEnabled: true,
      consent: { "api.test": true },
      language: "fr",
    });
    queue.enqueue("/media/clip.mp4", "balanced");
    queue.enqueue("/media/pic.png", "balanced");
    await queue.idle();
    const clip = await store.entry("/media/clip.mp4");
    assert.equal(clip.status, "ready", clip.error);
    assert.equal(clip.summary, "A test pattern clip with a tone.");
    const a = (await store.read(clip.sha256!))!;
    // A 13 s shot gets two samples at the balanced 10 s interval.
    assert.equal(a.visual!.samples!.length, sampleTimes(a, "balanced").length);
    assert.ok(a.visual!.samples!.length >= 3);
    assert.equal(a.visual!.shots[0].caption, "frame 1");
    assert.deepEqual(
      a.transcript!.words.map((w) => w.t),
      ["hello", "world"],
    );
    assert.equal(
      a.scenes![0].end,
      a.probe.duration,
      "scene ranges are clamped to the asset",
    );
    assert.equal(a.provenance.look.model, "vision-model");
    // Captions are requested in the UI language.
    assert.ok(fake.calls.some((c) => c.body.includes("Write captions in fr")));
    assert.ok(fake.calls.some((c) => c.path.endsWith("/audio/transcriptions")));
    const pic = (await store.read(
      (await store.entry("/media/pic.png")).sha256!,
    ))!;
    assert.equal(pic.image!.caption, "A blue card");
    assert.ok(pic.image!.details.length > 0);
    // Re-running with the same settings reuses every model result.
    const before = fake.calls.length;
    queue.enqueue("/media/clip.mp4", "balanced");
    await queue.idle();
    assert.equal(
      fake.calls.length,
      before,
      "no model calls for unchanged inputs",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("transcription is opt-in; consent and word timings are required", async () => {
  const root = await workspace();
  try {
    const off = setup(root, { consent: { "api.test": true } });
    off.queue.enqueue("/media/clip.mp4", "balanced");
    await off.queue.idle();
    assert.ok(
      !off.fake.calls.some((c) => c.path.endsWith("/audio/transcriptions")),
      "no audio leaves without opt-in",
    );
    assert.equal((await off.store.entry("/media/clip.mp4")).status, "ready");
    const noConsent = setup(await workspace(), { transcriptionEnabled: true });
    noConsent.queue.enqueue("/media/clip.mp4", "transcribe");
    await noConsent.queue.idle();
    const entry = await noConsent.store.entry("/media/clip.mp4");
    assert.equal(entry.status, "partial");
    assert.match(entry.error!, /Allow api\.test to receive media/);
    assert.equal(noConsent.fake.calls.length, 0);
    const wordless = setup(
      await workspace(),
      { transcriptionEnabled: true, consent: { "api.test": true } },
      provider({ words: false }),
      "chat",
    );
    wordless.queue.enqueue("/media/clip.mp4", "transcribe");
    await wordless.queue.idle();
    assert.match(
      (await wordless.store.entry("/media/clip.mp4")).error!,
      /did not return word timings/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chunk plan, estimates and tolerant JSON parsing", () => {
  assert.deepEqual(chunkPlan(100, []), [{ start: 0, end: 100 }]);
  const plan = chunkPlan(1500, [
    [580, 590],
    [1100, 1110],
  ]);
  assert.deepEqual(
    plan.map((c) => c.start),
    [0, 585, 1105],
  );
  assert.ok(plan.every((c) => c.end - c.start <= 600));
  const settings = AnalysisSettingsSchema.parse({});
  assert.equal(settings.transcriptionEnabled, false);
  assert.equal(
    "autoTranscribe" in
      AnalysisSettingsSchema.parse({ autoTranscribe: true, language: "fr" }),
    false,
    "old settings files still parse",
  );
  assert.equal(settings.defaultTier, "balanced");
  const e = estimate(
    [
      { type: "video", duration: 120, analysis: null },
      { type: "image", duration: null, analysis: null },
    ],
    "balanced",
    settings,
    connection,
  );
  assert.equal(e.frames, 12);
  assert.equal(e.sheets, 1);
  assert.equal(e.transcriptionMinutes, 0, "transcription is off by default");
  assert.equal(e.uploadsTo, "api.test");
  assert.equal(estimate([], "probe", settings, connection).uploadsTo, null);
  const on = estimate(
    [{ type: "audio", duration: 90, analysis: null }],
    "transcribe",
    { ...settings, transcriptionEnabled: true },
    connection,
  );
  assert.equal(on.transcriptionMinutes, 1.5);
  assert.deepEqual(parseJson('Sure! ```json\n{"a":1}\n```'), { a: 1 });
});

test("pasted lyrics produce an aligned, line-based transcript", async () => {
  const root = await workspace();
  try {
    const { store, queue } = setup(root, {
      transcriptionEnabled: true,
      consent: { "api.test": true },
    });
    queue.enqueue("/media/clip.mp4", "transcribe", {
      prompt: "Hello world\nsee you soon",
    });
    await queue.idle();
    const entry = await store.entry("/media/clip.mp4");
    assert.equal(entry.status, "ready", entry.error);
    const t = (await store.read(entry.sha256!))!.transcript!;
    assert.equal(t.source, "lyrics");
    assert.deepEqual(
      t.segments.map((s) => s.text),
      ["Hello world", "see you soon"],
    );
    assert.deepEqual(t.alignment, { matched: 2, total: 5 });
    assert.equal(t.words[0].s, 0.5, "matched words take ASR timings");
    assert.ok(
      t.words.slice(2).every((w) => w.p === 0.4),
      "unheard lines are flagged",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
