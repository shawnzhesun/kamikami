import {
  clamp01,
  drawn,
  f,
  line,
  rect,
  regMark,
  roundRect,
  smooth,
  timecode,
  pad2,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

const corners: P[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

export const frameKinds: Partial<Record<OverlayKind, KindSpec>> = {
  print: {
    name: "Print border",
    feel: "Frame",
    description: "A paper border and soft shadow, like a print pinned up.",
    defaults: { color: "#f6f2ea", pad: 1.4, seconds: 0.4, timing: "in" },
    controls: { ...drawn, color: "Paper", pad: "Border", variant: "Corners" },
    variants: ["Square", "Rounded", "Deckled"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, solid, cx, cy, fixed, m }) => {
      const x0 = -W2 - P,
        y0 = -H2 - P,
        x1 = W2 + P,
        y1 = H2 + P;
      let d = rect(x0, y0, x1, y1);
      if (o.variant === 1) d = roundRect(x0, y0, x1, y1, S(0.18, 0.04));
      if (o.variant === 2) {
        // Deckled: a torn-paper edge, irregular along every side.
        const pts: P[] = [];
        const n = 18;
        const amp = Math.max(0.06, 0.012 * m) * (1 + o.wobble * 2);
        const edge = (
          ax: number,
          ay: number,
          bx: number,
          by: number,
          k: number,
        ) => {
          const nx = -(by - ay),
            ny = bx - ax;
          const len = Math.hypot(nx, ny) || 1;
          for (let i = 0; i < n; i++) {
            const out = (fixed(k * 40 + i) - 0.5) * amp;
            pts.push([
              ax + ((bx - ax) * i) / n + (nx / len) * out,
              ay + ((by - ay) * i) / n + (ny / len) * out,
            ]);
          }
        };
        edge(x0, y0, x1, y0, 0);
        edge(x1, y0, x1, y1, 1);
        edge(x1, y1, x0, y1, 2);
        edge(x0, y1, x0, y0, 3);
        d = line(pts, true);
      }
      return [
        solid(d, {
          behind: true,
          opacity: a * p,
          shadow: S(0.08, 0.035),
          transform: `translate(${f(cx)} ${f(cy)}) scale(${f(0.97 + 0.03 * p)})`,
          encloses: true,
        }),
      ];
    },
  },
  shadowblock: {
    name: "Block shadow",
    feel: "Frame",
    description: "A hard offset shadow, pop-poster style.",
    defaults: {
      color: "#141414",
      strength: 0.95,
      pad: 1.2,
      angle: 45,
      seconds: 0.4,
      timing: "in",
    },
    controls: {
      ...drawn,
      color: "Shadow",
      pad: "Offset",
      angle: "Angle (degrees)",
      variant: "Shape",
    },
    variants: ["Block", "Extruded", "Stepped"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, cx, cy, rad, solid }) => {
      const d = P * p;
      const ux = Math.cos(rad),
        uy = Math.sin(rad);
      const block = (k: number, n: number, op = 1) =>
        solid(
          rect(-W2, -H2, W2, H2),
          {
            behind: true,
            transform: `translate(${f(cx + ux * d * k)} ${f(cy + uy * d * k)})`,
            opacity: a * op * Math.min(1, p * 2),
            cap: "square",
            encloses: true,
          },
          n,
        );
      if (o.variant === 1) {
        // Extruded: a solid prism joining the element to its shadow.
        const steps = 8;
        return Array.from({ length: steps }, (_, i) =>
          block((i + 1) / steps, i),
        );
      }
      if (o.variant === 2)
        return [block(1, 0, 0.45), block(0.66, 1, 0.7), block(0.33, 2, 1)];
      return [block(1, 0)];
    },
  },
  offsetframe: {
    name: "Offset frame",
    feel: "Frame",
    description: "An outline rectangle that slides out from behind.",
    defaults: { pad: 1.2, angle: 45, seconds: 0.5, timing: "in" },
    controls: {
      ...drawn,
      color: "Line",
      pad: "Offset",
      angle: "Angle (degrees)",
      weight: "Line weight",
      count: "Frames",
    },
    fills: true,
    strokes: true,
    draw: ({ o, a, p, W2, H2, P, cx, cy, rad, ink }) => {
      const n = Math.max(1, Math.min(6, o.count));
      return Array.from({ length: n }, (_, i) => {
        const d = P * p * (i + 1);
        return ink(
          rect(-W2, -H2, W2, H2),
          {
            behind: true,
            transform: `translate(${f(cx + Math.cos(rad) * d)} ${f(cy + Math.sin(rad) * d)})`,
            opacity: a * Math.min(1, p * 2) * (1 - i / (n + 1)),
            cap: "square",
            closed: true,
            encloses: true,
          },
          i,
        );
      });
    },
  },
  brackets: {
    name: "Corner brackets",
    feel: "Frame",
    description: "Viewfinder corners close in around the element.",
    defaults: { color: "#f6f2ea", seconds: 0.5 },
    controls: {
      ...drawn,
      pad: "Gap",
      size: "Size",
      weight: "Line weight",
      variant: "Corners",
    },
    variants: ["Square", "Rounded", "Ticks"],
    strokes: true,
    draw: ({ o, a, p, W2, H2, P, S, ink }) => {
      const out = P * (1 + (1 - p) * 1.5);
      const len = S(0.3, 0.1);
      const x = W2 + out,
        y = H2 + out;
      return corners.map(([sx, sy], n) => {
        let d = line([
          [sx * x, sy * (y - len)],
          [sx * x, sy * y],
          [sx * (x - len), sy * y],
        ]);
        if (o.variant === 1) {
          const k = len * 0.5;
          d = `M${f(sx * x)} ${f(sy * (y - len))}V${f(sy * (y - k))}Q${f(sx * x)} ${f(sy * y)} ${f(sx * (x - k))} ${f(sy * y)}H${f(sx * (x - len))}`;
        }
        if (o.variant === 2)
          d = line([
            [sx * (x - len * 0.15), sy * (y - len * 0.15)],
            [sx * (x + len * 0.5), sy * (y + len * 0.5)],
          ]);
        return ink(d, { opacity: a * p, cap: "square" }, n);
      });
    },
  },
  cropmarks: {
    name: "Crop marks",
    feel: "Frame",
    description: "Printer's crop marks and registration targets.",
    defaults: { color: "#f6f2ea", pad: 1.2, seconds: 0.6, timing: "in" },
    controls: { ...drawn, pad: "Gap", size: "Size", weight: "Line weight" },
    draw: ({ o, a, p, W2, H2, P, S, m, ink, key, cx, cy }) => {
      const len = S(0.5, 0.06) * p;
      const gap = P * 0.5;
      const thin = o.weight * Math.max(0.02, 0.0024 * m);
      const marks: OverlayPart[] = [];
      for (const [sx, sy] of corners) {
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
    },
  },
  label: {
    name: "Index label",
    feel: "Frame",
    description:
      "A monospaced caption types in: an index and the clip's start time, or your own words.",
    defaults: { color: "#f6f2ea", count: 1, seconds: 0.6, timing: "in" },
    controls: {
      ...drawn,
      label: "Label text",
      count: "Index",
      placement: "Side",
      size: "Size",
      seconds: "Type-on (seconds)",
    },
    draw: ({ o, a, p, W2, H2, S, m, ink, text, side, target }) => {
      const size = S(0.22, 0.035);
      const below = side("bottom") !== "top";
      const gap = Math.max(0.12, 0.03 * m);
      const s =
        o.label?.trim() || `No.${pad2(o.count)}  ·  ${timecode(target.start)}`;
      const shown = Math.ceil(clamp01(p * 1.4) * [...s].length);
      const y = below ? H2 + gap + size : -H2 - gap;
      const ly = below ? H2 + gap * 0.5 : -H2 - gap * 0.5 - size * 1.2;
      return [
        ink(
          line([
            [-W2, ly],
            [-W2 + size * 10 * smooth(p * 2), ly],
          ]),
          { width: Math.max(0.012, size * 0.06), cap: "butt" },
        ),
        text([...s].slice(0, shown).join(""), -W2, y, size, {
          align: "start",
          opacity: a,
        }),
      ];
    },
  },
  tape: {
    name: "Tape corners",
    feel: "Frame",
    description: "Strips of tape hold the element to the frame.",
    defaults: { color: "#f5e6b8", count: 2, seconds: 0.35, timing: "in" },
    controls: { ...drawn, color: "Tape", size: "Size", count: "Strips" },
    fills: true,
    draw: ({ o, a, p, W2, H2, S, cx, cy, solid, fixed }) => {
      const sw = S(1.2, 0.19),
        sh = sw * 0.29;
      // Two strips across the top corners; more add the bottom corners and
      // the middle of the top edge.
      const spots: [number, number, number][] = [
        [-1, -1, -32],
        [1, -1, 32],
        [1, 1, -32],
        [-1, 1, 32],
        [0, -1, 4],
        [0, 1, -4],
      ];
      const n = Math.max(1, Math.min(6, o.count));
      return spots.slice(0, n).map(([sx, sy, rot], i) => {
        // Torn ends: a zigzag at each end of the strip.
        const teeth = 4;
        const pts: P[] = [];
        for (let k = 0; k <= teeth; k++)
          pts.push([
            sw / 2 + (k % 2 ? sh * 0.08 : 0),
            -sh / 2 + (sh * k) / teeth,
          ]);
        for (let k = teeth; k >= 0; k--)
          pts.push([
            -sw / 2 - (k % 2 ? sh * 0.08 : 0),
            -sh / 2 + (sh * k) / teeth,
          ]);
        const tilt = rot + (fixed(i + 3) - 0.5) * 8;
        return solid(
          line(pts, true),
          {
            opacity: a * 0.82,
            shadow: sh * 0.08,
            transform: `translate(${f(cx + sx * (W2 - (sx ? sw * 0.18 : 0)))} ${f(cy + sy * H2)}) rotate(${f(tilt)}) scale(${f(p)})`,
          },
          i,
        );
      });
    },
  },
};
