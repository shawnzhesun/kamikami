import { clamp01, effectRandom, smooth } from "./visual-effects";
import {
  DEFAULT_TEMPO,
  neutralKineticFrame,
  type KineticFrame,
  type KineticMark,
  type TextGeometry,
} from "./kinetic-type";
import type { TextEffect } from "./text-effects";

/**
 * Kinetic typographic layouts (kamikami-visual-v8): whole-phrase compositions
 * that move each word, as one rigid piece, from the normal line into a
 * designed arrangement — justified stacks, a giant key word, size steps, a
 * word-by-word swap — with the move itself as the animation. They stack with
 * kinetic motions, text treatments and every other effect.
 */
export const layoutKinds = [
  "slamstack",
  "keyword",
  "steps",
  "giant",
  "swap",
  "typeslam",
  "flowsnap",
  "seesaw",
  "arc",
  "bandhide",
] as const;
export type LayoutKind = (typeof layoutKinds)[number];
export const isLayoutKind = (kind: string): kind is LayoutKind =>
  (layoutKinds as readonly string[]).includes(kind);
/** Layouts that loop on the tempo instead of playing once at the clip start. */
export const layoutHolds: readonly LayoutKind[] = ["seesaw"];

export const layoutNames: Record<LayoutKind, string> = {
  slamstack: "Justified slam stack",
  keyword: "Key word split",
  steps: "Size steps",
  giant: "Cropped giant word",
  swap: "Word swap",
  typeslam: "Type then slam",
  flowsnap: "Flow then snap",
  seesaw: "Seesaw",
  arc: "Arc ride",
  bandhide: "Band reveal",
};

type Ctl = Partial<
  Record<
    | "seconds"
    | "stagger"
    | "distance"
    | "angle"
    | "tempo"
    | "color"
    | "secondary"
    | "order",
    string
  >
>;
/** Editor labels for the settings each layout uses. */
export const layoutControls: Record<LayoutKind, Ctl> = {
  slamstack: {
    seconds: "Duration (seconds)",
    stagger: "Stagger",
    order: "Order",
  },
  keyword: { seconds: "Duration (seconds)", stagger: "Stagger" },
  steps: {
    seconds: "Duration (seconds)",
    stagger: "Stagger",
    distance: "Step (how fast sizes fall)",
  },
  giant: {
    seconds: "Duration (seconds)",
    secondary: "Giant word color",
  },
  swap: {
    tempo: "Tempo (BPM, one word per beat)",
    seconds: "Assemble (seconds)",
  },
  typeslam: { seconds: "Typing (seconds)", distance: "Typed size" },
  flowsnap: {
    seconds: "Float (seconds)",
    stagger: "Stagger",
    distance: "Scatter (em)",
  },
  seesaw: { tempo: "Tempo (BPM)", angle: "Tilt (degrees)" },
  arc: {
    seconds: "Ride-in (seconds)",
    distance: "Bend",
  },
  bandhide: { seconds: "Sweep (seconds)", color: "Band" },
};

const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
const easeOutBack = (p: number, k = 1.7) => {
  const u = clamp01(p) - 1;
  return 1 + (k + 1) * u * u * u + k * u * u;
};
/** A damped ring after a snap: 1 at the snap, settling to 0. */
const ring = (since: number, rate = 9, freq = 20) =>
  since < 0 ? 0 : Math.exp(-since * rate) * Math.cos(since * freq);

type Placement = { x: number; y: number; scale: number; rotation?: number };
const SPACE = 0.28;

/** Rows of words laid end to end at `scale`, starting at `left` (or centered). */
function row(
  widths: number[],
  scale: number,
  y: number,
  left?: number,
): Placement[] {
  const total =
    widths.reduce((a, w) => a + w, 0) * scale +
    Math.max(0, widths.length - 1) * SPACE * scale;
  let x = left ?? -total / 2;
  return widths.map((w) => {
    const p = { x: x + (w * scale) / 2, y, scale };
    x += (w + SPACE) * scale;
    return p;
  });
}

/** Each word on its own row, every row scaled to one width. */
function stackPlacements(g: TextGeometry, sizes: number[]): Placement[] {
  // Rows sit on cap height so stacked words almost touch.
  const heights = sizes.map((s) => s * 0.84);
  const total = heights.reduce((a, h) => a + h, 0);
  let top = -total / 2;
  return g.words.map((_, i) => {
    const y = top + heights[i] / 2;
    top += heights[i];
    return { x: 0, y, scale: sizes[i] };
  });
}

export type LayoutResult = {
  words: KineticFrame[];
  marks: KineticMark[];
  /** Words drawn behind the others (the giant word). */
  behind: Set<number>;
};

/** 0..1 stagger rank of word `i` of `n`. */
function rank(effect: TextEffect, i: number, n: number) {
  if (n <= 1) return 0;
  const order = effect.motion?.order ?? "forward";
  const f = i / (n - 1);
  if (order === "reverse") return 1 - f;
  if (order === "random") return effectRandom(effect.seed, i);
  if (order === "center") return Math.abs(f - 0.5) * 2;
  if (order === "edges") return 1 - Math.abs(f - 0.5) * 2;
  return f;
}
/** Per-word progress of a staggered entrance. */
function entrance(effect: TextEffect, time: number, i: number, n: number) {
  const span = effect.seconds * (1 - effect.stagger * (n > 1 ? 1 : 0));
  const delay = rank(effect, i, n) * effect.seconds * effect.stagger;
  return clamp01((time - delay) / Math.max(0.05, span));
}

/**
 * Word frames for one layout at clip-local `time`. Offsets are in em from
 * each word's place in the normal line, so `amount` 0 leaves the line alone.
 */
export function layoutFrames(
  effect: TextEffect,
  {
    time,
    duration,
    amount,
    geometry: g,
    hold,
    keyWord,
  }: {
    time: number;
    duration: number;
    amount: number;
    geometry: TextGeometry;
    /** 0 during this element's entrances and exits, 1 between (holds). */
    hold: number;
    keyWord: number;
  },
): LayoutResult {
  const n = g.words.length;
  const widths = g.words.map((w) => Math.max(0.2, w.w));
  const maxW = Math.max(0.2, ...widths);
  const blockW = Math.max(maxW, g.width);
  const a = clamp01(amount);
  const behind = new Set<number>();
  const marks: KineticMark[] = [];
  // Target placement and per-word motion on top of it.
  const place: Placement[] = g.words.map((w) => ({
    x: w.x,
    y: w.y,
    scale: 1,
  }));
  const extra = g.words.map(() => neutralKineticFrame());
  const kind = effect.kind as LayoutKind;

  if (kind === "slamstack") {
    let sizes = widths.map((w) => Math.min(3, maxW / w));
    // Long phrases would stack taller than the frame: shrink the whole stack.
    const tall = sizes.reduce((h, z) => h + z * 0.84, 0);
    const room = Math.max(3, g.height * 2.4);
    if (tall > room) sizes = sizes.map((z) => (z * room) / tall);
    stackPlacements(g, sizes).forEach((p, i) => (place[i] = p));
    g.words.forEach((_, i) => {
      // Each word slams down from oversize, one after another.
      const p = entrance(effect, time, i, n);
      extra[i].scale = 1 + 1.6 * (1 - easeOutCubic(p));
      extra[i].opacity = clamp01(p * 5);
    });
  } else if (kind === "keyword" || kind === "giant") {
    const k = keyWord < 0 ? 0 : keyWord;
    const before = widths.slice(0, k),
      after = widths.slice(k + 1);
    if (kind === "keyword") {
      const K = Math.max(1.4, Math.min(3.4, (blockW * 1.05) / widths[k]));
      const s = Math.max(0.4, Math.min(0.6, 1 / K + 0.18));
      const left = (-widths[k] * K) / 2;
      const gap = K * 0.42 + 0.18;
      place[k] = { x: 0, y: 0, scale: K };
      row(before, s, -gap, left).forEach((p, i) => (place[i] = p));
      row(after, s, gap, left).forEach((p, i) => (place[k + 1 + i] = p));
      const pk = entrance(effect, time, 0, 2);
      extra[k].scale = 0.35 + 0.65 * easeOutBack(pk, 2.2);
      extra[k].opacity = clamp01(pk * 4);
      g.words.forEach((_, i) => {
        if (i === k) return;
        const p = entrance(effect, time, 1, 2);
        extra[i].x = -1.2 * (1 - easeOutCubic(p));
        extra[i].opacity = clamp01(p * 3);
      });
    } else {
      // The key word, oversized and cropped to the text block, sits behind the rest.
      const G = Math.max(2.4, Math.min(8, (blockW * 1.5) / widths[k]));
      place[k] = { x: 0, y: 0, scale: G };
      behind.add(k);
      // The other words close the gap the key word left in its line.
      const shift = (widths[k] + SPACE) / 2;
      g.words.forEach((w, i) => {
        if (i === k || w.line !== g.words[k].line) return;
        place[i] = { ...place[i], x: w.x + (i < k ? shift : -shift) };
      });
      const p = entrance(effect, time, 0, 1);
      extra[k].scale = 1 + 0.25 * (1 - easeOutCubic(p));
      extra[k].opacity = smooth(p);
      extra[k].tint = { color: effect.secondary, amount: 1 };
      const halfW = blockW / 2 / G,
        halfH = (g.height / 2 + 0.35) / G;
      const cropX = Math.max(0, widths[k] / 2 - halfW);
      const cropY = Math.max(0, g.lead / 2 - halfH);
      extra[k].clip = `inset(${cropY}em ${cropX}em ${cropY}em ${cropX}em)`;
      g.words.forEach((_, i) => {
        if (i === k) return;
        const q = entrance(effect, time - effect.seconds * 0.35, i, n);
        extra[i].y = 0.5 * (1 - easeOutCubic(q));
        extra[i].opacity = clamp01(q * 3);
      });
    }
  } else if (kind === "steps") {
    const fall = Math.max(0.4, Math.min(0.92, 1 - effect.distance * 0.45));
    const sizes = widths.map((_, i) => Math.max(0.35, 1.7 * Math.pow(fall, i)));
    const rows = stackPlacements(g, sizes);
    const widest = Math.max(...widths.map((w, i) => w * sizes[i]));
    rows.forEach((p, i) => {
      // Left-aligned stair: every row starts at the same edge.
      place[i] = { ...p, x: -widest / 2 + (widths[i] * sizes[i]) / 2 };
      const q = entrance(effect, time, i, n);
      extra[i].y = 0.6 * (1 - easeOutCubic(q));
      extra[i].opacity = clamp01(q * 3);
    });
  } else if (kind === "swap") {
    const beat = 60 / (effect.tempo ?? DEFAULT_TEMPO);
    const swapEnd = n * beat;
    const assemble = easeOutBack(
      (time - swapEnd) / Math.max(0.05, effect.seconds),
      1.2,
    );
    const current = Math.min(n - 1, Math.floor(time / beat));
    g.words.forEach((w, i) => {
      const S = Math.max(1.1, Math.min(2.6, (1.5 * maxW) / widths[i]));
      if (time < swapEnd) {
        // One word at a time, alone in the center, popping on its beat.
        place[i] = { x: 0, y: 0, scale: S };
        const since = time - i * beat;
        extra[i].opacity = i === current ? 1 : 0;
        extra[i].scale = i === current ? 1 + 0.18 * Math.exp(-since * 14) : 1;
      } else {
        // Then every word flies from the center into the line.
        const u = assemble;
        place[i] = {
          x: w.x * u,
          y: w.y * u,
          scale: S + (1 - S) * u,
        };
        extra[i].opacity = i === n - 1 ? 1 : clamp01(u * 2);
      }
    });
  } else if (kind === "typeslam") {
    const c = Math.max(0.2, Math.min(0.8, effect.distance * 0.66));
    const since = time - effect.seconds;
    const k = since < 0 ? c : c + (1 - c) * easeOutBack(since / 0.28, 2.4);
    g.words.forEach((w, i) => {
      place[i] = { x: w.x * k, y: w.y * k, scale: k };
      const shown = time >= (i / n) * effect.seconds * 0.9;
      extra[i].opacity = shown ? 1 : 0;
      extra[i].rotation = ring(since, 10, 30) * 2.5 * (i % 2 ? 1 : -1);
    });
  } else if (kind === "flowsnap") {
    g.words.forEach((_, i) => {
      const r = (m: number) => effectRandom(effect.seed, i * 7 + m) * 2 - 1;
      const snap =
        effect.seconds * (1 - effect.stagger) +
        rank(effect, i, n) * effect.seconds * effect.stagger;
      const since = time - snap;
      const d = effect.distance * 3;
      if (since < 0) {
        // Floating loose, drifting slowly, before snapping into the line.
        const drift = Math.sin(time * 1.3 + i * 2.1) * 0.15;
        extra[i].x = r(0) * d * 1.4 + drift;
        extra[i].y = r(1) * d + drift;
        extra[i].rotation = r(2) * 28;
        extra[i].scale = 0.8 + 0.4 * effectRandom(effect.seed, i * 7 + 3);
        extra[i].opacity = 0.55;
      } else {
        const e = ring(since, 12, 24);
        extra[i].scale = 1 + 0.12 * e;
        extra[i].rotation = r(2) * 6 * e;
      }
    });
  } else if (kind === "seesaw") {
    const beat = 60 / (effect.tempo ?? DEFAULT_TEMPO);
    const tilt = effect.angle ?? 7;
    const index = Math.floor(Math.max(0, time) / beat);
    const since = time - index * beat;
    const to = index % 2 ? -tilt : tilt,
      from = -to;
    // A spring from the last tilt to the new one on every beat.
    const theta = (to + (from - to) * ring(since, 10, 16)) * hold;
    const rad = (theta * Math.PI) / 180;
    g.words.forEach((w, i) => {
      extra[i].rotation = theta;
      extra[i].y = Math.sin(rad) * w.x;
      extra[i].x = (Math.cos(rad) - 1) * w.x;
    });
  } else if (kind === "arc") {
    const bend = Math.max(0.05, Math.min(3, effect.distance)) * 0.9;
    const R = Math.max(0.5, blockW / bend);
    const p = easeOutCubic(time / Math.max(0.05, effect.seconds));
    const ride = -(1 - p) * (blockW + 2);
    g.words.forEach((w, i) => {
      // Arc length from the center sets each word's angle on the curve.
      const s = w.x + ride;
      const phi = s / R;
      place[i] = {
        x: R * Math.sin(phi),
        y:
          w.y +
          R * (1 - Math.cos(phi)) -
          (R * (1 - Math.cos(blockW / 2 / R))) / 2,
        scale: 1,
        rotation: (phi * 180) / Math.PI,
      };
      extra[i].opacity = clamp01(p * 2 + 0.2 * (i === 0 ? 1 : 0));
    });
  } else if (kind === "bandhide") {
    const sweep = clamp01(time / Math.max(0.05, effect.seconds));
    const band = 0.8;
    const from = -blockW / 2 - band,
      to = blockW / 2 + band;
    const x = from + (to - from) * smooth(sweep);
    if (sweep < 1)
      marks.push({
        kind: "block",
        x,
        y: 0,
        w: band,
        h: g.height + 0.2,
        color: effect.color,
        opacity: a,
      });
    g.words.forEach((w, i) => {
      extra[i].opacity = x > w.x ? 1 : 0;
    });
  }

  const words = g.words.map((w, i) => {
    const p = place[i];
    const f = neutralKineticFrame();
    f.x = (p.x - w.x) * a;
    f.y = (p.y - w.y) * a;
    f.scale = 1 + (p.scale - 1) * a;
    f.rotation = (p.rotation ?? 0) * a;
    f.origin = "50% 50%";
    const e = extra[i];
    f.x += e.x * a;
    f.y += e.y * a;
    f.rotation += e.rotation * a;
    f.scale *= 1 + (e.scale - 1) * a;
    f.opacity = 1 - (1 - e.opacity) * a;
    f.clip = e.clip;
    f.tint = e.tint;
    return f;
  });
  return { words, marks, behind };
}
