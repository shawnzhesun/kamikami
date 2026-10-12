import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ImageDescriptionSchema,
  probeSummary,
  type AnalysisSettings,
  type AnalysisTier,
  type AssetAnalysis,
} from "../../src/asset-analysis";
import { ffmpegPath, run } from "./ffmpeg";
import {
  askJson,
  providerHost,
  transcribeAudio,
  type ProviderConnection,
} from "./provider";
import type { AnalysisStage } from "./queue";
import { alignLyrics } from "./align";

export const LOOK_VERSION = "look-1.0.0";
export const TRANSCRIBE_VERSION = "transcribe-1.0.0";
export const SUMMARIZE_VERSION = "summarize-1.0.0";

/** Thrown when a stage cannot run yet (no connection, no consent); the asset becomes partial. */
export class SkipStage extends Error {}

export type StageDeps = {
  connection: () => ProviderConnection | null;
  settings: () => Promise<AnalysisSettings>;
  fontFile: string;
  fetcher?: typeof fetch;
};

const sampling: Record<AnalysisTier, { interval: number; cap: number }> = {
  probe: { interval: 0, cap: 0 },
  transcribe: { interval: 0, cap: 0 },
  balanced: { interval: 10, cap: 100 },
  full: { interval: 4, cap: 300 },
};
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Sample times: one per shot, plus more inside long shots; evenly capped. */
export function sampleTimes(analysis: AssetAnalysis, tier: AnalysisTier) {
  const { interval, cap } = sampling[tier];
  if (!cap) return [];
  const duration = analysis.probe.duration ?? 0;
  const shots = analysis.visual?.shots.length
    ? analysis.visual.shots
    : [{ i: 0, start: 0, end: duration }];
  const times: number[] = [];
  for (const shot of shots) {
    const span = Math.max(0, shot.end - shot.start);
    const n = Math.max(1, Math.ceil(span / interval));
    for (let k = 0; k < n; k++)
      times.push(round(shot.start + (span * (k + 0.5)) / n));
  }
  if (times.length <= cap) return times;
  return Array.from(
    { length: cap },
    (_, i) => times[Math.floor((i * times.length) / cap)],
  );
}

async function connectionFor(deps: StageDeps, kind: string) {
  const connection = deps.connection();
  if (!connection?.apiKey)
    throw new SkipStage(`Connect the assistant to run ${kind}.`);
  const settings = await deps.settings();
  if (!settings.consent[providerHost(connection)])
    throw new SkipStage(
      `Allow ${providerHost(connection)} to receive media in Assistant settings to run ${kind}.`,
    );
  return { connection, settings };
}

async function grabFrame(
  file: string,
  t: number,
  out: string,
  signal: AbortSignal,
) {
  const { code, stderr } = await run(
    ffmpegPath(),
    [
      "-v",
      "error",
      "-y",
      "-ss",
      String(t),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=384:216:force_original_aspect_ratio=decrease,pad=384:216:(ow-iw)/2:(oh-ih)/2:color=black",
      "-q:v",
      "5",
      out,
    ],
    { signal, timeoutMs: 60_000 },
  );
  if (code !== 0)
    throw new Error(`Frame extraction failed: ${stderr.slice(0, 160)}`);
}

/** Up to 12 labelled frames in a 4-column grid, one JPEG per vision request. */
async function contactSheet(
  frames: { file: string; label: string }[],
  out: string,
  fontFile: string,
  signal: AbortSignal,
) {
  const font = fontFile.replace(/\\/g, "/").replace(/:/g, "\\:");
  const inputs = frames.flatMap((f) => ["-i", f.file]);
  const labelled = frames
    .map(
      (f, i) =>
        `[${i}:v]drawtext=fontfile='${font}':text='${f.label.replace(/[':\\]/g, "")}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4[l${i}]`,
    )
    .join(";");
  const layout = frames
    .map((_, i) => `${(i % 4) * 384}_${Math.floor(i / 4) * 216}`)
    .join("|");
  const graph =
    frames.length > 1
      ? `${labelled};${frames.map((_, i) => `[l${i}]`).join("")}xstack=inputs=${frames.length}:layout=${layout}:fill=black[out]`
      : `${labelled};[l0]null[out]`;
  const { code, stderr } = await run(
    ffmpegPath(),
    [
      "-v",
      "error",
      "-y",
      ...inputs,
      "-filter_complex",
      graph,
      "-map",
      "[out]",
      "-frames:v",
      "1",
      "-q:v",
      "4",
      out,
    ],
    { signal, timeoutMs: 60_000 },
  );
  if (code !== 0)
    throw new Error(`Contact sheet failed: ${stderr.slice(0, 160)}`);
}

const FramesReply = z.object({
  frames: z.array(
    z.object({
      n: z.coerce.number().int(),
      caption: z.string().max(400),
      text: z.string().max(300).optional().default(""),
    }),
  ),
});

export function lookStage(deps: StageDeps): AnalysisStage {
  return {
    name: "look",
    tiers: ["balanced", "full"],
    applies: (a) => a.type !== "audio",
    async run(analysis, { file, signal, tier, name }) {
      const { connection, settings } = await connectionFor(
        deps,
        "visual descriptions",
      );
      const model = settings.visionModel || connection.model;
      const done = analysis.provenance.look;
      if (
        done?.version === LOOK_VERSION &&
        done.model === model &&
        done.paramsHash === `${tier}:${settings.language}`
      )
        return analysis;
      const dir = await mkdtemp(path.join(tmpdir(), "kamikami-look-"));
      try {
        if (analysis.type === "image") {
          const out = path.join(dir, "image.jpg");
          const { code } = await run(
            ffmpegPath(),
            [
              "-v",
              "error",
              "-y",
              "-i",
              file,
              "-frames:v",
              "1",
              "-vf",
              "scale='min(768,iw)':-2",
              "-q:v",
              "4",
              out,
            ],
            { signal },
          );
          if (code !== 0)
            throw new Error("Could not prepare the image for analysis.");
          const reply = await askJson(
            connection,
            `Describe this image for a video editor's assistant. Write all prose in ${settings.language}. Return only JSON: {"caption": "≤20 words, concrete", "details": "2-4 sentences: subjects, setting, style, mood, composition", "ocr": ["visible text, verbatim"], "colors": ["#rrggbb dominant colors, up to 5"], "subject": [x, y, w, h] main subject box in 0-1 coordinates or null, "safeTextRegion": "top|bottom|left|right|center|none" (largest calm area for overlaid text), "tags": ["up to 8 short tags"]}`,
            [await readFile(out)],
            { model, signal, fetcher: deps.fetcher },
          );
          const parsed = ImageDescriptionSchema.extend({
            tags: z.array(z.string().max(40)).max(20).optional(),
          }).parse(reply);
          const { tags, ...image } = parsed;
          analysis = {
            ...analysis,
            image,
            ...(tags ? { summary: { text: image.caption, tags } } : {}),
          };
        } else {
          const times = sampleTimes(analysis, tier);
          const samples: { t: number; caption: string; text: string }[] = [];
          for (let start = 0; start < times.length; start += 12) {
            signal.throwIfAborted();
            const group = times.slice(start, start + 12);
            const frames = [];
            for (const [i, t] of group.entries()) {
              const out = path.join(dir, `f${start + i}.jpg`);
              await grabFrame(file, t, out, signal);
              frames.push({
                file: out,
                label: `#${start + i + 1} ${t.toFixed(1)}s`,
              });
            }
            const sheet = path.join(dir, `sheet${start}.jpg`);
            await contactSheet(frames, sheet, deps.fontFile, signal);
            const reply = FramesReply.parse(
              await askJson(
                connection,
                `This is a contact sheet of ${frames.length} frames from the video "${name}", in reading order (left to right, top to bottom). Each frame is labelled #number and its timestamp. For each frame, write a concrete caption (≤20 words: subjects, setting, action, shot size) and any legible on-screen text. Write captions in ${settings.language}; keep on-screen text verbatim. Return only JSON: {"frames": [{"n": number, "caption": string, "text": string}]}`,
                [await readFile(sheet)],
                { model, signal, fetcher: deps.fetcher },
              ),
            );
            for (const [i, t] of group.entries()) {
              // Frames are labelled with global numbers; accept per-sheet numbering too.
              const frame =
                reply.frames.find((f) => f.n === start + i + 1) ??
                (reply.frames.every((f) => f.n <= group.length)
                  ? reply.frames.find((f) => f.n === i + 1)
                  : undefined);
              if (frame)
                samples.push({
                  t,
                  caption: frame.caption,
                  text: frame.text ?? "",
                });
            }
          }
          const visual = analysis.visual ?? {
            shots: [],
            black: [],
            freeze: [],
          };
          analysis = {
            ...analysis,
            visual: {
              ...visual,
              samples,
              shots: visual.shots.map((shot) => {
                const first = samples.find(
                  (s) => s.t >= shot.start && s.t < shot.end,
                );
                return first
                  ? { ...shot, caption: first.caption, keyframe: first.t }
                  : shot;
              }),
            },
          };
        }
        return {
          ...analysis,
          provenance: {
            ...analysis.provenance,
            look: {
              analyzer: "vision",
              version: LOOK_VERSION,
              model,
              endpoint: providerHost(connection),
              paramsHash: `${tier}:${settings.language}`,
              createdAt: new Date().toISOString(),
            },
          },
        };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Chunk boundaries ≤ maxSeconds, cut at the silence nearest each target. */
export function chunkPlan(
  duration: number,
  silences: [number, number][],
  maxSeconds = 600,
) {
  const cuts = [0];
  while (duration - cuts.at(-1)! > maxSeconds) {
    const target = cuts.at(-1)! + maxSeconds;
    const near = silences
      .map(([a, b]) => (a + b) / 2)
      .filter((m) => m > cuts.at(-1)! + maxSeconds * 0.5 && m <= target)
      .at(-1);
    cuts.push(round(near ?? target));
  }
  cuts.push(round(duration));
  return cuts.slice(0, -1).map((start, i) => ({ start, end: cuts[i + 1] }));
}

export function transcribeStage(deps: StageDeps): AnalysisStage {
  return {
    name: "transcript",
    tiers: ["transcribe", "balanced", "full"],
    // Opt-in: only applies when transcription is enabled and there is audible audio.
    applies: async (a) =>
      (await deps.settings()).transcriptionEnabled &&
      a.probe.audioTracks.length > 0 &&
      !!a.audio &&
      !a.audio.silent,
    async run(analysis, { file, signal, prompt }) {
      const { connection, settings } = await connectionFor(
        deps,
        "transcription",
      );
      const done = analysis.provenance.transcript;
      if (
        done?.version === TRANSCRIBE_VERSION &&
        done.model === settings.transcriptionModel &&
        !prompt
      )
        return analysis;
      const duration = analysis.probe.duration ?? 0;
      const words: { t: string; s: number; e: number }[] = [];
      const segments: { start: number; end: number; text: string }[] = [];
      let language: string | undefined;
      for (const chunk of chunkPlan(duration, analysis.audio?.silences ?? [])) {
        signal.throwIfAborted();
        // Mono 16 kHz MP3 keeps ten minutes well under the 25 MB upload limit.
        const { bytes, code, stderr } = await run(
          ffmpegPath(),
          [
            "-v",
            "error",
            "-ss",
            String(chunk.start),
            "-t",
            String(chunk.end - chunk.start),
            "-i",
            file,
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "48k",
            "-f",
            "mp3",
            "pipe:1",
          ],
          { signal },
        );
        if (code !== 0)
          throw new Error(`Audio extraction failed: ${stderr.slice(0, 160)}`);
        const part = await transcribeAudio(connection, bytes, {
          model: settings.transcriptionModel,
          prompt,
          signal,
          fetcher: deps.fetcher,
        });
        language ??= part.language;
        for (const w of part.words)
          words.push({
            t: w.t,
            s: round(w.s + chunk.start),
            e: round(w.e + chunk.start),
          });
        for (const s of part.segments)
          segments.push({
            start: round(s.start + chunk.start),
            end: round(s.end + chunk.start),
            text: s.text,
          });
      }
      // Pasted lyrics: keep the user's words and line breaks, timed by alignment.
      const aligned = prompt?.trim()
        ? alignLyrics(prompt, words, analysis.probe.duration ?? 0)
        : null;
      return {
        ...analysis,
        transcript: aligned
          ? {
              ...(language ? { language } : {}),
              source: "lyrics" as const,
              alignment: { matched: aligned.matched, total: aligned.total },
              text: prompt!.trim(),
              segments: aligned.segments,
              words: aligned.words,
            }
          : {
              ...(language ? { language } : {}),
              source: "asr" as const,
              text:
                segments
                  .map((s) => s.text)
                  .join(" ")
                  .trim() || words.map((w) => w.t).join(" "),
              segments,
              words,
            },
        provenance: {
          ...analysis.provenance,
          transcript: {
            analyzer: "transcription",
            version: TRANSCRIBE_VERSION,
            model: settings.transcriptionModel,
            endpoint: providerHost(connection),
            createdAt: new Date().toISOString(),
          },
        },
      };
    },
  };
}

const SummaryReply = z.object({
  summary: z.string().max(600),
  tags: z.array(z.string().max(40)).max(20).default([]),
  scenes: z
    .array(
      z.object({
        start: z.coerce.number(),
        end: z.coerce.number(),
        title: z.string().max(120),
      }),
    )
    .max(500)
    .optional(),
  sections: z
    .array(
      z.object({
        start: z.coerce.number(),
        end: z.coerce.number(),
        label: z.string().max(40),
      }),
    )
    .max(200)
    .optional(),
});

export function summarizeStage(deps: StageDeps): AnalysisStage {
  return {
    name: "summary",
    tiers: ["balanced", "full"],
    async run(analysis, { signal, name }) {
      const { connection, settings } = await connectionFor(deps, "summaries");
      const facts: string[] = [
        `Asset "${name}" (${analysis.type}): ${probeSummary(analysis)}.`,
      ];
      if (analysis.image)
        facts.push(
          `Image: ${analysis.image.caption}. ${analysis.image.details}`,
        );
      const samples = analysis.visual?.samples ?? [];
      if (samples.length)
        facts.push(
          "Frames:\n" +
            samples
              .slice(0, 80)
              .map(
                (s) =>
                  `[${s.t.toFixed(1)}s] ${s.caption}${s.text ? ` (text: ${s.text})` : ""}`,
              )
              .join("\n"),
        );
      if (analysis.visual?.shots.length)
        facts.push(
          `Shot cuts at: ${analysis.visual.shots.map((s) => s.start.toFixed(1)).join(", ")} s`,
        );
      if (analysis.transcript)
        facts.push(
          "Transcript:\n" +
            analysis.transcript.segments
              .map(
                (s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`,
              )
              .join("\n")
              .slice(0, 4000),
        );
      // Inputs unchanged (same facts, language and model): keep the cached summary.
      const inputs = createHash("sha1")
        .update(
          `${settings.language}\n${connection.model}\n${facts.join("\n")}`,
        )
        .digest("hex")
        .slice(0, 16);
      const done = analysis.provenance.summary;
      if (done?.version === SUMMARIZE_VERSION && done.paramsHash === inputs)
        return analysis;
      const reply = SummaryReply.parse(
        await askJson(
          connection,
          `${facts.join("\n\n")}\n\nWrite metadata so a video-editing assistant can find and use this asset. Use only the facts above. Write in ${settings.language}. Return only JSON: {"summary": "one factual sentence, ≤40 words", "tags": ["≤8 short tags"], "scenes": [{"start": s, "end": s, "title": "short"}] (videos only: group consecutive shots into scenes), "sections": [{"start": s, "end": s, "label": "intro|verse|chorus|bridge|outro|speech|…"}] (only when there is a transcript of a song or talk)}`,
          [],
          { signal, fetcher: deps.fetcher },
        ),
      );
      const duration = analysis.probe.duration ?? 0;
      const clampRange = <T extends { start: number; end: number }>(
        list?: T[],
      ) =>
        list
          ?.map((r) => ({
            ...r,
            start: round(Math.max(0, Math.min(duration, r.start))),
            end: round(Math.max(0, Math.min(duration, r.end))),
          }))
          .filter((r) => r.end > r.start);
      return {
        ...analysis,
        summary: { text: reply.summary, tags: reply.tags.slice(0, 20) },
        ...(analysis.type === "video" && reply.scenes
          ? { scenes: clampRange(reply.scenes) }
          : {}),
        ...(analysis.transcript && reply.sections
          ? { sections: clampRange(reply.sections) }
          : {}),
        provenance: {
          ...analysis.provenance,
          summary: {
            analyzer: "summary",
            version: SUMMARIZE_VERSION,
            model: connection.model,
            endpoint: providerHost(connection),
            paramsHash: inputs,
            createdAt: new Date().toISOString(),
          },
        },
      };
    },
  };
}

export const modelStages = (deps: StageDeps) => [
  transcribeStage(deps),
  lookStage(deps),
  summarizeStage(deps),
];

export type AnalysisEstimate = {
  assets: number;
  images: number;
  videos: number;
  frames: number;
  sheets: number;
  transcriptionMinutes: number;
  modelCalls: number;
  uploadsTo: string | null;
};
/** Dry run: what a tier would send, without calling any model. */
export function estimate(
  items: {
    type: AssetAnalysis["type"];
    analysis: AssetAnalysis | null;
    duration: number | null;
  }[],
  tier: AnalysisTier,
  settings: AnalysisSettings,
  connection: ProviderConnection | null,
): AnalysisEstimate {
  const e: AnalysisEstimate = {
    assets: items.length,
    images: 0,
    videos: 0,
    frames: 0,
    sheets: 0,
    transcriptionMinutes: 0,
    modelCalls: 0,
    uploadsTo:
      tier === "probe" || !connection ? null : providerHost(connection),
  };
  for (const item of items) {
    const duration = item.analysis?.probe.duration ?? item.duration ?? 0;
    if (tier !== "probe" && tier !== "transcribe") {
      if (item.type === "image") {
        e.images++;
        e.modelCalls++;
      } else if (item.type === "video") {
        e.videos++;
        const frames = item.analysis
          ? sampleTimes(item.analysis, tier).length
          : Math.min(
              sampling[tier].cap,
              Math.max(1, Math.ceil(duration / sampling[tier].interval)),
            );
        e.frames += frames;
        e.sheets += Math.ceil(frames / 12);
        e.modelCalls += Math.ceil(frames / 12);
      }
      e.modelCalls++; // summary
    }
    const audible =
      item.type !== "image" &&
      (!item.analysis?.audio || !item.analysis.audio.silent);
    if (
      settings.transcriptionEnabled &&
      tier !== "probe" &&
      audible &&
      duration > 0
    ) {
      e.transcriptionMinutes += duration / 60;
      e.modelCalls += chunkPlan(
        duration,
        item.analysis?.audio?.silences ?? [],
      ).length;
    }
  }
  e.transcriptionMinutes = Math.round(e.transcriptionMinutes * 10) / 10;
  return e;
}
