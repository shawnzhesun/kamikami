import {
  arc,
  backOut,
  drawn,
  ellipse,
  f,
  line,
  rect,
  smooth,
  stage,
  timecode,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

const HUD = "#7cf7d4";
const hex = (n: number) =>
  Math.floor(n * 65536)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");

export const interfaceKinds: Partial<Record<OverlayKind, KindSpec>> = {
  reticle: {
    name: "Lock-on reticle",
    feel: "Interface",
    description:
      "A targeting reticle spins in, closes on the element and locks with a blinking tag.",
    defaults: {
      color: HUD,
      seconds: 0.7,
      timing: "in",
      label: "LOCK",
      speed: 2,
      pad: 0.8,
    },
    controls: {
      ...drawn,
      anchor: "Locks on",
      label: "Tag",
      pad: "Gap",
      size: "Size",
      speed: "Blink speed",
      weight: "Line weight",
      variant: "Sight",
    },
    variants: ["Brackets", "Ring sight", "Diamond"],
    text: true,
    draw: ({ o, a, p, W2, H2, P, S, thin, ink, text, time, cx, cy }) => {
      const q = smooth(p);
      const far = 1 + (1 - q) * 1.4;
      const spin = (1 - q) * 90;
      const x = (W2 + P * 0.6) * far,
        y = (H2 + P * 0.6) * far;
      const len = S(0.28, 0.08);
      const parts: OverlayPart[] = [];
      const rot = `translate(${f(cx)} ${f(cy)}) rotate(${f(spin)})`;
      if (o.variant === 1) {
        const R = Math.max(x, y);
        for (let i = 0; i < 4; i++) {
          const t0 = (i * Math.PI) / 2 + 0.25,
            t1 = ((i + 1) * Math.PI) / 2 - 0.25;
          parts.push(
            ink(arc(0, 0, R, t0, t1), { width: thin * 1.5, transform: rot }, i),
          );
          const t = (i * Math.PI) / 2;
          parts.push(
            ink(
              line([
                [Math.cos(t) * R * 0.86, Math.sin(t) * R * 0.86],
                [Math.cos(t) * R * 1.12, Math.sin(t) * R * 1.12],
              ]),
              { width: thin * 1.5, transform: rot, cap: "butt" },
              i + 4,
            ),
          );
        }
      } else {
        const corners: P[] = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ];
        corners.forEach(([sx, sy], i) => {
          const d =
            o.variant === 2
              ? line([
                  [0, sy * (y + len * 0.8)],
                  [sx * len * 0.9, sy * (y + len * 0.8) - sy * len * 0.9],
                ]) +
                line([
                  [sx * (x + len * 0.8), 0],
                  [sx * (x + len * 0.8) - sx * len * 0.9, sy * len * 0.9],
                ])
              : line([
                  [sx * x, sy * (y - len)],
                  [sx * x, sy * y],
                  [sx * (x - len), sy * y],
                ]);
          parts.push(
            ink(d, { width: thin * 2, transform: rot, cap: "square" }, i),
          );
        });
      }
      const c = S(0.1, 0.02);
      parts.push(
        ink(
          `M${f(-c)} 0H${f(c)}M0 ${f(-c)}V${f(c)}`,
          { width: thin, opacity: a * q, cap: "butt" },
          9,
        ),
      );
      const blink =
        p >= 1 ? (Math.floor(time * o.speed * 2) % 2 ? 0.25 : 1) : 0;
      const size = S(0.16, 0.025);
      parts.push(
        text(o.label?.trim() || "LOCK", -x, y + size * 1.6, size, {
          align: "start",
          opacity: a * blink,
          bold: true,
        }),
      );
      return parts;
    },
  },
  scan: {
    name: "Scan sweep",
    feel: "Interface",
    description:
      "A glowing scan line sweeps over the element with a readout, or a radar arm sweeps round.",
    defaults: {
      color: HUD,
      seconds: 0.5,
      timing: "constant",
      speed: 0.5,
      label: "SCAN {pct}%",
    },
    controls: {
      ...drawn,
      label: "Readout",
      speed: "Sweeps per second",
      pad: "Gap",
      size: "Size",
      variant: "Sweep",
    },
    variants: ["Line sweep", "Radar", "Framed sweep"],
    draw: ({ o, a, p, W2, H2, P, S, thin, lw, ink, solid, text, time }) => {
      const u = (time * o.speed) % 1;
      const pct = String(Math.round(u * 100)).padStart(2, "0");
      const size = S(0.15, 0.022);
      const parts: OverlayPart[] = [];
      const readout = (o.label?.trim() || "SCAN {pct}%").replace(
        /\{pct\}/g,
        pct,
      );
      if (o.variant === 1) {
        const R = Math.max(W2, H2) + P * 0.5;
        const t = u * Math.PI * 2 - Math.PI / 2;
        parts.push(
          ink(ellipse(0, 0, R), { width: thin, opacity: a * p * 0.6 }, 0),
        );
        parts.push(
          ink(
            ellipse(0, 0, R * 0.5),
            { width: thin, opacity: a * p * 0.35 },
            1,
          ),
        );
        // A fading wedge behind the arm.
        for (let k = 0; k < 6; k++) {
          const t0 = t - (k + 1) * 0.12,
            t1 = t - k * 0.12;
          parts.push(
            solid(
              `M0 0L${f(Math.cos(t0) * R)} ${f(Math.sin(t0) * R)}A${f(R)} ${f(R)} 0 0 1 ${f(Math.cos(t1) * R)} ${f(Math.sin(t1) * R)}Z`,
              { opacity: a * p * 0.28 * (1 - k / 6), blend: "screen" },
              k + 2,
            ),
          );
        }
        parts.push(
          ink(
            line([
              [0, 0],
              [Math.cos(t) * R, Math.sin(t) * R],
            ]),
            { width: lw, glow: lw * 2, opacity: a * p },
            10,
          ),
        );
        parts.push(
          text(
            readout,
            R * 0.72,
            -R * 0.78,
            size,
            { align: "start", opacity: a * p },
            0,
          ),
        );
        return parts;
      }
      const x = W2 + P * 0.3,
        y = H2 + P * 0.3;
      const sy = -y + u * y * 2;
      parts.push(
        solid(
          rect(-x, Math.max(-y, sy - y * 0.5), x, sy),
          {
            opacity: a * p * 0.16,
            blend: "screen",
          },
          0,
        ),
        ink(
          line([
            [-x - P * 0.3, sy],
            [x + P * 0.3, sy],
          ]),
          { width: lw, glow: lw * 2.5, opacity: a * p, cap: "butt" },
          1,
        ),
      );
      if (o.variant === 2) {
        const len = S(0.25, 0.06);
        (
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ] as P[]
        ).forEach(([cx, cy], i) =>
          parts.push(
            ink(
              line([
                [cx * x, cy * (y - len)],
                [cx * x, cy * y],
                [cx * (x - len), cy * y],
              ]),
              { width: thin * 2, opacity: a * p, cap: "square" },
              i + 2,
            ),
          ),
        );
      }
      parts.push(
        text(
          readout,
          x + P * 0.4,
          sy + size * 0.35,
          size,
          { align: "start", opacity: a * p },
          0,
        ),
      );
      return parts;
    },
  },
  datacolumn: {
    name: "Data column",
    feel: "Interface",
    description:
      "A column of monospaced data scrolls beside the element: hex, live telemetry or binary.",
    defaults: {
      color: HUD,
      strength: 0.85,
      count: 6,
      speed: 1.5,
      seconds: 0.6,
      timing: "in",
      placement: "right",
    },
    controls: {
      ...drawn,
      placement: "Side",
      count: "Rows",
      speed: "Scroll (rows/s)",
      pad: "Gap",
      size: "Size",
      label: "Header",
      variant: "Data",
    },
    variants: ["Hex dump", "Telemetry", "Binary"],
    draw: ({
      o,
      a,
      p,
      W2,
      H2,
      P,
      S,
      w,
      h,
      fixed,
      text,
      ink,
      thin,
      target,
      time,
      duration,
    }) => {
      const rows = Math.max(2, Math.min(16, o.count));
      const size = S(0.13, 0.02);
      const lead = size * 1.45;
      const at =
        o.placement === "left"
          ? "left"
          : o.placement === "top"
            ? "top"
            : o.placement === "bottom"
              ? "bottom"
              : "right";
      const x0 =
        at === "left" ? -W2 - P * 0.6 : at === "right" ? W2 + P * 0.6 : -W2;
      const align = at === "left" ? "end" : "start";
      const top =
        at === "top"
          ? -H2 - P * 0.6 - rows * lead
          : at === "bottom"
            ? H2 + P * 0.6 + lead
            : -((rows - 1) * lead) / 2;
      const scroll = time * o.speed;
      const base = Math.floor(scroll);
      const frac = scroll - base;
      const pos = target.position ?? { x: 0, y: 0 };
      const row = (n: number) => {
        if (o.variant === 2)
          return Array.from({ length: 2 }, (_, k) =>
            Array.from({ length: 8 }, (_, b) =>
              fixed(n * 31 + k * 8 + b) > 0.5 ? "1" : "0",
            ).join(""),
          ).join(" ");
        if (o.variant === 1) {
          const lines = [
            `X  ${Math.round(pos.x)}`,
            `Y  ${Math.round(-pos.y)}`,
            `W  ${Math.round(w * target.unitPx)}`,
            `H  ${Math.round(h * target.unitPx)}`,
            `T  ${timecode(time)}`,
            `LEN ${timecode(duration)}`,
            `SEQ ${String(n).padStart(4, "0")}`,
            `SIG ${Math.round(40 + fixed(n) * 59)}%`,
          ];
          return lines[((n % lines.length) + lines.length) % lines.length];
        }
        return `${hex(fixed(n * 3))}  ${hex(fixed(n * 3 + 1)).slice(0, 2)} ${hex(fixed(n * 3 + 2)).slice(0, 2)}`;
      };
      const parts: OverlayPart[] = [];
      const shown = Math.ceil(stage(p, 0, 1) * rows);
      for (let i = 0; i < rows + 1; i++) {
        const y = top + (i - frac) * lead;
        const edge = Math.min(i + 1 - frac, rows - i + frac) / 1.5;
        if (i >= shown + 1) break;
        parts.push(
          text(
            row(base + i),
            x0,
            y + size * 0.35,
            size,
            {
              align,
              opacity: a * Math.max(0, Math.min(1, edge)),
            },
            i,
          ),
        );
      }
      const header = o.label?.trim();
      if (header)
        parts.push(
          text(
            header,
            x0,
            top - lead * 0.9,
            size,
            { align, bold: true, opacity: a },
            99,
          ),
        );
      const gx = at === "left" ? x0 + size * 0.5 : x0 - size * 0.5;
      parts.push(
        ink(
          line([
            [gx, top - lead * 0.4],
            [gx, top - lead * 0.4 + rows * lead * smooth(p)],
          ]),
          { width: thin, cap: "butt", opacity: a * 0.6 },
          0,
        ),
      );
      return parts;
    },
  },
  progressring: {
    name: "Progress ring",
    feel: "Interface",
    description:
      "A gauge fills over the clip: a small dial, a ring around the element, segments or a bar.",
    defaults: {
      color: HUD,
      secondary: "#2b3a44",
      seconds: 0.4,
      timing: "in",
      count: 12,
      placement: "left",
      weight: 1.4,
    },
    controls: {
      ...drawn,
      color: "Fill",
      secondary: "Track",
      placement: "Side",
      count: "Segments",
      label: "Readout",
      size: "Size",
      weight: "Line weight",
      variant: "Gauge",
    },
    variants: ["Dial", "Around", "Segments", "Bar"],
    text: true,
    draw: ({
      o,
      a,
      p,
      W2,
      H2,
      P,
      S,
      lw,
      ink,
      text,
      time,
      duration,
      side,
      cx,
      cy,
    }) => {
      const prog = Math.max(0, Math.min(1, time / Math.max(0.01, duration)));
      const pct = Math.round(prog * 100);
      const readout = (o.label?.trim() || "{pct}%").replace(
        /\{pct\}/g,
        String(pct),
      );
      const parts: OverlayPart[] = [];
      const size = S(0.15, 0.024);
      const shown = smooth(p);
      if (o.variant === 1) {
        const rx = W2 + P,
          ry = H2 + P;
        parts.push(
          ink(
            ellipse(0, 0, rx, ry),
            { stroke: o.secondary, width: lw, opacity: a * shown },
            0,
          ),
        );
        parts.push(
          ink(
            arc(
              0,
              0,
              rx,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * prog * shown,
              ry,
            ),
            { width: lw, cap: "round" },
            1,
          ),
        );
        return parts;
      }
      if (o.variant === 3) {
        const below = side("bottom") !== "top";
        const y = below ? H2 + P * 0.7 : -H2 - P * 0.7;
        parts.push(
          ink(
            line([
              [-W2, y],
              [W2, y],
            ]),
            {
              stroke: o.secondary,
              width: lw * 1.6,
              cap: "butt",
              opacity: a * shown,
            },
            0,
          ),
        );
        parts.push(
          ink(
            line([
              [-W2, y],
              [-W2 + W2 * 2 * prog, y],
            ]),
            { width: lw * 1.6, cap: "butt", opacity: a * shown },
            1,
          ),
        );
        parts.push(
          text(readout, W2, y + (below ? size * 1.7 : -size * 0.8), size, {
            align: "end",
            opacity: a * shown,
          }),
        );
        return parts;
      }
      const R = S(0.4, 0.09);
      const at = side("left");
      const x = at === "left" ? -W2 - P - R : at === "right" ? W2 + P + R : 0;
      const y = at === "top" ? -H2 - P - R : at === "bottom" ? H2 + P + R : 0;
      const k = backOut(stage(p, 0, 1));
      const t = `translate(${f(cx + x)} ${f(cy + y)}) scale(${f(k)})`;
      if (o.variant === 2) {
        const n = Math.max(4, Math.min(24, o.count));
        for (let i = 0; i < n; i++) {
          const t0 = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.06,
            t1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2 - 0.06;
          parts.push(
            ink(
              arc(0, 0, R, t0, t1),
              {
                stroke: (i + 0.5) / n <= prog ? o.color : o.secondary,
                width: lw * 1.4,
                cap: "butt",
                transform: t,
              },
              i,
            ),
          );
        }
      } else {
        parts.push(
          ink(
            ellipse(0, 0, R),
            { stroke: o.secondary, width: lw, transform: t },
            0,
          ),
        );
        parts.push(
          ink(
            arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog),
            { width: lw, transform: t },
            1,
          ),
        );
      }
      parts.push(
        text(readout, x, y + size * 0.36, size, {
          opacity: a * stage(p, 0.4, 1),
        }),
      );
      return parts;
    },
  },
  bearing: {
    name: "Bearing tape",
    feel: "Interface",
    description:
      "A cockpit tape scrolls past a fixed caret: a compass heading, an altitude ladder or a timecode strip.",
    defaults: {
      color: HUD,
      seconds: 0.5,
      timing: "in",
      speed: 12,
      angle: 40,
      count: 9,
    },
    controls: {
      ...drawn,
      angle: "Start heading (degrees)",
      speed: "Turn (degrees/s)",
      count: "Visible marks",
      pad: "Gap",
      size: "Size",
      variant: "Tape",
    },
    variants: ["Compass", "Altitude ladder", "Timecode strip"],
    draw: ({ o, a, p, W2, H2, P, S, thin, ink, text, time }) => {
      const vertical = o.variant === 1;
      const n = Math.max(3, Math.min(15, o.count));
      const span = vertical ? H2 + P : W2 + P * 0.5;
      const step = (span * 2) / n;
      const size = S(0.13, 0.02);
      const value =
        o.variant === 2
          ? time
          : (((o.angle + time * o.speed) % 360) + 360) % 360;
      const unit = o.variant === 2 ? 1 : vertical ? 10 : 15;
      const first = Math.floor(value / unit) - Math.ceil(n / 2) - 1;
      const pos = vertical ? -W2 - P * 0.7 : -H2 - P * 0.7;
      const parts: OverlayPart[] = [];
      const reach = smooth(p);
      for (let i = 0; i <= n + 2; i++) {
        const v = (first + i) * unit;
        const off = ((v - value) / unit) * step;
        if (Math.abs(off) > span * reach) continue;
        const fade = 1 - Math.pow(Math.abs(off) / span, 2);
        const major = vertical ? 0.16 : 0.18;
        const tick = S(major, 0.03);
        const d = vertical
          ? line([
              [pos, off],
              [pos - tick, off],
            ])
          : line([
              [off, pos],
              [off, pos - tick],
            ]);
        parts.push(ink(d, { width: thin, cap: "butt", opacity: a * fade }, i));
        const half = off + step / 2;
        if (Math.abs(half) < span * reach)
          parts.push(
            ink(
              vertical
                ? line([
                    [pos, half],
                    [pos - tick * 0.5, half],
                  ])
                : line([
                    [half, pos],
                    [half, pos - tick * 0.5],
                  ]),
              { width: thin, cap: "butt", opacity: a * fade * 0.7 },
              i + 40,
            ),
          );
        const name =
          o.variant === 2
            ? timecode(Math.max(0, v)).slice(0, 5)
            : vertical
              ? String(v)
              : ((
                  { 0: "N", 90: "E", 180: "S", 270: "W" } as Record<
                    number,
                    string
                  >
                )[((v % 360) + 360) % 360] ??
                String(((v % 360) + 360) % 360).padStart(3, "0"));
        parts.push(
          vertical
            ? text(
                name,
                pos - tick - size * 0.4,
                off + size * 0.35,
                size,
                { align: "end", opacity: a * fade },
                i,
              )
            : text(
                name,
                off,
                pos - tick - size * 0.5,
                size,
                { opacity: a * fade },
                i,
              ),
        );
      }
      const c = S(0.08, 0.016);
      parts.push(
        ink(
          vertical
            ? line([
                [pos + c * 1.6, -c],
                [pos + c * 0.2, 0],
                [pos + c * 1.6, c],
              ])
            : line([
                [-c, pos + c * 1.6],
                [0, pos + c * 0.2],
                [c, pos + c * 1.6],
              ]),
          { width: thin * 1.5, opacity: a * reach },
          99,
        ),
      );
      return parts;
    },
  },
};
