import {
  backOut,
  drawn,
  ellipse,
  f,
  line,
  polygon,
  roundRect,
  stage,
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
const heart = (s: number) =>
  `M0 ${f(s * 0.75)}C${f(-s * 1.3)} ${f(-s * 0.1)} ${f(-s * 0.6)} ${f(-s * 1.05)} 0 ${f(-s * 0.4)}C${f(s * 0.6)} ${f(-s * 1.05)} ${f(s * 1.3)} ${f(-s * 0.1)} 0 ${f(s * 0.75)}Z`;

export const paperKinds: Partial<Record<OverlayKind, KindSpec>> = {
  torn: {
    name: "Torn paper",
    feel: "Paper",
    description:
      "A torn strip of paper behind the element, its ragged edges different every seed.",
    defaults: {
      color: "#d64541",
      secondary: "#f3ead8",
      seconds: 0.4,
      timing: "in",
      angle: -2,
      pad: 1,
      shadow: 0.5,
    },
    controls: {
      ...drawn,
      color: "Paper",
      secondary: "Under-layer",
      pad: "Margin",
      angle: "Tilt (degrees)",
      wobble: "Roughness",
      variant: "Tear",
    },
    variants: ["Strip", "Patch", "Two layers"],
    fills: true,
    text: true,
    draw: ({ o, p, W2, H2, P, S, fixed, solid, cx, cy, m }) => {
      const amp = Math.max(0.1, 0.025 * m) * (1 + o.wobble * 2);
      const tear = (
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        k: number,
        all: boolean,
      ) => {
        const n = 16;
        const pts: P[] = [];
        const reach = x0 + (x1 - x0) * stage(p, 0, 1);
        const edge = (from: P, to: P, rough: boolean, seed: number) => {
          for (let i = 0; i < n; i++) {
            const u = i / n;
            const x = from[0] + (to[0] - from[0]) * u,
              y = from[1] + (to[1] - from[1]) * u;
            const nx = -(to[1] - from[1]),
              ny = to[0] - from[0];
            const l = Math.hypot(nx, ny) || 1;
            const out = rough ? (fixed(seed * 50 + i) - 0.5) * amp : 0;
            pts.push([x + (nx / l) * out, y + (ny / l) * out]);
          }
        };
        edge([x0, y0], [reach, y0], true, k);
        edge([reach, y0], [reach, y1], true, k + 1);
        edge([reach, y1], [x0, y1], true, k + 2);
        edge([x0, y1], [x0, y0], all, k + 3);
        return line(pts, true);
      };
      const x = W2 + P,
        y = o.variant === 1 ? H2 + P : H2 + P * 0.45;
      const parts: OverlayPart[] = [];
      if (o.variant === 2)
        parts.push(
          solid(
            tear(-x * 1.03, -y * 1.15, x * 1.03, y * 1.15, 7, true),
            {
              behind: true,
              fill: o.secondary,
              transform: `translate(${f(cx + S(0.05, 0.01))} ${f(cy + S(0.06, 0.012))}) rotate(${f(o.angle + 3)})`,
              encloses: true,
            },
            1,
          ),
        );
      parts.push(
        solid(tear(-x, -y, x, y, 0, o.variant !== 0), {
          behind: true,
          transform: `translate(${f(cx)} ${f(cy)}) rotate(${f(o.angle)})`,
          encloses: true,
        }),
      );
      return parts;
    },
  },
  photocorners: {
    name: "Photo corners",
    feel: "Paper",
    description:
      "Album photo corners hold each corner: paper mounts, clear sleeves or lace.",
    defaults: {
      color: "#1d1d1d",
      seconds: 0.5,
      timing: "in",
      size: 1,
      shadow: 0.4,
    },
    controls: { ...drawn, color: "Mount", size: "Size", variant: "Mount" },
    variants: ["Paper mounts", "Clear sleeves", "Lace"],
    fills: true,
    draw: ({ o, a, p, W2, H2, S, solid, ink, thin, cx, cy }) => {
      const L = S(0.55, 0.13);
      return corners.flatMap(([sx, sy], i) => {
        const k = backOut(stage(p, i * 0.12, 0.6 + i * 0.12));
        const X = sx * (W2 + L * 0.08),
          Y = sy * (H2 + L * 0.08);
        const tri: P[] = [
          [X, Y],
          [X - sx * L * k, Y],
          [X, Y - sy * L * k],
        ];
        const t = `translate(${f(cx)} ${f(cy)})`;
        if (o.variant === 1)
          return [
            solid(
              line(tri, true),
              { fill: "#ffffff", opacity: a * 0.18, transform: t },
              i * 2,
            ),
            ink(
              line(tri, true),
              {
                stroke: "#ffffff",
                width: thin * 1.4,
                opacity: a * 0.7,
                transform: t,
                closed: true,
              },
              i * 2 + 1,
            ),
          ];
        if (o.variant === 2) {
          // A scalloped lace edge along the hypotenuse.
          const n = 5;
          let d = `M${f(X)} ${f(Y)}L${f(tri[1][0])} ${f(tri[1][1])}`;
          for (let j = 0; j < n; j++) {
            const u0 = j / n,
              u1 = (j + 1) / n;
            const a0: P = [
              tri[1][0] + (tri[2][0] - tri[1][0]) * u0,
              tri[1][1] + (tri[2][1] - tri[1][1]) * u0,
            ];
            const a1: P = [
              tri[1][0] + (tri[2][0] - tri[1][0]) * u1,
              tri[1][1] + (tri[2][1] - tri[1][1]) * u1,
            ];
            const mx = (a0[0] + a1[0]) / 2 - sx * L * 0.08 * k,
              my = (a0[1] + a1[1]) / 2 - sy * L * 0.08 * k;
            d += `Q${f(mx)} ${f(my)} ${f(a1[0])} ${f(a1[1])}`;
          }
          return [solid(d + "Z", { transform: t }, i * 2)];
        }
        return [solid(line(tri, true), { transform: t }, i * 2)];
      });
    },
  },
  pin: {
    name: "Push pin",
    feel: "Paper",
    description:
      "A push pin, thumbtack or paper clip drops in and holds the element up.",
    defaults: { color: "#e8392f", seconds: 0.35, timing: "in", shadow: 0.6 },
    controls: {
      ...drawn,
      color: "Pin",
      placement: "Edge",
      size: "Size",
      variant: "Fastener",
    },
    variants: ["Round pin", "Thumbtack", "Paper clip"],
    fills: true,
    draw: (c) => {
      const { o, a, p, W2, H2, S, solid, ink, lw, cx, cy } = c;
      const s = S(0.22, 0.045);
      const left = o.placement === "left",
        right = o.placement === "right";
      const x = left ? -W2 * 0.8 : right ? W2 * 0.8 : 0;
      const y = -H2 + s * 0.2;
      c.pivot = [x, y];
      const drop = (1 - backOut(stage(p, 0, 1), 1.2)) * s * 4;
      const t = `translate(${f(cx + x)} ${f(cy + y - drop)})`;
      if (o.variant === 2) {
        const w = s * 0.9,
          h = s * 3.2;
        const d = `M${f(w * 0.3)} ${f(h * 0.55)}V${f(-h * 0.35)}A${f(w * 0.35)} ${f(w * 0.35)} 0 0 0 ${f(-w * 0.4)} ${f(-h * 0.35)}V${f(h * 0.5)}A${f(w * 0.55)} ${f(w * 0.55)} 0 0 0 ${f(w * 0.7)} ${f(h * 0.5)}V${f(-h * 0.5)}`;
        return [
          ink(d, {
            stroke: o.color === "#e8392f" ? "#c8cdd2" : o.color,
            width: lw * 0.9,
            transform: `${t} rotate(-8)`,
            shadow: s * 0.15,
          }),
        ];
      }
      if (o.variant === 1)
        return [
          solid(
            ellipse(0, 0, s * 1.15, s * 1.0),
            { transform: t, shadow: s * 0.25 },
            0,
          ),
          solid(
            ellipse(0, 0, s * 0.55, s * 0.48),
            { fill: "#ffffff", opacity: a * 0.25, transform: t },
            1,
          ),
          solid(
            ellipse(-s * 0.35, -s * 0.35, s * 0.2),
            { fill: "#ffffff", opacity: a * 0.6, transform: t },
            2,
          ),
        ];
      return [
        solid(ellipse(0, 0, s), { transform: t, shadow: s * 0.3 }, 0),
        solid(
          ellipse(-s * 0.3, -s * 0.32, s * 0.3),
          { fill: "#ffffff", opacity: a * 0.55, transform: t },
          1,
        ),
      ];
    },
  },
  sticker: {
    name: "Peel sticker",
    feel: "Paper",
    description:
      "A die-cut sticker on the corner with a curled, peeling edge and your word on it.",
    defaults: {
      color: "#ffd23f",
      secondary: "#141414",
      seconds: 0.35,
      timing: "in",
      label: "HI!",
      angle: -10,
      placement: "left",
      shadow: 0.4,
      font: "sans",
    },
    controls: {
      ...drawn,
      color: "Sticker",
      secondary: "Text",
      label: "Words",
      placement: "Corner",
      angle: "Tilt (degrees)",
      size: "Size",
      variant: "Shape",
    },
    variants: ["Circle", "Rounded label", "Star", "Heart"],
    fills: true,
    text: true,
    draw: (c) => {
      const { o, a, p, W2, H2, S, solid, text, cx, cy } = c;
      const words = c.label("HI!");
      const R = S(0.5, 0.11) * Math.max(1, [...words].length / 4);
      const left = o.placement !== "right";
      const below = o.placement === "bottom";
      const x = (left ? -1 : 1) * (W2 - R * 0.3),
        y = below ? H2 - R * 0.3 : -H2 + R * 0.3;
      c.pivot = [x, y];
      const k = backOut(stage(p, 0, 0.8));
      const t = `translate(${f(cx + x)} ${f(cy + y)}) rotate(${f(o.angle)}) scale(${f(k)})`;
      const shape =
        o.variant === 1
          ? roundRect(-R * 1.4, -R * 0.62, R * 1.4, R * 0.62, R * 0.3)
          : o.variant === 2
            ? line(polygon(0, 0, R * 1.15, 5, -Math.PI / 2, R * 0.55), true)
            : o.variant === 3
              ? heart(R)
              : ellipse(0, 0, R);
      // The peeled corner: a folded flap with its shadow.
      const peel = R * 0.38;
      const px = R * (o.variant === 1 ? 1.4 : 0.72),
        py = R * (o.variant === 1 ? 0.62 : 0.72);
      const parts: OverlayPart[] = [
        solid(shape, { transform: t, stroke: "#ffffff", width: R * 0.08 }, 0),
        solid(
          line(
            [
              [px - peel, py],
              [px, py - peel],
              [px - peel * 0.9, py - peel * 0.9],
            ],
            true,
          ),
          {
            fill: "#ffffff",
            opacity: a * 0.92,
            transform: t,
            shadow: peel * 0.2,
            closed: false,
          },
          1,
        ),
      ];
      const size =
        R *
        (o.variant === 1 ? 0.62 : 0.55) *
        Math.min(1, 4 / Math.max(3, [...words].length));
      parts.push(
        text(words, 0, size * 0.36, size, {
          x: 0,
          y: size * 0.36,
          fill: o.secondary,
          bold: true,
          mono: false,
          font: o.font === "auto" ? "sans" : o.font,
          transform: t,
          opacity: a,
        }),
      );
      return parts;
    },
  },
  ticket: {
    name: "Ticket edge",
    feel: "Paper",
    description:
      "Frames the element as a ticket with a perforated stub, a postage stamp or a cut-out coupon.",
    defaults: {
      color: "#f6f2ea",
      seconds: 0.6,
      timing: "in",
      label: "ADMIT ONE",
      pad: 0.8,
    },
    controls: {
      ...drawn,
      label: "Stub text",
      pad: "Margin",
      size: "Notch size",
      weight: "Line weight",
      variant: "Edge",
    },
    variants: ["Ticket", "Postage stamp", "Coupon"],
    strokes: true,
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, thin, ink, text, lw, cx, cy }) => {
      const x = W2 + P,
        y = H2 + P;
      const parts: OverlayPart[] = [];
      if (o.variant === 1) {
        // Postage: a scalloped edge all round.
        const r = S(0.09, 0.02);
        const along = (from: P, to: P) => {
          const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
          const n = Math.max(3, Math.round(len / (r * 2.6)));
          let d = "";
          for (let i = 0; i < n; i++) {
            const u1 = (i + 1) / n;
            const b: P = [
              from[0] + (to[0] - from[0]) * u1,
              from[1] + (to[1] - from[1]) * u1,
            ];
            d += `A${f(r)} ${f(r)} 0 0 0 ${f(b[0])} ${f(b[1])}`;
          }
          return d;
        };
        const d =
          `M${f(-x)} ${f(-y)}` +
          along([-x, -y], [x, -y]) +
          along([x, -y], [x, y]) +
          along([x, y], [-x, y]) +
          along([-x, y], [-x, -y]) +
          "Z";
        parts.push(
          ink(d, { width: lw * 0.8, draw: p, closed: true, encloses: true }),
        );
        return parts;
      }
      if (o.variant === 2) {
        parts.push(
          ink(`M${f(-x)} ${f(-y)}H${f(x)}V${f(y)}H${f(-x)}Z`, {
            width: thin * 1.6,
            draw: p,
            dash: [thin * 8, thin * 5],
            cap: "butt",
            closed: true,
            encloses: true,
          }),
          text("✂", -x + S(0.25, 0.05), -y + S(0.1, 0.02), S(0.3, 0.06), {
            opacity: a * stage(p, 0.3, 0.6),
            mono: false,
          }),
        );
        return parts;
      }
      const r = S(0.18, 0.04);
      const stub = x - Math.max(S(0.7, 0.18), r * 3);
      const d =
        `M${f(-x)} ${f(-y)}H${f(stub - r)}A${f(r)} ${f(r)} 0 0 0 ${f(stub + r)} ${f(-y)}H${f(x)}` +
        `V${f(y)}H${f(stub + r)}A${f(r)} ${f(r)} 0 0 0 ${f(stub - r)} ${f(y)}H${f(-x)}Z`;
      parts.push(
        ink(d, { width: lw * 0.8, draw: p, closed: true, encloses: true }, 0),
        ink(
          line([
            [stub, -y + r * 1.3],
            [stub, y - r * 1.3],
          ]),
          {
            width: thin * 1.4,
            dash: [thin * 3, thin * 3],
            cap: "butt",
            draw: stage(p, 0.4, 1),
          },
          1,
        ),
      );
      const size = S(0.13, 0.022);
      parts.push(
        text(o.label?.trim() || "ADMIT ONE", 0, 0, size, {
          x: 0,
          y: 0,
          transform: `translate(${f(cx + (stub + x) / 2 + size * 0.35)} ${f(cy)}) rotate(-90)`,
          opacity: a * stage(p, 0.6, 1),
          bold: true,
        }),
      );
      return parts;
    },
  },
};
