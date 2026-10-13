import {
  backOut,
  curve,
  drawn,
  ellipse,
  f,
  line,
  rect,
  stage,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

const quotePairs: [string, string][] = [
  ["“", "”"],
  ["«", "»"],
  ["「", "」"],
  ["‘", "’"],
];

export const ornamentKinds: Partial<Record<OverlayKind, KindSpec>> = {
  quotes: {
    name: "Big quotes",
    feel: "Ornament",
    description:
      "Oversized quotation marks open and close the words — curly, guillemets, corner brackets or single.",
    defaults: {
      color: "#f2765e",
      seconds: 0.45,
      timing: "in",
      font: "serif",
      strength: 0.95,
      size: 1,
    },
    controls: {
      ...drawn,
      pad: "Gap",
      size: "Size",
      variant: "Marks",
      font: "Typeface",
    },
    variants: ["Curly", "Guillemets", "Corner brackets", "Single"],
    text: true,
    draw: (c) => {
      const { o, a, p, W2, H2, P, S, text, cx, cy } = c;
      const [open, close] = quotePairs[o.variant] ?? quotePairs[0];
      const size = S(1.5, 0.32);
      const k = backOut(stage(p, 0, 0.7));
      const k2 = backOut(stage(p, 0.25, 0.95));
      const corner = o.variant === 2;
      const ox = -W2 - P * 0.3 - size * (corner ? 0.35 : 0.15),
        oy = -H2 + size * (corner ? 0.1 : 0.55);
      const ex = W2 + P * 0.3 + size * (corner ? 0.35 : 0.15),
        ey = H2 + size * (corner ? 0.5 : 0.3);
      const part = (
        s: string,
        x: number,
        y: number,
        sc: number,
        n: number,
      ): OverlayPart =>
        text(
          s,
          0,
          0,
          size,
          {
            x: 0,
            y: 0,
            bold: true,
            mono: false,
            font: o.font === "auto" ? "serif" : o.font,
            transform: `translate(${f(cx + x)} ${f(cy + y)}) scale(${f(sc)})`,
            opacity: a * Math.min(1, sc * 2),
          },
          n,
        );
      return [part(open, ox, oy, k, 0), part(close, ex, ey, k2, 1)];
    },
  },
  flourish: {
    name: "Flourish rules",
    feel: "Ornament",
    description:
      "Decorative rules draw out from the center above and below: a diamond, curls, dots or a double rule.",
    defaults: { color: "#e9d8a6", seconds: 0.7, timing: "in", pad: 0.8 },
    controls: {
      ...drawn,
      placement: "Side",
      pad: "Gap",
      size: "Ornament size",
      weight: "Line weight",
      variant: "Rule",
    },
    variants: ["Diamond", "Curls", "Dots", "Double rule"],
    text: true,
    strokes: true,
    draw: ({ o, p, W2, H2, P, S, thin, ink, solid }) => {
      const sides =
        o.placement === "top" ? [-1] : o.placement === "bottom" ? [1] : [-1, 1];
      const orn = S(0.14, 0.03);
      const reach = (W2 + P * 0.5) * stage(p, 0.2, 1);
      const gap = orn * (o.variant === 1 ? 2.4 : 1.8);
      const parts: OverlayPart[] = [];
      sides.forEach((sy, si) => {
        const y = sy * (H2 + P * 0.6 + orn);
        const n = si * 20;
        const k = backOut(stage(p, 0, 0.35));
        if (reach > gap)
          for (const sx of [-1, 1]) {
            parts.push(
              ink(
                line([
                  [sx * gap, y],
                  [sx * reach, y],
                ]),
                { width: thin * 1.5, cap: "butt" },
                n + (sx > 0 ? 1 : 2),
              ),
            );
            if (o.variant === 3)
              parts.push(
                ink(
                  line([
                    [sx * gap, y + sy * orn * 0.45],
                    [sx * reach * 0.85, y + sy * orn * 0.45],
                  ]),
                  { width: thin * 0.8, cap: "butt" },
                  n + (sx > 0 ? 3 : 4),
                ),
              );
          }
        if (o.variant === 0 || o.variant === 3)
          parts.push(
            solid(
              line(
                [
                  [0, y - orn * k],
                  [orn * 0.75 * k, y],
                  [0, y + orn * k],
                  [-orn * 0.75 * k, y],
                ],
                true,
              ),
              {},
              n + 5,
            ),
          );
        else if (o.variant === 2)
          [-1, 0, 1].forEach((i) =>
            parts.push(
              solid(ellipse(i * orn * 0.9, y, orn * 0.22 * k), {}, n + 6 + i),
            ),
          );
        else
          for (const sx of [-1, 1]) {
            const pts: P[] = Array.from({ length: 14 }, (_, i) => {
              const u = i / 13;
              const t = u * Math.PI * 1.7;
              const rr = orn * (1 - u * 0.65);
              return [
                sx * (gap - orn * 0.2 - Math.sin(t) * rr),
                y + sy * (Math.cos(t) * rr - orn * 0.3) * -1,
              ];
            });
            parts.push(
              ink(
                curve(pts),
                { width: thin * 1.5, draw: stage(p, 0, 0.5) },
                n + (sx > 0 ? 10 : 11),
              ),
            );
          }
      });
      return parts;
    },
  },
  footnote: {
    name: "Footnote",
    feel: "Ornament",
    description:
      "A superscript mark on the key word and a matching note set small at the foot of the frame.",
    defaults: {
      color: "#ffd166",
      seconds: 0.6,
      timing: "in",
      anchor: "keyword",
      label: "Your note here",
      count: 1,
      font: "serif",
    },
    controls: {
      ...drawn,
      anchor: "Marks",
      label: "Note",
      count: "Number",
      size: "Size",
      variant: "Marker",
    },
    variants: ["Asterisk", "Dagger", "Number"],
    text: true,
    draw: ({ o, a, p, W2, H2, S, box, target, text, ink, thin }) => {
      const mark =
        o.variant === 1 ? "†" : o.variant === 2 ? String(o.count) : "*";
      const size = S(0.42, 0.06);
      const font = o.font === "auto" ? "serif" : o.font;
      const block = target.box;
      const bottom = block.y + block.h / 2 + (target.room?.bottom ?? 4);
      const margin = Math.max(0.8, (target.room?.bottom ?? 4) * 0.25);
      const ny = bottom - margin - box.y;
      const nx = block.x - block.w / 2 - box.x;
      const note = `${mark} ${o.label?.trim() || "Your note here"}`;
      const shown = Math.ceil(stage(p, 0.35, 1) * [...note].length);
      const nsize = S(0.24, 0.025);
      return [
        text(
          mark,
          W2 + size * 0.05,
          -H2 + size * 0.45,
          size,
          {
            align: "start",
            mono: false,
            font,
            bold: true,
            opacity: a * stage(p, 0, 0.3),
          },
          0,
        ),
        ink(
          line([
            [nx, ny - nsize * 1.4],
            [nx + nsize * 8 * stage(p, 0.2, 0.5), ny - nsize * 1.4],
          ]),
          {
            width: thin,
            cap: "butt",
          },
        ),
        text(
          [...note].slice(0, shown).join(""),
          nx,
          ny,
          nsize,
          {
            align: "start",
            mono: false,
            font,
            opacity: a,
          },
          1,
        ),
      ];
    },
  },
  initial: {
    name: "Initial ornament",
    feel: "Ornament",
    description:
      "Decorates the first letter like an illuminated initial: a box, rings, vines or a solid block behind it.",
    defaults: {
      color: "#e9d8a6",
      secondary: "#7a2e2e",
      seconds: 0.6,
      timing: "in",
      pad: 0.6,
    },
    controls: {
      ...drawn,
      secondary: "Block",
      pad: "Gap",
      weight: "Line weight",
      variant: "Initial",
    },
    variants: ["Boxed", "Rings", "Vines", "Block"],
    text: true,
    draw: ({ o, a, p, box, target, W2, H2, m, thin, ink, solid, cx, cy }) => {
      // The first letter, or the top-left corner of a picture.
      const g = target.initial ?? {
        x: box.x - W2 + m * 0.2,
        y: box.y - H2 + m * 0.2,
        w: m * 0.4,
        h: m * 0.4,
      };
      const gx = g.x - cx,
        gy = g.y - cy;
      const pad = o.pad * Math.max(0.06, 0.02 * m);
      const half = Math.max(g.w, g.h * 0.8) / 2 + pad;
      const x0 = gx - half,
        x1 = gx + half,
        y0 = gy - half,
        y1 = gy + half;
      const parts: OverlayPart[] = [];
      if (o.variant === 3) {
        parts.push(
          solid(
            rect(x0, y0, x1, y1),
            {
              behind: true,
              fill: o.secondary,
              opacity: a * stage(p, 0, 0.6),
              encloses: true,
            },
            0,
          ),
          ink(
            rect(
              x0 + pad * 0.4,
              y0 + pad * 0.4,
              x1 - pad * 0.4,
              y1 - pad * 0.4,
            ),
            { width: thin, draw: p, cap: "butt" },
            1,
          ),
        );
        return parts;
      }
      if (o.variant === 1) {
        parts.push(
          ink(ellipse(gx, gy, half * 1.12), { width: thin * 1.6, draw: p }, 0),
          ink(
            ellipse(gx, gy, half * 1.28),
            {
              width: thin * 0.8,
              draw: stage(p, 0.2, 1),
              dash: [thin * 2, thin * 3],
            },
            1,
          ),
        );
        return parts;
      }
      parts.push(
        ink(
          rect(x0, y0, x1, y1),
          { width: thin * 1.6, draw: p, cap: "butt", closed: true },
          0,
        ),
        ink(
          rect(
            x0 + pad * 0.35,
            y0 + pad * 0.35,
            x1 - pad * 0.35,
            y1 - pad * 0.35,
          ),
          {
            width: thin * 0.7,
            draw: stage(p, 0.2, 1),
            cap: "butt",
          },
          1,
        ),
      );
      if (o.variant === 2)
        // Vines curl off the corners.
        (
          [
            [x0, y0, -1, -1],
            [x1, y0, 1, -1],
            [x1, y1, 1, 1],
            [x0, y1, -1, 1],
          ] as const
        ).forEach(([x, y, sx, sy], i) => {
          const L = half * 0.9;
          const pts: P[] = Array.from({ length: 12 }, (_, k) => {
            const u = k / 11;
            const t = u * Math.PI * 1.5;
            return [
              x + sx * u * L + sx * Math.sin(t) * L * 0.12,
              y + sy * Math.sin(u * Math.PI) * L * 0.3 * -1 + sy * u * L * 0.1,
            ];
          });
          parts.push(
            ink(curve(pts), { width: thin, draw: stage(p, 0.4, 1) }, 2 + i),
          );
          const end = pts[pts.length - 1];
          parts.push(
            solid(
              ellipse(end[0], end[1], thin * 2.2),
              { opacity: a * stage(p, 0.9, 1) },
              6 + i,
            ),
          );
        });
      return parts;
    },
  },
};
