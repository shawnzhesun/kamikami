import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  ANALYSIS_SCHEMA_VERSION,
  PROBE_ANALYZER_VERSION,
  type AssetAnalysis,
  type AudioStats,
  type Probe,
  type VisualStats,
} from "../../src/asset-analysis";
import { ffmpegPath, ffprobePath, run } from "./ffmpeg";

/** Probe thresholds, part of the cache key so tuning them invalidates old results. */
export const PROBE_PARAMS = {
  scene: 0.3,
  minShot: 0.25,
  silenceDb: -45,
  silenceMin: 0.4,
  blackMin: 0.4,
  freezeMin: 1,
} as const;
export const probeParamsHash = () =>
  createHash("sha1")
    .update(JSON.stringify(PROBE_PARAMS))
    .digest("hex")
    .slice(0, 12);

export async function sha256File(file: string, signal?: AbortSignal) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file, { signal }))
    hash.update(chunk);
  return hash.digest("hex");
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const fraction = (value?: string) => {
  if (!value || value === "0/0") return null;
  const [a, b] = value.split("/").map(Number);
  const n = b ? a / b : a;
  return Number.isFinite(n) && n > 0 ? n : null;
};

type FfprobeStream = {
  index: number;
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  disposition?: { attached_pic?: number };
  tags?: Record<string, string>;
  side_data_list?: { rotation?: number }[];
};
export async function probeStreams(
  file: string,
  signal?: AbortSignal,
): Promise<Probe> {
  const { stdout, code, stderr } = await run(
    ffprobePath(),
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      file,
    ],
    { signal, timeoutMs: 60_000 },
  );
  if (code !== 0)
    throw new Error(`ffprobe failed: ${stderr.trim().slice(0, 200)}`);
  const json = JSON.parse(stdout) as {
    streams?: FfprobeStream[];
    format?: { format_name?: string; duration?: string; size?: string };
  };
  const streams = json.streams ?? [];
  const video = streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
  );
  const durationValue = Number(json.format?.duration);
  const stillImage =
    !!video && /^(png|mjpeg|webp|gif|bmp|tiff)$/.test(video.codec_name ?? "");
  return {
    container: json.format?.format_name,
    duration:
      Number.isFinite(durationValue) && durationValue > 0 && !stillImage
        ? round(durationValue)
        : null,
    size: Number(json.format?.size) || (await stat(file)).size,
    video: video
      ? {
          codec: video.codec_name ?? "unknown",
          width: video.width ?? 1,
          height: video.height ?? 1,
          fps: stillImage
            ? null
            : (fraction(video.avg_frame_rate) ?? fraction(video.r_frame_rate)),
          rotation:
            video.side_data_list?.find((d) => typeof d.rotation === "number")
              ?.rotation ?? Number(video.tags?.rotate ?? 0),
          alpha:
            /a/.test(
              (video.pix_fmt ?? "").replace(/^(gray|yuvj?|nv|p0)/, ""),
            ) ||
            /^(rgba|bgra|argb|abgr|ya|yuva|pal8)/.test(video.pix_fmt ?? ""),
        }
      : null,
    audioTracks: streams
      .filter((s) => s.codec_type === "audio")
      .map((s, i) => ({
        index: i,
        codec: s.codec_name ?? "unknown",
        sampleRate: Number(s.sample_rate) || null,
        channels: s.channels ?? 0,
        ...(s.tags?.language ? { language: s.tags.language } : {}),
        ...(s.tags?.title ? { title: s.tags.title.slice(0, 120) } : {}),
      })),
  };
}

/** Loudness (EBU R128 integrated + true peak) and silences of one audio track. */
export async function audioStats(
  file: string,
  duration: number,
  track = 0,
  signal?: AbortSignal,
): Promise<AudioStats> {
  const { stderr } = await run(
    ffmpegPath(),
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-map",
      `0:a:${track}`,
      "-af",
      `ebur128=peak=true:framelog=quiet,silencedetect=n=${PROBE_PARAMS.silenceDb}dB:d=${PROBE_PARAMS.silenceMin}`,
      "-f",
      "null",
      "-",
    ],
    { signal },
  );
  const integrated = Number(/I:\s+(-?[\d.]+) LUFS/.exec(stderr)?.[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(stderr)?.[1]);
  const silences: [number, number][] = [];
  let open: number | null = null;
  for (const line of stderr.split("\n")) {
    const start = /silence_start: (-?[\d.]+)/.exec(line);
    const end = /silence_end: (-?[\d.]+)/.exec(line);
    if (start) open = Math.max(0, Number(start[1]));
    if (end && open !== null) {
      silences.push([round(open), round(Math.min(duration, Number(end[1])))]);
      open = null;
    }
  }
  if (open !== null && duration > open)
    silences.push([round(open), round(duration)]);
  const silentTime = silences.reduce(
    (sum, [a, b]) => sum + Math.max(0, b - a),
    0,
  );
  // −70 LUFS is the R128 gate floor: treat it (or nothing measurable) as silence.
  const silent = !Number.isFinite(integrated) || integrated <= -60;
  return {
    lufs: silent ? null : round(integrated),
    truePeak: silent || !Number.isFinite(peak) ? null : round(peak),
    silent,
    silences,
    activeRatio:
      duration > 0 ? Math.max(0, Math.min(1, 1 - silentTime / duration)) : 0,
  };
}

/** Shot cuts, black and frozen spans, decoded at low resolution in one pass. */
export async function visualStats(
  file: string,
  duration: number,
  signal?: AbortSignal,
): Promise<VisualStats> {
  const { stderr } = await run(
    ffmpegPath(),
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-filter_complex",
      `[0:v:0]scale=320:-2,split=2[a][b];[a]select='gt(scene,${PROBE_PARAMS.scene})',showinfo[s];[b]blackdetect=d=${PROBE_PARAMS.blackMin}:pix_th=0.10,freezedetect=n=-60dB:d=${PROBE_PARAMS.freezeMin}[t]`,
      "-map",
      "[s]",
      "-f",
      "null",
      "-",
      "-map",
      "[t]",
      "-f",
      "null",
      "-",
    ],
    { signal },
  );
  const cuts: number[] = [];
  for (const m of stderr.matchAll(/Parsed_showinfo[^\n]*pts_time:([\d.]+)/g)) {
    const t = Number(m[1]);
    if (
      t > PROBE_PARAMS.minShot &&
      t < duration - PROBE_PARAMS.minShot &&
      (!cuts.length || t - cuts.at(-1)! >= PROBE_PARAMS.minShot)
    )
      cuts.push(round(t));
  }
  const edges = [0, ...cuts, round(duration)];
  const shots = edges
    .slice(0, -1)
    .map((start, i) => ({ i, start, end: edges[i + 1] }));
  const black = [
    ...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g),
  ].map(
    (m) =>
      [round(Number(m[1])), round(Math.min(duration, Number(m[2])))] as [
        number,
        number,
      ],
  );
  const freeze: [number, number][] = [];
  let open: number | null = null;
  for (const m of stderr.matchAll(/freeze_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") open = Number(m[2]);
    else if (open !== null) {
      freeze.push([round(open), round(Number(m[2]))]);
      open = null;
    }
  }
  if (open !== null && duration > open)
    freeze.push([round(open), round(duration)]);
  return { shots, black, freeze };
}

/** Free, local stage: hash, streams, loudness, silences, shots, black/freeze. */
export async function probeAsset(
  file: string,
  type: AssetAnalysis["type"],
  signal?: AbortSignal,
  sha256?: string,
): Promise<AssetAnalysis> {
  const hash = sha256 ?? (await sha256File(file, signal));
  const probe = await probeStreams(file, signal);
  const createdAt = new Date().toISOString();
  const provenance = {
    analyzer: "ffmpeg",
    version: PROBE_ANALYZER_VERSION,
    paramsHash: probeParamsHash(),
    createdAt,
  };
  const analysis: AssetAnalysis = {
    schema: ANALYSIS_SCHEMA_VERSION,
    sha256: hash,
    type,
    probe,
    provenance: { probe: provenance },
  };
  const duration = probe.duration ?? 0;
  if (duration > 0 && probe.audioTracks.length) {
    analysis.audio = await audioStats(file, duration, 0, signal);
    analysis.provenance.audio = provenance;
  }
  if (type === "video" && probe.video && duration > 0) {
    analysis.visual = await visualStats(file, duration, signal);
    analysis.provenance.visual = provenance;
  }
  return analysis;
}
