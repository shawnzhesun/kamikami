import type React from "react";
import type { TextEffect } from "./text-effects";
import { mix, seeded, unit } from "./motion";

/**
 * Text looks (kamikami-visual-v8): treatments that change how type is painted
 * and decorations drawn around its words and block. Lyric-video art direction
 * leans on these: keylines, stacked shadows, colored ghosts, plates, rules
 * and texture bands. Framing marks such as brackets and labels are overlays.
 * Every value is a pure function of time.
 */
export const lookKinds = [
  // Paint treatments
  "outlined",
  "keyline",
  "doubleline",
  "extrude",
  "longshadow",
  "offset",
  "neontube",
  "chrome",
  "sticker",
  "stack",
  "halftone",
  "accent",
  // Whole-text copies
  "ghost",
  "reflection",
  "cutshift",
  // Decorations
  "wordbox",
  "plate",
  "rules",
  "ticker",
  "tape",
  "burst",
] as const;
export type LookKind = (typeof lookKinds)[number];
export const isLookKind = (kind: string): kind is LookKind =>
  (lookKinds as readonly string[]).includes(kind);
/** Looks rendered as extra copies of the whole text. */
export const copyLooks: readonly LookKind[] = [
  "ghost",
  "reflection",
  "cutshift",
];

export const lookNames: Record<LookKind, string> = {
  outlined: "Outline only",
  keyline: "Keyline",
  doubleline: "Double outline",
  extrude: "Extrude",
  longshadow: "Long shadow",
  offset: "Offset shadow",
  neontube: "Neon tube",
  chrome: "Chrome",
  sticker: "Sticker",
  stack: "Shadow stack",
  halftone: "Halftone fill",
  accent: "Accent word",
  ghost: "Color ghosts",
  reflection: "Reflection",
  cutshift: "Cut and shift",
  wordbox: "Word boxes",
  plate: "Word plates",
  rules: "Rules",
  ticker: "Text ticker",
  tape: "Caution tape",
  burst: "Ray burst",
};
export const lookControls: Record<
  LookKind,
  {
    distance?: string;
    color?: string;
    secondary?: string;
    speed?: string;
    angle?: boolean;
    reveal?: boolean;
    note?: string;
  }
> = {
  outlined: { distance: "Stroke width" },
  keyline: { distance: "Keyline width", color: "Keyline color" },
  doubleline: {
    distance: "Outline width",
    color: "Outer color",
    secondary: "Gap color",
  },
  extrude: { distance: "Depth", color: "Side color", angle: true },
  longshadow: {
    distance: "Length",
    color: "Shadow color",
    secondary: "Fade to",
    angle: true,
  },
  offset: { distance: "Offset", color: "Shadow color", angle: true },
  neontube: { distance: "Glow", color: "Tube color", speed: "Flicker" },
  chrome: {
    color: "Horizon tint",
    note: "A mirrored metal fill with a dark keyline.",
  },
  sticker: { distance: "Border", color: "Border color", secondary: "Shadow" },
  stack: {
    distance: "Spacing",
    color: "First copy",
    secondary: "Second copy",
    note: "Three hard copies step down-right in alternating colors.",
  },
  halftone: { distance: "Dot size", secondary: "Paper color" },
  accent: {
    color: "Accent color",
    note: "Word: the longest word takes the accent. Character: each line's first letter grows and takes it.",
  },
  ghost: {
    distance: "Offset",
    color: "Ghost A",
    secondary: "Ghost B",
    note: "Two flat-colored copies trail behind any motion on the text, like misregistered print.",
  },
  reflection: {
    distance: "Gap",
    note: "A fading mirrored copy below the text.",
  },
  cutshift: {
    distance: "Shift",
    color: "Cut line color",
    reveal: true,
    note: "Each line is sliced; the lower half slides sideways.",
  },
  wordbox: { color: "Box color", reveal: true },
  plate: {
    color: "Plate color",
    secondary: "Knocked-out text",
    reveal: true,
    note: "Every word sits on a solid plate; its letters take the knockout color.",
  },
  rules: { color: "Rule color", reveal: true },
  ticker: {
    color: "Ticker color",
    speed: "Scroll speed",
    note: "Rows of the text repeated small, scrolling behind it.",
  },
  tape: { color: "Stripe color", secondary: "Tape color", reveal: true },
  burst: { color: "Ray color", speed: "Turn speed" },
};

const hex = (c: string, alpha: number) =>
  c +
  Math.round(unit(alpha) * 255)
    .toString(16)
    .padStart(2, "0");
const outBack = (u: number, k = 1.7) => {
  const v = unit(u) - 1;
  return 1 + (k + 1) * v * v * v + k * v * v;
};
const outCubic = (u: number) => 1 - (1 - unit(u)) ** 3;
const radians = (a: number) => (a * Math.PI) / 180;
const step = (angle: number) => [
  Math.cos(radians(angle)),
  Math.sin(radians(angle)),
];

/** Reveal progress for decorations that draw in at the clip start. */
export function lookReveal(
  effect: TextEffect,
  time: number,
  index = 0,
  count = 1,
) {
  const seconds = Math.max(0.05, effect.seconds);
  const delay = count > 1 ? (index / (count - 1)) * effect.stagger : 0;
  return unit((time / seconds - delay) / Math.max(0.05, 1 - effect.stagger));
}

/**
 * Paint for every glyph leaf. Text shadows from several looks are combined,
 * the last stroke wins. `color` is the text's current color.
 */
export function lookPaint(
  looks: { effect: TextEffect; amount: number }[],
  color: string,
  time: number,
) {
  const paint: React.CSSProperties = {};
  const shadows: string[] = [];
  for (const { effect, amount: a } of looks) {
    const d = 0.4 + effect.distance;
    const angle = effect.angle ?? 45;
    const [sx, sy] = step(angle);
    switch (effect.kind as LookKind) {
      case "outlined":
        paint.WebkitTextStroke = `${(0.012 + 0.02 * d) * a}em ${color}`;
        paint.color = hex(color, 1 - a);
        break;
      case "keyline":
        paint.WebkitTextStroke = `${(0.05 + 0.08 * d) * a}em ${effect.color}`;
        paint.paintOrder = "stroke fill";
        break;
      case "doubleline": {
        const gap = (0.05 + 0.06 * d) * a;
        paint.WebkitTextStroke = `${gap}em ${effect.secondary}`;
        paint.paintOrder = "stroke fill";
        // A ring of hard shadows forms the outer outline.
        const r = gap / 2 + 0.035 * d * a;
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * Math.PI * 2;
          shadows.push(
            `${(Math.cos(t) * r).toFixed(4)}em ${(Math.sin(t) * r).toFixed(4)}em 0 ${effect.color}`,
          );
        }
        break;
      }
      case "extrude": {
        const steps = 14;
        const depth = 0.16 * d * a;
        for (let k = 1; k <= steps; k++)
          shadows.push(
            `${((sx * depth * k) / steps).toFixed(4)}em ${((sy * depth * k) / steps).toFixed(4)}em 0 ${effect.color}`,
          );
        break;
      }
      case "longshadow": {
        const steps = 24;
        const length = 0.55 * d * a;
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          shadows.push(
            `${(sx * length * f).toFixed(4)}em ${(sy * length * f).toFixed(4)}em 0 ${hex(mixHex(effect.color, effect.secondary, f), 1 - 0.85 * f)}`,
          );
        }
        break;
      }
      case "offset":
        shadows.push(
          `${(sx * 0.08 * d * a).toFixed(4)}em ${(sy * 0.08 * d * a).toFixed(4)}em 0 ${effect.color}`,
        );
        break;
      case "neontube": {
        const tube = mixHex(effect.color, "#ffffff", 0.45);
        paint.color = hex(tube, 1 - a);
        paint.WebkitTextStroke = `${0.028 * a}em ${tube}`;
        const glow = (0.05 + 0.1 * d) * a * (1 + 0.08 * Math.sin(time * 3.2));
        shadows.push(
          `0 0 ${glow}em ${effect.color}`,
          `0 0 ${glow * 2.2}em ${effect.color}`,
          `0 0 ${glow * 4}em ${hex(effect.color, 0.55)}`,
        );
        break;
      }
      case "chrome": {
        if (a <= 0) break;
        // Bright sky, a hard dark horizon, then a warm ground fading down.
        const sky = mixHex("#e8f4ff", effect.color, 0.25),
          horizon = mixHex("#1d2a44", effect.color, 0.2),
          ground = mixHex("#fff1dc", effect.color, 0.35);
        paint.backgroundImage = `linear-gradient(180deg, #ffffff 0%, ${sky} 30%, ${mixHex(sky, horizon, 0.55)} 49%, ${horizon} 50%, #0b0f18 54%, ${ground} 56%, ${mixHex(ground, "#8a6a4a", 0.7)} 100%)`;
        paint.backgroundClip = "text";
        paint.WebkitBackgroundClip = "text";
        paint.color = "transparent";
        paint.WebkitTextStroke = `${0.018 * a}em #0b0f18`;
        break;
      }
      case "sticker":
        paint.WebkitTextStroke = `${(0.1 + 0.08 * d) * a}em ${effect.color}`;
        paint.paintOrder = "stroke fill";
        paint.filter = `drop-shadow(0.03em 0.05em 0.02em ${hex(effect.secondary, 0.6 * a)})`;
        break;
      case "stack": {
        const gap = 0.045 * d * a;
        const colors = [
          effect.color,
          effect.secondary,
          mixHex(effect.color, effect.secondary, 0.5),
        ];
        colors.forEach((c, k) => {
          const o = gap * (k + 1);
          // A thin background-colored rim separates each copy from the next.
          shadows.push(`${o.toFixed(4)}em ${o.toFixed(4)}em 0 ${c}`);
        });
        break;
      }
      case "halftone": {
        if (a <= 0) break;
        const cell = (0.05 + 0.04 * d).toFixed(4);
        paint.backgroundImage = `radial-gradient(circle, ${color} ${Math.round(38 + 22 * (1 - a))}%, transparent ${Math.round(44 + 26 * (1 - a))}%)`;
        paint.backgroundSize = `${cell}em ${cell}em`;
        paint.backgroundClip = "text";
        paint.WebkitBackgroundClip = "text";
        paint.color = hex(color, 0.18 * (1 - a));
        break;
      }
    }
  }
  if (shadows.length) paint.textShadow = shadows.join(", ");
  return paint;
}

/** Per-glyph adjustments: neon flicker and the accent word. */
export function lookGlyph(
  looks: { effect: TextEffect; amount: number }[],
  time: number,
  glyph: { index: number; word: number; inLine: number },
  keyWord: number,
) {
  let opacity = 1,
    scale = 1;
  let color: string | null = null;
  for (const { effect, amount: a } of looks) {
    if (effect.kind === "neontube" && effect.speed > 0) {
      const tick = Math.floor(time * 24 * Math.min(4, effect.speed));
      const r = seeded(effect.seed + tick * 131, glyph.index);
      if (r < 0.012) opacity *= 1 - 0.78 * a;
      else if (r < 0.022) opacity *= 1 - 0.4 * a;
    }
    if (effect.kind === "accent") {
      if (
        effect.unit === "character"
          ? glyph.inLine === 0
          : glyph.word === keyWord
      ) {
        color = a >= 0.5 ? effect.color : null;
        if (effect.unit === "character") scale *= 1 + 0.18 * a;
      }
    }
  }
  return { opacity, scale, color };
}

/** Index of the word that takes an accent: the longest, first on ties. */
export function keyWordIndex(words: string[]) {
  let best = -1,
    length = 0;
  words.forEach((w, i) => {
    const n = [...w].length;
    if (n > length) {
      best = i;
      length = n;
    }
  });
  return best;
}

/** Ghost copies: time lag (seconds), offset (em) and color for each copy. */
export function ghostCopies(effect: TextEffect, amount: number) {
  const d = 0.4 + effect.distance;
  return [
    {
      lag: 2 / 24,
      x: -0.05 * d * amount,
      y: -0.02 * d * amount,
      color: effect.secondary,
    },
    {
      lag: 1 / 24,
      x: 0.045 * d * amount,
      y: 0.028 * d * amount,
      color: effect.color,
    },
  ];
}

/** Clip bands for the top or bottom half of every line, as a polygon. */
export function lineHalves(lines: number, top: boolean, cut = 0.55) {
  const points: string[] = [];
  for (let i = 0; i < lines; i++) {
    const y0 = (i / lines) * 100,
      y1 = ((i + 1) / lines) * 100,
      yc = ((i + cut) / lines) * 100;
    const [a, b] = top ? [y0, yc] : [yc, y1];
    points.push(
      `-50% ${a}%`,
      `150% ${a}%`,
      `150% ${b}%`,
      `-50% ${b}%`,
      `-50% ${a}%`,
    );
  }
  return `polygon(${points.join(",")})`;
}

export type LookDecor = {
  key: string;
  /** Behind the text (true) or over it. */
  behind: boolean;
  style: React.CSSProperties;
  text?: string;
};

/** Decorations around the whole text block, positioned in the run's box. */
export function blockDecor(
  looks: { effect: TextEffect; amount: number }[],
  time: number,
  context: { text: string; lines: number; start: number; mono: string },
): LookDecor[] {
  const out: LookDecor[] = [];
  looks.forEach(({ effect, amount: a }, n) => {
    const p = lookReveal(effect, time);
    const key = `${effect.kind}-${n}`;
    switch (effect.kind as LookKind) {
      case "rules": {
        const e = outCubic(p),
          e2 = outCubic(lookReveal(effect, time - effect.seconds * 0.2));
        out.push(
          {
            key: key + "a",
            behind: false,
            style: {
              position: "absolute",
              left: "-0.1em",
              right: "-0.1em",
              top: "-0.16em",
              height: "0.05em",
              background: effect.color,
              transform: `scaleX(${e})`,
              transformOrigin: "left",
              opacity: a,
            },
          },
          {
            key: key + "b",
            behind: false,
            style: {
              position: "absolute",
              left: "-0.1em",
              right: "-0.1em",
              bottom: "-0.12em",
              height: "0.018em",
              background: effect.color,
              transform: `scaleX(${e2})`,
              transformOrigin: "right",
              opacity: a,
            },
          },
        );
        break;
      }
      case "ticker": {
        const rows = 4;
        const speed = 0.6 * Math.max(0.05, effect.speed);
        const phrase = context.text.replace(/\s+/g, " ").trim() + "   /   ";
        const run = phrase.repeat(
          Math.max(4, Math.ceil(80 / Math.max(1, phrase.length))),
        );
        for (let r = 0; r < rows; r++) {
          const dir = r % 2 ? 1 : -1;
          const y =
            r < rows / 2
              ? -0.42 - (rows / 2 - 1 - r) * 0.3
              : 0.25 + (r - rows / 2) * 0.3;
          const shift = (((time * speed * dir) % 6) + 6) % 6;
          out.push({
            key: `${key}-${r}`,
            behind: true,
            text: run,
            style: {
              position: "absolute",
              left: "50%",
              top: r < rows / 2 ? `${y}em` : `calc(100% + ${y}em)`,
              transform: `translateX(calc(-50% + ${(shift - 3) * (dir > 0 ? 1 : -1)}em))`,
              fontSize: "0.2em",
              whiteSpace: "pre",
              color: effect.color,
              opacity: 0.32 * a,
              textShadow: "none",
              letterSpacing: "0.05em",
              pointerEvents: "none",
              lineHeight: 1,
            },
          });
        }
        break;
      }
      case "tape": {
        const e = outBack(p, 1.2);
        out.push({
          key,
          behind: true,
          style: {
            position: "absolute",
            left: "-1.4em",
            right: "-1.4em",
            top: "50%",
            height: "0.42em",
            background: `repeating-linear-gradient(-45deg, ${effect.color} 0 0.16em, ${effect.secondary} 0.16em 0.32em)`,
            transform: `translateY(-30%) rotate(-7deg) scaleX(${e})`,
            transformOrigin: "left center",
            opacity: a,
            boxShadow: `0 0.04em 0.1em ${hex("#000000", 0.35)}`,
          },
        });
        break;
      }
      case "burst": {
        const turn = time * 8 * effect.speed;
        out.push({
          key,
          behind: true,
          style: {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "7em",
            height: "7em",
            transform: `translate(-50%,-50%) rotate(${turn}deg) scale(${outCubic(p)})`,
            background: `repeating-conic-gradient(${hex(effect.color, 0.85)} 0deg 2.2deg, transparent 2.2deg 11deg)`,
            WebkitMaskImage:
              "radial-gradient(circle, transparent 22%, #000 34%, #000 46%, transparent 70%)",
            maskImage:
              "radial-gradient(circle, transparent 22%, #000 34%, #000 46%, transparent 70%)",
            opacity: a,
            pointerEvents: "none",
          },
        });
        break;
      }
    }
  });
  return out;
}

/** Decorations around one word: boxes and plates. */
export function wordDecor(
  looks: { effect: TextEffect; amount: number }[],
  time: number,
  word: number,
  count: number,
): { decor: LookDecor[]; color: string | null } {
  const decor: LookDecor[] = [];
  let color: string | null = null;
  looks.forEach(({ effect, amount: a }, n) => {
    const p = lookReveal(effect, time, word, count);
    const key = `${effect.kind}-${n}`;
    if (effect.kind === "wordbox") {
      const s = outBack(p, 1.8);
      decor.push({
        key,
        behind: false,
        style: {
          position: "absolute",
          left: "-0.07em",
          right: "-0.07em",
          top: "0.02em",
          bottom: "-0.04em",
          border: `0.035em solid ${effect.color}`,
          transform: `scale(${mix(0.6, 1, s)})`,
          opacity: a * unit(p * 4),
        },
      });
    }
    if (effect.kind === "plate") {
      const tilt = (word % 2 ? 1 : -1) * 2.2;
      decor.push({
        key,
        behind: true,
        style: {
          position: "absolute",
          left: "-0.1em",
          right: "-0.1em",
          top: "0.04em",
          bottom: "-0.06em",
          background: effect.color,
          transform: `rotate(${tilt}deg) scaleX(${outCubic(p)})`,
          transformOrigin: "left center",
          opacity: a,
        },
      });
      if (p > 0.35 && a >= 0.5) color = effect.secondary;
    }
  });
  return { decor, color };
}

export function mixHex(a: string, b: string, t: number) {
  const ch = (c: string, i: number) =>
    parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(mix(ch(a, i), ch(b, i), unit(t)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
