import {
  bezier,
  curve,
  ellipse,
  f,
  hand,
  line,
  roundRect,
  stage,
  type Ctx,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

/** Where a small mark beside the box goes, in box coordinates. */
function beside(c: Ctx, s: number, prefer: "right" | "left" = "right"): P {
  const { W2, H2, P } = c;
  const at = c.side(prefer);
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
  return [ox, oy];
}

/** Marks drawn along each line or the box: underline, highlight, strike. */
function lineMarks(c: Ctx): OverlayPart[] {
  const { o, p, box, target, S, lw, r, jitter, ink, key } = c;
  const boxes =
    o.anchor === "lines" && target.lines?.length ? target.lines : [box];
  const lines = o.kind === "highlight" ? 1 : Math.max(1, Math.min(3, o.count));
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

/** A curly, square or round brace of half-height `H` at x, opening right. */
function brace(x: number, H: number, k: number, variant: number) {
  if (variant === 1)
    return line([
      [x + k, -H],
      [x, -H],
      [x, H],
      [x + k, H],
    ]);
  if (variant === 2)
    return `M${f(x + k)} ${f(-H)}Q${f(x - k)} 0 ${f(x + k)} ${f(H)}`;
  if (variant === 3)
    return line([
      [x, -H],
      [x, H],
    ]);
  return `M${f(x + k)} ${f(-H)}Q${f(x)} ${f(-H)} ${f(x)} ${f(-H + k)}V${f(-k)}Q${f(x)} 0 ${f(x - k)} 0Q${f(x)} 0 ${f(x)} ${f(k)}V${f(H - k)}Q${f(x)} ${f(H)} ${f(x + k)} ${f(H)}`;
}

export const annotateKinds: Partial<Record<OverlayKind, KindSpec>> = {
  circle: {
    name: "Circle it",
    feel: "Annotate",
    description: "A quick marker loop around the element or its key word.",
    defaults: { wobble: 0.55, seconds: 0.6, weight: 1.2 },
    controls: {
      ...hand,
      anchor: "Marks",
      pad: "Gap",
      weight: "Line weight",
      count: "Loops",
    },
    text: true,
    strokes: true,
    fills: true,
    draw: ({ o, p, W2, H2, P, S, lw, r, jitter, ink }) => {
      const rx = W2 + P * 0.9,
        ry = H2 + P * 0.9;
      const loops = Math.max(1, Math.min(4, o.count));
      const n = 28 * loops;
      const start = -1.9 + (r(90) - 0.5) * 0.6;
      const pts: P[] = Array.from({ length: n + 1 }, (_, i) => {
        const u = i / n;
        const t = start + u * Math.PI * 2 * (loops + 0.1);
        // The stroke spirals slightly so its ends overlap without closing.
        const grow = 1 + (u - 0.5) * 0.08 * loops;
        return [Math.cos(t) * rx * grow, Math.sin(t) * ry * grow];
      });
      return [
        ink(curve(jitter(pts, S(0.08, 0.02), 3)), {
          width: lw * 1.4,
          draw: p,
          closed: true,
          encloses: true,
        }),
      ];
    },
  },
  underline: {
    name: "Hand underline",
    feel: "Annotate",
    description: "A hand-drawn underline, under the block or each line.",
    defaults: { wobble: 0.4, seconds: 0.45 },
    controls: {
      ...hand,
      anchor: "Marks",
      count: "Lines",
      weight: "Line weight",
    },
    text: true,
    strokes: true,
    draw: lineMarks,
  },
  highlight: {
    name: "Highlighter",
    feel: "Annotate",
    description: "A translucent highlighter swipe behind the words.",
    defaults: { color: "#ffe14d", strength: 0.6, wobble: 0.25, seconds: 0.4 },
    controls: { ...hand, anchor: "Marks", weight: "Height" },
    text: true,
    strokes: true,
    draw: lineMarks,
  },
  strike: {
    name: "Strike through",
    feel: "Annotate",
    description: "A line struck through the words.",
    defaults: { wobble: 0.3, seconds: 0.35 },
    controls: {
      ...hand,
      anchor: "Marks",
      count: "Lines",
      weight: "Line weight",
    },
    text: true,
    strokes: true,
    draw: lineMarks,
  },
  arrow: {
    name: "Pointer arrow",
    feel: "Annotate",
    description: "A marker arrow swoops in and points at the element.",
    defaults: { wobble: 0.45, seconds: 0.6 },
    controls: {
      ...hand,
      anchor: "Points at",
      placement: "From",
      pad: "Gap",
      size: "Length",
      weight: "Line weight",
      variant: "Shaft",
    },
    variants: ["Bowed", "Straight", "Loop"],
    text: true,
    strokes: true,
    draw: ({ o, p, W2, H2, P, S, lw, jitter, ink, side }) => {
      const at = side("right");
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
      const ux = dx / norm,
        uy = dy / norm;
      const start: P = [end[0] + ux * len, end[1] + uy * len];
      // The shaft bows to one side, like a quick marker gesture.
      const bend = o.variant === 1 ? 0 : len * 0.3;
      const mid: P = [
        (start[0] + end[0]) / 2 - uy * bend,
        (start[1] + end[1]) / 2 + ux * bend,
      ];
      let pts = bezier(start, mid, end, 6);
      if (o.variant === 2) {
        // A loop-the-loop on the way in.
        pts = Array.from({ length: 25 }, (_, i): P => {
          const u = i / 24;
          const base: P = [
            start[0] + (end[0] - start[0]) * u,
            start[1] + (end[1] - start[1]) * u,
          ];
          const loop = Math.sin(u * Math.PI) * len * 0.22;
          const t = u * Math.PI * 2;
          return [
            base[0] +
              Math.cos(t + Math.PI / 2) * loop * -uy +
              Math.sin(t) * loop * ux * 0.6,
            base[1] +
              Math.cos(t + Math.PI / 2) * loop * ux +
              Math.sin(t) * loop * uy * 0.6,
          ];
        });
      }
      const shaft = jitter(pts, S(0.05, 0.012), 5);
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
          { draw: stage(p, 0.7, 1), width: lw * 1.2 },
          1,
        ),
      ];
    },
  },
  tick: {
    name: "Tick",
    feel: "Annotate",
    description: "A check mark beside the element.",
    defaults: { color: "#3ad08a", wobble: 0.35, seconds: 0.35 },
    controls: {
      ...hand,
      anchor: "Marks",
      placement: "Side",
      size: "Size",
      weight: "Line weight",
    },
    text: true,
    strokes: true,
    draw: (c) => {
      const s = c.S(0.42, 0.1);
      const [ox, oy] = beside(c, s);
      c.pivot = [ox, oy];
      return [
        c.ink(
          curve(
            c.jitter(
              [
                [ox - 0.5 * s, oy - 0.02 * s],
                [ox - 0.2 * s, oy + 0.3 * s],
                [ox + 0.55 * s, oy - 0.5 * s],
              ],
              s * 0.12,
            ),
          ),
          { draw: c.p, width: c.lw * 1.5 },
        ),
      ];
    },
  },
  cross: {
    name: "Cross",
    feel: "Annotate",
    description: "A cross beside the element.",
    defaults: { wobble: 0.35, seconds: 0.35 },
    controls: {
      ...hand,
      anchor: "Marks",
      placement: "Side",
      size: "Size",
      weight: "Line weight",
    },
    text: true,
    strokes: true,
    draw: (c) => {
      const s = c.S(0.42, 0.1);
      const [ox, oy] = beside(c, s);
      c.pivot = [ox, oy];
      const amp = s * 0.12;
      const stroke = (a: P, b: P, k: number, from: number, to: number) =>
        c.ink(
          line(
            c.jitter(
              [
                [ox + a[0] * s, oy + a[1] * s],
                [ox + b[0] * s, oy + b[1] * s],
              ],
              amp,
              k * 9,
            ),
          ),
          { draw: stage(c.p, from, to), width: c.lw * 1.5 },
          k,
        );
      return [
        stroke([-0.45, -0.45], [0.45, 0.45], 0, 0, 0.55),
        stroke([0.45, -0.45], [-0.45, 0.45], 1, 0.45, 1),
      ];
    },
  },
  star: {
    name: "Margin star",
    feel: "Annotate",
    description: "A doodled star that rocks gently beside the element.",
    defaults: { color: "#ffe14d", wobble: 0.45, seconds: 0.5 },
    controls: {
      ...hand,
      anchor: "Marks",
      placement: "Side",
      size: "Size",
      speed: "Rock speed",
      count: "Points",
    },
    text: true,
    strokes: true,
    fills: true,
    draw: (c) => {
      const { o, p, time, lw } = c;
      const s = c.S(0.42, 0.1);
      const [ox, oy] = beside(c, s);
      c.pivot = [ox, oy];
      const points = o.count < 4 ? 5 : Math.min(12, o.count);
      const star: P[] = Array.from({ length: points * 2 + 1 }, (_, i) => {
        const t2 = -Math.PI / 2 + (i * Math.PI) / points;
        const rr = (i % 2 ? 0.22 : 0.55) * s;
        return [Math.cos(t2) * rr, Math.sin(t2) * rr];
      });
      return [
        c.ink(line(c.jitter(star, s * 0.12)), {
          transform: `translate(${f(c.cx + ox)} ${f(c.cy + oy)}) rotate(${f(o.angle + Math.sin(time * o.speed * 2) * 6)})`,
          draw: p,
          width: lw * 1.1,
          closed: true,
          ...(p >= 1 ? { fill: o.color } : {}),
        }),
      ];
    },
  },
  box: {
    name: "Box it",
    feel: "Annotate",
    description:
      "A hand-drawn box around the element or key word, corners overshooting like a quick pen.",
    defaults: { color: "#f2765e", wobble: 0.5, seconds: 0.6, weight: 1.1 },
    controls: {
      ...hand,
      anchor: "Marks",
      pad: "Gap",
      weight: "Line weight",
      variant: "Shape",
    },
    variants: ["Loose", "Two passes", "Rounded", "Cloud"],
    text: true,
    strokes: true,
    fills: true,
    draw: ({ o, p, W2, H2, P, S, lw, r, jitter, ink, m }) => {
      const x = W2 + P * 0.8,
        y = H2 + P * 0.8;
      const amp = S(0.1, 0.025);
      if (o.variant === 2)
        return [
          ink(roundRect(-x, -y, x, y, Math.min(x, y) * 0.45), {
            draw: p,
            width: lw * 1.2,
            closed: true,
            encloses: true,
          }),
        ];
      if (o.variant === 3) {
        // Scalloped cloud: bumps all the way round.
        const n = Math.max(
          8,
          Math.round(((x + y) * 2) / Math.max(0.35, 0.08 * m)),
        );
        const pts: P[] = [];
        for (let i = 0; i < n; i++) {
          const t = (i / n) * Math.PI * 2;
          pts.push([Math.cos(t) * x * 1.08, Math.sin(t) * y * 1.15]);
        }
        let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
        for (let i = 0; i < n; i++) {
          const a = pts[i],
            b = pts[(i + 1) % n];
          const mx = (a[0] + b[0]) / 2,
            my = (a[1] + b[1]) / 2;
          const k = 1.35 + (r(i) - 0.5) * 0.3 * o.wobble;
          d += `Q${f(mx * k)} ${f(my * k)} ${f(b[0])} ${f(b[1])}`;
        }
        return [
          ink(d + "Z", {
            draw: p,
            width: lw * 1.1,
            closed: true,
            encloses: true,
          }),
        ];
      }
      const pass = (k: number): P[] => {
        const over = S(0.18, 0.04);
        return jitter(
          [
            [-x - over * 0.3, -y],
            [x, -y - over * 0.15],
            [x + over * 0.1, y],
            [-x, y + over * 0.1],
            [-x + over * 0.2, -y - over * 0.4],
            [-x + over * 1.6, -y - over * 0.25],
          ],
          amp,
          k * 50,
        );
      };
      const parts = [
        ink(line(pass(0)), {
          draw: o.variant === 1 ? stage(p, 0, 0.6) : p,
          width: lw * 1.2,
          closed: true,
          encloses: true,
        }),
      ];
      if (o.variant === 1)
        parts.push(
          ink(line(pass(1)), { draw: stage(p, 0.45, 1), width: lw * 0.8 }, 1),
        );
      return parts;
    },
  },
  braces: {
    name: "Side braces",
    feel: "Annotate",
    description:
      "Braces, brackets or bars on both sides, or on one side, like a margin note.",
    defaults: { color: "#f6f2ea", seconds: 0.5, weight: 1, pad: 0.8 },
    controls: {
      ...hand,
      anchor: "Marks",
      placement: "Side",
      pad: "Gap",
      size: "Curl",
      weight: "Line weight",
      variant: "Shape",
    },
    variants: ["Curly", "Square", "Round", "Bar"],
    text: true,
    strokes: true,
    draw: ({ o, p, W2, H2, P, S, lw, ink, cx, cy }) => {
      const k = S(0.18, 0.04);
      const vertical = o.placement === "top" || o.placement === "bottom";
      const sides =
        o.placement === "auto"
          ? [-1, 1]
          : o.placement === "left" || o.placement === "top"
            ? [-1]
            : [1];
      const reach = vertical ? W2 + P * 0.3 : H2 + P * 0.3;
      const off = (vertical ? H2 : W2) + P * 0.8;
      return sides.map((s, n) => {
        // Drawn as a left brace, then mirrored and turned into place.
        const d = brace(-off, reach * (0.4 + 0.6 * p), k, o.variant);
        const rot = vertical ? (s < 0 ? 90 : -90) : s < 0 ? 0 : 180;
        return ink(
          d,
          {
            width: lw,
            transform: `translate(${f(cx)} ${f(cy)}) rotate(${rot})`,
            draw: p,
          },
          n,
        );
      });
    },
  },
  scribble: {
    name: "Scribble out",
    feel: "Annotate",
    description: "Scribbled over, like crossing out a word by hand.",
    defaults: {
      color: "#f2765e",
      wobble: 0.6,
      seconds: 0.7,
      count: 6,
      weight: 1.4,
    },
    controls: {
      ...hand,
      anchor: "Marks",
      count: "Passes",
      weight: "Line weight",
      variant: "Scribble",
    },
    variants: ["Zigzag", "Loops", "Hatch"],
    text: true,
    strokes: true,
    draw: ({ o, p, W2, H2, S, lw, jitter, ink }) => {
      const n = Math.max(2, Math.min(24, o.count));
      const x0 = -W2 * 1.04,
        x1 = W2 * 1.04;
      const y0 = -H2 * 0.75,
        y1 = H2 * 0.75;
      let pts: P[] = [];
      if (o.variant === 1) {
        // Cursive loops travelling along the line.
        const steps = n * 10;
        pts = Array.from({ length: steps + 1 }, (_, i): P => {
          const u = i / steps;
          const t = u * n * Math.PI * 2;
          return [
            x0 + (x1 - x0) * u + Math.cos(t) * (W2 / n) * 0.9,
            Math.sin(t) * (y1 - y0) * 0.45,
          ];
        });
      } else if (o.variant === 2) {
        const parts = Array.from({ length: n * 2 }, (_, i) => {
          const u = (i + 0.5) / (n * 2);
          const x = x0 + (x1 - x0) * u;
          const lean = H2 * 0.6;
          return ink(
            line(
              jitter(
                [
                  [x - lean, y1],
                  [x + lean, y0],
                ],
                S(0.08, 0.02),
                i * 4,
              ),
            ),
            {
              draw: stage(p, (i / (n * 2)) * 0.7, (i / (n * 2)) * 0.7 + 0.3),
              width: lw,
            },
            i,
          );
        });
        return parts;
      } else {
        for (let i = 0; i <= n * 2; i++) {
          const u = i / (n * 2);
          pts.push([x0 + (x1 - x0) * u, i % 2 ? y1 : y0]);
        }
      }
      return [
        ink(curve(jitter(pts, S(0.12, 0.03), 11)), {
          draw: p,
          width: lw * 1.1,
        }),
      ];
    },
  },
  squiggle: {
    name: "Wavy underline",
    feel: "Annotate",
    description: "A wavy, zigzag or looped line under each line of text.",
    defaults: { color: "#f2765e", seconds: 0.5, wobble: 0.15, speed: 0 },
    controls: {
      ...hand,
      anchor: "Marks",
      size: "Wave height",
      count: "Lines",
      speed: "Travel speed",
      weight: "Line weight",
      variant: "Wave",
    },
    variants: ["Wave", "Zigzag", "Loops", "Double wave"],
    text: true,
    strokes: true,
    draw: ({ o, p, W2, H2, S, lw, jitter, ink, time, m }) => {
      const amp = S(0.06, 0.015);
      const wave = Math.max(0.28, 0.06 * m) * Math.max(0.5, o.size);
      const waves = Math.max(3, Math.round((W2 * 2) / wave));
      const lines = o.variant === 3 ? 2 : Math.max(1, Math.min(3, o.count));
      const shift = time * o.speed * Math.PI * 2;
      return Array.from({ length: lines }, (_, k) => {
        const y = H2 + S(0.1, 0.02) + k * amp * 3;
        const steps = waves * (o.variant === 1 ? 2 : 8);
        const pts = Array.from({ length: steps + 1 }, (_, i): P => {
          const u = i / steps;
          const t = u * waves * Math.PI * 2 + shift + k * Math.PI;
          const x = -W2 * 1.03 + W2 * 2.06 * u;
          if (o.variant === 1) return [x, y + (i % 2 ? amp : -amp)];
          if (o.variant === 2)
            return [x + Math.cos(t) * amp * 1.2, y + Math.sin(t) * amp * 1.4];
          return [x, y + Math.sin(t) * amp];
        });
        return ink(
          (o.variant === 1 ? line : curve)(jitter(pts, amp * 0.5, k * 30)),
          {
            draw: stage(p, k / lines, (k + 1) / lines),
            width: lw,
          },
          k,
        );
      });
    },
  },
  swoosh: {
    name: "Brush swoosh",
    feel: "Annotate",
    description:
      "A tapered paint stroke: a swash under the words, a swatch behind them, an arc over or an ensō ring.",
    defaults: {
      color: "#f2765e",
      stroke: "brush",
      seconds: 0.55,
      weight: 2.2,
      wobble: 0.2,
    },
    controls: {
      ...hand,
      anchor: "Marks",
      weight: "Brush width",
      pad: "Gap",
      variant: "Stroke",
    },
    variants: ["Under", "Swatch", "Arc over", "Ring"],
    text: true,
    strokes: true,
    draw: ({ o, p, W2, H2, P, S, lw, jitter, ink, h }) => {
      let pts: P[];
      let width = lw * 2.2;
      if (o.variant === 1) {
        width = h * 0.85 * (o.weight / 2.2);
        pts = [
          [-W2 * 1.08, H2 * 0.15],
          [-W2 * 0.4, -H2 * 0.05],
          [W2 * 0.4, H2 * 0.05],
          [W2 * 1.06, -H2 * 0.12],
        ];
      } else if (o.variant === 2) {
        const y = -H2 - P * 0.5;
        pts = bezier(
          [-W2 * 1.05, y + H2 * 0.4],
          [0, y - H2 * 0.9],
          [W2 * 1.05, y + H2 * 0.3],
          8,
        );
      } else if (o.variant === 3) {
        const rx = W2 + P,
          ry = H2 + P;
        pts = Array.from({ length: 33 }, (_, i): P => {
          const t = -2.2 + (i / 32) * Math.PI * 1.85;
          return [Math.cos(t) * rx, Math.sin(t) * ry];
        });
      } else {
        const y = H2 + P * 0.35 + S(0.05, 0.01);
        pts = bezier(
          [-W2 * 1.05, y + H2 * 0.2],
          [-W2 * 0.1, y + H2 * 0.45],
          [W2 * 1.1, y - H2 * 0.35],
          8,
        );
      }
      return [
        ink(curve(jitter(pts, S(0.06, 0.015))), {
          draw: p,
          width,
          behind: true,
        }),
      ];
    },
  },
  margin: {
    name: "Margin marks",
    feel: "Annotate",
    description:
      "An editor's marks in the margin: !!, ?, an asterisk, NB or a margin bar.",
    defaults: {
      color: "#f2765e",
      wobble: 0.35,
      seconds: 0.4,
      placement: "left",
    },
    controls: {
      ...hand,
      anchor: "Marks",
      placement: "Side",
      size: "Size",
      weight: "Line weight",
      variant: "Mark",
    },
    variants: ["!!", "?", "Asterisk", "NB", "Margin bar"],
    text: true,
    strokes: true,
    draw: (c) => {
      const { o, p, H2, lw, jitter, ink } = c;
      const s = c.S(0.45, 0.1);
      const [ox, oy0] = beside(c, s, "left");
      const oy = o.variant === 4 ? 0 : oy0 + H2 * 0.45;
      c.pivot = [ox, oy];
      const amp = s * 0.1;
      const at = (x: number, y: number): P => [ox + x * s, oy + y * s];
      const dot = (x: number, y: number, n: number, from: number) =>
        c.solid(
          ellipse(at(x, y)[0], at(x, y)[1], lw * 0.9),
          {
            opacity: c.a * stage(p, from, 1),
            transform: `translate(${f(c.cx)} ${f(c.cy)})`,
          },
          n,
        );
      const stroke = (pts: P[], n: number, from: number, to: number) =>
        ink(
          curve(jitter(pts, amp, n * 7)),
          { draw: stage(p, from, to), width: lw * 1.3 },
          n,
        );
      switch (o.variant) {
        case 1:
          return [
            stroke(
              [
                at(-0.25, -0.3),
                at(-0.05, -0.5),
                at(0.22, -0.38),
                at(0.18, -0.12),
                at(0, 0.05),
                at(0, 0.22),
              ],
              0,
              0,
              0.8,
            ),
            dot(0, 0.48, 1, 0.8),
          ];
        case 2:
          return [0, 60, 120].map((deg, n) => {
            const t = (deg * Math.PI) / 180;
            return stroke(
              [
                at(-Math.cos(t) * 0.5, -Math.sin(t) * 0.5),
                at(Math.cos(t) * 0.5, Math.sin(t) * 0.5),
              ],
              n,
              n / 3,
              (n + 1) / 3,
            );
          });
        case 3:
          return [
            c.text(c.label("NB"), ox, oy + s * 0.35, s * 0.95, {
              font: "hand",
              bold: true,
              mono: false,
              opacity: c.a * stage(p, 0, 0.6),
            }),
            stroke([at(-0.6, 0.55), at(0.6, 0.5)], 1, 0.5, 1),
          ];
        case 4:
          return [
            stroke(
              [
                [ox, -H2],
                [ox + amp * 0.3, 0],
                [ox, H2],
              ],
              0,
              0,
              1,
            ),
          ];
        default:
          return [-0.22, 0.22].flatMap((x, k) => [
            stroke(
              [at(x, -0.5), at(x + 0.02, 0.18)],
              k * 2,
              k * 0.3,
              k * 0.3 + 0.5,
            ),
            dot(x + 0.02, 0.45, k * 2 + 1, k * 0.3 + 0.5),
          ]);
      }
    },
  },
};
