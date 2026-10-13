import {
  arc,
  backOut,
  curve,
  drawn,
  ellipse,
  f,
  line,
  polygon,
  rect,
  smooth,
  stage,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

type V3 = [number, number, number];
const PHI = (1 + Math.sqrt(5)) / 2;
/** Vertices and edges of the wireframe solids, unit-sized. */
const solids: { v: V3[]; e: [number, number][] }[] = [
  {
    v: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ],
  },
  {
    v: [
      [1.4, 0, 0],
      [-1.4, 0, 0],
      [0, 1.4, 0],
      [0, -1.4, 0],
      [0, 0, 1.4],
      [0, 0, -1.4],
    ],
    e: [
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 4],
      [4, 3],
      [3, 5],
      [5, 2],
    ],
  },
  {
    v: [
      [0, -1.3, 0],
      [-1.1, 0.8, -1.1],
      [1.1, 0.8, -1.1],
      [1.1, 0.8, 1.1],
      [-1.1, 0.8, 1.1],
    ],
    e: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1],
    ],
  },
  (() => {
    const v: V3[] = [];
    for (const a of [-1, 1])
      for (const b of [-PHI, PHI]) v.push([0, a, b], [a, b, 0], [b, 0, a]);
    const e: [number, number][] = [];
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++) {
        const d = Math.hypot(
          v[i][0] - v[j][0],
          v[i][1] - v[j][1],
          v[i][2] - v[j][2],
        );
        if (Math.abs(d - 2) < 0.01) e.push([i, j]);
      }
    return { v: v.map(([x, y, z]) => [x * 0.75, y * 0.75, z * 0.75] as V3), e };
  })(),
];
const palettes = [
  ["#ff5c8a", "#ffd23f", "#2ec4b6", "#3a86ff", "#141414"],
  ["#f6f2ea", "#bdbdbd", "#8a8a8a", "#f6f2ea", "#5c5c5c"],
  ["#ffb5c2", "#bde0fe", "#cdeac0", "#ffe5a5", "#d6c8ff"],
];
const bauhaus = [
  ["#e63946", "#f4c430", "#1d4e89", "#141414"],
  ["#141414", "#5c5c5c", "#bdbdbd", "#f6f2ea"],
  ["#f2765e", "#e0a526", "#efe4cc", "#6b2737"],
];

export const geometryKinds: Partial<Record<OverlayKind, KindSpec>> = {
  orbit: {
    name: "Orbit rings",
    feel: "Geometry",
    description:
      "Tilted rings orbit the element with satellites passing behind and in front of it.",
    defaults: {
      color: "#f6f2ea",
      secondary: "#ffd23f",
      seconds: 0.6,
      timing: "in",
      count: 1,
      speed: 0.35,
      angle: -18,
      pad: 1,
    },
    controls: {
      ...drawn,
      color: "Ring",
      secondary: "Satellites",
      count: "Rings",
      speed: "Orbit speed",
      angle: "Tilt (degrees)",
      pad: "Gap",
      weight: "Line weight",
      variant: "System",
    },
    variants: ["Rings", "Atom", "Saturn"],
    text: true,
    strokes: true,
    draw: ({ o, a, p, W2, H2, P, S, thin, lw, ink, solid, time, cx, cy }) => {
      const n =
        o.variant === 1
          ? 3
          : o.variant === 2
            ? 1
            : Math.max(1, Math.min(4, o.count));
      const parts: OverlayPart[] = [];
      for (let i = 0; i < n; i++) {
        const rx = (W2 + P) * (1 + i * 0.18) * (o.variant === 2 ? 1.25 : 1);
        const ry = rx * (o.variant === 2 ? 0.16 : 0.28);
        const tilt = o.variant === 1 ? o.angle + i * 60 : o.angle + i * 14;
        const t = `translate(${f(cx)} ${f(cy)}) rotate(${f(tilt)})`;
        const reach = smooth(p);
        const width = o.variant === 2 ? lw * 2.4 : thin * 1.6;
        // The far half of the ring passes behind the element.
        parts.push(
          ink(
            arc(0, 0, rx, Math.PI, Math.PI + Math.PI * reach, ry),
            { behind: true, transform: t, width, opacity: a * 0.7 },
            i * 4,
          ),
          ink(
            arc(0, 0, rx, 0, Math.PI * reach, ry),
            { transform: t, width },
            i * 4 + 1,
          ),
        );
        const sat = time * o.speed * Math.PI * 2 * (1 + i * 0.3) + i * 2.1;
        const sx = Math.cos(sat) * rx,
          sy = Math.sin(sat) * ry;
        const front = Math.sin(sat) > 0;
        const ss = S(0.07, 0.016) * (front ? 1.2 : 0.85);
        parts.push(
          solid(
            ellipse(sx, sy, ss),
            {
              fill: o.secondary,
              behind: !front,
              transform: t,
              opacity: a * stage(p, 0.8, 1),
            },
            i * 4 + 2,
          ),
        );
      }
      return parts;
    },
  },
  wireframe: {
    name: "Wire solid",
    feel: "Geometry",
    description:
      "A rotating wireframe solid beside the element: cube, octahedron, pyramid or icosahedron.",
    defaults: {
      color: "#9fd8ff",
      seconds: 0.8,
      timing: "in",
      speed: 0.4,
      placement: "right",
      size: 1,
    },
    controls: {
      ...drawn,
      placement: "Side",
      size: "Size",
      speed: "Spin speed",
      pad: "Gap",
      weight: "Line weight",
      variant: "Solid",
    },
    variants: ["Cube", "Octahedron", "Pyramid", "Icosahedron"],
    strokes: true,
    draw: (c) => {
      const { o, p, W2, H2, P, S, thin, ink, time } = c;
      const R = S(0.45, 0.12);
      const at = c.side("right");
      const x =
        at === "left"
          ? -W2 - P - R * 1.3
          : at === "right"
            ? W2 + P + R * 1.3
            : 0;
      const y =
        at === "top"
          ? -H2 - P - R * 1.3
          : at === "bottom"
            ? H2 + P + R * 1.3
            : 0;
      c.pivot = [x, y];
      const solid = solids[o.variant] ?? solids[0];
      const ay = time * o.speed * Math.PI * 2,
        ax = 0.5 + time * o.speed * 1.3;
      const project = ([vx, vy, vz]: V3): P => {
        const x1 = vx * Math.cos(ay) + vz * Math.sin(ay);
        const z1 = -vx * Math.sin(ay) + vz * Math.cos(ay);
        const y2 = vy * Math.cos(ax) - z1 * Math.sin(ax);
        const z2 = vy * Math.sin(ax) + z1 * Math.cos(ax);
        const persp = 3.2 / (3.2 + z2);
        return [x + x1 * R * persp, y + y2 * R * persp];
      };
      const pts = solid.v.map(project);
      const d = solid.e.map(([i, j]) => line([pts[i], pts[j]])).join("");
      return [ink(d, { width: thin * 1.8, draw: p })];
    },
  },
  polygons: {
    name: "Nested polygons",
    feel: "Geometry",
    description:
      "Concentric polygons turn slowly behind the element, each ring the other way.",
    defaults: {
      color: "#f6f2ea",
      strength: 0.6,
      seconds: 0.7,
      timing: "in",
      count: 3,
      speed: 0.08,
      pad: 1,
    },
    controls: {
      ...drawn,
      count: "Rings",
      speed: "Turn speed",
      pad: "Gap",
      size: "Spacing",
      weight: "Line weight",
      variant: "Sides",
    },
    variants: ["Triangles", "Squares", "Hexagons", "Mixed"],
    strokes: true,
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, thin, ink, time }) => {
      const n = Math.max(1, Math.min(8, o.count));
      const base = Math.hypot(W2, H2) + P * 0.5;
      const step = S(0.35, 0.08);
      const sides = [3, 4, 6][o.variant] ?? 0;
      return Array.from({ length: n }, (_, i) => {
        const k = sides || [3, 4, 5, 6, 8][i % 5];
        const turn =
          (i % 2 ? -1 : 1) * time * o.speed * Math.PI * 2 + (i * Math.PI) / k;
        const r = (base + i * step) * (k === 3 ? 1.25 : k === 4 ? 1.05 : 1);
        return ink(
          line(polygon(0, 0, r, k, turn - Math.PI / 2), true),
          {
            behind: true,
            width: thin * 1.5,
            draw: stage(p, (i / n) * 0.4, (i / n) * 0.4 + 0.6),
            opacity: a * (1 - i / (n + 1)),
            closed: true,
            encloses: true,
            cap: "butt",
          },
          i,
        );
      });
    },
  },
  confetti: {
    name: "Memphis confetti",
    feel: "Geometry",
    description:
      "Squiggles, zigzags, triangles, rings and dots scattered round the element, bobbing and turning.",
    defaults: {
      seconds: 0.5,
      timing: "in",
      count: 12,
      speed: 0.4,
      pad: 1,
      weight: 1.3,
    },
    controls: {
      timing: "Draw",
      seconds: "Draw-on (seconds)",
      strength: "Opacity",
      count: "Pieces",
      speed: "Motion speed",
      pad: "Spread",
      size: "Size",
      weight: "Line weight",
      variant: "Palette",
    },
    variants: ["Memphis", "Mono", "Pastel"],
    text: true,
    strokes: true,
    fills: true,
    draw: ({ o, p, W2, H2, P, S, lw, fixed, time, solid, ink, cx, cy }) => {
      const n = Math.max(1, Math.min(24, o.count));
      const pal = palettes[o.variant] ?? palettes[0];
      const s = S(0.16, 0.035);
      const parts: OverlayPart[] = [];
      for (let i = 0; i < n; i++) {
        // Spread on a band outside the box, never over the words.
        const t = ((i + fixed(i) * 0.7) / n) * Math.PI * 2;
        const band = 1.12 + fixed(i + 50) * 0.45;
        const x = Math.cos(t) * (W2 + P * 0.6) * band,
          y = Math.sin(t) * (H2 + P * 0.6) * band;
        const bob = Math.sin(time * o.speed * Math.PI * 2 + i) * s * 0.3;
        const k = backOut(stage(p, (i / n) * 0.5, (i / n) * 0.5 + 0.5));
        const rot = fixed(i + 9) * 360 + time * o.speed * 60 * (i % 2 ? 1 : -1);
        const tr = `translate(${f(cx + x)} ${f(cy + y + bob)}) rotate(${f(rot)}) scale(${f(k)})`;
        const color = pal[i % pal.length];
        const sz = s * (0.7 + fixed(i + 70) * 0.6);
        switch (i % 6) {
          case 0:
            parts.push(
              solid(ellipse(0, 0, sz * 0.5), { fill: color, transform: tr }, i),
            );
            break;
          case 1:
            parts.push(
              solid(
                line(polygon(0, 0, sz * 0.7, 3), true),
                { fill: color, transform: tr },
                i,
              ),
            );
            break;
          case 2:
            parts.push(
              ink(
                curve(
                  Array.from({ length: 7 }, (_, k2): P => [
                    (k2 / 6 - 0.5) * sz * 2.2,
                    Math.sin(k2 * 1.6) * sz * 0.35,
                  ]),
                ),
                {
                  stroke: color,
                  width: lw,
                  transform: tr,
                },
                i,
              ),
            );
            break;
          case 3:
            parts.push(
              ink(
                line(
                  Array.from({ length: 6 }, (_, k2): P => [
                    (k2 / 5 - 0.5) * sz * 2,
                    k2 % 2 ? sz * 0.35 : -sz * 0.35,
                  ]),
                ),
                {
                  stroke: color,
                  width: lw,
                  transform: tr,
                  cap: "butt",
                },
                i,
              ),
            );
            break;
          case 4:
            parts.push(
              ink(
                ellipse(0, 0, sz * 0.5),
                { stroke: color, width: lw, transform: tr },
                i,
              ),
            );
            break;
          default:
            parts.push(
              solid(
                rect(-sz * 0.4, -sz * 0.4, sz * 0.4, sz * 0.4),
                { fill: color, transform: tr },
                i,
              ),
            );
        }
      }
      return parts;
    },
  },
  bauhaus: {
    name: "Bauhaus shapes",
    feel: "Geometry",
    description:
      "Big primary shapes — a disc, a half-moon, a triangle and a bar — slide in behind the element.",
    defaults: { seconds: 0.7, timing: "in", pad: 0.6, size: 1 },
    controls: {
      timing: "Draw",
      seconds: "Slide-in (seconds)",
      strength: "Opacity",
      pad: "Spread",
      size: "Size",
      variant: "Palette",
    },
    variants: ["Primary", "Mono", "Warm"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, fixed, solid, cx, cy }) => {
      const pal = bauhaus[o.variant] ?? bauhaus[0];
      const R = S(0.6, 0.45);
      const pieces: {
        d: string;
        x: number;
        y: number;
        from: P;
        color: string;
      }[] = [
        {
          d: ellipse(0, 0, R),
          x: -W2 * 0.75,
          y: -H2 * 0.35 - P * 0.4,
          from: [-1, -0.4],
          color: pal[0],
        },
        {
          d: `M${f(-R * 0.9)} 0A${f(R * 0.9)} ${f(R * 0.9)} 0 0 1 ${f(R * 0.9)} 0Z`,
          x: W2 * 0.7,
          y: H2 * 0.55 + P * 0.3,
          from: [1, 0.5],
          color: pal[1],
        },
        {
          d: line(polygon(0, 0, R * 0.85, 3), true),
          x: W2 * 0.85 + P * 0.3,
          y: -H2 * 0.6,
          from: [1, -1],
          color: pal[2],
        },
        {
          d: rect(-R * 1.6, -R * 0.14, R * 1.6, R * 0.14),
          x: -W2 * 0.3,
          y: H2 + P * 0.3,
          from: [-1, 1],
          color: pal[3],
        },
      ];
      return pieces.map((piece, i) => {
        const q = smooth(stage(p, i * 0.12, 0.6 + i * 0.12));
        const off = (1 - q) * (W2 + R * 2);
        const rot = (fixed(i) - 0.5) * 30 * (1 - q) + (i === 3 ? -8 : 0);
        return solid(
          piece.d,
          {
            behind: true,
            fill: piece.color,
            transform: `translate(${f(cx + piece.x + piece.from[0] * off)} ${f(cy + piece.y + piece.from[1] * off)}) rotate(${f(rot)})`,
            opacity: a * Math.min(1, q * 2),
          },
          i,
        );
      });
    },
  },
};
