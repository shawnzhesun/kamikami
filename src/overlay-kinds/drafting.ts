import {
  arc,
  drawn,
  ellipse,
  f,
  line,
  pad2,
  rect,
  roundRect,
  stage,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

export const draftingKinds: Partial<Record<OverlayKind, KindSpec>> = {
  dimension: {
    name: "Dimension line",
    feel: "Drafting",
    description: "A technical dimension line with the element's width.",
    defaults: { color: "#9fd8ff", seconds: 0.7, timing: "in" },
    controls: {
      ...drawn,
      anchor: "Measures",
      placement: "Side",
      label: "Readout",
      pad: "Gap",
      size: "Size",
    },
    text: true,
    draw: ({ o, a, p, w, W2, H2, P, S, thin, ink, text, side, target }) => {
      const at = side("top") === "bottom" ? 1 : -1;
      const gap = P * 0.9 + S(0.1, 0.02);
      const y = at * (H2 + gap);
      const half = W2 * stage(p, 0, 0.6);
      const tick = S(0.12, 0.025);
      const size = S(0.2, 0.03);
      const px = Math.round(w * target.unitPx * stage(p, 0.3, 1));
      const arrow = (sx: number): P[] => [
        [sx * half - sx * tick * 0.9, y - tick * 0.45],
        [sx * half, y],
        [sx * half - sx * tick * 0.9, y + tick * 0.45],
      ];
      const leg = (x: number, n: number) =>
        ink(
          line([
            [x, at * H2],
            [x, y + at * tick],
          ]),
          {
            width: thin,
            cap: "butt",
            draw: stage(p, 0, 0.3),
            opacity: a * 0.7,
          },
          n,
        );
      return [
        leg(-W2, 0),
        leg(W2, 1),
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
        text(
          o.label?.trim() || `${px} PX`,
          0,
          y + (at < 0 ? -size * 0.5 : size * 1.25),
          size,
          { opacity: a * stage(p, 0.3, 0.6) },
        ),
      ];
    },
  },
  crosshair: {
    name: "Crosshair",
    feel: "Drafting",
    description:
      "Hairlines through the element's center with a coordinate readout.",
    defaults: { color: "#9fd8ff", strength: 0.75, seconds: 0.6, timing: "in" },
    controls: {
      ...drawn,
      anchor: "Centers on",
      label: "Readout",
      size: "Size",
    },
    text: true,
    draw: ({ o, a, p, W2, H2, S, m, ink, text, target }) => {
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
        text(
          o.label?.trim() || `X ${Math.round(pos.x)}  Y ${Math.round(-pos.y)}`,
          ring * 1.4,
          -ring * 1.4,
          size,
          { align: "start", opacity: a * stage(p, 0.6, 1) },
        ),
      ];
    },
  },
  ruler: {
    name: "Ruler",
    feel: "Drafting",
    description: "A ruler with numbered divisions along one side.",
    defaults: { color: "#f6f2ea", count: 10, seconds: 0.7, timing: "in" },
    controls: {
      ...drawn,
      placement: "Side",
      count: "Divisions",
      pad: "Gap",
      size: "Size",
    },
    draw: ({ o, a, p, w, W2, H2, P, S, m, ink, text, side, key }) => {
      const below = side("bottom") !== "top";
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
          parts.push(
            text(
              String(i / 4),
              x,
              y + s * (major + size * (below ? 1.1 : 0.4)),
              size,
              {
                key: `${key}-n${i}`,
                opacity: a,
              },
            ),
          );
      }
      return parts;
    },
  },
  callout: {
    name: "Callout",
    feel: "Drafting",
    description: "A leader line from the element to a figure label.",
    defaults: { color: "#f6f2ea", seconds: 0.8, timing: "in" },
    controls: {
      ...drawn,
      anchor: "Points at",
      placement: "Side",
      label: "Label text",
      count: "Figure number",
      pad: "Gap",
      size: "Size",
    },
    text: true,
    draw: ({ o, a, p, W2, H2, P, S, m, ink, solid, text, side }) => {
      const at = side("right");
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
      const s = o.label?.trim() || `FIG. ${pad2(o.count)}`;
      const shown = Math.ceil(stage(p, 0.55, 1) * [...s].length);
      return [
        solid(
          ellipse(from[0], from[1], dot),
          { opacity: a * stage(p, 0, 0.1), closed: false },
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
        text(
          [...s].slice(0, shown).join(""),
          sx > 0 ? elbow[0] : end[0],
          end[1] - size * 0.4,
          size,
          {
            align: "start",
            opacity: a,
          },
        ),
      ];
    },
  },
  typeguides: {
    name: "Type guides",
    feel: "Drafting",
    description:
      "Baseline, x-height and cap-height guides across each line of text, like a type specimen. Pictures get a thirds grid.",
    defaults: { color: "#ff5fa2", strength: 0.85, seconds: 0.7, timing: "in" },
    controls: { ...drawn, size: "Overhang", label: "Tag", variant: "Guides" },
    variants: ["Labelled", "Lines only", "With side bearings"],
    text: true,
    draw: (c) => {
      const { o, a, p, box, target, W2, H2, S, thin, ink, text } = c;
      const parts: OverlayPart[] = [];
      const ext = S(0.45, 0.06);
      const size = S(0.13, 0.02);
      const reach = stage(p, 0, 0.7);
      const rule = (
        y: number,
        x0: number,
        x1: number,
        n: number,
        dash = false,
      ) =>
        ink(
          line([
            [x0 - ext, y],
            [x0 - ext + (x1 - x0 + ext * 2) * reach, y],
          ]),
          {
            width: thin,
            cap: "butt",
            dash: dash ? [thin * 6, thin * 4] : undefined,
          },
          n,
        );
      if (!target.lines?.length) {
        // A picture: rule-of-thirds guides.
        for (let i = 1; i < 3; i++) {
          const y = -H2 + (H2 * 2 * i) / 3,
            x = -W2 + (W2 * 2 * i) / 3;
          parts.push(rule(y, -W2, W2, i));
          parts.push(
            ink(
              line([
                [x, -H2 - ext],
                [x, -H2 - ext + (H2 * 2 + ext * 2) * reach],
              ]),
              { width: thin, cap: "butt" },
              i + 4,
            ),
          );
        }
        return parts;
      }
      target.lines.forEach((l, li) => {
        // Typical Latin proportions in em: baseline, x-height, cap height.
        const base = l.y - box.y + l.h * 0.3;
        const guides: [string, number, boolean][] = [
          [o.label?.trim() || "cap", base - 0.7, false],
          ["x", base - 0.5, true],
          ["base", base, false],
          ["desc", base + 0.2, true],
        ];
        const x0 = l.x - box.x - l.w / 2,
          x1 = l.x - box.x + l.w / 2;
        guides.forEach(([name, y, dash], gi) => {
          parts.push(rule(y, x0, x1, li * 10 + gi, dash));
          if (o.variant === 0)
            parts.push(
              text(name, x0 - ext - size * 0.4, y + size * 0.35, size, {
                key: `${c.key}-${li}-${gi}-t`,
                align: "end",
                opacity: a * stage(p, 0.5, 1),
              }),
            );
        });
        if (o.variant === 2)
          for (const [x, n] of [
            [x0, 8],
            [x1, 9],
          ] as const)
            parts.push(
              ink(
                line([
                  [x, base - 0.85],
                  [x, base - 0.85 + 1.15 * reach],
                ]),
                { width: thin, cap: "butt" },
                li * 10 + n,
              ),
            );
      });
      return parts;
    },
  },
  selection: {
    name: "Selection box",
    feel: "Drafting",
    description:
      "A design-tool selection: a thin box, square handles and a size readout.",
    defaults: { color: "#2f8cff", seconds: 0.35, timing: "in", pad: 0.4 },
    controls: {
      ...drawn,
      anchor: "Selects",
      pad: "Gap",
      size: "Handle size",
      label: "Readout",
      variant: "Handles",
    },
    variants: ["Eight handles", "Corners only", "With rotate handle"],
    text: true,
    draw: ({ o, a, p, w, h, W2, H2, P, S, thin, ink, solid, text, target }) => {
      const x = W2 + P * 0.5,
        y = H2 + P * 0.5;
      const hs = S(0.07, 0.012);
      const parts: OverlayPart[] = [
        ink(
          rect(-x, -y, x, y),
          { width: thin, cap: "butt", draw: p, closed: true },
          0,
        ),
      ];
      const spots: P[] = [
        [-x, -y],
        [x, -y],
        [x, y],
        [-x, y],
      ];
      if (o.variant !== 1) spots.push([0, -y], [x, 0], [0, y], [-x, 0]);
      spots.forEach(([sx, sy], i) =>
        parts.push({
          ...solid(
            rect(sx - hs, sy - hs, sx + hs, sy + hs),
            {
              fill: "#ffffff",
              stroke: o.color,
              width: thin,
              opacity: a * stage(p, 0.5 + i * 0.04, 0.8 + i * 0.02),
            },
            i + 1,
          ),
        }),
      );
      if (o.variant === 2)
        parts.push(
          ink(
            line([
              [0, -y],
              [0, -y - hs * 5],
            ]),
            { width: thin, opacity: a * stage(p, 0.6, 1) },
            20,
          ),
          solid(
            ellipse(0, -y - hs * 6, hs * 1.1),
            {
              fill: "#ffffff",
              stroke: o.color,
              width: thin,
              opacity: a * stage(p, 0.6, 1),
            },
            21,
          ),
        );
      const size = S(0.15, 0.022);
      const readout =
        o.label?.trim() ||
        `${Math.round(w * target.unitPx)} × ${Math.round(h * target.unitPx)}`;
      const tw = [...readout].length * size * 0.66 + size;
      const ty = y + hs * 2 + size * 1.1;
      parts.push(
        solid(
          roundRect(
            -tw / 2,
            ty - size * 1.05,
            tw / 2,
            ty + size * 0.45,
            size * 0.3,
          ),
          {
            opacity: a * stage(p, 0.7, 1),
          },
          30,
        ),
        text(
          readout,
          0,
          ty,
          size,
          {
            fill: "#ffffff",
            opacity: a * stage(p, 0.7, 1),
            spacing: 0.02,
          },
          31,
        ),
      );
      return parts;
    },
  },
  anglearc: {
    name: "Angle arc",
    feel: "Drafting",
    description:
      "A protractor reading from a corner of the element: two rays, an arc and the angle in degrees.",
    defaults: { color: "#ffd166", angle: 30, seconds: 0.8, timing: "in" },
    controls: {
      ...drawn,
      angle: "Angle (degrees)",
      size: "Radius",
      placement: "Corner side",
      variant: "Gauge",
    },
    variants: ["Arc", "Protractor"],
    draw: ({ o, a, p, W2, H2, S, thin, ink, text, side }) => {
      const right = side("left") === "right";
      const sx = right ? -1 : 1;
      const origin: P = [right ? W2 : -W2, H2];
      const R = S(0.9, 0.35);
      const deg = Math.max(5, Math.min(175, Math.abs(o.angle) || 30));
      const shown = deg * stage(p, 0.2, 0.9);
      const t1 = (-shown * Math.PI) / 180;
      const dir = (t: number): P => [
        origin[0] + sx * Math.cos(t) * R * 1.35,
        origin[1] + Math.sin(t) * R * 1.35,
      ];
      const parts: OverlayPart[] = [
        ink(
          line([origin, dir(0)]),
          { width: thin, cap: "butt", draw: stage(p, 0, 0.3) },
          0,
        ),
        ink(
          line([origin, dir(t1)]),
          { width: thin, cap: "butt", draw: stage(p, 0.1, 0.4) },
          1,
        ),
        ink(
          sx > 0
            ? arc(origin[0], origin[1], R, t1, 0)
            : arc(origin[0], origin[1], R, Math.PI, Math.PI - t1),
          { width: thin * 1.6 },
          2,
        ),
      ];
      if (o.variant === 1)
        for (let i = 0; i <= 18; i++) {
          const t = (-i * 10 * Math.PI) / 180;
          if (i * 10 > shown + 1e-6) break;
          const len = i % 3 === 0 ? 0.16 : 0.08;
          parts.push(
            ink(
              line([
                [
                  origin[0] + sx * Math.cos(t) * R * 1.12,
                  origin[1] + Math.sin(t) * R * 1.12,
                ],
                [
                  origin[0] + sx * Math.cos(t) * R * (1.12 + len),
                  origin[1] + Math.sin(t) * R * (1.12 + len),
                ],
              ]),
              { width: thin, cap: "butt" },
              10 + i,
            ),
          );
        }
      const mid = t1 / 2;
      const size = S(0.17, 0.025);
      parts.push(
        text(
          o.label?.trim() || `${Math.round(shown)}°`,
          origin[0] + sx * Math.cos(mid) * R * 0.62,
          origin[1] + Math.sin(mid) * R * 0.62 + size * 0.35,
          size,
          { opacity: a * stage(p, 0.3, 0.6) },
        ),
      );
      return parts;
    },
  },
  dotgrid: {
    name: "Dot grid",
    feel: "Drafting",
    description:
      "Graph paper behind the element — dots, lines, crosses or an isometric grid — fading out at the edges.",
    defaults: {
      color: "#9fb3c8",
      strength: 0.55,
      seconds: 0.8,
      timing: "in",
      size: 1,
      pad: 3,
    },
    controls: { ...drawn, pad: "Spread", size: "Spacing", variant: "Grid" },
    variants: ["Dots", "Lines", "Crosses", "Isometric"],
    text: true,
    draw: ({ o, a, p, W2, H2, P, S, thin, m, ink, solid }) => {
      const gap = Math.max(0.3, 0.06 * m) * o.size;
      const ex = W2 + P,
        ey = H2 + P;
      const nx = Math.min(60, Math.ceil(ex / gap)),
        ny = Math.min(60, Math.ceil(ey / gap));
      // Three rings, fainter towards the edge, appearing outwards.
      const rings = ["", "", ""];
      const lines = ["", "", ""];
      for (let j = -ny; j <= ny; j++)
        for (let i = -nx; i <= nx; i++) {
          const iso = o.variant === 3 ? (j % 2 ? gap / 2 : 0) : 0;
          const x = i * gap + iso,
            y = j * gap * (o.variant === 3 ? 0.866 : 1);
          const d = Math.max(Math.abs(x) / ex, Math.abs(y) / ey);
          if (d > 1) continue;
          const ring = Math.min(2, Math.floor(d * 3));
          if (ring / 3 > p) continue;
          const k = gap * 0.12;
          if (o.variant === 2)
            lines[ring] +=
              `M${f(x - k)} ${f(y)}H${f(x + k)}M${f(x)} ${f(y - k)}V${f(y + k)}`;
          else if (o.variant !== 1)
            rings[ring] +=
              `M${f(x - k * 0.5)} ${f(y)}a${f(k * 0.5)} ${f(k * 0.5)} 0 1 0 ${f(k)} 0a${f(k * 0.5)} ${f(k * 0.5)} 0 1 0 ${f(-k)} 0`;
        }
      if (o.variant === 1) {
        for (let ring = 0; ring < 3; ring++) {
          const lo = ring / 3,
            hi = (ring + 1) / 3;
          for (let i = -nx; i <= nx; i++) {
            const x = i * gap;
            const u = Math.abs(x) / ex;
            if (u >= lo && u < hi)
              lines[ring] += `M${f(x)} ${f(-ey * p)}V${f(ey * p)}`;
          }
          for (let j = -ny; j <= ny; j++) {
            const y = j * gap;
            const u = Math.abs(y) / ey;
            if (u >= lo && u < hi)
              lines[ring] += `M${f(-ex * p)} ${f(y)}H${f(ex * p)}`;
          }
        }
      }
      const fade = [1, 0.6, 0.25];
      return [0, 1, 2].flatMap((ring) => [
        ...(rings[ring]
          ? [
              solid(
                rings[ring],
                { behind: true, opacity: a * fade[ring], closed: false },
                ring,
              ),
            ]
          : []),
        ...(lines[ring]
          ? [
              ink(
                lines[ring],
                {
                  behind: true,
                  width: thin,
                  cap: "butt",
                  opacity: a * fade[ring],
                },
                ring + 3,
              ),
            ]
          : []),
      ]);
    },
  },
};
