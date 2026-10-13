import { drawn, ellipse, f, line, type KindSpec } from "../overlay-kit";
import type { OverlayKind, OverlayPart, OverlayTarget } from "../overlays";

/** The letters an effect plays with: the element's own text, or the label. */
function letters(target: OverlayTarget, label?: string) {
  const source = label?.trim() || target.text || "KAMIKAMI";
  const chars = [...source.replace(/\s+/gu, "")];
  return chars.length ? chars : ["✦"];
}

export const atmosphereKinds: Partial<Record<OverlayKind, KindSpec>> = {
  glyphrain: {
    name: "Letter rain",
    feel: "Atmosphere",
    description:
      "The element's own letters fall in columns behind it, bright at the head and fading behind.",
    defaults: {
      color: "#7cf7d4",
      strength: 0.7,
      count: 10,
      speed: 1,
      timing: "constant",
      pad: 1.5,
      seconds: 0.6,
    },
    controls: {
      ...drawn,
      label: "Letters (empty uses the text)",
      count: "Columns",
      speed: "Fall speed",
      pad: "Spread",
      size: "Letter size",
      font: "Typeface",
      variant: "Fall",
    },
    variants: ["Columns", "Drift", "Single trail"],
    text: true,
    draw: ({ o, a, p, W2, H2, P, S, fixed, text, time, target }) => {
      const chars = letters(target, o.label);
      const n = o.variant === 2 ? 1 : Math.max(2, Math.min(24, o.count));
      const size = S(0.26, 0.04);
      const lead = size * 1.15;
      const x0 = -W2 - P,
        span = (W2 + P) * 2;
      const top = -H2 - P,
        height = (H2 + P) * 2;
      const trail = o.variant === 2 ? 14 : 7;
      const parts: OverlayPart[] = [];
      for (let i = 0; i < n; i++) {
        const x =
          n === 1
            ? 0
            : x0 + (span * (i + 0.5)) / n + (fixed(i) - 0.5) * (span / n) * 0.6;
        const rate = (0.6 + fixed(i + 40) * 0.8) * o.speed;
        const head =
          ((time * rate * 2 + fixed(i + 80) * 3) % (n === 1 ? 1 : 1.25)) *
            (height + trail * lead) +
          top;
        for (let k = 0; k < trail; k++) {
          const y = head - k * lead;
          if (y < top - lead || y > top + height + lead) continue;
          const drift =
            o.variant === 1
              ? Math.sin(time * 1.5 + i + k * 0.3) * size * 0.6
              : 0;
          const ci =
            Math.floor(
              fixed(i * 31 + k) * chars.length + time * (k === 0 ? 8 : 0),
            ) % chars.length;
          parts.push(
            text(
              chars[ci],
              x + drift,
              y,
              size,
              {
                behind: true,
                mono: o.font === "auto",
                font: o.font === "auto" ? undefined : o.font,
                bold: k === 0,
                fill: k === 0 ? "#ffffff" : o.color,
                opacity: a * p * Math.pow(1 - k / trail, 1.4),
              },
              i * 40 + k,
            ),
          );
        }
      }
      return parts;
    },
  },
  letterburst: {
    name: "Letter burst",
    feel: "Atmosphere",
    description:
      "On every beat the element's letters fly out from it and fade, like confetti made of its words.",
    defaults: {
      color: "#ffd23f",
      count: 8,
      tempo: 100,
      timing: "constant",
      size: 1,
      seconds: 0.5,
    },
    controls: {
      ...drawn,
      label: "Letters (empty uses the text)",
      count: "Letters per beat",
      tempo: "Tempo (BPM)",
      size: "Reach",
      font: "Typeface",
      variant: "Burst",
    },
    variants: ["Radial", "Fountain", "Sideways"],
    text: true,
    draw: ({ o, a, p, W2, H2, S, fixed, text, time, target, cx, cy }) => {
      const chars = letters(target, o.label);
      const beat = 60 / o.tempo;
      const index = Math.floor(time / beat);
      const age = (time - index * beat) / beat;
      const n = Math.max(1, Math.min(24, o.count));
      const reach = S(1.4, 0.35);
      const size = S(0.3, 0.05);
      const parts: OverlayPart[] = [];
      for (let i = 0; i < n; i++) {
        const seed = index * 97 + i;
        const t =
          o.variant === 1
            ? -Math.PI / 2 + (fixed(seed) - 0.5) * 1.6
            : o.variant === 2
              ? (i % 2 ? 0 : Math.PI) + (fixed(seed) - 0.5) * 0.8
              : (i / n) * Math.PI * 2 + fixed(seed) * 0.6;
        const go = 1 - Math.pow(1 - age, 2.5);
        const fall = o.variant === 1 ? age * age * reach * 1.4 : 0;
        const x = Math.cos(t) * (W2 * 0.6 + reach * go),
          y = Math.sin(t) * (H2 * 0.6 + reach * go * 0.8) + fall;
        const rot = (fixed(seed + 5) - 0.5) * 120 * go;
        parts.push(
          text(
            chars[(index * n + i) % chars.length],
            0,
            0,
            size * (0.7 + fixed(seed + 9) * 0.6),
            {
              x: 0,
              y: 0,
              transform: `translate(${f(cx + x)} ${f(cy + y)}) rotate(${f(rot)})`,
              mono: o.font === "auto",
              font: o.font === "auto" ? undefined : o.font,
              bold: true,
              behind: true,
              opacity: a * p * (1 - age),
            },
            i,
          ),
        );
      }
      return parts;
    },
  },
  fireflies: {
    name: "Fireflies",
    feel: "Atmosphere",
    description:
      "Glowing specks drift around the element: fireflies, dust in a light beam, rising bubbles or snow.",
    defaults: {
      color: "#ffe99a",
      count: 14,
      speed: 0.4,
      timing: "constant",
      pad: 2,
      seconds: 0.8,
    },
    controls: {
      ...drawn,
      count: "Specks",
      speed: "Drift speed",
      pad: "Spread",
      size: "Size",
      variant: "Specks",
    },
    variants: ["Fireflies", "Dust motes", "Bubbles", "Snow"],
    text: true,
    draw: ({ o, a, p, W2, H2, P, S, fixed, time, solid, ink, thin }) => {
      const n = Math.max(1, Math.min(24, o.count));
      const ex = W2 + P,
        ey = H2 + P;
      const parts: OverlayPart[] = [];
      for (let i = 0; i < n; i++) {
        const sp = o.speed * (0.6 + fixed(i + 10) * 0.8);
        let x: number, y: number;
        if (o.variant === 2 || o.variant === 3) {
          // Bubbles rise, snow falls, both swaying.
          const life = (time * sp * 0.25 + fixed(i)) % 1;
          const dir = o.variant === 2 ? -1 : 1;
          y = dir * (-ey + life * ey * 2);
          x =
            (fixed(i + 20) - 0.5) * ex * 2 +
            Math.sin(time * sp * 2 + i) * S(0.15, 0.03);
        } else {
          // A smooth wander from summed sines.
          x =
            (fixed(i + 20) - 0.5) * ex * 2 +
            Math.sin(time * sp + i * 1.7) * ex * 0.25 +
            Math.sin(time * sp * 0.37 + i) * ex * 0.1;
          y =
            (fixed(i + 30) - 0.5) * ey * 2 +
            Math.cos(time * sp * 0.8 + i * 2.3) * ey * 0.25;
        }
        const edge = Math.max(Math.abs(x) / ex, Math.abs(y) / ey);
        const fade = Math.max(0, 1 - Math.pow(edge, 4));
        const twinkle =
          o.variant === 0
            ? 0.35 +
              0.65 * Math.pow(Math.abs(Math.sin(time * sp * 3 + i * 2.1)), 2)
            : 1;
        const r =
          S(0.07, 0.014) *
          (0.6 + fixed(i + 40) * 0.8) *
          (o.variant === 2 ? 2.2 : o.variant === 3 ? 1.4 : 1);
        const op = a * p * fade * twinkle * (o.variant === 1 ? 0.55 : 1);
        if (o.variant === 2)
          parts.push(
            ink(ellipse(x, y, r), { width: thin * 1.2, opacity: op }, i),
          );
        else if (o.variant === 3)
          parts.push(
            ink(
              [0, 60, 120]
                .map((deg) => {
                  const t = (deg * Math.PI) / 180 + time * sp;
                  return line([
                    [x - Math.cos(t) * r, y - Math.sin(t) * r],
                    [x + Math.cos(t) * r, y + Math.sin(t) * r],
                  ]);
                })
                .join(""),
              { width: thin, opacity: op },
              i,
            ),
          );
        else
          parts.push(
            solid(
              ellipse(x, y, r),
              {
                opacity: op,
                glow: o.variant === 0 ? r * 2.5 : undefined,
                blend: o.variant === 0 ? "screen" : undefined,
              },
              i,
            ),
          );
      }
      return parts;
    },
  },
};
