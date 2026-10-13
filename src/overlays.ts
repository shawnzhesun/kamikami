import { z } from "zod";
import { clamp01, effectRandom, smooth } from "./visual-effects";

/**
 * Overlays (kamikami-visual-v8): vector graphics attached to an element —
 * frames, hand-drawn annotations, drafting marks, print marks and comic
 * energy. One engine serves text and pictures: every kind is a pure function
 * from the element's box (in overlay units, centered on the element) and time
 * to SVG parts, so previews and exports draw the same frame.
 *
 * Units: text uses 1 unit = 1 em; pictures use 1 unit = 2.5% of the frame's
 * shorter side. Sizes mix a text-calibrated minimum with a fraction of the
 * box, so a mark reads at title size and scales with a full-frame picture.
 */
export const overlayKinds = [
  // Frames
  "print",
  "shadowblock",
  "offsetframe",
  "brackets",
  "cropmarks",
  "label",
  "tape",
  // Annotate
  "circle",
  "underline",
  "highlight",
  "strike",
  "arrow",
  "tick",
  "cross",
  "star",
  // Drafting
  "dimension",
  "crosshair",
  "ruler",
  "callout",
  // Print
  "registration",
  "colorbars",
  "stamp",
  // Energy
  "speedlines",
  "impact",
  "sparkle",
] as const;
export type OverlayKind = (typeof overlayKinds)[number];
export const isOverlayKind = (kind: string): kind is OverlayKind =>
  (overlayKinds as readonly string[]).includes(kind);
/** Kinds that can follow each text line (other kinds use the block). */
export const lineOverlays: readonly OverlayKind[] = [
  "underline",
  "highlight",
  "strike",
];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const OverlaySchema = z
  .object({
    kind: z.enum(overlayKinds),
    /** Ink. */
    color: hex,
    /** Accent: second plate, tape stripes, stamp fill. */
    secondary: hex,
    /** Overall opacity, 0–1. */
    strength: z.number().min(0).max(1),
    /** What it marks on text: the whole block, the key word, or each line. */
    anchor: z.enum(["block", "keyword", "lines"]),
    /** Which side labels, arrows and callouts use; auto picks the roomiest. */
    placement: z.enum(["auto", "top", "bottom", "left", "right"]),
    /** Gap between the element and the mark. */
    pad: z.number().min(0).max(10),
    /** Size of the mark. */
    size: z.number().min(0.1).max(5),
    /** Line weight. */
    weight: z.number().min(0.1).max(5),
    angle: z.number().min(-180).max(180),
    /** Lines, ticks, rays, sparkles, bars or the label index. */
    count: z.number().int().min(1).max(24),
    /** Draw-on (and retract) length. */
    seconds: z.number().min(0.02).max(30),
    /** Draw on at the start and retract at the end, draw on only, draw at the end, or always drawn. */
    timing: z.enum(["envelope", "in", "out", "constant"]),
    /** Motion of speed lines, rays and sparkles. */
    speed: z.number().min(0).max(10),
    /** Hand-drawn irregularity, 0 (ruled) to 1 (loose). */
    wobble: z.number().min(0).max(1),
    /** Redraws per second for a boiling pencil line; 0 holds one drawing. */
    boil: z.number().min(0).max(24),
    /** Label, readout or stamp text; empty uses a default. */
    label: z.string().max(60).optional(),
    seed: z.number().int().min(0).max(65535),
  })
  .strict();
export type Overlay = z.infer<typeof OverlaySchema>;
export type OverlayUse = { overlay: Overlay; amount: number };

export const overlayNames: Record<OverlayKind, string> = {
  print: "Print border",
  shadowblock: "Block shadow",
  offsetframe: "Offset frame",
  brackets: "Corner brackets",
  cropmarks: "Crop marks",
  label: "Index label",
  tape: "Tape corners",
  circle: "Circle it",
  underline: "Hand underline",
  highlight: "Highlighter",
  strike: "Strike through",
  arrow: "Pointer arrow",
  tick: "Tick",
  cross: "Cross",
  star: "Margin star",
  dimension: "Dimension line",
  crosshair: "Crosshair",
  ruler: "Ruler",
  callout: "Callout",
  registration: "Registration marks",
  colorbars: "Color bars",
  stamp: "Rubber stamp",
  speedlines: "Speed lines",
  impact: "Impact burst",
  sparkle: "Sparkles",
};

const defaults: Record<OverlayKind, Partial<Overlay>> = {
  print: { color: "#f6f2ea", pad: 1.4, seconds: 0.4, timing: "in" },
  shadowblock: {
    color: "#141414",
    strength: 0.95,
    pad: 1.2,
    angle: 45,
    seconds: 0.4,
    timing: "in",
  },
  offsetframe: { pad: 1.2, angle: 45, seconds: 0.5, timing: "in" },
  brackets: { color: "#f6f2ea", seconds: 0.5 },
  cropmarks: { color: "#f6f2ea", pad: 1.2, seconds: 0.6, timing: "in" },
  label: { color: "#f6f2ea", count: 1, seconds: 0.6, timing: "in" },
  tape: { color: "#f5e6b8", seconds: 0.35, timing: "in" },
  circle: { wobble: 0.55, seconds: 0.6, weight: 1.2 },
  underline: { wobble: 0.4, seconds: 0.45 },
  highlight: { color: "#ffe14d", strength: 0.6, wobble: 0.25, seconds: 0.4 },
  strike: { wobble: 0.3, seconds: 0.35 },
  arrow: { wobble: 0.45, seconds: 0.6 },
  tick: { color: "#3ad08a", wobble: 0.35, seconds: 0.35 },
  cross: { wobble: 0.35, seconds: 0.35 },
  star: { color: "#ffe14d", wobble: 0.45, seconds: 0.5 },
  dimension: { color: "#9fd8ff", seconds: 0.7, timing: "in" },
  crosshair: { color: "#9fd8ff", strength: 0.75, seconds: 0.6, timing: "in" },
  ruler: { color: "#f6f2ea", count: 10, seconds: 0.7, timing: "in" },
  callout: { color: "#f6f2ea", seconds: 0.8, timing: "in" },
  registration: { color: "#141414", seconds: 0.7, timing: "in" },
  colorbars: { count: 8, seconds: 0.6, timing: "in" },
  stamp: {
    angle: -12,
    wobble: 0.3,
    seconds: 0.22,
    timing: "in",
    strength: 0.9,
  },
  speedlines: {
    color: "#f6f2ea",
    strength: 0.8,
    count: 9,
    speed: 1.2,
    angle: 0,
    timing: "constant",
  },
  impact: {
    color: "#ffe14d",
    count: 14,
    speed: 1,
    seconds: 0.3,
    timing: "in",
  },
  sparkle: {
    color: "#fff7c2",
    count: 6,
    speed: 1,
    timing: "constant",
  },
};
export function makeOverlay(
  kind: OverlayKind,
  patch: Partial<Overlay> = {},
): Overlay {
  return OverlaySchema.parse({
    kind,
    color: "#f2765e",
    secondary: "#16f4d4",
    strength: 1,
    anchor: "block",
    placement: "auto",
    pad: 1,
    size: 1,
    weight: 1,
    angle: 0,
    count: 1,
    seconds: 0.5,
    timing: "envelope",
    speed: 1,
    wobble: 0,
    boil: 0,
    seed: 11,
    ...defaults[kind],
    ...patch,
  });
}

// ------------------------------------------------------------------ timing

/** Draw-on amount (0–1) at animation time `time` in a clip of `duration`. */
export function overlayProgress(o: Overlay, time: number, duration: number) {
  const s = Math.max(0.02, Math.min(o.seconds, duration / 2 || o.seconds));
  switch (o.timing) {
    case "constant":
      return 1;
    case "in":
      return smooth(time / s);
    case "out":
      // Finishes early so the element can still leave after the mark lands.
      return smooth((time - (duration - s)) / (s * 0.65));
    case "envelope":
      return Math.min(smooth(time / s), smooth((duration - time) / s));
  }
}
const stage = (p: number, from: number, to: number) =>
  clamp01((p - from) / Math.max(1e-6, to - from));

// ---------------------------------------------------------------- geometry

/** A box in overlay units; x/y is its center relative to the element's center. */
export type OverlayBox = { x: number; y: number; w: number; h: number };
export type OverlayTarget = {
  /** The whole element. */
  box: OverlayBox;
  /** The key word (text) — the block for pictures. */
  key?: OverlayBox;
  /** Each text line. */
  lines?: OverlayBox[];
  /** Pixels per overlay unit, for readouts. */
  unitPx: number;
  /** Free space from each edge of the box to the frame edge, in units. */
  room?: { top: number; bottom: number; left: number; right: number };
  /** The clip's start, for index labels. */
  start: number;
  /** Element center relative to the frame center, pixels, for readouts. */
  position?: { x: number; y: number };
};
export type OverlayPart = {
  key: string;
  behind: boolean;
  opacity: number;
  d?: string;
  fill?: string;
  stroke?: string;
  width?: number;
  /** Stroke draw-on, 0–1; omitted means fully drawn. */
  draw?: number;
  cap?: "round" | "square" | "butt";
  /** SVG transform in units. */
  transform?: string;
  /** Soft drop shadow blur, units. */
  shadow?: number;
  blend?: "multiply" | "screen";
  /** Fill with the even-odd rule, so inner subpaths cut holes. */
  evenodd?: boolean;
  text?: string;
  x?: number;
  y?: number;
  size?: number;
  align?: "start" | "middle" | "end";
  mono?: boolean;
  bold?: boolean;
};

type P = [number, number];
const f = (n: number) => +n.toFixed(3);
const line = (pts: P[], closed = false) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("") +
  (closed ? "Z" : "");
const rect = (x0: number, y0: number, x1: number, y1: number) =>
  line(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    true,
  );
/** A smooth curve through points (Catmull-Rom as cubic Béziers). */
function curve(pts: P[]) {
  if (pts.length < 3) return line(pts);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
export const timecode = (seconds: number) =>
  `${pad2(Math.floor(seconds / 60))}:${pad2(Math.floor(seconds % 60))}.${pad2(Math.floor((seconds % 1) * 100))}`;
export function overlayLabel(o: Overlay, start: number) {
  return o.label?.trim() || `No.${pad2(o.count)}  ·  ${timecode(start)}`;
}
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
export { MONO as overlayMono };

/** The side with the most free space, or the requested one. */
function side(
  o: Overlay,
  target: OverlayTarget,
  prefer: "top" | "bottom" | "left" | "right",
) {
  if (o.placement !== "auto") return o.placement;
  const room = target.room;
  if (!room) return prefer;
  // Keep the preferred side when it has room for the mark.
  if (room[prefer] > 2.5) return prefer;
  return (["bottom", "top", "right", "left"] as const).reduce((a, b) =>
    room[b] > room[a] ? b : a,
  );
}

/** SVG parts for one overlay at a time; `amount` scales its opacity. */
export function overlayParts(
  o: Overlay,
  amount: number,
  time: number,
  duration: number,
  target: OverlayTarget,
  index = 0,
): OverlayPart[] {
  const a = clamp01(o.strength * amount);
  const p = overlayProgress(o, time, duration);
  if (a <= 0 || p <= 0) return [];
  const anchorBox =
    o.anchor === "keyword" && target.key ? target.key : target.box;
  const { x: cx, y: cy, w, h } = anchorBox;
  const W2 = w / 2,
    H2 = h / 2;
  const m = Math.min(w, h);
  /** A size that reads on titles and grows with large pictures. */
  const S = (text: number, rel: number) => Math.max(text, rel * m) * o.size;
  const lw = o.weight * Math.max(0.05, 0.006 * m);
  const P = o.pad * Math.max(0.25, 0.035 * m);
  // A boiling line redraws on held frames, like pencil animation.
  const tick = o.boil > 0 ? Math.floor(time * o.boil) : 0;
  const r = (n: number) => effectRandom(o.seed + tick * 7919, n);
  const jitter = (pts: P[], amp: number, k = 0): P[] =>
    pts.map(([x, y], i) => [
      x + (r(k + i * 2) - 0.5) * amp * o.wobble,
      y + (r(k + i * 2 + 1) - 0.5) * amp * o.wobble,
    ]);
  const key = `${o.kind}-${index}`;
  const ink = (
    d: string,
    part: Partial<OverlayPart> = {},
    n = 0,
  ): OverlayPart => ({
    key: `${key}-${n}`,
    behind: false,
    opacity: a,
    d,
    stroke: o.color,
    width: lw,
    cap: "round",
    transform: `translate(${f(cx)} ${f(cy)})`,
    ...part,
  });
  const rad = (o.angle * Math.PI) / 180;
  switch (o.kind) {
    case "print":
      return [
        ink(rect(-W2 - P, -H2 - P, W2 + P, H2 + P), {
          behind: true,
          stroke: undefined,
          fill: o.color,
          opacity: a * p,
          shadow: S(0.08, 0.035),
          transform: `translate(${f(cx)} ${f(cy)}) scale(${f(0.97 + 0.03 * p)})`,
        }),
      ];
    case "shadowblock":
    case "offsetframe": {
      const d = P * p;
      const t = `translate(${f(cx + Math.cos(rad) * d)} ${f(cy + Math.sin(rad) * d)})`;
      return [
        ink(rect(-W2, -H2, W2, H2), {
          behind: true,
          transform: t,
          opacity: a * Math.min(1, p * 2),
          cap: "square",
          ...(o.kind === "shadowblock"
            ? { stroke: undefined, fill: o.color }
            : {}),
        }),
      ];
    }
    case "brackets": {
      const out = P * (1 + (1 - p) * 1.5);
      const len = S(0.3, 0.1);
      const x = W2 + out,
        y = H2 + out;
      return (
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as P[]
      ).map(([sx, sy], n) =>
        ink(
          line([
            [sx * x, sy * (y - len)],
            [sx * x, sy * y],
            [sx * (x - len), sy * y],
          ]),
          { opacity: a * p, cap: "square" },
          n,
        ),
      );
    }
    case "cropmarks": {
      const len = S(0.5, 0.06) * p;
      const gap = P * 0.5;
      const thin = o.weight * Math.max(0.02, 0.0024 * m);
      const marks: OverlayPart[] = [];
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as P[]) {
        marks.push(
          ink(
            line([
              [sx * (W2 + gap), sy * H2],
              [sx * (W2 + gap + len), sy * H2],
            ]),
            { width: thin, cap: "butt" },
            marks.length,
          ),
          ink(
            line([
              [sx * W2, sy * (H2 + gap)],
              [sx * W2, sy * (H2 + gap + len)],
            ]),
            { width: thin, cap: "butt" },
            marks.length + 1,
          ),
        );
      }
      const tr = Math.max(0.15, 0.013 * m) * o.size;
      for (const sy of [-1, 1]) {
        const y = sy * (H2 + gap + tr * 2.2);
        marks.push(
          regMark(0, y, tr, thin, o.color, a * p, `${key}-t${sy}`, cx, cy),
        );
      }
      return marks;
    }
    case "label": {
      const size = S(0.22, 0.035);
      const below = side(o, target, "bottom") !== "top";
      const gap = Math.max(0.12, 0.03 * m);
      const text = overlayLabel(o, target.start);
      const shown = Math.ceil(clamp01(p * 1.4) * [...text].length);
      const y = below ? H2 + gap + size : -H2 - gap;
      return [
        ink(
          line([
            [-W2, below ? H2 + gap * 0.5 : -H2 - gap * 0.5 - size * 1.2],
            [
              -W2 + size * 10 * smooth(p * 2),
              below ? H2 + gap * 0.5 : -H2 - gap * 0.5 - size * 1.2,
            ],
          ]),
          { width: Math.max(0.012, size * 0.06), cap: "butt" },
        ),
        {
          key: `${key}-text`,
          behind: false,
          opacity: a,
          text: [...text].slice(0, shown).join(""),
          x: cx - W2,
          y: cy + y,
          size,
          align: "start",
          mono: true,
          fill: o.color,
        },
      ];
    }
    case "tape": {
      const sw = S(1.2, 0.19),
        sh = sw * 0.29;
      return [-1, 1].map((sx, n) =>
        ink(
          rect(-sw / 2, -sh / 2, sw / 2, sh / 2),
          {
            stroke: undefined,
            fill: o.color,
            opacity: a * 0.82,
            shadow: sh * 0.08,
            transform: `translate(${f(cx + sx * (W2 - sw * 0.18))} ${f(cy - H2)}) rotate(${sx * 32}) scale(${f(p)})`,
          },
          n,
        ),
      );
    }
    case "circle": {
      const rx = W2 + P * 0.9,
        ry = H2 + P * 0.9;
      const n = 28;
      const start = -1.9 + (r(90) - 0.5) * 0.6;
      const pts: P[] = Array.from({ length: n + 1 }, (_, i) => {
        const u = i / n;
        const t = start + u * Math.PI * 2 * 1.1;
        // The stroke spirals slightly so its ends overlap without closing.
        const grow = 1 + (u - 0.5) * 0.08;
        return [Math.cos(t) * rx * grow, Math.sin(t) * ry * grow];
      });
      return [
        ink(curve(jitter(pts, S(0.08, 0.02), 3)), {
          width: lw * 1.4,
          draw: p,
        }),
      ];
    }
    case "underline":
    case "highlight":
    case "strike": {
      const boxes =
        o.anchor === "lines" && target.lines?.length
          ? target.lines
          : [anchorBox];
      const lines =
        o.kind === "highlight" ? 1 : Math.max(1, Math.min(3, o.count));
      const parts: OverlayPart[] = [];
      boxes.forEach((b, bi) => {
        const bw = b.w / 2,
          bh = b.h / 2;
        // Lines draw one after another down the block.
        const q = stage(
          p,
          (bi / boxes.length) * 0.5,
          0.5 + ((bi + 1) / boxes.length) * 0.5,
        );
        for (let k = 0; k < lines; k++) {
          const gap = S(0.12, 0.03);
          const y =
            o.kind === "underline"
              ? bh + S(0.06, 0.015) + k * gap
              : o.kind === "strike"
                ? -bh * 0.08 + (k - (lines - 1) / 2) * gap
                : bh * 0.22;
          const x0 = -bw - b.w * 0.04,
            x1 = bw + b.w * 0.03;
          const tilt =
            (r(bi * 9 + k) - 0.5) * S(0.08, 0.02) +
            (o.kind === "strike" ? -S(0.06, 0.012) : 0);
          const pts = jitter(
            Array.from({ length: 6 }, (_, i): P => {
              const u = i / 5;
              return [
                x0 + (x1 - x0) * u,
                y +
                  tilt * (u - 0.5) * 2 +
                  Math.sin(u * Math.PI) *
                    (o.kind === "underline" ? S(0.03, 0.006) : 0),
              ];
            }),
            S(0.06, 0.012),
            bi * 40 + k * 13,
          );
          parts.push({
            ...ink(curve(pts), {
              transform: `translate(${f(b.x)} ${f(b.y)})`,
              draw: stage(q, k / lines, (k + 1) / lines),
              ...(o.kind === "highlight"
                ? {
                    behind: true,
                    width: b.h * 0.6 * o.weight,
                    cap: "butt" as const,
                    blend: "multiply" as const,
                  }
                : { width: lw * (o.kind === "strike" ? 1.3 : 1.2) }),
            }),
            key: `${key}-${bi}-${k}`,
          });
        }
      });
      return parts;
    }
    case "arrow": {
      const at = side(o, target, "right");
      const len = S(1.1, 0.3);
      const dir: Record<string, P> = {
        right: [1, -0.55],
        left: [-1, -0.55],
        top: [0.55, -1],
        bottom: [0.55, 1],
      };
      const [dx, dy] = dir[at];
      const end: P = [
        dx * (W2 + P * 0.6) * (Math.abs(dx) === 1 ? 1 : 0.6),
        dy * (H2 + P * 0.6) * (Math.abs(dy) === 1 ? 1 : 0.6),
      ];
      const norm = Math.hypot(dx, dy);
      const start: P = [end[0] + (dx / norm) * len, end[1] + (dy / norm) * len];
      // The shaft bows to one side, like a quick marker gesture.
      const bend = len * 0.3;
      const mid: P = [
        (start[0] + end[0]) / 2 - (dy / norm) * bend,
        (start[1] + end[1]) / 2 + (dx / norm) * bend,
      ];
      const shaft = jitter(
        Array.from({ length: 7 }, (_, i): P => {
          const u = i / 6;
          const v = 1 - u;
          return [
            v * v * start[0] + 2 * v * u * mid[0] + u * u * end[0],
            v * v * start[1] + 2 * v * u * mid[1] + u * u * end[1],
          ];
        }),
        S(0.05, 0.012),
        5,
      );
      const last = shaft[shaft.length - 2];
      const ang = Math.atan2(end[1] - last[1], end[0] - last[0]);
      const head = S(0.22, 0.05);
      const wing = (s: number): P => [
        end[0] - Math.cos(ang + s * 0.5) * head,
        end[1] - Math.sin(ang + s * 0.5) * head,
      ];
      return [
        ink(curve(shaft), { draw: stage(p, 0, 0.75), width: lw * 1.2 }),
        ink(
          line([wing(-1), end, wing(1)]),
          {
            draw: stage(p, 0.7, 1),
            width: lw * 1.2,
          },
          1,
        ),
      ];
    }
    case "tick":
    case "cross":
    case "star": {
      const at = side(o, target, "right");
      const s = S(0.42, 0.1);
      const ox =
        at === "left"
          ? -W2 - P - s * 0.6
          : at === "right"
            ? W2 + P + s * 0.6
            : W2 * 0.7;
      const oy =
        at === "top"
          ? -H2 - P - s * 0.6
          : at === "bottom"
            ? H2 + P + s * 0.6
            : -H2 * 0.45;
      const t = `translate(${f(cx + ox)} ${f(cy + oy)})`;
      const amp = s * 0.12;
      if (o.kind === "tick")
        return [
          ink(
            curve(
              jitter(
                [
                  [-0.5 * s, -0.02 * s],
                  [-0.2 * s, 0.3 * s],
                  [0.55 * s, -0.5 * s],
                ],
                amp,
              ),
            ),
            {
              transform: t,
              draw: p,
              width: lw * 1.5,
            },
          ),
        ];
      if (o.kind === "cross")
        return [
          ink(
            line(
              jitter(
                [
                  [-0.45 * s, -0.45 * s],
                  [0.45 * s, 0.45 * s],
                ],
                amp,
              ),
            ),
            {
              transform: t,
              draw: stage(p, 0, 0.55),
              width: lw * 1.5,
            },
          ),
          ink(
            line(
              jitter(
                [
                  [0.45 * s, -0.45 * s],
                  [-0.45 * s, 0.45 * s],
                ],
                amp,
                9,
              ),
            ),
            {
              transform: t,
              draw: stage(p, 0.45, 1),
              width: lw * 1.5,
            },
            1,
          ),
        ];
      const star: P[] = Array.from({ length: 11 }, (_, i) => {
        const t2 = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = (i % 2 ? 0.22 : 0.55) * s;
        return [Math.cos(t2) * rr, Math.sin(t2) * rr];
      });
      return [
        ink(line(jitter(star, amp)), {
          transform: `${t} rotate(${f(o.angle + Math.sin(time * o.speed * 2) * 6)})`,
          draw: p,
          width: lw * 1.1,
          ...(p >= 1 ? { fill: o.color } : {}),
        }),
      ];
    }
    case "dimension": {
      const at = side(o, target, "top") === "bottom" ? 1 : -1;
      const gap = P * 0.9 + S(0.1, 0.02);
      const y = at * (H2 + gap);
      const thin = o.weight * Math.max(0.02, 0.0025 * m);
      const half = W2 * stage(p, 0, 0.6);
      const tick = S(0.12, 0.025);
      const size = S(0.2, 0.03);
      const px = Math.round(w * target.unitPx * stage(p, 0.3, 1));
      const arrow = (sx: number): P[] => [
        [sx * half - sx * tick * 0.9, y - tick * 0.45],
        [sx * half, y],
        [sx * half - sx * tick * 0.9, y + tick * 0.45],
      ];
      return [
        ink(
          line([
            [-W2, at * H2],
            [-W2, y + at * tick],
          ]),
          {
            width: thin,
            cap: "butt",
            draw: stage(p, 0, 0.3),
            opacity: a * 0.7,
          },
          0,
        ),
        ink(
          line([
            [W2, at * H2],
            [W2, y + at * tick],
          ]),
          {
            width: thin,
            cap: "butt",
            draw: stage(p, 0, 0.3),
            opacity: a * 0.7,
          },
          1,
        ),
        ink(
          line([
            [-half, y],
            [half, y],
          ]),
          { width: thin, cap: "butt" },
          2,
        ),
        ink(line(arrow(-1)), { width: thin, cap: "butt" }, 3),
        ink(line(arrow(1)), { width: thin, cap: "butt" }, 4),
        {
          key: `${key}-text`,
          behind: false,
          opacity: a * stage(p, 0.3, 0.6),
          text: o.label?.trim() || `${px} PX`,
          x: cx,
          y: cy + y + (at < 0 ? -size * 0.5 : size * 1.25),
          size,
          align: "middle",
          mono: true,
          fill: o.color,
        },
      ];
    }
    case "crosshair": {
      const ext = S(0.35, 0.08);
      const thin = o.weight * Math.max(0.018, 0.002 * m);
      const xs = (W2 + ext) * stage(p, 0, 0.7),
        ys = (H2 + ext) * stage(p, 0, 0.7);
      const ring = S(0.16, 0.035);
      const size = S(0.18, 0.026);
      const pos = target.position ?? { x: 0, y: 0 };
      return [
        ink(
          line([
            [-xs, 0],
            [xs, 0],
          ]),
          { behind: true, width: thin, cap: "butt" },
          0,
        ),
        ink(
          line([
            [0, -ys],
            [0, ys],
          ]),
          { behind: true, width: thin, cap: "butt" },
          1,
        ),
        ink(
          `M${f(-ring)} 0A${f(ring)} ${f(ring)} 0 1 0 ${f(ring)} 0A${f(ring)} ${f(ring)} 0 1 0 ${f(-ring)} 0`,
          { width: thin, draw: stage(p, 0.4, 1) },
          2,
        ),
        {
          key: `${key}-text`,
          behind: false,
          opacity: a * stage(p, 0.6, 1),
          text:
            o.label?.trim() ||
            `X ${Math.round(pos.x)}  Y ${Math.round(-pos.y)}`,
          x: cx + ring * 1.4,
          y: cy - ring * 1.4,
          size,
          align: "start",
          mono: true,
          fill: o.color,
        },
      ];
    }
    case "ruler": {
      const below = side(o, target, "bottom") !== "top";
      const s = below ? 1 : -1;
      const y = s * (H2 + P * 0.6);
      const n = Math.max(2, o.count);
      const thin = o.weight * Math.max(0.018, 0.0022 * m);
      const major = S(0.16, 0.03),
        minor = major * 0.5;
      const size = S(0.15, 0.022);
      const parts: OverlayPart[] = [
        ink(
          line([
            [-W2, y],
            [-W2 + w * stage(p, 0, 0.8), y],
          ]),
          { width: thin, cap: "butt" },
          0,
        ),
      ];
      const steps = n * 4;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        if (u > stage(p, 0, 0.8) + 1e-6) break;
        const x = -W2 + w * u;
        const big = i % 4 === 0;
        parts.push(
          ink(
            line([
              [x, y],
              [x, y + s * (big ? major : minor)],
            ]),
            { width: thin, cap: "butt" },
            i + 1,
          ),
        );
        if (big)
          parts.push({
            key: `${key}-n${i}`,
            behind: false,
            opacity: a,
            text: String(i / 4),
            x: cx + x,
            y: cy + y + s * (major + size * (below ? 1.1 : 0.4)),
            size,
            align: "middle",
            mono: true,
            fill: o.color,
          });
      }
      return parts;
    }
    case "callout": {
      const at = side(o, target, "right");
      const sx = at === "left" ? -1 : 1;
      const sy = at === "bottom" ? 1 : -1;
      const size = S(0.22, 0.03);
      const from: P = [sx * W2 * 0.82, sy * H2 * 0.7];
      const elbow: P = [
        sx * (W2 + P + S(0.35, 0.08)),
        sy * (H2 + P + S(0.3, 0.06)),
      ];
      const end: P = [elbow[0] + sx * S(0.9, 0.2), elbow[1]];
      const dot = S(0.045, 0.01);
      const text = o.label?.trim() || `FIG. ${pad2(o.count)}`;
      const shown = Math.ceil(stage(p, 0.55, 1) * [...text].length);
      return [
        ink(
          `M${f(from[0] - dot)} ${f(from[1])}a${f(dot)} ${f(dot)} 0 1 0 ${f(dot * 2)} 0a${f(dot)} ${f(dot)} 0 1 0 ${f(-dot * 2)} 0`,
          { stroke: undefined, fill: o.color, opacity: a * stage(p, 0, 0.1) },
          0,
        ),
        ink(
          line([from, elbow, end]),
          {
            width: o.weight * Math.max(0.02, 0.0025 * m),
            draw: stage(p, 0, 0.6),
            cap: "butt",
          },
          1,
        ),
        {
          key: `${key}-text`,
          behind: false,
          opacity: a,
          text: [...text].slice(0, shown).join(""),
          x: cx + (sx > 0 ? elbow[0] : end[0]),
          y: cy + end[1] - size * 0.4,
          size,
          align: "start",
          mono: true,
          fill: o.color,
        },
      ];
    }
    case "registration": {
      // Three plates slide from misregistration into one sharp mark.
      const tr = S(0.14, 0.03);
      const thin = o.weight * Math.max(0.02, 0.0024 * m);
      const gap = P * 0.6 + tr * 1.6;
      const settle = 1 - smooth(p);
      const plates = ["#00a8e8", "#ec008c", "#ffd400"];
      const parts: OverlayPart[] = [];
      const spots: P[] = [
        [-(W2 + gap), 0],
        [W2 + gap, 0],
        [0, -(H2 + gap)],
        [0, H2 + gap],
      ];
      spots.forEach(([x, y], si) => {
        plates.forEach((c, pi) => {
          const t = (pi / 3) * Math.PI * 2 + r(si) * 6;
          const off = tr * 1.6 * settle;
          parts.push({
            ...regMark(
              x + Math.cos(t) * off,
              y + Math.sin(t) * off,
              tr,
              thin,
              c,
              a * 0.9 * clamp01(p * 3),
              `${key}-${si}-${pi}`,
              cx,
              cy,
            ),
            blend: "multiply",
          });
        });
        if (p >= 1)
          parts.push(
            regMark(x, y, tr, thin, o.color, a, `${key}-${si}-k`, cx, cy),
          );
      });
      return parts;
    }
    case "colorbars": {
      const below = side(o, target, "bottom") !== "top";
      const n = Math.max(2, Math.min(16, o.count));
      const s = S(0.2, 0.035);
      const palette = [
        "#00a8e8",
        "#ec008c",
        "#ffd400",
        "#141414",
        "#e8392f",
        "#2fb24a",
        "#2a5bd7",
        "#f6f2ea",
      ];
      const greys = (i: number) => {
        const v = Math.round(255 * (i / (n - 1)));
        return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      };
      const y = below ? H2 + P * 0.6 : -H2 - P * 0.6 - s;
      return Array.from({ length: n }, (_, i) => {
        const x = -W2 + i * s * 1.05;
        const q = stage(p, (i / n) * 0.7, (i / n) * 0.7 + 0.3);
        return ink(
          rect(x, y, x + s, y + s),
          {
            stroke: undefined,
            fill: i < palette.length ? palette[i] : greys(i - palette.length),
            opacity: a * q,
            transform: `translate(${f(cx)} ${f(cy + (1 - q) * s * 0.5 * (below ? 1 : -1))})`,
          },
          i,
        );
      });
    }
    case "stamp": {
      const text = (o.label?.trim() || "APPROVED").toUpperCase();
      const size = S(0.24, 0.05);
      const tw = [...text].length * size * 0.66 + size * 0.9;
      const th = size * 1.7;
      // Stamped on the top-right corner, slammed down from above.
      const slam = 1 + (1 - smooth(p)) * 0.8;
      const t = `translate(${f(cx + W2 - tw * 0.25)} ${f(cy - H2 + th * 0.1)}) rotate(${f(o.angle)}) scale(${f(slam)})`;
      const edge = (inset: number) =>
        curve(
          jitter(
            [
              [-tw / 2 + inset, -th / 2 + inset],
              [tw / 2 - inset, -th / 2 + inset],
              [tw / 2 - inset, th / 2 - inset],
              [-tw / 2 + inset, th / 2 - inset],
              [-tw / 2 + inset, -th / 2 + inset],
            ],
            size * 0.1,
            inset * 100,
          ),
        );
      const op = a * clamp01(p * 2.5);
      return [
        ink(
          edge(0),
          { transform: t, width: size * 0.09, opacity: op, cap: "square" },
          0,
        ),
        ink(
          edge(size * 0.16),
          { transform: t, width: size * 0.035, opacity: op, cap: "square" },
          1,
        ),
        {
          key: `${key}-text`,
          behind: false,
          opacity: op,
          text,
          x: 0,
          y: size * 0.36,
          size,
          align: "middle",
          bold: true,
          mono: true,
          fill: o.color,
          transform: t,
        },
      ];
    }
    case "speedlines": {
      const n = Math.max(2, o.count);
      const span = S(1.6, 0.45);
      const thin = o.weight * Math.max(0.03, 0.004 * m);
      // Lines stream away from the direction of travel (`angle`).
      const ux = Math.cos(rad),
        uy = Math.sin(rad);
      return Array.from({ length: n }, (_, i) => {
        const lane = (i + 0.5) / n - 0.5 + (r(i) - 0.5) * (0.6 / n);
        const phase =
          (time * o.speed * (0.8 + r(i + 30) * 0.6) + r(i + 60)) % 1;
        const len = span * (0.3 + r(i + 90) * 0.5);
        const back = Math.abs(ux) * W2 + Math.abs(uy) * H2;
        const d0 = back + P * 0.3 + phase * span;
        const across = lane * (Math.abs(ux) * h + Math.abs(uy) * w) * 1.1;
        const ox = -ux * d0 - uy * across,
          oy = -uy * d0 + ux * across;
        return ink(
          line([
            [ox, oy],
            [ox - ux * len, oy - uy * len],
          ]),
          {
            behind: true,
            width: thin * (0.6 + r(i + 120)),
            opacity: a * p * Math.sin(phase * Math.PI),
          },
          i,
        );
      });
    }
    case "impact": {
      // A comic burst: a spiky ring whose hole frames the element.
      const n = Math.max(4, o.count);
      const rx = W2 + P * 0.6,
        ry = H2 + P * 0.6;
      const reach = S(0.6, 0.18) * smooth(p);
      const throb = 1 + 0.08 * Math.sin(time * o.speed * Math.PI * 2);
      const pts: P[] = [];
      for (let i = 0; i < n * 2; i++) {
        const t =
          (i / (n * 2)) * Math.PI * 2 + (r(i) - 0.5) * (Math.PI / n) * 0.5;
        const out =
          i % 2 ? 0.25 : (0.6 + r(i + 40) * 0.8) * (i % 4 ? 0.75 : 1) * throb;
        pts.push([
          Math.cos(t) * (rx + reach * out),
          Math.sin(t) * (ry + reach * out),
        ]);
      }
      const hole = `M${f(rx)} 0A${f(rx)} ${f(ry)} 0 1 0 ${f(-rx)} 0A${f(rx)} ${f(ry)} 0 1 0 ${f(rx)} 0Z`;
      return [
        ink(line(pts, true) + hole, {
          behind: true,
          stroke: undefined,
          fill: o.color,
          evenodd: true,
          opacity: a * clamp01(p * 3),
        }),
      ];
    }
    case "sparkle": {
      const n = Math.max(1, o.count);
      return Array.from({ length: n }, (_, i) => {
        // Seeded spots on a ring just outside the box.
        const t = r(i) * Math.PI * 2;
        const ring = 1 + 0.15 + r(i + 20) * 0.25;
        const x = Math.cos(t) * (W2 + P * 0.5) * ring,
          y = Math.sin(t) * (H2 + P * 0.5) * ring;
        const twinkle = Math.pow(
          Math.abs(
            Math.sin(
              time * o.speed * Math.PI * (0.8 + r(i + 40)) + r(i + 60) * 6,
            ),
          ),
          3,
        );
        const s = S(0.16, 0.035) * (0.6 + r(i + 80) * 0.6) * twinkle * p;
        const k = s * 0.18;
        return ink(
          `M0 ${f(-s)}Q${f(k)} ${f(-k)} ${f(s)} 0Q${f(k)} ${f(k)} 0 ${f(s)}Q${f(-k)} ${f(k)} ${f(-s)} 0Q${f(-k)} ${f(-k)} 0 ${f(-s)}Z`,
          {
            stroke: undefined,
            fill: o.color,
            transform: `translate(${f(cx + x)} ${f(cy + y)})`,
          },
          i,
        );
      });
    }
  }
}

/** A registration target: a ring with a cross through it. */
function regMark(
  x: number,
  y: number,
  r: number,
  width: number,
  color: string,
  opacity: number,
  key: string,
  cx: number,
  cy: number,
): OverlayPart {
  const e = r * 1.45;
  return {
    key,
    behind: false,
    opacity,
    d: `M${f(-r)} 0A${f(r)} ${f(r)} 0 1 0 ${f(r)} 0A${f(r)} ${f(r)} 0 1 0 ${f(-r)} 0M${f(-e)} 0H${f(e)}M0 ${f(-e)}V${f(e)}`,
    stroke: color,
    width,
    cap: "butt",
    transform: `translate(${f(cx + x)} ${f(cy + y)})`,
  };
}

/** Every visible part of an element's overlays, in stacking order. */
export function overlayStack(
  uses: OverlayUse[],
  time: number,
  duration: number,
  target: OverlayTarget,
) {
  return uses.flatMap((u, i) =>
    overlayParts(u.overlay, u.amount, time, duration, target, i),
  );
}

// --------------------------------------------------------------- migration

const legacyArtDecor = [
  "print",
  "shadowblock",
  "offsetframe",
  "brackets",
  "cropmarks",
  "label",
  "tape",
];
const legacyTextDecor = ["brackets", "label"];
type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Earlier definitions drew framing decorations as artwork treatments
 * (`art`) or text looks (`text`). They are overlays now; convert them so
 * saved projects and bundles keep their marks.
 */
export function migrateLegacyDecor<T>(effect: T): T {
  if (!isObject(effect) || effect.overlay !== undefined) return effect;
  const art = effect.art;
  if (isObject(art) && legacyArtDecor.includes(art.kind as string)) {
    const { art: _art, ...rest } = effect;
    const num = (k: string, d: number) =>
      typeof art[k] === "number" ? (art[k] as number) : d;
    return {
      ...rest,
      overlay: makeOverlay(
        art.kind as OverlayKind,
        {
          color: typeof art.color === "string" ? art.color : undefined,
          secondary:
            typeof art.secondary === "string" ? art.secondary : undefined,
          strength: clamp01(num("strength", 1)),
          // Artwork sizes were fractions of the frame's short side.
          pad: Math.min(10, num("distance", 0.03) / 0.025),
          angle: num("angle", 0),
          count: Math.round(Math.min(24, Math.max(1, num("count", 1)))),
          seconds: Math.min(30, Math.max(0.02, num("seconds", 0.4))),
          timing: "in",
          ...(typeof art.label === "string" ? { label: art.label } : {}),
          ...(typeof art.seed === "number" ? { seed: art.seed } : {}),
        } as Partial<Overlay>,
      ),
    } as T;
  }
  const text = effect.text;
  if (isObject(text) && legacyTextDecor.includes(text.kind as string)) {
    const { text: _text, ...rest } = effect;
    const seed = typeof text.seed === "number" ? text.seed : 17;
    return {
      ...rest,
      overlay: makeOverlay(text.kind as OverlayKind, {
        ...(typeof text.color === "string" ? { color: text.color } : {}),
        seconds:
          typeof text.seconds === "number"
            ? Math.min(30, Math.max(0.02, text.seconds))
            : 0.5,
        timing: "in",
        count: (seed % 99) + 1,
        ...(typeof text.label === "string" ? { label: text.label } : {}),
        seed,
      }),
    } as T;
  }
  return effect;
}
/** Migrates a project-like object's effects and per-instance snapshots. */
export function migrateProjectDecor(input: unknown): unknown {
  if (!isObject(input)) return input;
  const out: Loose = { ...input };
  if (Array.isArray(input.effects))
    out.effects = input.effects.map(migrateLegacyDecor);
  if (Array.isArray(input.layers))
    out.layers = input.layers.map((layer) =>
      isObject(layer) && Array.isArray(layer.effects)
        ? {
            ...layer,
            effects: layer.effects.map((instance) =>
              isObject(instance) && isObject(instance.settings)
                ? {
                    ...instance,
                    settings: migrateLegacyDecor(instance.settings),
                  }
                : instance,
            ),
          }
        : layer,
    );
  return out;
}

// --------------------------------------------------------------- controls

type OverlayField =
  | "anchor"
  | "placement"
  | "pad"
  | "size"
  | "weight"
  | "angle"
  | "count"
  | "seconds"
  | "timing"
  | "speed"
  | "wobble"
  | "boil"
  | "label"
  | "strength"
  | "color"
  | "secondary";
const drawn = {
  timing: "Draw",
  seconds: "Draw-on (seconds)",
  strength: "Opacity",
  color: "Color",
} as const;
const hand = { ...drawn, wobble: "Hand wobble", boil: "Boil (redraws/s)" };
/** Editor labels for the settings each kind uses. */
export const overlayControls: Record<
  OverlayKind,
  Partial<Record<OverlayField, string>>
> = {
  print: { ...drawn, color: "Paper", pad: "Border" },
  shadowblock: {
    ...drawn,
    color: "Shadow",
    pad: "Offset",
    angle: "Angle (degrees)",
  },
  offsetframe: {
    ...drawn,
    color: "Line",
    pad: "Offset",
    angle: "Angle (degrees)",
    weight: "Line weight",
  },
  brackets: { ...drawn, pad: "Gap", size: "Size", weight: "Line weight" },
  cropmarks: { ...drawn, pad: "Gap", size: "Size", weight: "Line weight" },
  label: {
    ...drawn,
    label: "Label text",
    count: "Index",
    placement: "Side",
    size: "Size",
    seconds: "Type-on (seconds)",
  },
  tape: { ...drawn, color: "Tape", size: "Size" },
  circle: { ...hand, anchor: "Marks", pad: "Gap", weight: "Line weight" },
  underline: {
    ...hand,
    anchor: "Marks",
    count: "Lines",
    weight: "Line weight",
  },
  highlight: { ...hand, anchor: "Marks", weight: "Height" },
  strike: { ...hand, anchor: "Marks", count: "Lines", weight: "Line weight" },
  arrow: {
    ...hand,
    anchor: "Points at",
    placement: "From",
    pad: "Gap",
    size: "Length",
    weight: "Line weight",
  },
  tick: {
    ...hand,
    anchor: "Marks",
    placement: "Side",
    size: "Size",
    weight: "Line weight",
  },
  cross: {
    ...hand,
    anchor: "Marks",
    placement: "Side",
    size: "Size",
    weight: "Line weight",
  },
  star: {
    ...hand,
    anchor: "Marks",
    placement: "Side",
    size: "Size",
    speed: "Rock speed",
  },
  dimension: {
    ...drawn,
    anchor: "Measures",
    placement: "Side",
    label: "Readout",
    pad: "Gap",
    size: "Size",
  },
  crosshair: { ...drawn, anchor: "Centers on", label: "Readout", size: "Size" },
  ruler: {
    ...drawn,
    placement: "Side",
    count: "Divisions",
    pad: "Gap",
    size: "Size",
  },
  callout: {
    ...drawn,
    anchor: "Points at",
    placement: "Side",
    label: "Label text",
    count: "Figure number",
    pad: "Gap",
    size: "Size",
  },
  registration: { ...drawn, color: "Final mark", pad: "Gap", size: "Size" },
  colorbars: {
    timing: "Draw",
    seconds: "Draw-on (seconds)",
    strength: "Opacity",
    placement: "Side",
    count: "Patches",
    pad: "Gap",
    size: "Size",
  },
  stamp: {
    ...hand,
    label: "Stamp text",
    angle: "Angle (degrees)",
    size: "Size",
    seconds: "Slam (seconds)",
  },
  speedlines: {
    ...drawn,
    count: "Lines",
    angle: "Travel direction (degrees)",
    speed: "Speed",
    size: "Length",
    weight: "Line weight",
    pad: "Gap",
  },
  impact: {
    ...drawn,
    anchor: "Bursts from",
    count: "Rays",
    speed: "Throb speed",
    size: "Reach",
    pad: "Gap",
  },
  sparkle: {
    ...drawn,
    anchor: "Around",
    count: "Sparkles",
    speed: "Twinkle speed",
    size: "Size",
    pad: "Gap",
  },
};
