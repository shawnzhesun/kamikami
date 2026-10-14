import {
  writtenSummary,
  isManual,
  manualFields,
  type AnalysisEntry,
  type AssetAnalysis,
} from "../../src/asset-analysis";
import type { MediaAsset } from "../../src/media";

export const analysisSections = [
  "overview",
  "transcript",
  "words",
  "shots",
  "frames",
  "audio",
  "image",
  "all",
] as const;
export type AnalysisSection = (typeof analysisSections)[number];

const inRange = (a: number, b: number, start: number, end: number) =>
  b > start && a < end;

/**
 * Agent-sized views of a sidecar. "overview" is small; detailed sections are
 * sliced to [start, end) so long media never floods the context.
 */
export function sliceAnalysis(
  analysis: AssetAnalysis,
  section: AnalysisSection = "overview",
  start = 0,
  end = Number.POSITIVE_INFINITY,
) {
  const s = Math.max(0, start),
    e = Math.max(s, end);
  const transcript = analysis.transcript;
  const overview = {
    type: analysis.type,
    // Probe facts are already in probe, loudness and counts.
    summary: writtenSummary(analysis),
    ...(analysis.description ? { description: analysis.description } : {}),
    tags: analysis.summary?.tags ?? [],
    probe: analysis.probe,
    counts: {
      shots: analysis.visual?.shots.length ?? 0,
      frames: analysis.visual?.samples?.length ?? 0,
      words: transcript?.words.length ?? 0,
      silences: analysis.audio?.silences.length ?? 0,
    },
    loudness: analysis.audio
      ? {
          lufs: analysis.audio.lufs,
          truePeak: analysis.audio.truePeak,
          silent: analysis.audio.silent,
        }
      : null,
    scenes: analysis.scenes ?? [],
    sections: analysis.sections ?? [],
    language: transcript?.language,
    image: analysis.image ?? null,
    analyzed: Object.keys(analysis.provenance).filter(
      (k) => !k.startsWith("manual."),
    ),
    // Fields written by the user or assistant; automatic analysis keeps them.
    manual: manualFields.filter((f) => isManual(analysis, f)),
  };
  const words = (transcript?.words ?? []).filter((w) =>
    inRange(w.s, w.e, s, e),
  );
  const parts = {
    transcript: (transcript?.segments ?? []).filter((x) =>
      inRange(x.start, x.end, s, e),
    ),
    // Words are capped; ask for a narrower range to see more.
    words: words.slice(0, 3000),
    wordsTruncated: words.length > 3000,
    shots: (analysis.visual?.shots ?? []).filter((x) =>
      inRange(x.start, x.end, s, e),
    ),
    frames: (analysis.visual?.samples ?? []).filter((x) => x.t >= s && x.t < e),
    audio: analysis.audio
      ? {
          ...overview.loudness,
          silences: analysis.audio.silences.filter(([a, b]) =>
            inRange(a, b, s, e),
          ),
          activeRatio: analysis.audio.activeRatio,
        }
      : null,
    black: (analysis.visual?.black ?? []).filter(([a, b]) =>
      inRange(a, b, s, e),
    ),
    freeze: (analysis.visual?.freeze ?? []).filter(([a, b]) =>
      inRange(a, b, s, e),
    ),
  };
  if (section === "overview") return overview;
  if (section === "transcript")
    return {
      transcript: parts.transcript,
      language: transcript?.language ?? null,
    };
  if (section === "words")
    return { words: parts.words, truncated: parts.wordsTruncated };
  if (section === "shots")
    return { shots: parts.shots, black: parts.black, freeze: parts.freeze };
  if (section === "frames") return { frames: parts.frames };
  if (section === "audio") return { audio: parts.audio };
  if (section === "image") return { image: analysis.image ?? null };
  return { ...overview, ...parts };
}

export type SearchHit = {
  where: string;
  text: string;
  start?: number;
  end?: number;
};
const normalize = (text: string) =>
  text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Keyword search across names, summaries, tags, captions, on-screen text and transcripts. */
export function searchAnalyses(
  query: string,
  items: { asset: MediaAsset; analysis: AssetAnalysis | null }[],
  limit = 10,
) {
  const terms = normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
  if (!terms.length) return [];
  const score = (text: string) => {
    const n = normalize(text);
    return terms.reduce((sum, t) => sum + (n.includes(t) ? 1 : 0), 0);
  };
  const results = items.map(({ asset, analysis }) => {
    const hits: (SearchHit & { score: number })[] = [];
    const add = (where: string, text: string, range?: [number, number]) => {
      const value = score(text);
      if (value)
        hits.push({
          where,
          text: text.slice(0, 200),
          score: value,
          ...(range ? { start: range[0], end: range[1] } : {}),
        });
    };
    add("name", asset.name);
    if (analysis) {
      if (analysis.summary)
        add(
          "summary",
          `${analysis.summary.text} ${analysis.summary.tags.join(" ")}`,
        );
      if (analysis.description) add("description", analysis.description);
      if (analysis.image)
        add(
          "image",
          `${analysis.image.caption} ${analysis.image.details} ${analysis.image.ocr.join(" ")}`,
        );
      for (const f of analysis.visual?.samples ?? [])
        add("frame", `${f.caption} ${f.text}`, [f.t, f.t]);
      for (const x of analysis.transcript?.segments ?? [])
        add("transcript", x.text, [x.start, x.end]);
      for (const x of analysis.scenes ?? [])
        add("scene", x.title, [x.start, x.end]);
    }
    hits.sort((a, b) => b.score - a.score);
    return {
      src: asset.src,
      name: asset.name,
      type: asset.type,
      score: hits.reduce((sum, h) => sum + h.score, 0),
      hits: hits.slice(0, 5).map(({ score: _score, ...h }) => h),
    };
  });
  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** The always-in-context library digest: one line per asset, capped. */
export function libraryDigest(
  assets: MediaAsset[],
  entries: Record<string, AnalysisEntry>,
  maxChars = 6000,
) {
  const lines: string[] = [];
  let length = 0;
  for (const asset of assets.filter((a) => !a.deleted && !a.missing)) {
    const entry = entries[asset.src];
    const status = entry?.status ?? "none";
    const line = `- ${asset.src} "${asset.name}" ${asset.type}${entry?.summary ? `: ${entry.summary}` : ""}${status === "ready" ? "" : ` [analysis: ${status}]`}`;
    if (length + line.length > maxChars) {
      lines.push(
        `- …${assets.length - lines.length} more assets; use search_assets.`,
      );
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join("\n");
}
