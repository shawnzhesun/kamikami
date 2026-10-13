import {
  getLength,
  getPointAtLength,
  getTangentAtLength,
} from "@remotion/paths";
import {
  arrowhead,
  backOut,
  drawn,
  ellipse,
  f,
  line,
  smooth,
  stage,
  type Ctx,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

/** Where a ray from the box center along (ux, uy) leaves the padded box. */
function exit(W2: number, H2: number, ux: number, uy: number, pad: number): P {
  const x = W2 + pad,
    y = H2 + pad;
  const k = Math.min(
    Math.abs(ux) > 1e-6 ? x / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-6 ? y / Math.abs(uy) : Infinity,
  );
  return [ux * k, uy * k];
}

/** The other element to link to, in box coordinates, or a point along `angle`. */
function partner(c: Ctx): { at: P; found: boolean } {
  const peers = [...(c.target.peers ?? [])]
    .map(([x, y]): P => [x - c.cx, y - c.cy])
    .filter(([x, y]) => Math.hypot(x, y) > 1e-3)
    .sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  const pick = peers[Math.min(peers.length - 1, Math.max(0, c.o.count - 1))];
  if (pick) return { at: pick, found: true };
  const len = Math.max(c.W2, c.H2) + c.S(2.2, 0.6);
  return { at: [Math.cos(c.rad) * len, Math.sin(c.rad) * len], found: false };
}

export const connectKinds: Partial<Record<OverlayKind, KindSpec>> = {
  route: {
    name: "Route line",
    feel: "Connect",
    description:
      "A dashed travel route curves in to the element with a marker riding along it: a dot, a plane or pulses at the destination.",
    defaults: {
      color: "#f6f2ea",
      secondary: "#f2765e",
      seconds: 1.2,
      timing: "in",
      angle: 205,
      speed: 0.3,
      weight: 1,
    },
    controls: {
      ...drawn,
      secondary: "Marker",
      angle: "Comes from (degrees)",
      size: "Length",
      speed: "Loop speed (0 rides once)",
      pad: "Gap",
      weight: "Line weight",
      variant: "Marker",
    },
    variants: ["Dot", "Plane", "Pulse"],
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
      rad,
      ink,
      solid,
      time,
      cx,
      cy,
      fixed,
    }) => {
      const ux = Math.cos(rad),
        uy = Math.sin(rad);
      const end = exit(W2, H2, ux, uy, P * 0.5);
      const len = S(2.4, 0.6);
      const start: P = [end[0] + ux * len, end[1] + uy * len];
      // Bowed to one side, like a flight path on a map.
      const bend = len * (0.35 + fixed(3) * 0.2);
      const ctrl: P = [
        (start[0] + end[0]) / 2 - uy * bend,
        (start[1] + end[1]) / 2 + ux * bend,
      ];
      const d = `M${f(start[0])} ${f(start[1])}Q${f(ctrl[0])} ${f(ctrl[1])} ${f(end[0])} ${f(end[1])}`;
      const total = getLength(d);
      const ride = o.speed > 0 && p >= 1 ? (time * o.speed) % 1 : smooth(p);
      const at = getPointAtLength(d, total * ride) ?? { x: end[0], y: end[1] };
      const tan = getTangentAtLength(
        d,
        total * Math.max(0.001, Math.min(0.999, ride)),
      ) ?? { x: ux, y: uy };
      const parts: OverlayPart[] = [
        ink(
          d,
          { width: lw, draw: p, dash: [lw * 3, lw * 2.4], cap: "butt" },
          0,
        ),
        ink(
          ellipse(start[0], start[1], lw * 2.5),
          { width: lw * 0.8, opacity: a * stage(p, 0, 0.2) },
          1,
        ),
      ];
      const t = `translate(${f(cx + at.x)} ${f(cy + at.y)}) rotate(${f((Math.atan2(tan.y, tan.x) * 180) / Math.PI)})`;
      const s = S(0.14, 0.03);
      if (o.variant === 1)
        parts.push(
          solid(
            line(
              [
                [s * 1.2, 0],
                [-s * 0.8, -s * 0.7],
                [-s * 0.4, 0],
                [-s * 0.8, s * 0.7],
              ],
              true,
            ),
            { fill: o.secondary, transform: t },
            2,
          ),
        );
      else if (o.variant === 2) {
        for (let k = 0; k < 3; k++) {
          const age = (time * 0.8 + k / 3) % 1;
          parts.push(
            ink(
              ellipse(end[0], end[1], s * (0.4 + age * 2.2)),
              {
                stroke: o.secondary,
                width: lw * 0.8,
                opacity: a * stage(p, 0.8, 1) * (1 - age),
              },
              3 + k,
            ),
          );
        }
        parts.push(
          solid(
            ellipse(end[0], end[1], s * 0.4),
            { fill: o.secondary, opacity: a * stage(p, 0.8, 1) },
            2,
          ),
        );
      } else
        parts.push(
          solid(
            ellipse(0, 0, s * 0.55),
            { fill: o.secondary, transform: t },
            2,
          ),
        );
      return parts;
    },
  },
  mappin: {
    name: "Map pin",
    feel: "Connect",
    description:
      "A map pin drops onto the element with a ripple where it lands, and an optional place name.",
    defaults: {
      color: "#f2765e",
      secondary: "#f6f2ea",
      seconds: 0.5,
      timing: "in",
      anchor: "keyword",
      label: "",
    },
    controls: {
      ...drawn,
      anchor: "Drops on",
      secondary: "Label",
      label: "Place name",
      size: "Size",
      variant: "Pin",
    },
    variants: ["Pin", "Flag", "Pulsing dot"],
    text: true,
    fills: true,
    draw: (c) => {
      const { o, a, p, H2, S, solid, ink, text, cx, cy, lw, time } = c;
      const s = S(0.42, 0.08);
      const tipY = -H2 - s * 0.1;
      c.pivot = [0, tipY];
      const drop = (1 - backOut(stage(p, 0, 0.8), 1.4)) * s * 3.5;
      const t = `translate(${f(cx)} ${f(cy + tipY - drop)})`;
      const parts: OverlayPart[] = [];
      const ring = stage(p, 0.55, 1);
      if (ring > 0 && ring < 1)
        parts.push(
          ink(
            ellipse(0, tipY, s * (0.3 + ring * 1.2), s * (0.12 + ring * 0.45)),
            { width: lw * 0.7, opacity: a * (1 - ring) },
            9,
          ),
        );
      if (o.variant === 2) {
        for (let k = 0; k < 2; k++) {
          const age = (time * 0.9 + k / 2) % 1;
          parts.push(
            ink(
              ellipse(0, 0, s * (0.3 + age * 0.9)),
              { width: lw * 0.7, transform: t, opacity: a * (1 - age) },
              3 + k,
            ),
          );
        }
        parts.push(
          solid(
            ellipse(0, 0, s * 0.3),
            { transform: t, stroke: o.secondary, width: lw * 0.6 },
            0,
          ),
        );
      } else if (o.variant === 1) {
        parts.push(
          ink(
            line([
              [0, 0],
              [0, -s * 2.2],
            ]),
            { stroke: o.secondary, width: lw * 0.8, transform: t, cap: "butt" },
            0,
          ),
          solid(
            `M0 ${f(-s * 2.2)}L${f(s * 1.3)} ${f(-s * 1.85)}L0 ${f(-s * 1.5)}Z`,
            { transform: t },
            1,
          ),
        );
      } else {
        // A teardrop pin with its point on the element.
        parts.push(
          solid(
            `M0 0C${f(-s * 0.25)} ${f(-s * 0.55)} ${f(-s * 0.75)} ${f(-s * 0.9)} ${f(-s * 0.75)} ${f(-s * 1.45)}A${f(s * 0.75)} ${f(s * 0.75)} 0 1 1 ${f(s * 0.75)} ${f(-s * 1.45)}C${f(s * 0.75)} ${f(-s * 0.9)} ${f(s * 0.25)} ${f(-s * 0.55)} 0 0Z`,
            { transform: t, shadow: s * 0.12 },
            0,
          ),
          solid(
            ellipse(0, -s * 1.45, s * 0.3),
            { fill: o.secondary, transform: t },
            1,
          ),
        );
      }
      const name = o.label?.trim();
      if (name) {
        const size = S(0.2, 0.03);
        parts.push(
          text(name, 0, tipY - s * (o.variant === 2 ? 0.9 : 2.6), size, {
            fill: o.secondary,
            bold: true,
            opacity: a * stage(p, 0.7, 1),
          }),
        );
      }
      return parts;
    },
  },
  thread: {
    name: "Thread link",
    feel: "Connect",
    description:
      "A line links the element to the nearest other element on screen — a sagging thread, a dotted line or a leader with an arrow. With nothing else on screen it reaches out along an angle.",
    defaults: {
      color: "#f6f2ea",
      seconds: 0.8,
      timing: "in",
      count: 1,
      angle: -30,
      weight: 0.9,
    },
    controls: {
      ...drawn,
      count: "Link to (1 = nearest)",
      angle: "Fallback direction (degrees)",
      pad: "Gap",
      size: "Sag",
      weight: "Line weight",
      variant: "Line",
    },
    variants: ["Thread", "Dotted", "Leader"],
    text: true,
    strokes: true,
    draw: (c) => {
      const { o, a, p, P, S, lw, ink, solid, time } = c;
      const { at } = partner(c);
      const dist = Math.hypot(at[0], at[1]) || 1;
      const ux = at[0] / dist,
        uy = at[1] / dist;
      const from = exit(c.W2, c.H2, ux, uy, P * 0.4);
      const to: P = [at[0] - ux * P * 0.6, at[1] - uy * P * 0.6];
      const parts: OverlayPart[] = [];
      if (o.variant === 2) {
        const elbow: P = [to[0], from[1]];
        parts.push(
          ink(line([from, elbow, to]), { width: lw, draw: p, cap: "butt" }, 0),
          ink(
            arrowhead(
              to,
              Math.atan2(to[1] - elbow[1], to[0] - elbow[0]),
              S(0.16, 0.03),
            ),
            {
              width: lw,
              opacity: a * stage(p, 0.85, 1),
            },
            1,
          ),
        );
      } else {
        // A thread sags under its own weight and sways a little.
        const sag =
          o.variant === 1
            ? 0
            : dist * 0.18 * o.size * (1 + Math.sin(time * 1.3) * 0.08);
        const mid: P = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + sag];
        parts.push(
          ink(
            `M${f(from[0])} ${f(from[1])}Q${f(mid[0])} ${f(mid[1])} ${f(to[0])} ${f(to[1])}`,
            {
              width: o.variant === 1 ? lw * 1.4 : lw,
              draw: p,
              dash: o.variant === 1 ? [0.001, lw * 3] : undefined,
            },
            0,
          ),
        );
      }
      parts.push(
        solid(
          ellipse(from[0], from[1], lw * 1.8),
          { opacity: a * stage(p, 0, 0.15) },
          2,
        ),
        solid(
          ellipse(to[0], to[1], lw * 1.8),
          { opacity: a * stage(p, 0.9, 1) },
          3,
        ),
      );
      return parts;
    },
  },
};
