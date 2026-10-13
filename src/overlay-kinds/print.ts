import {
  clamp01,
  curve,
  drawn,
  ellipse,
  f,
  hand,
  rect,
  regMark,
  smooth,
  stage,
  type KindSpec,
  type P,
} from "../overlay-kit";
import type { OverlayKind, OverlayPart } from "../overlays";

export const printKinds: Partial<Record<OverlayKind, KindSpec>> = {
  registration: {
    name: "Registration marks",
    feel: "Print",
    description:
      "Three ink plates slide from misregistration into one sharp mark.",
    defaults: { color: "#141414", seconds: 0.7, timing: "in" },
    controls: { ...drawn, color: "Final mark", pad: "Gap", size: "Size" },
    draw: ({ o, a, p, W2, H2, P, S, m, r, key, cx, cy }) => {
      const tr = S(0.14, 0.03);
      const thin = o.weight * Math.max(0.02, 0.0024 * m);
      const gap = P * 0.6 + tr * 1.6;
      const settle = 1 - smooth(p);
      const plates = ["#00a8e8", "#ec008c", "#ffd400"];
      const parts: OverlayPart[] = [];
      const spots: P[] = [
        [-(W2 + gap), 0],
        [W2 + gap, 0],
        [0, -(H2 + gap)],
        [0, H2 + gap],
      ];
      spots.forEach(([x, y], si) => {
        plates.forEach((c, pi) => {
          const t = (pi / 3) * Math.PI * 2 + r(si) * 6;
          const off = tr * 1.6 * settle;
          parts.push({
            ...regMark(
              x + Math.cos(t) * off,
              y + Math.sin(t) * off,
              tr,
              thin,
              c,
              a * 0.9 * clamp01(p * 3),
              `${key}-${si}-${pi}`,
              cx,
              cy,
            ),
            blend: "multiply",
          });
        });
        if (p >= 1)
          parts.push(
            regMark(x, y, tr, thin, o.color, a, `${key}-${si}-k`, cx, cy),
          );
      });
      return parts;
    },
  },
  colorbars: {
    name: "Color bars",
    feel: "Print",
    description: "A printer's color control strip.",
    defaults: { count: 8, seconds: 0.6, timing: "in" },
    controls: {
      timing: "Draw",
      seconds: "Draw-on (seconds)",
      strength: "Opacity",
      placement: "Side",
      count: "Patches",
      pad: "Gap",
      size: "Size",
      variant: "Strip",
    },
    variants: ["Process + greys", "Grey ramp", "Broadcast"],
    fills: true,
    draw: ({ o, a, p, W2, H2, P, S, solid, side, cx, cy }) => {
      const below = side("bottom") !== "top";
      const n = Math.max(2, Math.min(16, o.count));
      const s = S(0.2, 0.035);
      const palettes = [
        [
          "#00a8e8",
          "#ec008c",
          "#ffd400",
          "#141414",
          "#e8392f",
          "#2fb24a",
          "#2a5bd7",
          "#f6f2ea",
        ],
        [],
        [
          "#c0c0c0",
          "#c0c000",
          "#00c0c0",
          "#00c000",
          "#c000c0",
          "#c00000",
          "#0000c0",
          "#141414",
        ],
      ];
      const palette = palettes[o.variant] ?? palettes[0];
      const greys = (i: number, k: number) => {
        const v = Math.round(255 * (i / Math.max(1, k - 1)));
        return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      };
      const y = below ? H2 + P * 0.6 : -H2 - P * 0.6 - s;
      return Array.from({ length: n }, (_, i) => {
        const x = -W2 + i * s * 1.05;
        const q = stage(p, (i / n) * 0.7, (i / n) * 0.7 + 0.3);
        return solid(
          rect(x, y, x + s, y + s),
          {
            fill:
              i < palette.length
                ? palette[i]
                : greys(i - palette.length, n - palette.length),
            opacity: a * q,
            transform: `translate(${f(cx)} ${f(cy + (1 - q) * s * 0.5 * (below ? 1 : -1))})`,
          },
          i,
        );
      });
    },
  },
  stamp: {
    name: "Rubber stamp",
    feel: "Print",
    description: "A rubber stamp slams onto the corner.",
    defaults: {
      angle: -12,
      wobble: 0.3,
      seconds: 0.22,
      timing: "in",
      strength: 0.9,
    },
    controls: {
      ...hand,
      label: "Stamp text",
      angle: "Angle (degrees)",
      size: "Size",
      seconds: "Slam (seconds)",
      variant: "Shape",
    },
    variants: ["Box", "Round seal", "Dated"],
    text: true,
    draw: ({ o, a, p, W2, H2, S, jitter, ink, cx, cy, key, target }) => {
      const s = (o.label?.trim() || "APPROVED").toUpperCase();
      const size = S(0.24, 0.05);
      const round = o.variant === 1;
      const tw = round ? size * 4.2 : [...s].length * size * 0.66 + size * 0.9;
      const th = round ? tw : size * (o.variant === 2 ? 2.6 : 1.7);
      // Stamped on the top-right corner, slammed down from above.
      const slam = 1 + (1 - smooth(p)) * 0.8;
      const t = `translate(${f(cx + W2 - tw * 0.25)} ${f(cy - H2 + th * 0.1)}) rotate(${f(o.angle)}) scale(${f(slam)})`;
      const edge = (inset: number) =>
        round
          ? ellipse(0, 0, tw / 2 - inset)
          : curve(
              jitter(
                [
                  [-tw / 2 + inset, -th / 2 + inset],
                  [tw / 2 - inset, -th / 2 + inset],
                  [tw / 2 - inset, th / 2 - inset],
                  [-tw / 2 + inset, th / 2 - inset],
                  [-tw / 2 + inset, -th / 2 + inset],
                ],
                size * 0.1,
                inset * 100,
              ),
            );
      const op = a * clamp01(p * 2.5);
      const label = (
        text: string,
        y: number,
        sz: number,
        n: number,
      ): OverlayPart => ({
        key: `${key}-text${n}`,
        behind: false,
        opacity: op,
        text,
        x: 0,
        y,
        size: sz,
        align: "middle",
        bold: true,
        mono: true,
        fill: o.color,
        transform: t,
      });
      const parts = [
        ink(
          edge(0),
          {
            transform: t,
            width: size * 0.09,
            opacity: op,
            cap: "square",
            closed: true,
          },
          0,
        ),
        ink(
          edge(size * 0.16),
          { transform: t, width: size * 0.035, opacity: op, cap: "square" },
          1,
        ),
      ];
      if (round) {
        const short = [...s].slice(0, 9).join("");
        parts.push(
          label(
            short,
            size * 0.3,
            size * Math.min(1, 7 / Math.max(4, short.length)),
            0,
          ),
        );
        parts.push(label("★ ★ ★", size * 1.25, size * 0.45, 1));
        parts.push(label("★ ★ ★", -size * 0.9, size * 0.45, 2));
      } else if (o.variant === 2) {
        parts.push(label(s, -size * 0.15, size, 0));
        const mins = Math.floor(target.start);
        parts.push(
          label(
            `DAY ${String(1 + (o.seed % 28)).padStart(2, "0")} · ${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
            size * 0.85,
            size * 0.45,
            1,
          ),
        );
      } else parts.push(label(s, size * 0.36, size, 0));
      return parts;
    },
  },
};
