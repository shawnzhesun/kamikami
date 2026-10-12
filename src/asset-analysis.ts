import { z } from "zod";

/**
 * Agent-friendly media analysis, stored per content hash in
 * `.kamikami/analysis/<sha256>.json`. Times are asset-relative seconds
 * (3 decimals, half-open [start, end)). Each section records its provenance so
 * only stale sections are recomputed. See docs/asset-analysis-design.md.
 */
export const ANALYSIS_SCHEMA_VERSION = 1;
export const PROBE_ANALYZER_VERSION = "probe-1.0.0";

export const analysisTiers = [
  "probe",
  "transcribe",
  "balanced",
  "full",
] as const;
export type AnalysisTier = (typeof analysisTiers)[number];
export const analysisStatuses = [
  "none",
  "queued",
  "running",
  "ready",
  "partial",
  "stale",
  "error",
] as const;
export type AnalysisStatus = (typeof analysisStatuses)[number];

const time = z.number().min(0).max(360000);
const range = z.tuple([time, time]);
export const ProvenanceSchema = z
  .object({
    analyzer: z.string().max(80),
    version: z.string().max(40),
    model: z.string().max(120).optional(),
    endpoint: z.string().max(200).optional(),
    paramsHash: z.string().max(80).optional(),
    createdAt: z.string().max(40),
  })
  .strict();
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const ProbeSchema = z
  .object({
    container: z.string().max(80).optional(),
    duration: z.number().min(0).nullable(),
    size: z.number().int().min(0),
    video: z
      .object({
        codec: z.string().max(40),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        fps: z.number().positive().nullable(),
        rotation: z.number(),
        alpha: z.boolean(),
      })
      .strict()
      .nullable(),
    audioTracks: z
      .array(
        z
          .object({
            index: z.number().int().min(0),
            codec: z.string().max(40),
            sampleRate: z.number().int().positive().nullable(),
            channels: z.number().int().min(0),
            language: z.string().max(20).optional(),
            title: z.string().max(120).optional(),
          })
          .strict(),
      )
      .max(32),
  })
  .strict();
export type Probe = z.infer<typeof ProbeSchema>;

export const AudioStatsSchema = z
  .object({
    /** Integrated loudness (EBU R128) and true peak, or null when silent. */
    lufs: z.number().nullable(),
    truePeak: z.number().nullable(),
    silent: z.boolean(),
    silences: z.array(range).max(5000),
    /** Fraction of the duration that is not silence. */
    activeRatio: z.number().min(0).max(1),
  })
  .strict();
export type AudioStats = z.infer<typeof AudioStatsSchema>;

export const ShotSchema = z
  .object({
    i: z.number().int().min(0),
    start: time,
    end: time,
    /** Filled by the Look stage. */
    caption: z.string().max(400).optional(),
    keyframe: z.number().min(0).optional(),
  })
  .strict();
export const VisualStatsSchema = z
  .object({
    shots: z.array(ShotSchema).max(5000),
    /** Captioned frame samples from the Look stage (one or more per shot). */
    samples: z
      .array(
        z
          .object({
            t: time,
            caption: z.string().max(400),
            text: z.string().max(300),
          })
          .strict(),
      )
      .max(1000)
      .optional(),
    black: z.array(range).max(5000),
    freeze: z.array(range).max(5000),
  })
  .strict();
export type VisualStats = z.infer<typeof VisualStatsSchema>;

export const TranscriptSchema = z
  .object({
    language: z.string().max(20).optional(),
    /** "lyrics" when the user's pasted text was aligned to the recognized words. */
    source: z.enum(["asr", "lyrics", "manual"]).optional(),
    alignment: z
      .object({
        matched: z.number().int().min(0),
        total: z.number().int().min(0),
      })
      .strict()
      .optional(),
    text: z.string().max(200000),
    segments: z
      .array(
        z
          .object({ start: time, end: time, text: z.string().max(4000) })
          .strict(),
      )
      .max(20000),
    /** Word timings: t = text, s/e = start/end seconds. */
    words: z
      .array(
        z
          .object({
            t: z.string().max(200),
            s: time,
            e: time,
            /** Confidence 0–1 when known (lyrics alignment sets it). */
            p: z.number().min(0).max(1).optional(),
          })
          .strict(),
      )
      .max(100000),
  })
  .strict();
export type Transcript = z.infer<typeof TranscriptSchema>;
export const ImageDescriptionSchema = z
  .object({
    caption: z.string().max(300),
    details: z.string().max(1500),
    ocr: z.array(z.string().max(300)).max(50),
    colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(8),
    /** Main subject box in 0–1 image coordinates [x, y, w, h]. */
    subject: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .nullable(),
    safeTextRegion: z.enum([
      "top",
      "bottom",
      "left",
      "right",
      "center",
      "none",
    ]),
  })
  .strict();
export type ImageDescription = z.infer<typeof ImageDescriptionSchema>;

export const AnalysisSettingsSchema = z
  .object({
    /** Opt-in: transcription uploads audio to the provider. Off by default. */
    transcriptionEnabled: z.boolean().default(false),
    /** Also transcribe new imports automatically (requires transcriptionEnabled). */
    autoTranscribe: z.boolean().default(false),
    transcriptionModel: z.string().trim().min(1).max(120).default("whisper-1"),
    /** Empty means "use the assistant's chat model". */
    visionModel: z.string().trim().max(120).default(""),
    defaultTier: z.enum(analysisTiers).default("balanced"),
    /** Language for captions, descriptions and summaries (the UI language). */
    language: z.string().max(40).default("en"),
    /** Provider hosts the user has allowed to receive media for analysis. */
    consent: z.record(z.string().max(200), z.boolean()).default({}),
  })
  .strict();
export type AnalysisSettings = z.infer<typeof AnalysisSettingsSchema>;

export const AssetAnalysisSchema = z
  .object({
    schema: z.literal(ANALYSIS_SCHEMA_VERSION),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    type: z.enum(["image", "video", "audio"]),
    probe: ProbeSchema,
    audio: AudioStatsSchema.optional(),
    visual: VisualStatsSchema.optional(),
    transcript: TranscriptSchema.optional(),
    image: ImageDescriptionSchema.optional(),
    scenes: z
      .array(
        z
          .object({ start: time, end: time, title: z.string().max(120) })
          .strict(),
      )
      .max(500)
      .optional(),
    /** Music structure when the audio is a song (verse/chorus/…). */
    sections: z
      .array(
        z
          .object({ start: time, end: time, label: z.string().max(40) })
          .strict(),
      )
      .max(200)
      .optional(),
    /** Free-form description written by the user or assistant (manual metadata). */
    description: z.string().max(4000).optional(),
    /** Compact, always-injected line for the assistant's library digest. */
    summary: z
      .object({
        text: z.string().max(600),
        tags: z.array(z.string().max(40)).max(20),
      })
      .strict()
      .optional(),
    provenance: z.record(z.string().max(40), ProvenanceSchema),
  })
  .strict();
export type AssetAnalysis = z.infer<typeof AssetAnalysisSchema>;

/** Per-src status shown on media cards and in the assistant digest. */
export const AnalysisEntrySchema = z
  .object({
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    status: z.enum(analysisStatuses),
    tier: z.enum(analysisTiers).optional(),
    updatedAt: z.string().max(40).optional(),
    error: z.string().max(400).optional(),
    /** One-line summary so lists don't need to load full sidecars. */
    summary: z.string().max(600).optional(),
  })
  .strict();
export type AnalysisEntry = z.infer<typeof AnalysisEntrySchema>;

/** Probe-only digest line: useful before any model has run. */
export function probeSummary(a: AssetAnalysis): string {
  const parts: string[] = [];
  const d = a.probe.duration;
  if (d) parts.push(`${d.toFixed(1)}s`);
  if (a.probe.video)
    parts.push(
      `${a.probe.video.width}×${a.probe.video.height}${a.probe.video.fps ? ` @ ${Math.round(a.probe.video.fps * 100) / 100}fps` : ""}`,
    );
  if (a.visual && a.type === "video")
    parts.push(`${a.visual.shots.length} shots`);
  if (a.audio) {
    if (a.audio.silent) parts.push("silent audio");
    else {
      parts.push(`${Math.round(a.audio.activeRatio * 100)}% audio activity`);
      if (a.audio.lufs !== null) parts.push(`${a.audio.lufs.toFixed(1)} LUFS`);
    }
  }
  if (a.probe.audioTracks.length > 1)
    parts.push(`${a.probe.audioTracks.length} audio tracks`);
  return parts.join(", ");
}

/**
 * Manual metadata: descriptions, tags, scenes or transcripts written by the
 * user or the assistant (for example, from analysis done outside the app).
 * Each manual field records provenance `manual.<field>`; automatic analysis
 * skips or preserves those fields instead of overwriting them.
 */
export const manualFields = [
  "summary",
  "description",
  "scenes",
  "sections",
  "transcript",
  "image",
] as const;
export type ManualField = (typeof manualFields)[number];
const MANUAL = "manual.";
const timedText = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ start: time, end: time, ...shape }).strict();
export const AssetMetadataSchema = z
  .object({
    /** One factual line, shown to the assistant for every asset. */
    summary: z.string().trim().min(1).max(600).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    scenes: z
      .array(timedText({ title: z.string().trim().min(1).max(120) }))
      .max(500)
      .optional(),
    sections: z
      .array(timedText({ label: z.string().trim().min(1).max(40) }))
      .max(200)
      .optional(),
    transcript: z
      .object({
        language: z.string().max(20).optional(),
        segments: z
          .array(timedText({ text: z.string().trim().min(1).max(4000) }))
          .min(1)
          .max(20000),
        words: TranscriptSchema.shape.words.optional(),
      })
      .strict()
      .optional(),
    /** Image assets only; merged into any existing description. */
    image: ImageDescriptionSchema.partial().optional(),
    /** Remove these manual fields (automatic analysis may fill them again). */
    clear: z.array(z.enum(manualFields)).max(manualFields.length).optional(),
  })
  .strict();
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export const isManual = (a: AssetAnalysis, field: ManualField) =>
  !!a.provenance[MANUAL + field];

/** Merge manual metadata into an analysis; times are checked against the asset. */
export function applyMetadata(
  analysis: AssetAnalysis,
  input: AssetMetadata,
  author: string,
  now = new Date().toISOString(),
): { analysis: AssetAnalysis; fields: ManualField[] } {
  const next: AssetAnalysis = structuredClone(analysis);
  const fields: ManualField[] = [];
  const mark = (field: ManualField) => {
    fields.push(field);
    next.provenance[MANUAL + field] = {
      analyzer: "manual",
      version: "1",
      model: author.slice(0, 120),
      createdAt: now,
    };
  };
  for (const field of input.clear ?? []) {
    delete next[field];
    delete next.provenance[MANUAL + field];
  }
  const duration = analysis.probe.duration;
  const timed = <T extends { start: number; end: number }>(
    list: T[],
    what: string,
  ) => {
    if (analysis.type === "image")
      throw new Error(`Images have no timeline, so they cannot have ${what}.`);
    for (const item of list) {
      if (!(item.end > item.start))
        throw new Error(`Each ${what} range needs end > start.`);
      if (duration !== null && item.start >= duration + 0.05)
        throw new Error(
          `A ${what} range starts at ${item.start}s, after the asset ends (${duration.toFixed(2)}s).`,
        );
    }
    const round = (v: number) =>
      Math.round((duration === null ? v : Math.min(v, duration)) * 1000) / 1000;
    return list
      .map((item) => ({
        ...item,
        start: round(item.start),
        end: round(item.end),
      }))
      .filter((item) => item.end > item.start)
      .sort((a, b) => a.start - b.start);
  };
  if (input.summary !== undefined || input.tags !== undefined) {
    next.summary = {
      text: input.summary ?? next.summary?.text ?? entrySummary(next),
      tags: input.tags ?? next.summary?.tags ?? [],
    };
    mark("summary");
  }
  if (input.description !== undefined) {
    next.description = input.description;
    mark("description");
  }
  if (input.scenes) {
    if (analysis.type !== "video")
      throw new Error("Scenes are for video assets; use sections for audio.");
    next.scenes = timed(input.scenes, "scene");
    mark("scenes");
  }
  if (input.sections) {
    next.sections = timed(input.sections, "section");
    mark("sections");
  }
  if (input.transcript) {
    const segments = timed(input.transcript.segments, "transcript segment");
    next.transcript = {
      ...(input.transcript.language
        ? { language: input.transcript.language }
        : {}),
      source: "manual",
      text: segments.map((s) => s.text).join(" "),
      segments,
      words: input.transcript.words ?? [],
    };
    mark("transcript");
  }
  if (input.image) {
    if (analysis.type !== "image")
      throw new Error(
        "Image descriptions are for image assets; use description for audio and video.",
      );
    next.image = {
      caption: "",
      details: "",
      ocr: [],
      colors: [],
      subject: null,
      safeTextRegion: "none",
      ...next.image,
      ...input.image,
    };
    mark("image");
  }
  return { analysis: AssetAnalysisSchema.parse(next), fields };
}

/**
 * Carry manual fields from the latest stored analysis into a newly computed
 * one, so analysis that started before a manual edit never overwrites it.
 */
export function keepManual(
  latest: AssetAnalysis | null,
  next: AssetAnalysis,
): AssetAnalysis {
  if (!latest || latest.sha256 !== next.sha256) return next;
  const merged: AssetAnalysis = { ...next, provenance: { ...next.provenance } };
  for (const field of manualFields) {
    const key = MANUAL + field;
    if (latest.provenance[key]) {
      (merged as Record<string, unknown>)[field] = latest[field];
      merged.provenance[key] = latest.provenance[key];
    } else if (next.provenance[key]) {
      // Cleared manually since this analysis started.
      delete (merged as Record<string, unknown>)[field];
      delete merged.provenance[key];
    }
  }
  return merged;
}

/** The digest line: summary, else the description's first sentence, else probe facts. */
export function entrySummary(a: AssetAnalysis): string {
  if (a.summary?.text) return a.summary.text;
  if (a.description) {
    const first =
      a.description.match(/^.*?[.!?。！？](\s|$)/)?.[0] ?? a.description;
    return first.trim().slice(0, 600);
  }
  return probeSummary(a);
}
