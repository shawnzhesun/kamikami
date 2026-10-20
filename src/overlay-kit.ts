import { clamp01, effectRandom, smooth } from "./visual-effects";
import type {
  Overlay,
  OverlayBox,
  OverlayField,
  OverlayPart,
  OverlayTarget,
} from "./overlays";

/**
 * Shared geometry for overlay kinds. Each kind is a pure function from a
 * drawing context (the anchored box in overlay units, the draw-on amount and
 * time) to SVG parts; the engine then applies the shared line and fill
 * styles, entrances, loops and placement.
 */
export type P = [number, number];
export const f = (n: number) => +n.toFixed(3);
export const line = (pts: P[], closed = false) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("") +
  (closed ? "Z" : "");
export const rect = (x0: number, y0: number, x1: number, y1: number) =>
  line(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    true,
  );
/** A rounded rectangle. */
export function roundRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
) {
  const k = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (k <= 0) return rect(x0, y0, x1, y1);
  return `M${f(x0 + k)} ${f(y0)}H${f(x1 - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x1)} ${f(y0 + k)}V${f(y1 - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x1 - k)} ${f(y1)}H${f(x0 + k)}A${f(k)} ${f(k)} 0 0 1 ${f(x0)} ${f(y1 - k)}V${f(y0 + k)}A${f(k)} ${f(k)} 0 0 1 ${f(x0 + k)} ${f(y0)}Z`;
}
/** A full ellipse as two arcs. */
export const ellipse = (x: number, y: number, rx: number, ry = rx) =>
  `M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 1 0 ${f(x + rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 1 0 ${f(x - rx)} ${f(y)}Z`;
/** An open arc from angle a0 to a1 (radians, clockwise from +x). */
export function arc(
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  ry = r,
) {
  const span = a1 - a0;
  if (Math.abs(span) >= Math.PI * 2 - 1e-6) return ellipse(x, y, r, ry);
  const p0: P = [x + Math.cos(a0) * r, y + Math.sin(a0) * ry];
  const p1: P = [x + Math.cos(a1) * r, y + Math.sin(a1) * ry];
  return `M${f(p0[0])} ${f(p0[1])}A${f(r)} ${f(ry)} 0 ${Math.abs(span) > Math.PI ? 1 : 0} ${span > 0 ? 1 : 0} ${f(p1[0])} ${f(p1[1])}`;
}
/** A regular polygon (or star when `inner` is set). */
export function polygon(
  x: number,
  y: number,
  r: number,
  sides: number,
  rotation = -Math.PI / 2,
  inner?: number,
): P[] {
  const n = inner === undefined ? sides : sides * 2;
  return Array.from({ length: n }, (_, i) => {
    const t = rotation + (i / n) * Math.PI * 2;
    const rr = inner !== undefined && i % 2 ? inner : r;
    return [x + Math.cos(t) * rr, y + Math.sin(t) * rr];
  });
}
/** A smooth curve through points (Catmull-Rom as cubic Béziers). */
export function curve(pts: P[], closed = false) {
  if (pts.length < 3) return line(pts, closed);
  const at = (i: number) =>
    closed
      ? pts[(i + pts.length) % pts.length]
      : pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? "Z" : "");
}
/** Points along a quadratic Bézier. */
export const bezier = (a: P, c: P, b: P, n = 8): P[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n,
      v = 1 - u;
    return [
      v * v * a[0] + 2 * v * u * c[0] + u * u * b[0],
      v * v * a[1] + 2 * v * u * c[1] + u * u * b[1],
    ];
  });
/** An arrowhead at `tip`, pointing along `angle` (radians). */
export function arrowhead(tip: P, angle: number, size: number, spread = 0.5) {
  const wing = (s: number): P => [
    tip[0] - Math.cos(angle + s * spread) * size,
    tip[1] - Math.sin(angle + s * spread) * size,
  ];
  return line([wing(-1), tip, wing(1)]);
}
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const timecode = (seconds: number) =>
  `${pad2(Math.floor(seconds / 60))}:${pad2(Math.floor(seconds % 60))}.${pad2(Math.floor((seconds % 1) * 100))}`;
/** Progress of a sub-step of the draw-on, 0–1. */
export const stage = (p: number, from: number, to: number) =>
  clamp01((p - from) / Math.max(1e-6, to - from));
/** Overshooting ease for pops and drops. */
export const backOut = (t: number, k = 1.7) => {
  const u = clamp01(t) - 1;
  return 1 + (k + 1) * u * u * u + k * u * u;
};
export const outPow = (t: number, k = 3) => 1 - Math.pow(1 - clamp01(t), k);
export { clamp01, smooth };

export type Side = "top" | "bottom" | "left" | "right";
/** The side with the most free space, or the requested one. */
export function side(o: Overlay, target: OverlayTarget, prefer: Side): Side {
  if (o.placement !== "auto") return o.placement;
  const room = target.room;
  if (!room) return prefer;
  // Keep the preferred side when it has room for the mark.
  if (room[prefer] > 2.5) return prefer;
  return (["bottom", "top", "right", "left"] as const).reduce((a, b) =>
    room[b] > room[a] ? b : a,
  );
}

/** A registration target: a ring with a cross through it. */
export function regMark(
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

/** Everything a kind needs to draw one frame. */
export type Ctx = {
  o: Overlay;
  /** Opacity, 0–1. */
  a: number;
  /** Draw-on amount, 0–1. */
  p: number;
  time: number;
  duration: number;
  target: OverlayTarget;
  /** The anchored box. */
  box: OverlayBox;
  cx: number;
  cy: number;
  w: number;
  h: number;
  W2: number;
  H2: number;
  /** The box's shorter side. */
  m: number;
  /** A size that reads on titles and grows with large pictures. */
  S: (text: number, rel: number) => number;
  /** Hairline: thin drafting strokes. */
  thin: number;
  /** Line weight. */
  lw: number;
  /** Gap from the box. */
  P: number;
  /** `angle` in radians. */
  rad: number;
  /** Seeded random in [0, 1), redrawn on boil steps. */
  r: (n: number) => number;
  /** Seeded random that never boils, for layouts. */
  fixed: (n: number) => number;
  jitter: (pts: P[], amp: number, k?: number) => P[];
  key: string;
  /** A stroked path centered on the box. */
  ink: (d: string, part?: Partial<OverlayPart>, n?: number) => OverlayPart;
  /** A filled shape centered on the box. */
  solid: (d: string, part?: Partial<OverlayPart>, n?: number) => OverlayPart;
  /** Text in box coordinates. */
  text: (
    s: string,
    x: number,
    y: number,
    size: number,
    part?: Partial<OverlayPart>,
    n?: number,
  ) => OverlayPart;
  side: (prefer: Side) => Side;
  /** The label, or a default. */
  label: (fallback: string) => string;
  /** Where pops and spins pivot, in box coordinates; defaults to the center. */
  pivot?: P;
};

export type KindSpec = {
  name: string;
  /** Gallery section. */
  feel: string;
  description: string;
  /** Defaults on top of the shared ones. */
  defaults: Partial<Overlay>;
  /** Editor labels for the shape settings it uses. */
  controls: Partial<Record<OverlayField, string>>;
  /** Names of its `variant` shapes, if it has several. */
  variants?: readonly string[];
  /** Has closed shapes that take a fill style. */
  fills?: boolean;
  /** Has lines that take a line style. */
  strokes?: boolean;
  /** Previewed around text rather than a picture. */
  text?: boolean;
  draw: (c: Ctx) => OverlayPart[];
};

/** Builds a kind's context from the anchored box. */
export function context(
  o: Overlay,
  a: number,
  p: number,
  time: number,
  duration: number,
  target: OverlayTarget,
  box: OverlayBox,
  key: string,
): Ctx {
  const { x: cx, y: cy, w, h } = box;
  const m = Math.min(w, h);
  const S = (text: number, rel: number) => Math.max(text, rel * m) * o.size;
  // A boiling line redraws on held frames, like pencil animation.
  const tick = o.boil > 0 ? Math.floor(time * o.boil) : 0;
  const r = (n: number) => effectRandom(o.seed + tick * 7919, n);
  const fixed = (n: number) => effectRandom(o.seed, n);
  const at = `translate(${f(cx)} ${f(cy)})`;
  const c: Ctx = {
    o,
    a,
    p,
    time,
    duration,
    target,
    box,
    cx,
    cy,
    w,
    h,
    W2: w / 2,
    H2: h / 2,
    m,
    S,
    thin: o.weight * Math.max(0.02, 0.0025 * m),
    lw: o.weight * Math.max(0.05, 0.006 * m),
    P: o.pad * Math.max(0.25, 0.035 * m),
    rad: (o.angle * Math.PI) / 180,
    r,
    fixed,
    jitter: (pts, amp, k = 0) =>
      pts.map(([x, y], i) => [
        x + (r(k + i * 2) - 0.5) * amp * o.wobble,
        y + (r(k + i * 2 + 1) - 0.5) * amp * o.wobble,
      ]),
    key,
    ink: (d, part = {}, n = 0) => ({
      key: `${key}-${n}`,
      behind: false,
      opacity: a,
      d,
      stroke: o.color,
      width: c.lw,
      cap: "round",
      transform: at,
      ...part,
    }),
    solid: (d, part = {}, n = 0) => ({
      key: `${key}-${n}`,
      behind: false,
      opacity: a,
      d,
      fill: o.color,
      transform: at,
      closed: true,
      ...part,
    }),
    text: (s, x, y, size, part = {}, n = 0) => ({
      key: `${key}-t${n}`,
      behind: false,
      opacity: a,
      text: s,
      x: cx + x,
      y: cy + y,
      size,
      align: "middle",
      mono: true,
      fill: o.color,
      ...part,
    }),
    side: (prefer) => side(o, target, prefer),
    label: (fallback) => o.label?.trim() || fallback,
  };
  return c;
}

/**
 * The frame's edges relative to the anchored box's center, in units. Without
 * a stage (gallery previews) it falls back to a margin around the box.
 */
export function frameEdges({ target, cx, cy, W2, H2 }: Ctx) {
  const { room, box } = target;
  if (!room)
    return { left: -W2 - 8, right: W2 + 8, top: -H2 - 5, bottom: H2 + 5 };
  return {
    left: box.x - box.w / 2 - room.left - cx,
    right: box.x + box.w / 2 + room.right - cx,
    top: box.y - box.h / 2 - room.top - cy,
    bottom: box.y + box.h / 2 + room.bottom - cy,
  };
}

/** Control labels shared by drawn marks. */
export const drawn = {
  timing: "Draw",
  seconds: "Draw-on (seconds)",
  strength: "Opacity",
  color: "Color",
} as const;
/** Control labels shared by hand-drawn marks. */
export const hand = {
  ...drawn,
  wobble: "Hand wobble",
  boil: "Boil (redraws/s)",
} as const;
