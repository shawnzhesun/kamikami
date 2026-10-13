import { z } from "zod";
import { clamp01, effectRandom, smooth } from "./visual-effects";

/**
 * Artwork treatments (kamikami-visual-v8): camera moves, beat-locked hits,
 * lagged color copies and slices for images, video, shapes and backdrops
 * (camera moves also work on text). Framing marks are overlays. They stack with each other and with every other
 * effect. Beat kinds count beats from the project start at `tempo` BPM so
 * every element on the same tempo hits together.
 */
export const artCameraKinds = [
  "drift",
  "punch",
  "jolt",
  "stutter",
  "strobe",
] as const;
export const artCopyKinds = ["trail", "slices"] as const;
export const artKinds = [...artCameraKinds, ...artCopyKinds] as const;
export type ArtKind = (typeof artKinds)[number];
const includes = (list: readonly string[], kind: string) => list.includes(kind);
export const isCameraArt = (kind: string) => includes(artCameraKinds, kind);
/** Kinds drawn from the element's pixels; text has its own treatments. */
export const isFrameArt = (kind: string) => !isCameraArt(kind);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const ArtSchema = z
  .object({
    kind: z.enum(artKinds),
    color: hex,
    secondary: hex,
    /** Overall intensity, 0–1. */
    strength: z.number().min(0).max(1),
    /** Beats per minute for beat kinds and the beat slice timing. */
    tempo: z.number().min(30).max(240),
    /** Animation speed of drift and continuous slices. */
    speed: z.number().min(0).max(10),
    /** Offset or shift size as a fraction of the shorter frame side. */
    distance: z.number().min(0).max(1),
    /** Copies, slices, beats between strobes or stutter steps per second. */
    count: z.number().int().min(1).max(24),
    angle: z.number().min(-180).max(180),
    /** Decay of beat hits, copy lag, or slide length. */
    seconds: z.number().min(0.02).max(30),
    timing: z.enum(["constant", "beat", "in", "out"]),
    direction: z.enum(["horizontal", "vertical"]),
    seed: z.number().int().min(0).max(65535),
  })
  .strict();
export type Art = z.infer<typeof ArtSchema>;

export const artNames: Record<ArtKind, string> = {
  drift: "Handheld drift",
  punch: "Beat punch",
  jolt: "Beat jolt",
  stutter: "Stop-motion stutter",
  strobe: "Beat strobe",
  trail: "Color ghost trail",
  slices: "Slice shift",
};

const defaults: Record<ArtKind, Partial<Art>> = {
  drift: { strength: 0.5, distance: 0.012, speed: 0.6 },
  punch: { strength: 0.6, seconds: 0.22 },
  jolt: { strength: 0.6, distance: 0.02, seconds: 0.18 },
  stutter: { count: 8 },
  strobe: { strength: 1, count: 4, seconds: 0.08 },
  trail: {
    count: 2,
    seconds: 0.07,
    distance: 0.018,
    angle: 0,
    color: "#ff2e88",
    secondary: "#16f4d4",
  },
  slices: { count: 6, distance: 0.06, seconds: 0.35, timing: "beat" },
};
export function makeArt(kind: ArtKind, patch: Partial<Art> = {}): Art {
  return ArtSchema.parse({
    kind,
    color: "#f2765e",
    secondary: "#16f4d4",
    strength: 0.7,
    tempo: 120,
    speed: 1,
    distance: 0.03,
    count: 2,
    angle: 0,
    seconds: 0.4,
    timing: "constant",
    direction: "horizontal",
    seed: 11,
    ...defaults[kind],
    ...patch,
  });
}

export type ArtUse = { art: Art; amount: number };

/** Beat number and seconds since it, counted from the project start. */
export function artBeat(art: Art, projectTime: number) {
  const period = 60 / art.tempo;
  const index = Math.floor(Math.max(0, projectTime) / period + 1e-6);
  return { index, since: Math.max(0, projectTime - index * period), period };
}
const hit = (since: number, decay: number) =>
  since < 0.025 ? since / 0.025 : Math.exp(-(since - 0.025) / decay);

/** Stop-motion: hold the element's animation for whole steps. */
export function steppedTime(uses: ArtUse[], t: number) {
  const step = uses.find((u) => u.art.kind === "stutter" && u.amount > 0);
  if (!step) return t;
  const size = 1 / step.art.count;
  return Math.floor(t / size + 1e-6) * size;
}

export type ArtCamera = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  invert: number;
};
/** Camera and beat moves added to the element's transform. */
export function artCamera(
  uses: ArtUse[],
  time: number,
  projectTime: number,
  stage: { width: number; height: number },
): ArtCamera {
  const v: ArtCamera = { x: 0, y: 0, scale: 1, rotation: 0, invert: 0 };
  const side = Math.min(stage.width, stage.height);
  for (const { art, amount } of uses) {
    const a = art.strength * amount;
    if (!a) continue;
    const r = (n: number) => effectRandom(art.seed, n);
    if (art.kind === "drift") {
      // Layered slow sines at seeded rates read as an unsteady hand.
      const s = time * art.speed;
      const wave = (n: number) =>
        0.6 * Math.sin(Math.PI * 2 * (0.13 + r(n) * 0.1) * s + r(n + 1) * 7) +
        0.4 *
          Math.sin(Math.PI * 2 * (0.31 + r(n + 2) * 0.2) * s + r(n + 3) * 7);
      const d = art.distance * side * a;
      v.x += wave(0) * d;
      v.y += wave(4) * d * 0.8;
      v.rotation += wave(8) * a * 1.2;
      // Overscan so full-frame artwork never shows its edges.
      v.scale *= 1 + art.distance * 2.4 * a;
    } else if (art.kind === "punch") {
      const b = artBeat(art, projectTime);
      v.scale *= 1 + 0.14 * a * hit(b.since, art.seconds);
    } else if (art.kind === "jolt") {
      const b = artBeat(art, projectTime);
      const e = hit(b.since, art.seconds) * Math.cos(b.since * 38);
      const dir = r(b.index) * Math.PI * 2;
      v.x += Math.cos(dir) * art.distance * side * a * e;
      v.y += Math.sin(dir) * art.distance * side * a * e;
      v.rotation += (r(b.index + 999) - 0.5) * 5 * a * e;
    } else if (art.kind === "strobe") {
      const b = artBeat(art, projectTime);
      if (b.index % art.count === 0 && b.since < art.seconds)
        v.invert = Math.max(v.invert, clamp01(a));
    }
  }
  return v;
}

/** Lagged, offset copies behind the element. */
export function trailCopies(art: Art, amount: number, side: number) {
  const a = art.strength * amount;
  if (!a) return [];
  const rad = (art.angle * Math.PI) / 180;
  return Array.from({ length: Math.min(art.count, 4) }, (_, n) => {
    const k = n + 1;
    // Copies alternate sides and colors so they read as a chroma split.
    const sign = n % 2 ? -1 : 1;
    const d = art.distance * side * Math.ceil(k / 2) * sign;
    return {
      lag: art.seconds * k,
      x: Math.cos(rad) * d,
      y: Math.sin(rad) * d,
      color: n % 2 ? art.secondary : art.color,
      opacity: a * (1 - n / (Math.min(art.count, 4) + 1)),
    };
  }).reverse();
}

/** Band clips (percent of the frame) and their offsets in pixels. */
export function sliceBands(
  art: Art,
  amount: number,
  time: number,
  projectTime: number,
  duration: number,
  side: number,
) {
  const n = Math.max(2, Math.min(art.count, 12));
  const a = art.strength * amount;
  const max = art.distance * side * a;
  const r = (i: number) => effectRandom(art.seed, i);
  let shift: (i: number) => number;
  if (art.timing === "beat") {
    const b = artBeat(art, projectTime);
    const e = hit(b.since, art.seconds);
    shift = (i) => (r(b.index * 31 + i) * 2 - 1) * max * e;
  } else if (art.timing === "in" || art.timing === "out") {
    const p =
      art.timing === "in"
        ? 1 - smooth(time / art.seconds)
        : smooth((time - duration + art.seconds) / art.seconds);
    shift = (i) => (i % 2 ? -1 : 1) * (0.5 + r(i)) * max * 4 * p;
  } else
    shift = (i) =>
      Math.sin(time * art.speed * Math.PI * 2 * (0.3 + r(i) * 0.4) + i) * max;
  return Array.from({ length: n }, (_, i) => {
    const from = (i / n) * 100,
      to = 100 - ((i + 1) / n) * 100;
    const s = shift(i);
    return art.direction === "horizontal"
      ? { clip: `inset(${from}% -50% ${to}% -50%)`, x: s, y: 0 }
      : { clip: `inset(-50% ${to}% -50% ${from}%)`, x: 0, y: s };
  });
}

type ArtField =
  | "strength"
  | "tempo"
  | "speed"
  | "distance"
  | "count"
  | "angle"
  | "seconds"
  | "timing"
  | "direction"
  | "color"
  | "secondary";
/** Editor labels for the settings each kind uses. */
export const artControls: Record<ArtKind, Partial<Record<ArtField, string>>> = {
  drift: {
    strength: "Amount",
    distance: "Travel (% of frame)",
    speed: "Speed",
  },
  punch: { tempo: "Tempo (BPM)", strength: "Zoom", seconds: "Decay (seconds)" },
  jolt: {
    tempo: "Tempo (BPM)",
    strength: "Amount",
    distance: "Travel (% of frame)",
    seconds: "Decay (seconds)",
  },
  stutter: { count: "Steps per second" },
  strobe: {
    tempo: "Tempo (BPM)",
    count: "Every n beats",
    seconds: "Flash (seconds)",
    strength: "Amount",
  },
  trail: {
    count: "Copies",
    seconds: "Lag per copy (seconds)",
    distance: "Offset (% of frame)",
    angle: "Offset angle (degrees)",
    strength: "Opacity",
    color: "First color",
    secondary: "Second color",
  },
  slices: {
    timing: "Timing",
    direction: "Bands",
    count: "Slices",
    distance: "Shift (% of frame)",
    seconds: "Decay or slide (seconds)",
    tempo: "Tempo (BPM)",
    speed: "Speed",
    strength: "Amount",
  },
};
