import {
  backOut,
  bezier,
  curve,
  ellipse,
  f,
  hand,
  line,
  stage,
  type Ctx,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

/** The top corner the mark sits on, in box coordinates. */
function corner(c: Ctx, s: number): P {
  const left = c.o.placement === "left";
  const below = c.o.placement === "bottom";
  return [
    (left ? -1 : 1) * (c.W2 * 0.85 + s * 0.2),
    below ? c.H2 + c.P * 0.4 + s * 0.6 : -c.H2 - c.P * 0.4 - s * 0.5,
  ];
}
const drop = (x: number, y: number, s: number) =>
  `M${f(x)} ${f(y - s)}C${f(x + s * 0.5)} ${f(y - s * 0.25)} ${f(x + s * 0.58)} ${f(y + s * 0.3)} ${f(x)} ${f(y + s * 0.62)}C${f(x - s * 0.58)} ${f(y + s * 0.3)} ${f(x - s * 0.5)} ${f(y - s * 0.25)} ${f(x)} ${f(y - s)}Z`;
const heart = (x: number, y: number, s: number) =>
  `M${f(x)} ${f(y + s * 0.55)}C${f(x - s * 0.9)} ${f(y - s * 0.05)} ${f(x - s * 0.45)} ${f(y - s * 0.75)} ${f(x)} ${f(y - s * 0.25)}C${f(x + s * 0.45)} ${f(y - s * 0.75)} ${f(x + s * 0.9)} ${f(y - s * 0.05)} ${f(x)} ${f(y + s * 0.55)}Z`;
/** A small puffy cloud of `n` bumps. */
function cloud(x: number, y: number, s: number, n = 5) {
  const pts: P[] = Array.from({ length: n }, (_, i) => {
    const t = Math.PI + (i / (n - 1)) * Math.PI;
    return [x + Math.cos(t) * s, y + Math.sin(t) * s * 0.55];
  });
  let d = `M${f(pts[0][0])} ${f(y + s * 0.15)}L${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i],
      b = pts[i + 1];
    d += `Q${f((a[0] + b[0]) / 2 + ((a[0] + b[0]) / 2 - x) * 0.35)} ${f((a[1] + b[1]) / 2 - s * 0.45)} ${f(b[0])} ${f(b[1])}`;
  }
  return d + `L${f(pts[n - 1][0])} ${f(y + s * 0.15)}Z`;
}

export const emotionKinds: Partial<Record<OverlayKind, KindSpec>> = {
  sweat: {
    name: "Sweat drop",
    feel: "Emotion",
    description:
      "Manga sweat drops on the corner — nervous, awkward, caught out. They slide a little as they hang.",
    defaults: {
      color: "#2b6fb3",
      secondary: "#cfeaff",
      seconds: 0.3,
      timing: "in",
      speed: 0.6,
      weight: 0.8,
    },
    controls: {
      ...hand,
      placement: "Corner",
      size: "Size",
      speed: "Slide speed",
      weight: "Outline",
      variant: "Drops",
    },
    variants: ["Single", "Pair", "Flying"],
    text: true,
    fills: true,
    draw: (c) => {
      const { o, a, p, lw, time, S, ink, solid } = c;
      const s = S(0.45, 0.1);
      const [x0, y0] = corner(c, s);
      c.pivot = [x0, y0];
      const slide = ((time * o.speed) % 1) * s * 0.35;
      const drops: [number, number, number][] =
        o.variant === 1
          ? [
              [x0, y0, 1],
              [x0 + s * 0.75, y0 + s * 0.5, 0.6],
            ]
          : o.variant === 2
            ? [
                [x0 + s * 0.2, y0 - s * 0.2, 0.8],
                [x0 + s * 1.0, y0 + s * 0.2, 0.55],
                [x0 + s * 0.65, y0 - s * 0.9, 0.5],
              ]
            : [[x0, y0, 1]];
      const parts: OverlayPart[] = [];
      drops.forEach(([x, y, k], i) => {
        const yy = o.variant === 2 ? y : y + slide * k;
        const ss = s * k * backOut(stage(p, i * 0.15, 0.7 + i * 0.15));
        if (ss <= 0) return;
        parts.push(
          solid(
            drop(x, yy, ss),
            { fill: o.secondary, stroke: o.color, width: lw * 0.8 },
            i * 3,
          ),
          ink(
            `M${f(x - ss * 0.22)} ${f(yy + ss * 0.05)}Q${f(x - ss * 0.25)} ${f(yy + ss * 0.38)} ${f(x)} ${f(yy + ss * 0.45)}`,
            { stroke: "#ffffff", width: lw * 0.7, opacity: a * 0.9 },
            i * 3 + 1,
          ),
        );
        if (o.variant === 2)
          parts.push(
            ink(
              line([
                [x - ss * 0.9, yy + ss * 0.2],
                [x - ss * 1.5, yy + ss * 0.55],
              ]),
              { width: lw * 0.6 },
              i * 3 + 2,
            ),
          );
      });
      return parts;
    },
  },
  vein: {
    name: "Anger mark",
    feel: "Emotion",
    description:
      "The popping cross-vein of manga anger, throbbing on the corner — or steam puffs, or a tangled scribble.",
    defaults: {
      color: "#e8392f",
      seconds: 0.25,
      timing: "in",
      speed: 2,
      weight: 1.4,
    },
    controls: {
      ...hand,
      placement: "Corner",
      size: "Size",
      speed: "Throb speed",
      weight: "Line weight",
      variant: "Mark",
    },
    variants: ["Vein", "Steam puffs", "Scribble cloud"],
    text: true,
    strokes: true,
    draw: (c) => {
      const { o, a, p, lw, time, S, ink, jitter, r } = c;
      const s = S(0.45, 0.1);
      const [x, y] = corner(c, s);
      c.pivot = [x, y];
      const throb =
        1 + 0.12 * Math.max(0, Math.sin(time * o.speed * Math.PI * 2));
      const k = s * backOut(p) * throb;
      if (o.variant === 1)
        return [0, 1, 2].map((i) => {
          const age = (time * o.speed * 0.5 + i / 3) % 1;
          const ps = k * (0.3 + age * 0.5);
          return ink(
            cloud(x + (i - 1) * s * 0.7, y - age * s * 1.2, ps),
            { width: lw, opacity: a * (1 - age), closed: true },
            i,
          );
        });
      if (o.variant === 2) {
        const pts: P[] = Array.from({ length: 30 }, (_, i) => {
          const t = i * 0.9;
          const rr = k * (0.35 + r(i) * 0.25);
          return [x + Math.cos(t) * rr * 1.4, y + Math.sin(t) * rr];
        });
        return [ink(curve(jitter(pts, s * 0.2)), { draw: p, width: lw * 0.7 })];
      }
      const g = k * 0.18,
        b = k * 0.62;
      return [0, 90, 180, 270].map((deg, i) => {
        const t = (deg * Math.PI) / 180;
        const rot = ([px, py]: P): P => [
          x + px * Math.cos(t) - py * Math.sin(t),
          y + px * Math.sin(t) + py * Math.cos(t),
        ];
        return ink(
          curve(
            bezier(rot([g, -b]), rot([g * 0.9, -g * 0.9]), rot([b, -g]), 6),
          ),
          { width: lw, cap: "round" },
          i,
        );
      });
    },
  },
  blush: {
    name: "Blush",
    feel: "Emotion",
    description:
      "Blush hatching, soft cheeks or little hearts under the words.",
    defaults: {
      color: "#ff6f91",
      seconds: 0.4,
      timing: "in",
      count: 5,
      wobble: 0.3,
      speed: 0.5,
    },
    controls: {
      ...hand,
      count: "Strokes",
      size: "Size",
      speed: "Float speed",
      weight: "Line weight",
      variant: "Blush",
    },
    variants: ["Hatching", "Soft cheeks", "Hearts"],
    text: true,
    strokes: true,
    draw: ({ o, a, p, W2, H2, S, lw, ink, solid, jitter, time, r }) => {
      const s = S(0.32, 0.07);
      const spots: P[] = [
        [-W2 * 0.62, H2 + s * 0.35],
        [W2 * 0.62, H2 + s * 0.35],
      ];
      const parts: OverlayPart[] = [];
      spots.forEach(([x, y], si) => {
        if (o.variant === 1) {
          parts.push(
            solid(
              ellipse(x, y, s * 1.1 * p, s * 0.45 * p),
              {
                opacity: a * 0.45,
                glow: s * 0.35,
              },
              si,
            ),
          );
          return;
        }
        if (o.variant === 2) {
          const n = Math.max(1, Math.min(6, Math.round(o.count / 2)));
          for (let i = 0; i < n; i++) {
            const age = (time * o.speed + r(si * 10 + i)) % 1;
            const hx = x + (r(si * 10 + i + 5) - 0.5) * s * 2.2;
            const hy = y - age * s * 2.5;
            parts.push(
              solid(
                heart(hx, hy, s * 0.7 * (0.6 + r(i) * 0.5) * p),
                {
                  opacity: a * Math.sin(age * Math.PI),
                },
                si * 10 + i,
              ),
            );
          }
          return;
        }
        const n = Math.max(2, Math.min(9, o.count));
        for (let i = 0; i < n; i++) {
          const u = (i - (n - 1) / 2) / n;
          const sx = x + u * s * 2.4;
          parts.push(
            ink(
              line(
                jitter(
                  [
                    [sx + s * 0.2, y - s * 0.32],
                    [sx - s * 0.2, y + s * 0.32],
                  ],
                  s * 0.2,
                  i * 4 + si * 40,
                ),
              ),
              {
                width: lw * 0.8,
                draw: stage(p, (i / n) * 0.6, (i / n) * 0.6 + 0.4),
              },
              si * 10 + i,
            ),
          );
        }
      });
      return parts;
    },
  },
  gloom: {
    name: "Gloom lines",
    feel: "Emotion",
    description:
      "Manga gloom: lines hang down over the words, a rain cloud drips, or dizzy spirals circle.",
    defaults: {
      color: "#6c7bd1",
      strength: 0.8,
      seconds: 0.7,
      timing: "in",
      count: 9,
      speed: 0.6,
    },
    controls: {
      ...hand,
      count: "Lines",
      size: "Length",
      speed: "Speed",
      weight: "Line weight",
      variant: "Mood",
    },
    variants: ["Hanging lines", "Wavy lines", "Rain cloud", "Dizzy spirals"],
    text: true,
    strokes: true,
    draw: ({
      o,
      a,
      p,
      W2,
      H2,
      P,
      S,
      lw,
      thin,
      ink,
      jitter,
      r,
      fixed,
      time,
    }) => {
      const parts: OverlayPart[] = [];
      if (o.variant === 3) {
        // Spirals orbiting above the head.
        const n = Math.max(1, Math.min(4, Math.round(o.count / 3)));
        for (let i = 0; i < n; i++) {
          const t = time * o.speed * Math.PI * 2 + (i / n) * Math.PI * 2;
          const cxs = Math.cos(t) * W2 * 0.6,
            cys = -H2 - P * 0.5 - S(0.25, 0.05) + Math.sin(t) * S(0.12, 0.03);
          const rr = S(0.18, 0.04);
          const pts = Array.from({ length: 22 }, (_, k): P => {
            const u = k / 21;
            const tt = u * Math.PI * 4 + t * 2;
            return [
              cxs + Math.cos(tt) * rr * u,
              cys + Math.sin(tt) * rr * u * 0.8,
            ];
          });
          parts.push(ink(curve(pts), { width: lw * 0.8, draw: p }, i));
        }
        return parts;
      }
      if (o.variant === 2) {
        const s = S(0.45, 0.12);
        const y = -H2 - P * 0.4 - s * 0.7;
        parts.push(
          ink(
            cloud(0, y, s * 1.4, 6),
            { width: lw * 0.9, closed: true, draw: p },
            0,
          ),
        );
        const n = Math.max(3, Math.min(10, o.count));
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1) - 0.5) * s * 2.2;
          const age = (time * o.speed * 2 + fixed(i)) % 1;
          const y0 = y + s * 0.3 + age * (H2 * 2 + s);
          parts.push(
            ink(
              line([
                [x, y0],
                [x - s * 0.06, y0 + s * 0.3],
              ]),
              { width: thin * 1.6, opacity: a * p * (1 - age) },
              i + 1,
            ),
          );
        }
        return parts;
      }
      const n = Math.max(3, Math.min(24, o.count));
      const top = -H2 - P * 0.3;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * W2 * 2.1;
        const len =
          (H2 * 1.4 + S(0.2, 0.05)) * o.size * (0.45 + fixed(i) * 0.55);
        const pts: P[] = Array.from({ length: 6 }, (_, k) => {
          const u = k / 5;
          return [
            x +
              (o.variant === 1
                ? Math.sin(u * Math.PI * 2 + time * o.speed * 3 + i) *
                  S(0.04, 0.01)
                : 0),
            top + len * u,
          ];
        });
        parts.push(
          ink(
            curve(jitter(pts, S(0.03, 0.008), i * 7)),
            {
              behind: true,
              width: thin * (1.4 + r(i + 30)),
              draw: stage(p, (i / n) * 0.4, (i / n) * 0.4 + 0.6),
              cap: "butt",
            },
            i,
          ),
        );
      }
      return parts;
    },
  },
};
