import type { TextEffect } from "./text-effects";
import { bounceOut, seeded, unit } from "./motion";

/**
 * Title animations modeled on modern motion-design title packs (Apple-keynote
 * kinetic type, minimal line/box reveals, stretch/split/repeat "hype" titles).
 * Each returns per-grapheme values; AnimatedText applies them alongside the
 * original text effects. Everything is a pure function of time and seed.
 */
export const titleKinds = [
  "mask",
  "focus",
  "stretch",
  "swipe",
  "slot",
  "bounce",
  "turn",
  "highlight",
  "underline",
  "outline",
  "echo",
  "split",
  "draw",
  "flicker",
  "count",
  "circle",
  "blurrise",
  "karaoke",
  "shimmer",
  "prism",
  "bubbles",
  "flap",
  "roll",
  "odometer",
  "retype",
  "rotate",
  "typeloop",
  "morph",
] as const;
/** Kinds that replace the whole text over time, using each text line as one step. */
export const sequenceKinds = ["retype", "rotate", "typeloop", "morph"] as const;
export type SequenceKind = (typeof sequenceKinds)[number];
export const isSequenceKind = (kind: string): kind is SequenceKind =>
  (sequenceKinds as readonly string[]).includes(kind);
export type TitleKind = (typeof titleKinds)[number];
export const isTitleKind = (kind: string): kind is TitleKind =>
  (titleKinds as readonly string[]).includes(kind);
export const titleNames: Record<TitleKind, string> = {
  mask: "Mask reveal",
  focus: "Focus in",
  stretch: "Stretch in",
  swipe: "Swipe in",
  slot: "Slot roll",
  bounce: "Bouncy letters",
  turn: "Turn in",
  highlight: "Highlight",
  underline: "Underline reveal",
  outline: "Outline fill",
  echo: "Echo stack",
  split: "Split slice",
  draw: "Stroke draw",
  flicker: "Flicker on",
  count: "Number count",
  circle: "Circle text",
  blurrise: "Blur rise",
  karaoke: "Karaoke",
  shimmer: "Shimmer",
  prism: "Prism reveal",
  bubbles: "Letter bubbles",
  flap: "Split-flap board",
  roll: "Cube roll",
  odometer: "Odometer",
  retype: "Retype",
  rotate: "Word rotator",
  typeloop: "Type and delete",
  morph: "Gooey word morph",
};

/** Settings-dialog controls per title kind. */
export const titleControls: Record<
  TitleKind,
  {
    distance?: string;
    speed?: string;
    color?: string;
    secondary?: string;
    direction?: [string, string][];
    variant?: [string, string][];
    units?: boolean;
    entrance?: boolean;
    note?: string;
  }
> = {
  mask: {
    units: true,
    entrance: true,
    direction: [
      ["up", "Rise from below"],
      ["down", "Drop from above"],
      ["left", "Slide from left"],
      ["right", "Slide from right"],
    ],
    note: "Each unit slides out from behind an invisible baseline mask.",
  },
  focus: {
    units: true,
    entrance: true,
    variant: [
      ["soft", "Soft focus"],
      ["slam", "Zoom slam"],
    ],
  },
  stretch: { units: true, entrance: true, distance: "Stretch amount" },
  swipe: {
    units: true,
    entrance: true,
    distance: "Travel (em ÷ 4)",
    direction: [
      ["left", "From left"],
      ["right", "From right"],
    ],
  },
  slot: {
    units: true,
    entrance: true,
    note: "Digits roll through digits; letters through the alphabet.",
  },
  bounce: {
    units: true,
    entrance: true,
    distance: "Drop height",
    variant: [
      ["bounce", "Bounce drop"],
      ["elastic", "Elastic pop"],
    ],
  },
  turn: {
    units: true,
    entrance: true,
    direction: [
      ["left", "Turn from left"],
      ["right", "Turn from right"],
    ],
  },
  highlight: {
    entrance: true,
    color: "Box color",
    variant: [
      ["marker", "Marker swipe"],
      ["block", "Block wipe"],
    ],
    note: "The box sweeps across the whole title; stagger sets how sharp its front is.",
  },
  underline: { entrance: true, color: "Line color" },
  outline: {
    units: true,
    entrance: true,
    note: "Letters start as outlines in the text color and fill in.",
  },
  echo: { entrance: true, distance: "Stack spread", color: "Outline color" },
  split: { entrance: true, distance: "Split distance" },
  draw: {
    units: true,
    entrance: true,
    color: "Stroke color",
    note: "Outlines draw on like a pen, then the fill fades in.",
  },
  flicker: { units: true, entrance: true, speed: "Flicker rate" },
  count: {
    entrance: true,
    note: "Every number in the text counts up from zero, keeping its decimals and separators.",
  },
  circle: {
    distance: "Letter spacing",
    speed: "Rotation speed",
    note: "Lays the text around a circle, like a badge; use one line of text.",
  },
  blurrise: { units: true, entrance: true, distance: "Rise height" },
  karaoke: {
    units: true,
    entrance: true,
    color: "Sung color",
    note: "Duration is the reading time: words light up one after another across it. Unsung words stay faintly visible.",
  },
  shimmer: {
    speed: "Sweep speed",
    distance: "Band width",
    color: "Highlight color",
    secondary: "Base tone",
    note: "Runs throughout the clip. Base tone replaces the text color.",
  },
  prism: {
    units: true,
    entrance: true,
    note: "A rainbow front sweeps across; letters ahead of it are hidden.",
  },
  bubbles: {
    units: true,
    entrance: true,
    color: "Bubble color",
    secondary: "Bubble shade",
  },
  flap: {
    entrance: true,
    secondary: "Tile color",
    note: "Each letter flips through random characters on a tile, like a departure board.",
  },
  roll: {
    units: true,
    entrance: true,
    color: "First face color",
    note: "Letters roll like cubes from a colored face onto the final one.",
  },
  odometer: {
    entrance: true,
    note: "Every number rolls digit by digit up to its value; higher digits turn over on carries.",
  },
  retype: {
    entrance: true,
    note: "Write two lines: the first is overwritten letter by letter into the second.",
  },
  rotate: {
    entrance: true,
    note: "Each line of the text is one word or phrase; the clip is split evenly between them. Duration is the swap time.",
  },
  typeloop: {
    entrance: false,
    note: "Each line is typed, held and deleted in turn; the last line stays. The clip is split evenly between lines.",
  },
  morph: {
    entrance: true,
    note: "Each line melts into the next; the clip is split evenly between lines. Duration is the morph time.",
  },
};

export type TitleFrame = {
  opacity: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  rotateY: number;
  /** em */
  blur: number;
  /** Translation inside a clipping mask, em. */
  maskX: number;
  maskY: number;
  /** Remaining slot-roll travel, 0..1. */
  slot: number | null;
  box: {
    scale: number;
    origin: "left" | "right";
    /** Circles sit centered behind the glyph (letter bubbles). */
    shape?: "rect" | "circle";
  } | null;
  /** Recolor toward a color (karaoke, shimmer, prism). */
  tint: { color: string; amount: number } | null;
  /** Split-flap: flipping from `from` to `to`, phase 0..1. */
  flap: { from: string; to: string; phase: number } | null;
  /** Cube roll: 0 = first face showing, 1 = settled. */
  roll: number | null;
  line: number | null;
  /** 1 = outline only. */
  outline: number;
  echo: number;
  split: number;
  /** Stroke draw progress. */
  draw: number | null;
  /** Horizontal mask: reveal sweeping across the word from one side. */
  sweep: { progress: number; from: "left" | "right" } | null;
};
export const neutralTitleFrame = (): TitleFrame => ({
  opacity: 1,
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  rotateY: 0,
  blur: 0,
  maskX: 0,
  maskY: 0,
  slot: null,
  box: null,
  line: null,
  outline: 0,
  echo: 0,
  split: 0,
  draw: null,
  sweep: null,
  tint: null,
  flap: null,
  roll: null,
});

const fract = (n: number) => n - Math.floor(n);
export function mixHex(a: string, b: string, t: number) {
  const ch = (c: string, i: number) =>
    parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(
          ch(a, i) + (ch(b, i) - ch(a, i)) * Math.max(0, Math.min(1, t)),
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
const easeOut = (u: number, power = 3) => 1 - Math.pow(1 - unit(u), power);
const smooth = (u: number) => {
  const v = unit(u);
  return v * v * (3 - 2 * v);
};
const back = (u: number, k = 1.70158) => {
  const v = unit(u) - 1;
  return 1 + (k + 1) * v * v * v + k * v * v;
};
const elastic = (u: number) =>
  u >= 1 ? 1 : 1 - Math.pow(2, -9 * u) * Math.cos(2 * Math.PI * 2.2 * u);

/** Per-unit 0 → 1 settle progress and whether the effect runs as an exit. */
export function titleProgress(
  effect: TextEffect,
  time: number,
  index: number,
  count: number,
  duration: number,
) {
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const exit = effect.motion?.direction === "out";
  const p = exit
    ? unit((time - (duration - seconds)) / seconds)
    : unit(time / seconds);
  const order = effect.motion?.order;
  const position =
    order === "reverse"
      ? count - 1 - index
      : order === "random"
        ? seeded(effect.seed, index) * Math.max(0, count - 1)
        : index;
  const delay = count > 1 ? (position / (count - 1)) * effect.stagger : 0;
  const local = unit((p - delay) / Math.max(0.05, 1 - effect.stagger));
  // Exits play the entrance backwards from the settled state.
  return { settle: exit ? 1 - local : local, exit };
}

export function titleUnitFrame(
  effect: TextEffect,
  time: number,
  index: number,
  count: number,
  duration: number,
  amount = 1,
): TitleFrame {
  const f = neutralTitleFrame();
  const a = unit(amount);
  const { settle: s } = titleProgress(effect, time, index, count, duration);
  const kind = effect.kind as TitleKind;
  switch (kind) {
    case "mask": {
      const d = effect.direction ?? "up";
      if (d === "left" || d === "right") {
        // Horizontal masks reveal across the word; per-letter clips would chop glyphs.
        f.sweep = {
          progress: 1 - (1 - easeOut(s, 4)) * a,
          from: d === "left" ? "left" : "right",
        };
        break;
      }
      const q = (1 - easeOut(s, 4)) * a;
      f.maskY = d === "up" ? q * 1.15 : -q * 1.15;
      break;
    }
    case "focus": {
      if (effect.variant === "slam") {
        // Accelerate into place, like a stamp; a small rebound sells the impact.
        const q = Math.pow(1 - unit(s), 2.2) * a;
        f.scale =
          1 + 2.6 * q + (s >= 1 ? 0 : 0.04 * Math.sin(unit(s) * Math.PI));
        f.blur = 0.25 * q;
        f.opacity = 1 - unit(q * 1.4);
      } else {
        const q = (1 - easeOut(s, 3)) * a;
        f.scale = 1 + 0.35 * q;
        f.blur = 0.4 * q;
        f.opacity = 1 - q;
      }
      break;
    }
    case "stretch": {
      const q = (1 - easeOut(s, 5)) * a;
      f.scaleX = 1 + (1 + effect.distance * 5) * q;
      f.scaleY = 1 - 0.35 * q;
      f.blur = 0.06 * q;
      f.opacity = 1 - q * q;
      break;
    }
    case "swipe": {
      const q = (1 - easeOut(s, 5)) * a;
      const sign = effect.direction === "right" ? 1 : -1;
      f.x = sign * q * (0.5 + effect.distance * 4);
      f.skewX = -sign * 24 * q;
      f.blur = 0.12 * q;
      f.opacity = 1 - unit(q * 1.3);
      break;
    }
    case "slot": {
      // Back easing overshoots one glyph and settles, like a reel stopping.
      f.slot = s >= 1 || a === 0 ? null : (1 - back(s, 1.2)) * a;
      break;
    }
    case "bounce": {
      if (effect.variant === "elastic") {
        f.scale = 1 + (elastic(unit(s)) - 1) * a;
        f.opacity = 1 - (1 - unit(s * 5)) * a;
      } else {
        const v = bounceOut(unit(s), 3);
        f.y = -(1 - v) * (0.6 + effect.distance * 3) * a;
        // Squash on contact, strongest on the first impact.
        const contact = v > 0.985 && s < 1 ? 1 - unit(s) : 0;
        f.scaleX = 1 + 0.35 * contact * a;
        f.scaleY = 1 - 0.3 * contact * a;
        f.opacity = 1 - (1 - unit(s * 6)) * a;
      }
      break;
    }
    case "turn": {
      const q = (1 - easeOut(s, 3)) * a;
      f.rotateY = (effect.direction === "right" ? 90 : -90) * q;
      f.opacity = 1 - q * q;
      break;
    }
    case "highlight": {
      if (effect.variant === "block") {
        const cover = unit(s * 2),
          reveal = unit(s * 2 - 1);
        f.box =
          reveal > 0
            ? { scale: 1 - smooth(reveal), origin: "right" }
            : { scale: smooth(cover), origin: "left" };
        f.opacity = reveal > 0 ? 1 : 1 - a;
        if (a < 1 && f.box) f.box.scale *= a;
      } else {
        f.box = { scale: smooth(s) * a, origin: "left" };
      }
      break;
    }
    case "underline": {
      f.line = smooth(unit(s * 2)) * a;
      f.maskY = (1 - easeOut(unit(s * 2 - 1), 4)) * 1.15 * a;
      break;
    }
    case "outline":
      f.outline = (1 - smooth(s)) * a;
      break;
    case "echo":
      f.echo = (1 - easeOut(s, 2)) * a;
      break;
    case "split":
      f.split = (1 - easeOut(s, 4)) * a;
      f.opacity = 1 - 0.4 * f.split;
      break;
    case "draw":
      f.draw = a > 0 ? 1 - (1 - unit(s)) * a : null;
      break;
    case "flicker": {
      // Before ignition a tube buzzes on and off; the odds of being lit rise with progress.
      if (s < 1) {
        const tick = Math.floor(time * Math.max(0.1, effect.speed) * 24);
        const lit =
          seeded(effect.seed + tick * 131, index) < Math.pow(unit(s), 0.6);
        f.opacity = lit ? 1 : 1 - 0.92 * a;
      }
      break;
    }
    case "blurrise": {
      // Rise with a small overshoot past the baseline, as in blur-in-up presets.
      f.y = (1 - back(s, 1.6)) * (0.3 + effect.distance * 0.7) * a;
      f.blur = (1 - easeOut(s, 3)) * 0.18 * a;
      f.opacity = 1 - (1 - easeOut(s * 1.5, 2)) * a;
      break;
    }
    case "karaoke": {
      const lit = smooth(s);
      f.opacity = 1 - (1 - (0.2 + 0.8 * lit)) * a;
      f.blur = (1 - lit) * 0.04 * a;
      if (lit > 0) f.tint = { color: effect.color, amount: lit * a };
      break;
    }
    case "shimmer": {
      const width = 1.5 + effect.distance * 4;
      const position =
        fract(time * Math.max(0.05, effect.speed) * 0.4) * (count + width * 2) -
        width;
      const band = Math.max(0, 1 - Math.abs(index - position) / width) ** 2;
      f.tint = {
        color: mixHex(effect.secondary, effect.color, band),
        amount: a,
      };
      break;
    }
    case "prism": {
      if (s <= 0) f.opacity = 1 - a;
      else if (s < 1)
        f.tint = {
          color: `hsl(${Math.round((index / Math.max(1, count)) * 300 + s * 90) % 360},95%,62%)`,
          // Hold full color through the front, then settle to the text color.
          amount: (1 - smooth((s - 0.45) / 0.55)) * a,
        };
      break;
    }
    case "bubbles": {
      f.scale = 1 + (back(s, 2.2) - 1) * a;
      f.opacity = 1 - (1 - unit(s * 4)) * a;
      if (a > 0) f.box = { scale: 1, origin: "left", shape: "circle" };
      break;
    }
    case "flap": {
      if (a > 0 && s < 1) {
        const flips = 6;
        const k = Math.floor(unit(s) * flips);
        const phase = unit(s) * flips - k;
        const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const glyph = (n: number) =>
          n >= flips
            ? ""
            : n < 0
              ? " "
              : pool[
                  Math.floor(seeded(effect.seed + n * 31, index) * pool.length)
                ];
        f.flap = { from: glyph(k - 1), to: glyph(k), phase };
      }
      if (a > 0) f.box = { scale: 1, origin: "left" };
      break;
    }
    case "roll":
      if (a > 0 && s < 1) f.roll = 1 - (1 - smooth(s)) * a;
      break;
    case "count":
    case "circle":
    case "odometer":
    case "retype":
    case "rotate":
    case "typeloop":
    case "morph":
      break;
  }
  return f;
}

/** Replace every number with its counted value, keeping decimals and separators. */
export function countedText(
  text: string,
  effect: TextEffect,
  time: number,
  duration: number,
) {
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const exit = effect.motion?.direction === "out";
  const p = exit
    ? 1 - unit((time - (duration - seconds)) / seconds)
    : unit(time / seconds);
  const k = easeOut(p, 3);
  return text.replace(/\d[\d,]*(\.\d+)?/g, (match) => {
    const decimals = match.split(".")[1]?.length ?? 0;
    const grouped = match.includes(",");
    const target = Number(match.replace(/,/g, ""));
    const value = target * k;
    const fixed = value.toFixed(decimals);
    if (!grouped) return fixed;
    const [whole, fraction] = fixed.split(".");
    return (
      whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
      (fraction ? "." + fraction : "")
    );
  });
}

/** Glyph strip a slot reel passes through before landing on `glyph`. */
export function slotStrip(
  glyph: string,
  seed: number,
  index: number,
  length = 7,
) {
  // Match the final glyph's class and skip the widest letters so reels stay inside narrow cells.
  const pool = /\d/.test(glyph)
    ? "0123456789"
    : /\p{Ll}/u.test(glyph)
      ? "abcdeghknopqrsuvxyz"
      : "ABCDEFGHJKLNOPRSTUVXYZ";
  return Array.from(
    { length },
    (_, i) => pool[Math.floor(seeded(seed + i * 17, index) * pool.length)],
  );
}

/** Circle layout: angle (deg) and radius (em) for each character. */
export function circleLayout(effect: TextEffect, count: number, time: number) {
  const spacing = 0.55 + effect.distance * 0.6;
  const radius = Math.max(1.2, (count * spacing) / (2 * Math.PI));
  const spin = time * effect.speed * 20;
  return {
    radius,
    angle: (i: number) => (i / Math.max(1, count)) * 360 + spin,
  };
}

const graphemes = (text: string) =>
  Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (s) => s.segment,
  );
export const sequenceLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

/** Which line is current and how far the swap into it has progressed. */
export function sequenceStep(
  lines: number,
  effect: TextEffect,
  time: number,
  duration: number,
) {
  const n = Math.max(1, lines);
  const slot = Math.max(0.05, duration / n);
  const index = Math.min(n - 1, Math.floor(Math.max(0, time) / slot));
  const into = Math.max(0, time) - index * slot;
  const swap = Math.min(effect.seconds, slot * 0.6);
  return {
    index,
    previous: index > 0 ? index - 1 : null,
    progress: index > 0 ? unit(into / Math.max(0.05, swap)) : 1,
    slot,
    into,
  };
}

/** Retype: the first line is overwritten left to right into the second. */
export function retypeText(
  text: string,
  effect: TextEffect,
  time: number,
  duration: number,
) {
  const [from = "", to = from] = sequenceLines(text);
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const exit = effect.motion?.direction === "out";
  const v = smooth(
    exit
      ? 1 - unit((time - (duration - seconds)) / seconds)
      : unit(time / seconds),
  );
  const a = graphemes(from),
    b = graphemes(to);
  const written = Math.floor(b.length * v);
  const length = Math.round(a.length + (b.length - a.length) * v);
  const rest = a.slice(written, Math.max(written, length));
  while (written + rest.length < length)
    rest.push(b[written + rest.length] ?? "");
  return {
    text: [...b.slice(0, written), ...rest].join(""),
    caret: v > 0 && v < 1 ? written : null,
  };
}

/** Type-and-delete loop: type each line, hold, backspace, then the next; the last line stays. */
export function typeLoopText(
  text: string,
  effect: TextEffect,
  time: number,
  duration: number,
) {
  const lines = sequenceLines(text);
  if (!lines.length) return { text: "", typing: false };
  const { index, into, slot } = sequenceStep(
    lines.length,
    effect,
    time,
    duration,
  );
  const glyphs = graphemes(lines[index]);
  const typeTime = Math.min(
    slot * 0.45,
    (glyphs.length * 0.07) / Math.max(0.1, effect.speed),
  );
  const deleteTime = Math.min(
    slot * 0.2,
    (glyphs.length * 0.035) / Math.max(0.1, effect.speed),
  );
  const last = index === lines.length - 1;
  let shown = glyphs.length;
  if (into < typeTime) shown = Math.floor((into / typeTime) * glyphs.length);
  else if (!last && into > slot - deleteTime)
    shown = Math.ceil(((slot - into) / deleteTime) * glyphs.length);
  return {
    text: glyphs.slice(0, Math.max(0, shown)).join(""),
    typing: shown < glyphs.length || into < typeTime,
  };
}

/** Odometer: continuous per-digit roll positions (0..10) for every digit in the text. */
export function odometerRolls(
  text: string,
  effect: TextEffect,
  time: number,
  duration: number,
) {
  const seconds = Math.min(effect.seconds, Math.max(0.05, duration));
  const exit = effect.motion?.direction === "out";
  const p = exit
    ? 1 - unit((time - (duration - seconds)) / seconds)
    : unit(time / seconds);
  const k = easeOut(p, 3);
  const rolls = new Map<number, number>();
  const chars = graphemes(text);
  let offset = 0;
  const positions: number[] = [];
  for (const c of chars) {
    positions.push(offset);
    offset += c.length;
  }
  for (const match of text.matchAll(/\d[\d,]*(\.\d+)?/g)) {
    const raw = match[0];
    const digits = raw.replace(/[,.]/g, "");
    const target = Number(digits);
    const value = target * k;
    let place = 0;
    for (let i = raw.length - 1; i >= 0; i--) {
      if (!/\d/.test(raw[i])) continue;
      const unitValue = Math.pow(10, place);
      const below = value % unitValue;
      const carry = place === 0 ? 0 : Math.max(0, below - (unitValue - 1));
      const roll =
        place === 0 ? value % 10 : (Math.floor(value / unitValue) % 10) + carry;
      const charIndex = positions.indexOf(match.index! + i);
      if (charIndex >= 0) rolls.set(charIndex, p >= 1 ? Number(raw[i]) : roll);
      place++;
    }
  }
  return rolls;
}
