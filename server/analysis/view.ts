import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpegPath, run } from "./ffmpeg";

/**
 * One PNG for a source range: evenly spaced, labelled frames over a waveform
 * strip, the editor's version of video-use's timeline_view. Used at decision
 * points only, never to scan whole files.
 */
export async function viewRange(
  file: string,
  kind: "video" | "audio" | "image",
  start: number,
  end: number,
  out: string,
  fontFile: string,
  {
    frames = 8,
    signal,
    labelOffset = 0,
  }: { frames?: number; signal?: AbortSignal; labelOffset?: number } = {},
) {
  const font = fontFile.replace(/\\/g, "/").replace(/:/g, "\\:");
  const span = Math.max(0.05, end - start);
  const dir = await mkdtemp(path.join(tmpdir(), "kamikami-view-"));
  try {
    const parts: string[] = [];
    if (kind !== "audio") {
      const count =
        kind === "image" ? 1 : Math.max(1, Math.min(12, Math.round(frames)));
      for (let i = 0; i < count; i++) {
        const t = kind === "image" ? 0 : start + (span * (i + 0.5)) / count;
        const frame = path.join(dir, `f${i}.png`);
        const seek = kind === "image" ? [] : ["-ss", String(t)];
        const label =
          kind === "image"
            ? ""
            : `,drawtext=fontfile='${font}':text='${(t + labelOffset).toFixed(2)}s':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4`;
        const { code, stderr } = await run(
          ffmpegPath(),
          [
            "-v",
            "error",
            "-y",
            ...seek,
            "-i",
            file,
            "-frames:v",
            "1",
            "-vf",
            `scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black${label}`,
            frame,
          ],
          { signal, timeoutMs: 60_000 },
        );
        if (code !== 0)
          throw new Error(`Frame extraction failed: ${stderr.slice(0, 160)}`);
        parts.push(frame);
      }
    }
    const columns = Math.min(4, Math.max(1, parts.length));
    const width = columns * 320;
    let wave: string | null = null;
    if (kind !== "image") {
      wave = path.join(dir, "wave.png");
      const { code } = await run(
        ffmpegPath(),
        [
          "-v",
          "error",
          "-y",
          "-ss",
          String(start),
          "-t",
          String(span),
          "-i",
          file,
          "-filter_complex",
          `[0:a:0]aformat=channel_layouts=mono,showwavespic=s=${Math.max(width, 640)}x120:colors=#f2765e:scale=sqrt:draw=full,drawtext=fontfile='${font}':text='${(start + labelOffset).toFixed(2)}s – ${(end + labelOffset).toFixed(2)}s':x=6:y=6:fontsize=16:fontcolor=white`,
          "-frames:v",
          "1",
          wave,
        ],
        { signal, timeoutMs: 60_000 },
      );
      if (code !== 0) wave = null; // No audio stream: frames only.
    }
    const inputs = [...parts, ...(wave ? [wave] : [])];
    if (!inputs.length) throw new Error("Nothing to show for this range.");
    const layout = parts
      .map((_, i) => `${(i % columns) * 320}_${Math.floor(i / columns) * 180}`)
      .join("|");
    const grid =
      parts.length > 1
        ? `${parts.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${parts.length}:layout=${layout}:fill=black[grid]`
        : parts.length
          ? "[0:v]null[grid]"
          : "";
    const graph = wave
      ? parts.length
        ? `${grid};[${parts.length}:v]scale=${width}:120[w];[grid][w]vstack=inputs=2[out]`
        : "[0:v]null[out]"
      : `${grid.replace("[grid]", "[out]")}`;
    const { code, stderr } = await run(
      ffmpegPath(),
      [
        "-v",
        "error",
        "-y",
        ...inputs.flatMap((f) => ["-i", f]),
        "-filter_complex",
        graph,
        "-map",
        "[out]",
        "-frames:v",
        "1",
        out,
      ],
      { signal, timeoutMs: 60_000 },
    );
    if (code !== 0)
      throw new Error(`Range view failed: ${stderr.slice(0, 160)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
