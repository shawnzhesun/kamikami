import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Bundled ffmpeg/ffprobe (ffmpeg-static / ffprobe-static), overridable with
 * KAMIKAMI_FFMPEG / KAMIKAMI_FFPROBE. The bundled builds are GPL (ffmpeg also
 * nonfree): fine for development, but swap in a redistributable build before
 * shipping. See docs/asset-analysis-design.md.
 */
export function ffmpegPath(): string {
  if (process.env.KAMIKAMI_FFMPEG) return process.env.KAMIKAMI_FFMPEG;
  const bundled = require("ffmpeg-static") as string | null;
  if (!bundled) throw new Error("ffmpeg is unavailable for this platform.");
  return bundled;
}
export function ffprobePath(): string {
  if (process.env.KAMIKAMI_FFPROBE) return process.env.KAMIKAMI_FFPROBE;
  return (require("ffprobe-static") as { path: string }).path;
}

export type RunResult = {
  stdout: string;
  stderr: string;
  code: number;
  /** Raw stdout, for binary output such as encoded audio. */
  bytes: Buffer;
};
/** Run a binary with an abort signal and a timeout; never goes through a shell. */
export function run(
  binary: string,
  args: string[],
  {
    signal,
    timeoutMs = 10 * 60_000,
  }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "",
      size = 0;
    const chunks: Buffer[] = [];
    const limit = 256 * 1024 * 1024;
    child.stdout.on("data", (d: Buffer) => {
      if (size < limit) {
        chunks.push(d);
        size += d.length;
      }
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < 32 * 1024 * 1024) stderr += d;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    const abort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) reject(new Error("Analysis canceled"));
      else {
        const bytes = Buffer.concat(chunks);
        resolve({
          stdout: bytes.toString("utf8"),
          bytes,
          stderr,
          code: code ?? -1,
        });
      }
    });
  });
}

/** Extract one audio track to AAC (browsers only play a video's first track). */
export async function extractAudioTrack(
  input: string,
  output: string,
  track = 0,
  signal?: AbortSignal,
) {
  const { code, stderr } = await run(
    ffmpegPath(),
    [
      "-v",
      "error",
      "-y",
      "-i",
      input,
      "-map",
      `0:a:${track}`,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      output,
    ],
    { signal },
  );
  if (code !== 0)
    throw new Error(
      `Audio extraction failed: ${stderr.trim().slice(0, 200) || "no such audio track"}`,
    );
}

/**
 * Two-pass EBU R128 loudness normalization of a rendered file: measure, then
 * apply linear gain toward the target with a −1.5 dBTP ceiling. Video is copied.
 */
export async function normalizeLoudness(
  input: string,
  output: string,
  target: number,
  signal?: AbortSignal,
) {
  const filter = `loudnorm=I=${target}:TP=-1.5:LRA=11`;
  const measure = await run(
    ffmpegPath(),
    [
      "-hide_banner",
      "-nostats",
      "-i",
      input,
      "-map",
      "0:a:0",
      "-af",
      `${filter}:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    { signal },
  );
  const json = /\{[\s\S]*"input_i"[\s\S]*\}/.exec(measure.stderr)?.[0];
  if (!json)
    throw new Error(
      "Loudness measurement failed (does the export have audio?).",
    );
  const m = JSON.parse(json) as Record<string, string>;
  // Silence measures as -inf: nothing to normalize.
  if (!Number.isFinite(Number(m.input_i))) return false;
  const { code, stderr } = await run(
    ffmpegPath(),
    [
      "-v",
      "error",
      "-y",
      "-i",
      input,
      "-map",
      "0:v?",
      "-map",
      "0:a:0",
      "-c:v",
      "copy",
      "-af",
      `${filter}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      "-ar",
      "48000",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      output,
    ],
    { signal },
  );
  if (code !== 0)
    throw new Error(`Loudness normalization failed: ${stderr.slice(0, 200)}`);
  return true;
}
