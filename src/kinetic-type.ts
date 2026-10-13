import type { TextEffect } from "./text-effects";
import { mix, seeded, unit } from "./motion";

/**
 * Kinetic type (kamikami-visual-v8): entrances, exits and holds that move
 * letters, words or the whole title as rigid units. Inspired by lyric-video
 * motion design; every value is a pure function of time, so frames render
 * deterministically.
 *
 * Positions are in em, relative to the unit's resting place. Word and title
 * frames are applied to a wrapper around their glyphs, so rotations pivot the
 * whole word instead of each letter.
 */
export const kineticKinds = [
  // Entrances (motion.direction "out" plays them backwards at the clip end)
  "spring",
  "hop",
  "wheel",
  "hinge",
  "spin",
  "slam",
  "fan",
  "drum",
  "shuffle",
  "cardflip",
  "ripple",
  "lens",
  "glint",
  "brush",
  "ink",
  "decode",
  "rain",
  "push",
  "flash",
  "inertia",
  // Exits: they always play over the last `seconds` of the clip
  "kick",
  "launch",
  "flutter",
  "domino",
  "closegap",
  "burn",
  "tornado",
  // Holds: they loop on the tempo between the entrance and the exit
  "pluck",
  "beathop",
  "colorrun",
  "dangle",
  "rock",
  "ride",
  "breathe",
  "pulse",
  "lean",
] as const;
export type KineticKind = (typeof kineticKinds)[number];
export const isKineticKind = (kind: string): kind is KineticKind =>
  (kineticKinds as readonly string[]).includes(kind);
export const kineticExits: readonly KineticKind[] = [
  "kick",
  "launch",
  "flutter",
  "domino",
  "closegap",
  "burn",
  "tornado",
];
export const kineticHolds: readonly KineticKind[] = [
  "pluck",
  "beathop",
  "colorrun",
  "dangle",
  "rock",
  "ride",
  "breathe",
  "pulse",
  "lean",
];
export const kineticRole = (kind: KineticKind) =>
  kineticHolds.includes(kind)
    ? ("hold" as const)
    : kineticExits.includes(kind)
      ? ("exit" as const)
      : ("enter" as const);
/** Kinds whose geometry only makes sense for whole words. */
export const wordKinds: readonly KineticKind[] = [
  "hinge",
  "spin",
  "slam",
  "push",
  "flash",
  "kick",
  "closegap",
  "rock",
  "ride",
  "breathe",
  "pulse",
  "lean",
];
export const DEFAULT_TEMPO = 120;

// ---------------------------------------------------------------- geometry

export type GlyphBox = {
  /** Center relative to the text block's center, em. */
  x: number;
  y: number;
  w: number;
  line: number;
  word: number;
  /** Index among the line's visible glyphs. */
  inLine: number;
  lineLength: number;
};
export type WordBox = { x: number; y: number; w: number; line: number };
export type TextGeometry = {
  glyphs: GlyphBox[];
  words: WordBox[];
  width: number;
  height: number;
  lines: number;
  /** Line height, em. */
  lead: number;
};
/** Advance width of a string in em. */
export type Measure = (text: string) => number;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const graphemes = (text: string) =>
  Array.from(segmenter.segment(text), ({ segment }) => segment);
const blank = (g: string) => /^\s+$/u.test(g);
/** Without a browser canvas (tests, servers): a typical display-face advance. */
export const estimateWidth: Measure = (text) =>
  graphemes(text).reduce((w, g) => w + (blank(g) ? 0.28 : 0.58), 0);

let canvas: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
/** Canvas measurement of loaded fonts; `font` is a CSS font shorthand at 100 px. */
export function canvasMeasure(font: string, tracking: number): Measure {
  if (canvas === undefined)
    canvas =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  if (!canvas) return estimateWidth;
  const ctx = canvas;
  return (text) => {
    const key = `${font}\u0000${tracking}\u0000${text}`;
    let w = widths.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width / 100 + graphemes(text).length * tracking;
      if (widths.size > 4000) widths.clear();
      widths.set(key, w);
    }
    return w;
  };
}

/** Per-grapheme and per-word boxes for left-aligned, explicit-line text. */
export function textGeometry(
  text: string,
  measure: Measure = estimateWidth,
  lead = 1.03,
): TextGeometry {
  const lines = text.split("\n");
  const glyphs: GlyphBox[] = [];
  const words: WordBox[] = [];
  const widthsByLine = lines.map((line) => measure(line));
  const width = Math.max(0, ...widthsByLine);
  const height = lines.length * lead;
  let word = -1;
  lines.forEach((line, li) => {
    const parts = graphemes(line);
    const visible = parts.filter((g) => !blank(g)).length;
    const y = (li - (lines.length - 1) / 2) * lead;
    // Lines are centered in the block.
    const indent = (width - widthsByLine[li]) / 2;
    let prefix = "",
      inLine = 0,
      inWord = false,
      wordStart = 0;
    const closeWord = (end: number) => {
      const w = words[word];
      w.x = indent + (wordStart + end) / 2 - width / 2;
      w.w = end - wordStart;
    };
    for (const g of parts) {
      const start = measure(prefix);
      prefix += g;
      const end = measure(prefix);
      if (blank(g)) {
        if (inWord) closeWord(start);
        inWord = false;
      } else if (!inWord) {
        inWord = true;
        word++;
        wordStart = start;
        words.push({ x: 0, y, w: 0, line: li });
      }
      glyphs.push({
        x: indent + (start + end) / 2 - width / 2,
        y,
        w: end - start,
        line: li,
        word: blank(g) ? -1 : word,
        inLine: blank(g) ? -1 : inLine++,
        lineLength: visible,
      });
      if (!blank(g)) closeWord(end);
    }
    // The newline itself occupies no box.
    if (li < lines.length - 1)
      glyphs.push({
        x: 0,
        y,
        w: 0,
        line: li,
        word: -1,
        inLine: -1,
        lineLength: visible,
      });
  });
  return { glyphs, words, width, height, lines: lines.length, lead };
}

// ---------------------------------------------------------------- frames

export type KineticCopy = {
  x: number;
  y: number;
  opacity: number;
  color?: string;
  glyph?: string;
  clip?: string;
};
export type KineticMark = {
  kind: "dot" | "ring" | "block" | "bar";
  /** Center relative to the unit's center, em. */
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  rotation?: number;
};
export type KineticFrame = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  rotateY: number;
  opacity: number;
  /** em */
  blur: number;
  origin: string | null;
  clip: string | null;
  glyph: string | null;
  tint: { color: string; amount: number } | null;
  copies: KineticCopy[];
  marks: KineticMark[];
};
export const neutralKineticFrame = (): KineticFrame => ({
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  rotateY: 0,
  opacity: 1,
  blur: 0,
  origin: null,
  clip: null,
  glyph: null,
  tint: null,
  copies: [],
  marks: [],
});
/** Offsets add, scales and opacity multiply, the latest clip/glyph/tint wins. */
export function mergeKinetic(into: KineticFrame, f: KineticFrame) {
  into.x += f.x;
  into.y += f.y;
  into.rotation += f.rotation;
  into.skewX += f.skewX;
  into.rotateY += f.rotateY;
  into.blur += f.blur;
  into.scale *= f.scale;
  into.scaleX *= f.scaleX;
  into.scaleY *= f.scaleY;
  into.opacity *= f.opacity;
  into.origin = f.origin ?? into.origin;
  into.clip = f.clip ?? into.clip;
  into.glyph = f.glyph ?? into.glyph;
  into.tint = f.tint ?? into.tint;
  into.copies.push(...f.copies);
  into.marks.push(...f.marks);
  return into;
}
export const isNeutralKinetic = (f: KineticFrame) =>
  f.x === 0 &&
  f.y === 0 &&
  f.rotation === 0 &&
  f.scale === 1 &&
  f.scaleX === 1 &&
  f.scaleY === 1 &&
  f.skewX === 0 &&
  f.rotateY === 0 &&
  f.opacity === 1 &&
  f.blur === 0 &&
  !f.clip &&
  !f.glyph &&
  !f.tint &&
  !f.copies.length &&
  !f.marks.length;

// ---------------------------------------------------------------- easing

const outPow = (u: number, p: number) => 1 - Math.pow(1 - unit(u), p);
const inPow = (u: number, p: number) => Math.pow(unit(u), p);
const inOutCubic = (u: number) => {
  const v = unit(u);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
const inOutSine = (u: number) => (1 - Math.cos(Math.PI * unit(u))) / 2;
const outExpo = (u: number) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * unit(u)));
const outBack = (u: number, k = 1.70158) => {
  const v = unit(u) - 1;
  return 1 + (k + 1) * v * v * v + k * v * v;
};
function outBounce(u: number) {
  const v = unit(u),
    n = 7.5625,
    d = 2.75;
  if (v < 1 / d) return n * v * v;
  if (v < 2 / d) return n * (v - 1.5 / d) ** 2 + 0.75;
  if (v < 2.5 / d) return n * (v - 2.25 / d) ** 2 + 0.9375;
  return n * (v - 2.625 / d) ** 2 + 0.984375;
}
/** Remaining offset of a damped spring that lands exactly on 1 → 0. */
export const settle = (q: number, decay = 4.2, halfCycles = 3) => {
  const v = unit(q);
  return (
    Math.exp(-decay * v) * Math.cos(Math.PI * halfCycles * v) * (1 - v ** 3)
  );
};
const bump = (u: number, at: number, width: number) =>
  Math.exp(-(((u - at) / width) ** 2));
const signed = (seed: number, i: number) => seeded(seed, i) * 2 - 1;
const SIGNS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=/<>";
const sign = (seed: number, i: number) =>
  SIGNS[Math.floor(seeded(seed, i) * SIGNS.length)];
const deg = (rad: number) => (rad * 180) / Math.PI;

// ---------------------------------------------------------------- timing

export type KineticUnit = {
  index: number;
  count: number;
  /** Box of the unit relative to the block center (em). */
  x: number;
  y: number;
  w: number;
  line: number;
  inLine: number;
  lineLength: number;
};
export type KineticEnv = {
  effect: TextEffect;
  time: number;
  duration: number;
  amount: number;
  geometry: TextGeometry;
  /** Hold envelope: 0 during entrances/exits on the same element, 1 between. */
  hold: number;
  /** Text color, for tints that return to it. */
  color: string;
};

/** 0..1 rank of a unit for staggering. */
function rank(effect: TextEffect, u: KineticUnit, geometry: TextGeometry) {
  if (u.count <= 1) return 0;
  const order = effect.motion?.order ?? "forward";
  if (order === "reverse") return 1 - u.index / (u.count - 1);
  if (order === "random") return seeded(effect.seed + 7, u.index);
  if (order === "center" || order === "edges") {
    const half = Math.max(0.01, geometry.width / 2);
    const d = unit(Math.hypot(u.x / half, u.y / Math.max(half, 1)));
    return order === "center" ? d : 1 - d;
  }
  return u.index / (u.count - 1);
}
/** Staggered local progress; `exit` measures from the exit window's start. */
function windowed(env: KineticEnv, u: KineticUnit, exit: boolean) {
  const { effect, time, duration } = env;
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const p = exit
    ? unit((time - (duration - seconds)) / seconds)
    : unit(time / seconds);
  const spread = effect.stagger;
  return unit(
    (p - rank(effect, u, env.geometry) * spread) / Math.max(0.05, 1 - spread),
  );
}
/** Entrance settle progress 0 → 1 (reversed when played as an exit). */
function enterProgress(env: KineticEnv, u: KineticUnit) {
  const out = env.effect.motion?.direction === "out";
  const q = windowed(env, u, out);
  return out ? 1 - q : q;
}
export function beatAt(effect: TextEffect, time: number) {
  const len = 60 / Math.max(30, Math.min(240, effect.tempo ?? DEFAULT_TEMPO));
  const index = Math.floor(time / len);
  return { len, index, since: time - index * len };
}

// ---------------------------------------------------------------- kinds

/** One unit's frame for a kinetic kind at `env.time` (clip-local seconds). */
export function kineticFrame(env: KineticEnv, u: KineticUnit): KineticFrame {
  const f = neutralKineticFrame();
  const { effect, amount: a } = env;
  if (a <= 0) return f;
  const kind = effect.kind as KineticKind;
  const role = kineticRole(kind);
  const d = 0.4 + effect.distance;
  const seed = effect.seed;
  const dir = effect.direction ?? "up";
  const horizontal = dir === "left" || dir === "right";
  const towards = dir === "left" || dir === "up" ? -1 : 1;
  if (role === "enter") {
    const s = enterProgress(env, u);
    if (s >= 1) return f;
    const q = 1 - s;
    switch (kind) {
      case "spring": {
        // A spring that lands exactly at rest, stretching along its speed.
        const off = settle(s, 4.2, 3) * 1.7 * d * towards * a;
        const v = Math.abs(settle(s + 0.01) - settle(s)) * 100 * 1.7 * d;
        const stretch = 1 + Math.min(0.5, v * 0.075) * a;
        if (horizontal) {
          f.x = off;
          f.scaleX = stretch;
          f.scaleY = 1 / Math.sqrt(stretch);
        } else {
          f.y = off;
          f.scaleY = stretch;
          f.scaleX = 1 / Math.sqrt(stretch);
        }
        f.opacity = 1 - (1 - unit(s * 6)) * a;
        break;
      }
      case "hop": {
        // One big parabolic jump that lands at half time, then two small hops.
        const segments: [number, number, number][] = [
          [0, 0.5, 1.6 * d],
          [0.5, 0.78, 0.24 * d],
          [0.78, 1, 0.06 * d],
        ];
        let y = 0;
        for (const [from, to, height] of segments)
          if (s >= from && s < to) {
            const k = (s - from) / (to - from);
            y =
              from === 0
                ? (1 - k) * height - Math.sin(k * Math.PI) * height * 0.7
                : -Math.sin(k * Math.PI) * height;
          }
        f.y = y * a;
        f.origin = "50% 100%";
        const squash = (bump(s, 0.5, 0.035) + bump(s, 0.78, 0.035) * 0.5) * a;
        f.scaleY = 1 - 0.3 * squash;
        f.scaleX = 1 + 0.24 * squash;
        f.rotation =
          s < 0.5
            ? signed(seed, u.index) * 28 * Math.sin(s * 2 * Math.PI) * a
            : 0;
        f.opacity = 1 - (1 - unit(s * 8)) * a;
        break;
      }
      case "wheel": {
        // Rolls without slipping: rotation is distance over radius.
        const side = dir === "right" ? 1 : -1;
        const off = side * 2.3 * d * (1 - outBack(s, 1.2));
        const radius = Math.max(0.2, Math.min(u.w, 0.75) / 2);
        f.x = off * a;
        f.rotation = deg(off / radius) * a;
        f.scale = 1 - 0.28 * q * a;
        f.opacity = 1 - (1 - unit(s * 4)) * a;
        break;
      }
      case "hinge": {
        // The word swings down from its outer corner and bounces at rest.
        const right = dir === "right";
        f.origin = right ? "100% 100%" : "0% 100%";
        f.rotation = (right ? 88 : -88) * (1 - outBounce(s)) * a;
        f.opacity = 1 - (1 - unit(s * 5)) * a;
        break;
      }
      case "spin": {
        const turn = u.index % 2 ? -1 : 1;
        f.rotation = turn * 200 * (1 - outPow(s, 3)) * a;
        f.scale = 1 + (mix(0.15, 1, outBack(s, 1.6)) - 1) * a;
        f.opacity = 1 - (1 - unit(s * 4)) * a;
        break;
      }
      case "slam": {
        // Drop in from far above the page, tilted; later words knock earlier ones.
        const hit = inPow(s, 2);
        f.scale = 1 + (mix(3.1, 1, hit) - 1) * a;
        f.rotation = signed(seed, u.index) * 7 * (1 - hit) * a;
        f.opacity = 1 - (1 - unit(s * 3)) * a;
        break;
      }
      case "fan": {
        // Every glyph starts stacked on one rib around a pivot below the line start.
        const g = env.geometry;
        const px = -g.width / 2 - 0.2,
          py = u.y + 0.8 + g.lead / 2;
        const lineStart = -g.width / 2;
        const spread =
          Math.atan2(u.x - px, py - u.y) -
          Math.atan2(lineStart - px, py - u.y) +
          0.45;
        const angle = -spread * (1 - outBack(s, 1.15)) * a;
        const dx = u.x - px,
          dy = u.y - py;
        f.x = dx * Math.cos(angle) - dy * Math.sin(angle) - dx;
        f.y = dx * Math.sin(angle) + dy * Math.cos(angle) - dy;
        f.rotation = deg(angle);
        f.opacity = 1 - (1 - unit(s * 3)) * a;
        break;
      }
      case "drum": {
        // Letters ride a turning drum, then unroll flat.
        const r = Math.max(0.6, env.geometry.width / Math.PI);
        const spinPhase =
          (seeded(seed, 3) > 0.5 ? 1 : -1) * 2.4 * (1 - outPow(s, 4));
        const theta = u.x / r + spinPhase;
        const flat = inOutCubic((s - 0.5) / 0.5);
        const projected = mix(r * Math.sin(theta), u.x, flat);
        const facing = mix(Math.cos(theta), 1, flat);
        f.x = (projected - u.x) * a;
        f.scaleX = 1 + (Math.max(0.001, facing) - 1) * a;
        f.opacity = 1 - (facing <= 0.04 ? 1 : 0.5 * (1 - facing)) * a;
        break;
      }
      case "shuffle": {
        // Letters trade places shell-game style, arcing over or under each other.
        const g = env.geometry;
        const slots = g.glyphs.filter((b) => b.word >= 0);
        const n = slots.length;
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
          const j = Math.floor(seeded(seed + 11, i) * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        if (n > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
        const from = slots[order[u.index]] ?? slots[u.index];
        if (!from) break;
        const e = inOutCubic(s);
        const dx = (from.x - u.x) * (1 - e),
          dy = (from.y - u.y) * (1 - e);
        const distance = Math.hypot(from.x - u.x, from.y - u.y);
        const bulge =
          Math.min(0.85, 0.4 * distance) *
          Math.sin(Math.PI * e) *
          (from.x < u.x ? -1 : 1);
        f.x = dx * a;
        f.y = (dy + bulge) * a;
        f.scale =
          1 + 0.14 * Math.sin(Math.PI * e) * (from.x < u.x ? 1 : -1) * a;
        break;
      }
      case "cardflip": {
        // A colored tile flips over to reveal the letter.
        const pop = outBack(unit(s / 0.22), 1.6);
        const turn = unit((s - 0.22) / 0.78);
        const angle = 180 * (1 - outBack(turn, 1.25));
        f.rotateY = angle * a;
        const back = angle > 90;
        f.scale = 1 + (pop - 1) * a;
        if (back) {
          f.opacity = 1 - a;
          f.marks.push({
            kind: "block",
            x: 0,
            y: 0,
            w: Math.max(0.5, u.w * 0.9),
            h: 0.8,
            color: effect.color,
            opacity: a,
          });
        }
        f.tint = {
          color: effect.secondary,
          amount: Math.abs(Math.sin((angle * Math.PI) / 180)) * 0.45 * a,
        };
        break;
      }
      case "ripple": {
        // A radial wave from the block center pushes letters outward as it passes.
        const g = env.geometry;
        const reach = Math.max(0.01, Math.hypot(g.width / 2, g.height / 2));
        const dist = Math.hypot(u.x, u.y);
        const start = 0.68 * (dist / reach);
        const k = unit((s - start) / (1 - start));
        const push = 0.28 * Math.sin(2 * Math.PI * k) * (1 - k) ** 2;
        const nx = dist > 0.001 ? u.x / dist : 0,
          ny = dist > 0.001 ? u.y / dist : -1;
        f.x = nx * push * a;
        f.y = ny * push * a;
        f.scale = 1 + 0.4 * Math.sin(Math.PI * k) * (1 - k) * a;
        f.opacity = 1 - (1 - unit(k * 4)) * a;
        break;
      }
      case "lens": {
        // A magnifier sweeps the line; letters swell under it and stay lit behind it.
        const g = env.geometry;
        const radius = 0.95;
        const lx = mix(
          -g.width / 2 - radius,
          g.width / 2 + radius,
          inOutSine(unwindowed(env)),
        );
        const dd = (u.x - lx) / radius;
        const m = Math.max(0, 1 - dd * dd);
        f.scale = 1 + 0.6 * m * a;
        f.x = Math.sign(dd) * 0.35 * m * a;
        f.opacity = 1 - (u.x > lx ? 0.86 : 0) * a;
        break;
      }
      case "glint": {
        // A slanted light band uncovers the text; a faint ghost waits ahead of it.
        const g = env.geometry;
        const slope = 0.45,
          band = 0.55;
        const front = mix(
          -g.width / 2 - band,
          g.width / 2 + band + slope,
          inOutSine(unwindowed(env)),
        );
        const local = ((front - (u.x - u.w / 2)) / Math.max(0.01, u.w)) * 100;
        const lean = (slope / Math.max(0.01, u.w)) * 100;
        if (local - lean >= 100) break;
        const shown = `polygon(-50% -20%, ${local}% -20%, ${local - lean}% 120%, -50% 120%)`;
        const ahead = `polygon(${local}% -20%, 200% -20%, 200% 120%, ${local - lean}% 120%)`;
        f.clip = shown;
        f.copies.push({ x: 0, y: 0, opacity: 0.2 * a, clip: ahead });
        const bandW = (0.12 / Math.max(0.01, u.w)) * 100;
        f.copies.push({
          x: 0,
          y: 0,
          opacity: a,
          color: effect.color,
          clip: `polygon(${local - bandW}% -20%, ${local}% -20%, ${local - lean}% 120%, ${local - lean - bandW}% 120%)`,
        });
        if (a < 1) f.clip = null;
        break;
      }
      case "brush": {
        // Dry-brush bristles reveal each line in turn; ragged strip ends lag behind.
        const g = env.geometry;
        const p = unwindowed(env) * g.lines;
        const lineP = unit(p - u.line);
        const lineW = Math.max(0.01, g.width);
        const front = mix(-0.2, lineW + 1.3, outPow(lineP, 2));
        const left = u.x - u.w / 2 + g.width / 2;
        const strips = 14;
        const points: string[] = ["-20% -20%"];
        for (let k = 0; k < strips; k++) {
          const lag = 1.1 * Math.pow(seeded(seed + u.line * 31, k), 1.6);
          const edge = ((front - lag - left) / Math.max(0.01, u.w)) * 100;
          const top = -20 + (140 * k) / strips,
            bottom = -20 + (140 * (k + 1)) / strips;
          points.push(`${edge}% ${top}%`, `${edge}% ${bottom}%`);
        }
        points.push("-20% 120%");
        f.clip = `polygon(${points.join(",")})`;
        if (a < 1) f.opacity = 1 - (1 - lineP) * a;
        break;
      }
      case "ink": {
        // An accent drop lands on the letter, then a wobbly blot spreads over it.
        const cx = 30 + seeded(seed, u.index) * 40,
          cy = 30 + seeded(seed + 1, u.index) * 40;
        const drop = outBack(unit(s / 0.12), 2);
        const grow = outPow(unit((s - 0.12) / 0.88), 3);
        const r = grow * 150;
        const p1 = seeded(seed + 2, u.index) * 6.28,
          p2 = seeded(seed + 3, u.index) * 6.28;
        const pts = Array.from({ length: 20 }, (_, k) => {
          const t = (k / 20) * Math.PI * 2;
          const rr =
            r * (1 + 0.1 * Math.sin(3 * t + p1) + 0.07 * Math.sin(5 * t + p2));
          return `${cx + Math.cos(t) * rr}% ${cy + Math.sin(t) * rr * (u.w / 1.03)}%`;
        });
        f.clip = a >= 1 ? `polygon(${pts.join(",")})` : null;
        if (a < 1) f.opacity = 1 - q * a;
        if (grow < 1)
          f.marks.push({
            kind: "dot",
            x: ((cx - 50) / 100) * u.w,
            y: ((cy - 50) / 100) * 1.03,
            w: 0.22 * drop * (1 - grow),
            h: 0.22 * drop * (1 - grow),
            color: effect.color,
            opacity: a,
          });
        break;
      }
      case "decode": {
        // A decoding front: an accent block, noisy signs ahead, clean letters behind.
        const front = unwindowed(env) * (u.count + 1.8);
        const at = front - u.index;
        const step = Math.floor(env.time * 24);
        if (at >= 1) {
          if (at < 1.6)
            f.tint = { color: effect.color, amount: (1 - (at - 1) / 0.6) * a };
        } else if (at >= 0) {
          f.opacity = 1 - a;
          f.marks.push({
            kind: "block",
            x: 0,
            y: 0.02,
            w: Math.max(0.45, u.w),
            h: 0.8,
            color: effect.color,
            opacity: a,
          });
        } else if (at > -4) {
          f.glyph = sign(seed + step, u.index);
          f.opacity = 1 - 0.5 * a;
        } else f.opacity = 1 - a;
        break;
      }
      case "rain": {
        // Letters fall as hot signs trailing copies of themselves, then cool into place.
        const g = env.geometry;
        const lowFirst = 1 - (g.lines > 1 ? u.line / (g.lines - 1) : 0);
        const order = 0.65 * lowFirst + 0.35 * seeded(seed + 5, u.index);
        const p = unwindowed(env);
        const k = unit(
          (p - order * effect.stagger) / Math.max(0.05, 1 - effect.stagger),
        );
        const step = Math.floor(env.time * 24);
        if (k < 0.62) {
          const fall = outPow(k / 0.62, 3);
          const from = 2.2 + seeded(seed + 6, u.index);
          f.y = -(1 - fall) * from * a;
          f.glyph = sign(seed + step, u.index);
          f.tint = { color: effect.color, amount: a };
          f.opacity = 1 - (1 - unit(k * 6)) * a;
          for (let c = 1; c <= 4; c++)
            f.copies.push({
              x: 0,
              y: -c * 0.92,
              opacity: (0.55 - c * 0.12) * a,
              color: effect.color,
              glyph: sign(seed + step + c * 13, u.index),
            });
        } else
          f.tint = { color: effect.color, amount: (1 - (k - 0.62) / 0.38) * a };
        break;
      }
      case "push": {
        // Each word arrives at the end of its line and shoves the earlier words back.
        const g = env.geometry;
        const p = unwindowed(env) * u.count;
        const arrived = (j: number) => outPow(unit(p - j), 4);
        let shove = 0;
        g.words.forEach((w, j) => {
          if (j > u.index && w.line === u.line)
            shove += (w.w + 0.28) * (1 - arrived(j));
        });
        const self = arrived(u.index);
        f.x = (shove + (1 - self) * 2 * d) * a;
        f.opacity = 1 - (1 - unit(self * 3)) * a;
        break;
      }
      case "flash": {
        // Words flash big one at a time at the center, then all fly to their places.
        const g = env.geometry;
        const p = unwindowed(env);
        const split = 0.7;
        const big = Math.min(
          2.4,
          (0.8 * Math.max(g.width, 1)) / Math.max(0.3, u.w),
        );
        if (p < split) {
          const slot = (p / split) * u.count;
          const current = Math.min(u.count - 1, Math.floor(slot));
          if (current !== u.index) {
            f.opacity = 1 - a;
            break;
          }
          const punch = 0.35 * Math.exp(-10 * (slot - current));
          f.x = -u.x * a;
          f.y = -u.y * a;
          f.scale = 1 + (big * (1 + punch) - 1) * a;
        } else {
          const e = outExpo((p - split) / (1 - split));
          f.x = -u.x * (1 - e) * a;
          f.y = -u.y * (1 - e) * a;
          const from = u.index === u.count - 1 ? big : 0.3;
          f.scale = 1 + (mix(from, 1, e) - 1) * a;
        }
        break;
      }
      case "inertia": {
        // The line slides in; the front stops first and the rear bunches up, stretched by speed.
        const side = dir === "right" ? 1 : -1;
        const pos = (k: number) => side * 4 * d * (1 - outBack(k, 2.1));
        const v = Math.abs(pos(s + 0.02) - pos(s)) / 0.02;
        const stretch = Math.min(0.5, v * 0.06);
        f.x = pos(s) * a;
        f.scaleX = 1 + stretch * a;
        f.scaleY = 1 - (0.18 * bump(s, 0.85, 0.1) + stretch * 0.3) * a;
        f.opacity = 1 - (1 - unit(s * 5)) * a;
        break;
      }
    }
    return f;
  }
  if (role === "exit") {
    const q = windowed(env, u, true);
    if (q <= 0) return f;
    switch (kind) {
      case "kick": {
        const up = u.index % 2 ? 1 : -1;
        f.y = up * 3.2 * d * inPow(q, 1.6) * a;
        f.x = signed(seed, u.index) * 0.8 * q * a;
        f.rotation = up * 70 * q * a;
        f.opacity = 1 - unit((q - 0.55) / 0.45) * a;
        break;
      }
      case "launch": {
        // A small wind-up, then the line accelerates away with a speed stretch.
        const side = dir === "left" ? -1 : 1;
        const wind = -0.06 * Math.sin(Math.PI * unit(q / 0.25));
        const go = inPow(unit((q - 0.18) / 0.82), 3);
        f.x = side * (wind + go * 12 * d) * a;
        f.scaleX = 1 + Math.min(1.2, go * 3) * a;
        f.scaleY = 1 - Math.min(0.3, go) * a;
        f.opacity = 1 - unit((q - 0.7) / 0.3) * a;
        break;
      }
      case "flutter": {
        // Leaves: sway, flip their paper over and fall faster and faster.
        const freq = 1.5 + seeded(seed, u.index) * 1.5;
        const t = q * effect.seconds;
        f.x = 0.55 * d * Math.sin(t * freq * Math.PI * 2) * q * a;
        f.y = (0.25 * q + 0.75 * inPow(q, 1.6)) * 6 * d * a;
        f.rotation = 28 * Math.cos(t * freq * Math.PI * 2) * q * a;
        const flip = Math.cos(t * freq * 2.2 * Math.PI * 2);
        f.scaleX = 1 + (flip - 1) * unit(q * 4) * a;
        if (flip < 0)
          f.tint = { color: effect.secondary, amount: a * unit(q * 4) };
        f.opacity = 1 - unit((q - 0.65) / 0.35) * a;
        break;
      }
      case "domino": {
        // Each letter topples about its bottom corner, with a small rebound.
        const right = dir !== "left";
        f.origin = right ? "100% 100%" : "0% 100%";
        const fall =
          q < 0.62
            ? inPow(q / 0.62, 3)
            : 1 - 0.11 * Math.sin(Math.PI * unit((q - 0.62) / 0.38));
        f.rotation = (right ? 90 : -90) * fall * a;
        f.opacity = 1 - unit((q - 0.8) / 0.2) * a;
        break;
      }
      case "closegap": {
        // Words leave from both ends towards the middle; the rest close ranks.
        const g = env.geometry;
        const n = u.count;
        const order = (j: number) =>
          j % 2 === 0 ? j / 2 : n - 1 - (j - 1) / 2;
        const turns = Array.from({ length: n }, (_, j) => order(j));
        const p = unwindowed(env, true) * n;
        const collapse = (w: number) => inOutCubic(unit(p - turns.indexOf(w)));
        const self = collapse(u.index);
        let shift = 0;
        g.words.forEach((w, j) => {
          if (j === u.index || w.line !== u.line) return;
          shift += (w.w + 0.28) * collapse(j) * 0.5 * (j < u.index ? -1 : 1);
        });
        f.x = shift * a;
        f.scale = 1 - self * a;
        f.opacity = 1 - self * a;
        break;
      }
      case "burn": {
        // Letters heat to the accent color, char towards soot and burn away from the bottom.
        const heat = unit(q / 0.35),
          char = unit((q - 0.35) / 0.4);
        const eaten = unit((q - 0.12) / 0.88) * 100;
        f.tint = {
          color:
            char > 0
              ? mixColor(effect.color, effect.secondary, char)
              : effect.color,
          amount: heat * a,
        };
        if (a >= 1) f.clip = `inset(-20% -20% ${eaten}% -20%)`;
        else f.opacity = 1 - q * a;
        f.x =
          signed(seed + Math.floor(env.time * 24), u.index) * 0.02 * heat * a;
        if (eaten > 0 && eaten < 100)
          for (let k = 0; k < 4; k++) {
            const life = unit(q * 3 - seeded(seed + 9, u.index * 4 + k) * 2);
            if (life <= 0 || life >= 1) continue;
            f.marks.push({
              kind: "dot",
              x: signed(seed + 10, u.index * 4 + k) * u.w * 0.45,
              y: 0.5 - (eaten / 100) * 1.03 - life * 0.55,
              w: 0.07,
              h: 0.07,
              color: effect.color,
              opacity: (1 - life) * a,
            });
          }
        break;
      }
      case "tornado": {
        // Letters orbit a spinning column, shrinking as they pass behind it, and lift away.
        const r = Math.max(0.6, env.geometry.width / 2);
        const theta0 = Math.asin(Math.max(-1, Math.min(1, u.x / r)));
        const theta = theta0 + (3.2 + seeded(seed, 2)) * Math.PI * q * q;
        const z = Math.cos(theta);
        f.x = (r * Math.sin(theta) - u.x) * a;
        f.y = -q * q * 4 * d * a;
        f.scale = 1 + (0.72 + 0.28 * ((z + 1) / 2) - 1) * a;
        f.opacity =
          (1 - (1 - (0.3 + 0.7 * ((z + 1) / 2))) * a) *
          (1 - unit((q - 0.75) / 0.25) * a);
        break;
      }
    }
    return f;
  }
  // Holds
  const h = env.hold * a;
  if (h <= 0) return f;
  const beat = beatAt(effect, env.time);
  const t = env.time * Math.max(0.05, effect.speed);
  switch (kind) {
    case "pluck": {
      // A standing wave along each line, re-plucked every four beats.
      const period = beat.len * 4;
      const tau = env.time - Math.floor(env.time / period) * period;
      const x = u.lineLength > 1 ? u.inLine / (u.lineLength - 1) : 0.5;
      const decay = Math.exp(-1.6 * tau);
      f.y =
        (0.32 * d * Math.sin(Math.PI * x) * Math.cos(2 * Math.PI * 2.4 * tau) +
          0.08 *
            d *
            Math.sin(2 * Math.PI * x) *
            Math.cos(2 * Math.PI * 4.1 * tau)) *
        decay *
        h;
      break;
    }
    case "beathop": {
      const target = beat.index % Math.max(1, u.count);
      const k = unit(beat.since / (beat.len * 0.85));
      const lift = Math.pow(Math.sin(Math.PI * k), 0.7) * 0.3 * d;
      const near = Math.abs(target - u.index);
      f.y = -lift * (near === 0 ? 1 : near === 1 ? 0.3 : 0) * h;
      break;
    }
    case "colorrun": {
      // A soft accent highlight runs along the text.
      const span = u.count + 4;
      const center = ((t * 7) % span) - 2;
      const g = Math.exp(-((u.index - center) ** 2) / (2 * 0.8));
      f.tint = { color: effect.color, amount: g * h };
      f.y = -0.05 * g * h;
      break;
    }
    case "dangle": {
      // Each letter swings from its top edge at its own tempo.
      const w = (2 * Math.PI) / (beat.len * (1.6 + seeded(seed, u.index)));
      f.origin = "50% 0%";
      f.rotation =
        (6.5 * d * Math.sin(env.time * w + seeded(seed + 1, u.index) * 6.28) +
          1.6 * Math.sin(env.time * w * 2.7)) *
        h;
      break;
    }
    case "rock": {
      const side = u.index % 2 ? -1 : 1;
      f.rotation = side * 4 * d * Math.sin((Math.PI * env.time) / beat.len) * h;
      break;
    }
    case "ride": {
      // A travelling wave: each word bobs and tilts with its slope.
      const phase = (env.time / (beat.len * 2) - u.index * 0.25) * Math.PI * 2;
      f.y = 0.12 * d * Math.sin(phase) * h;
      f.rotation = 6 * Math.cos(phase) * h;
      break;
    }
    case "breathe": {
      // The spaces between words widen and narrow while the words stay still.
      const k = Math.sin((2 * Math.PI * env.time) / (beat.len * 4));
      f.x = (u.inLine - (u.lineLength - 1) / 2) * 0.16 * d * k * h;
      break;
    }
    case "pulse": {
      const target = beat.index % Math.max(1, u.count);
      if (target === u.index)
        f.scale = 1 + 0.14 * d * Math.exp(-6 * beat.since) * h;
      break;
    }
    case "lean": {
      const side = (u.index + beat.index) % 2 ? -1 : 1;
      f.skewX = side * 18 * Math.exp(-6 * beat.since) * h;
      break;
    }
  }
  return f;
}

/** Whole-effect progress without per-unit stagger (sweeps and fronts). */
function unwindowed(env: KineticEnv, exit = false) {
  const { effect, time, duration } = env;
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const out = exit || effect.motion?.direction === "out";
  const p = out
    ? unit((time - (duration - seconds)) / seconds)
    : unit(time / seconds);
  return out && !exit ? 1 - p : p;
}
function mixColor(a: string, b: string, t: number) {
  const ch = (c: string, i: number) =>
    parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(mix(ch(a, i), ch(b, i), unit(t)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * Hold envelope for an element: holds wait for its entrances to settle and
 * fade out before its exits start.
 */
export function holdEnvelope(
  time: number,
  entranceEnd: number,
  exitStart: number,
) {
  return (
    unit((time - entranceEnd * 0.85) / 0.25) * unit((exitStart - time) / 0.25)
  );
}

export const kineticNames: Record<KineticKind, string> = {
  spring: "Spring in",
  hop: "Hop in",
  wheel: "Roll in",
  hinge: "Hinge drop",
  spin: "Word spin",
  slam: "Word slam",
  fan: "Fan open",
  drum: "Drum unroll",
  shuffle: "Shuffle",
  cardflip: "Card flip",
  ripple: "Ripple in",
  lens: "Magnifier sweep",
  glint: "Glint reveal",
  brush: "Brush reveal",
  ink: "Ink drop",
  decode: "Decode",
  rain: "Matrix rain",
  push: "Push in",
  flash: "Word flash",
  inertia: "Inertia slide",
  kick: "Word kick",
  launch: "Launch",
  flutter: "Flutter away",
  domino: "Domino topple",
  closegap: "Close the gap",
  burn: "Burn away",
  tornado: "Tornado",
  pluck: "Plucked string",
  beathop: "Beat hop",
  colorrun: "Color run",
  dangle: "Dangle",
  rock: "Counter rock",
  ride: "Word ride",
  breathe: "Gap breath",
  pulse: "Word pulse",
  lean: "Beat lean",
};

/** Settings-dialog controls per kinetic kind (see TitleEffectControls). */
export const kineticControls: Record<
  KineticKind,
  {
    distance?: string;
    speed?: string;
    color?: string;
    secondary?: string;
    direction?: [string, string][];
    note?: string;
  }
> = {
  spring: {
    distance: "Travel",
    direction: [
      ["up", "From below"],
      ["down", "From above"],
      ["left", "From the right"],
      ["right", "From the left"],
    ],
  },
  hop: { distance: "Jump height" },
  wheel: {
    distance: "Roll distance",
    direction: [
      ["left", "From the left"],
      ["right", "From the right"],
    ],
  },
  hinge: {
    direction: [
      ["left", "Hinged on the left"],
      ["right", "Hinged on the right"],
    ],
    note: "Each word swings down from a corner and bounces to rest.",
  },
  spin: { note: "Each word spins in as one piece, alternating direction." },
  slam: { note: "Words drop in from far above the page, tilted." },
  fan: { note: "Letters fan open around a pivot below the line, like ribs." },
  drum: { note: "Letters ride a turning drum, then unroll flat." },
  shuffle: { note: "Letters swap places along arcs, then settle in order." },
  cardflip: {
    color: "Tile color",
    secondary: "Shade",
    note: "Colored tiles flip over to reveal each letter.",
  },
  ripple: { note: "A wave spreads from the center; use Center out order." },
  lens: { note: "A magnifier sweeps the line; letters light up behind it." },
  glint: {
    color: "Glint color",
    note: "A slanted light band uncovers the text; a faint ghost waits ahead.",
  },
  brush: { note: "Dry-brush bristles paint each line in turn." },
  ink: { color: "Ink color", note: "A drop lands on each letter and spreads." },
  decode: {
    color: "Cursor color",
    note: "A decoding front turns noisy signs into letters.",
  },
  rain: {
    color: "Hot color",
    note: "Letters fall as glowing signs with trails, then cool into place.",
  },
  push: {
    distance: "Slide distance",
    note: "Each word pushes the earlier words back.",
  },
  flash: { note: "Words flash big one at a time, then fly to their places." },
  inertia: {
    distance: "Travel",
    direction: [
      ["left", "From the left"],
      ["right", "From the right"],
    ],
  },
  kick: { distance: "Kick height" },
  launch: {
    distance: "Travel",
    direction: [
      ["right", "Towards the right"],
      ["left", "Towards the left"],
    ],
    note: "Use Reverse order so the leading letter leaves first.",
  },
  flutter: { distance: "Fall", secondary: "Paper back color" },
  domino: {
    direction: [
      ["right", "Topple right"],
      ["left", "Topple left"],
    ],
  },
  closegap: { note: "Words leave from both ends; the rest close ranks." },
  burn: { color: "Heat color", secondary: "Soot color" },
  tornado: { distance: "Lift" },
  pluck: { distance: "Amplitude", note: "Re-plucked every four beats." },
  beathop: { distance: "Hop height", note: "One unit hops on every beat." },
  colorrun: { speed: "Run speed", color: "Highlight color" },
  dangle: { distance: "Swing" },
  rock: { distance: "Rock angle" },
  ride: { distance: "Wave height" },
  breathe: { distance: "Gap change" },
  pulse: { distance: "Pulse size", note: "One word swells on every beat." },
  lean: { note: "Words lean into each beat, alternating sides." },
};
