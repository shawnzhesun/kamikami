import { z } from "zod";
import { clamp01, effectRandom, smooth } from "./visual-effects";
import {
  backOut,
  context,
  f,
  outPow,
  type Ctx,
  type KindSpec,
  type P,
} from "./overlay-kit";
import { styleParts } from "./overlay-style";
import { annotateKinds } from "./overlay-kinds/annotate";
import { atmosphereKinds } from "./overlay-kinds/atmosphere";
import { broadcastKinds } from "./overlay-kinds/broadcast";
import { comicKinds } from "./overlay-kinds/comic";
import { connectKinds } from "./overlay-kinds/connect";
import { draftingKinds } from "./overlay-kinds/drafting";
import { emotionKinds } from "./overlay-kinds/emotion";
import { energyKinds } from "./overlay-kinds/energy";
import { frameKinds } from "./overlay-kinds/frames";
import { geometryKinds } from "./overlay-kinds/geometry";
import { interfaceKinds } from "./overlay-kinds/interface";
import { ornamentKinds } from "./overlay-kinds/ornament";
import { paperKinds } from "./overlay-kinds/paper";
import { printKinds } from "./overlay-kinds/print";

/**
 * Overlays (kamikami-visual-v8): vector graphics attached to an element —
 * frames, hand-drawn annotations, manga marks, drafting and interface
 * readouts, paper, ornaments, broadcast chrome, geometry, energy, atmosphere
 * and connectors. One engine serves text and pictures: every kind is a pure
 * function from the element's box (in overlay units, centered on the
 * element) and time to SVG parts, so previews and exports draw the same
 * frame. Shared styles then restyle any kind: line style (marker, pencil,
 * brush, neon…), fill (hatching, dots, halftone), entrance and exit, a loop
 * on the beat, and placement.
 *
 * Units: text uses 1 unit = 1 em; pictures use 1 unit = 2.5% of the frame's
 * shorter side. Sizes mix a text-calibrated minimum with a fraction of the
 * box, so a mark reads at title size and scales with a full-frame picture.
 */
export const overlayKinds = [
  // Frame
  "print",
  "shadowblock",
  "offsetframe",
  "brackets",
  "cropmarks",
  "label",
  "tape",
  // Annotate
  "circle",
  "underline",
  "highlight",
  "strike",
  "arrow",
  "tick",
  "cross",
  "star",
  "box",
  "braces",
  "scribble",
  "squiggle",
  "swoosh",
  "margin",
  // Emotion
  "sweat",
  "vein",
  "blush",
  "gloom",
  // Comic
  "focuslines",
  "shake",
  "balloon",
  "badge",
  // Drafting
  "dimension",
  "crosshair",
  "ruler",
  "callout",
  "typeguides",
  "selection",
  "anglearc",
  "dotgrid",
  // Interface
  "reticle",
  "scan",
  "datacolumn",
  "progressring",
  "bearing",
  // Paper
  "torn",
  "photocorners",
  "pin",
  "sticker",
  "ticket",
  // Ornament
  "quotes",
  "flourish",
  "footnote",
  "initial",
  // Broadcast
  "viewfinder",
  "safearea",
  "sprockets",
  "slate",
  "lowerthird",
  // Print
  "registration",
  "colorbars",
  "stamp",
  // Geometry
  "orbit",
  "wireframe",
  "polygons",
  "confetti",
  "bauhaus",
  // Energy
  "speedlines",
  "impact",
  "sparkle",
  "shockwave",
  "zap",
  // Atmosphere
  "glyphrain",
  "letterburst",
  "fireflies",
  // Connect
  "route",
  "mappin",
  "thread",
] as const;
export type OverlayKind = (typeof overlayKinds)[number];
export const isOverlayKind = (kind: string): kind is OverlayKind =>
  (overlayKinds as readonly string[]).includes(kind);
/** Kinds that follow each text line themselves (other kinds repeat per line). */
export const lineOverlays: readonly OverlayKind[] = [
  "underline",
  "highlight",
  "strike",
];

/** Line styles every kind can take. */
export const overlayStrokes = [
  "plain",
  "marker",
  "pencil",
  "sketch",
  "brush",
  "chalk",
  "dashed",
  "dotted",
  "double",
  "neon",
] as const;
/** Fill styles for closed shapes; auto keeps the kind's own. */
export const overlayFills = [
  "auto",
  "none",
  "solid",
  "hatch",
  "crosshatch",
  "zigzag",
  "dots",
  "halftone",
] as const;
/** How a mark arrives; "draw" is the kind's own draw-on. */
export const overlayEntrances = [
  "draw",
  "fade",
  "pop",
  "zoom",
  "drop",
  "slide",
  "wipe",
  "flicker",
] as const;
export const overlayLoops = [
  "none",
  "pulse",
  "spin",
  "sway",
  "bob",
  "breathe",
  "flicker",
  "jitter",
] as const;
export const overlayFonts = [
  "auto",
  "mono",
  "sans",
  "serif",
  "hand",
  "element",
] as const;
export type OverlayFont = Exclude<(typeof overlayFonts)[number], "auto">;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const OverlaySchema = z
  .object({
    kind: z.enum(overlayKinds),
    /** Ink. */
    color: hex,
    /** Accent: second plate, tape stripes, stamp fill, balloon fill. */
    secondary: hex,
    /** Overall opacity, 0–1. */
    strength: z.number().min(0).max(1),
    /** What it marks on text: the whole block, the key word, each line, each word or the first letter. */
    anchor: z.enum(["block", "keyword", "lines", "words", "initial"]),
    /** Which side labels, arrows and callouts use; auto picks the roomiest. */
    placement: z.enum(["auto", "top", "bottom", "left", "right"]),
    /** Gap between the element and the mark. */
    pad: z.number().min(0).max(10),
    /** Size of the mark. */
    size: z.number().min(0.1).max(5),
    /** Line weight. */
    weight: z.number().min(0.1).max(5),
    angle: z.number().min(-360).max(360),
    /** Lines, ticks, rays, sparkles, bars or the label index. */
    count: z.number().int().min(1).max(24),
    /** Draw-on (and retract) length. */
    seconds: z.number().min(0.02).max(30),
    /** Draw on at the start and retract at the end, draw on only, draw at the end, or always drawn. */
    timing: z.enum(["envelope", "in", "out", "constant"]),
    /** Motion of speed lines, rays and sparkles. */
    speed: z.number().min(0).max(60),
    /** Hand-drawn irregularity, 0 (ruled) to 1 (loose). */
    wobble: z.number().min(0).max(1),
    /** Redraws per second for a boiling pencil line; 0 holds one drawing. */
    boil: z.number().min(0).max(24),
    /** Label, readout or stamp text; empty uses a default. `{time}` and friends fill in live. */
    label: z.string().max(60).optional(),
    seed: z.number().int().min(0).max(65535),
    /** The kind's shape variant (its own list of names). */
    variant: z.number().int().min(0).max(7).default(0),
    /** Line style. */
    stroke: z.enum(overlayStrokes).default("plain"),
    /** Fill style of closed shapes. */
    fill: z.enum(overlayFills).default("auto"),
    /** Fill color; omitted uses the shape's own. */
    fillColor: hex.optional(),
    fillOpacity: z.number().min(0).max(1).default(1),
    /** Hatching and dot density. */
    density: z.number().min(0.2).max(4).default(1),
    /** Pencil and sketch roughness. */
    roughness: z.number().min(0).max(3).default(1),
    /** Entrance style. */
    enter: z.enum(overlayEntrances).default("draw"),
    /** Exit style; "match" plays the entrance backwards. */
    exit: z.enum(["match", ...overlayEntrances]).default("match"),
    /** A loop while shown, timed to `tempo`. */
    loop: z.enum(overlayLoops).default("none"),
    tempo: z.number().min(30).max(240).default(120),
    loopDepth: z.number().min(0).max(1).default(0.5),
    /** Placement nudge in overlay units, rotation and mirroring. */
    offsetX: z.number().min(-40).max(40).default(0),
    offsetY: z.number().min(-40).max(40).default(0),
    rotate: z.number().min(-180).max(180).default(0),
    mirror: z.boolean().default(false),
    blend: z
      .enum(["auto", "normal", "multiply", "screen", "overlay", "difference"])
      .default("auto"),
    /** Draw behind or in front of the element; auto lets the kind decide. */
    layer: z.enum(["auto", "behind", "front"]).default("auto"),
    font: z.enum(overlayFonts).default("auto"),
    caps: z.boolean().default(false),
    /** Soft drop shadow, 0–1. */
    shadow: z.number().min(0).max(1).default(0),
    /** Delay between words or lines when the mark repeats, 0–1 of its draw-on. */
    stagger: z.number().min(0).max(1).default(0.3),
  })
  .strict();
export type Overlay = z.infer<typeof OverlaySchema>;
export type OverlayUse = { overlay: Overlay; amount: number };

const specs = {
  ...frameKinds,
  ...annotateKinds,
  ...emotionKinds,
  ...comicKinds,
  ...draftingKinds,
  ...interfaceKinds,
  ...paperKinds,
  ...ornamentKinds,
  ...broadcastKinds,
  ...printKinds,
  ...geometryKinds,
  ...energyKinds,
  ...atmosphereKinds,
  ...connectKinds,
} as Record<OverlayKind, KindSpec>;
/** Name, gallery section, defaults and controls of each kind. */
export const overlaySpecs: Record<OverlayKind, KindSpec> = specs;
/** Gallery sections, in order. */
export const overlayFeelNames = [
  "Frame",
  "Annotate",
  "Emotion",
  "Comic",
  "Drafting",
  "Interface",
  "Paper",
  "Ornament",
  "Broadcast",
  "Print",
  "Geometry",
  "Energy",
  "Atmosphere",
  "Connect",
] as const;
export const overlayNames = Object.fromEntries(
  overlayKinds.map((k) => [k, specs[k].name]),
) as Record<OverlayKind, string>;

export function makeOverlay(
  kind: OverlayKind,
  patch: Partial<Overlay> = {},
): Overlay {
  return OverlaySchema.parse({
    kind,
    color: "#f2765e",
    secondary: "#16f4d4",
    strength: 1,
    anchor: "block",
    placement: "auto",
    pad: 1,
    size: 1,
    weight: 1,
    angle: 0,
    count: 1,
    seconds: 0.5,
    timing: "envelope",
    speed: 1,
    wobble: 0,
    boil: 0,
    seed: 11,
    ...specs[kind].defaults,
    ...patch,
  });
}

// ------------------------------------------------------------------ timing

/** Entrance and exit progress (1 = settled) at animation time `time`. */
function phases(o: Overlay, time: number, duration: number) {
  const s = Math.max(0.02, Math.min(o.seconds, duration / 2 || o.seconds));
  switch (o.timing) {
    case "constant":
      return { enter: 1, leave: 1 };
    case "in":
      return { enter: smooth(time / s), leave: 1 };
    case "out":
      // Finishes early so the element can still leave after the mark lands.
      return {
        enter: smooth((time - (duration - s)) / (s * 0.65)),
        leave: 1,
      };
    case "envelope":
      return {
        enter: smooth(time / s),
        leave: smooth((duration - time) / s),
      };
  }
}
/** Draw-on amount (0–1) at animation time `time` in a clip of `duration`. */
export function overlayProgress(o: Overlay, time: number, duration: number) {
  const { enter, leave } = phases(o, time, duration);
  return Math.min(enter, leave);
}

// ---------------------------------------------------------------- geometry

/** A box in overlay units; x/y is its center relative to the element's center. */
export type OverlayBox = { x: number; y: number; w: number; h: number };
export type OverlayTarget = {
  /** The whole element. */
  box: OverlayBox;
  /** The key word (text) — the block for pictures. */
  key?: OverlayBox;
  /** Each text line. */
  lines?: OverlayBox[];
  /** Each word. */
  words?: OverlayBox[];
  /** The first letter. */
  initial?: OverlayBox;
  /** The element's text and key word, for letter effects and readouts. */
  text?: string;
  word?: string;
  /** Centers of the other elements on screen, in units from this one's center. */
  peers?: P[];
  /** Pixels per overlay unit, for readouts. */
  unitPx: number;
  /** Free space from each edge of the box to the frame edge, in units. */
  room?: { top: number; bottom: number; left: number; right: number };
  /** The clip's start, for index labels. */
  start: number;
  /** Element center relative to the frame center, pixels, for readouts. */
  position?: { x: number; y: number };
};
/** A styled sub-path inside a part (marker outlines, rough strokes, fills). */
export type OverlayPath = {
  d: string;
  fill?: string;
  stroke?: string;
  width?: number;
  opacity?: number;
  transform?: string;
  /** Blur radius for glows. */
  glow?: number;
  /** Chalky grain at this scale. */
  grain?: number;
  pattern?: OverlayPattern;
};
export type OverlayPattern = {
  style: "hatch" | "crosshatch" | "zigzag" | "dots" | "halftone";
  color: string;
  gap: number;
  width: number;
};
export type OverlayPart = {
  key: string;
  behind: boolean;
  opacity: number;
  d?: string;
  fill?: string;
  stroke?: string;
  width?: number;
  /** Stroke draw-on, 0–1; omitted means fully drawn. */
  draw?: number;
  cap?: "round" | "square" | "butt";
  /** SVG transform in units. */
  transform?: string;
  /** Soft drop shadow blur, units. */
  shadow?: number;
  blend?: "multiply" | "screen" | "overlay" | "difference";
  /** Fill with the even-odd rule, so inner subpaths cut holes. */
  evenodd?: boolean;
  /** A closed shape that takes fill styles. */
  closed?: boolean;
  /** It surrounds the element, so added fills go behind it. */
  encloses?: boolean;
  /** Dash pattern in units. */
  dash?: number[];
  /** Blur radius for a glow. */
  glow?: number;
  pattern?: OverlayPattern;
  fillOpacity?: number;
  /** Styled sub-paths drawn instead of `d`, which then only guides the draw-on. */
  paths?: OverlayPath[];
  /** Visible rectangle in overlay units, for wipes. */
  clip?: OverlayBox;
  text?: string;
  x?: number;
  y?: number;
  size?: number;
  align?: "start" | "middle" | "end";
  mono?: boolean;
  bold?: boolean;
  font?: OverlayFont;
  /** Letter spacing, em. */
  spacing?: number;
};

/** The boxes a mark repeats over. */
function anchorBoxes(o: Overlay, target: OverlayTarget): OverlayBox[] {
  switch (o.anchor) {
    case "keyword":
      return [target.key ?? target.box];
    case "initial":
      return [target.initial ?? target.box];
    case "words":
      return target.words?.length ? target.words : [target.box];
    case "lines":
      if (lineOverlays.includes(o.kind)) return [target.box];
      return target.lines?.length ? target.lines : [target.box];
    default:
      return [target.box];
  }
}

/** SVG parts for one overlay at a time; `amount` scales its opacity. */
export function overlayParts(
  o: Overlay,
  amount: number,
  time: number,
  duration: number,
  target: OverlayTarget,
  index = 0,
): OverlayPart[] {
  const a = clamp01(o.strength * amount);
  if (a <= 0) return [];
  const boxes = anchorBoxes(o, target);
  if (boxes.length === 1)
    return one(o, a, time, duration, target, boxes[0], `${o.kind}-${index}`, 0);
  // Words or lines draw one after another.
  const step = (o.stagger * Math.min(o.seconds, duration / 2)) / 1;
  return boxes.flatMap((box, i) =>
    one(
      o,
      a,
      time,
      duration,
      target,
      box,
      `${o.kind}-${index}-${i}`,
      i * step,
      (boxes.length - 1 - i) * step,
    ),
  );
}

function one(
  o: Overlay,
  a: number,
  time: number,
  duration: number,
  target: OverlayTarget,
  box: OverlayBox,
  key: string,
  delay: number,
  lead = 0,
): OverlayPart[] {
  const enter = phases(o, time - delay, duration).enter;
  const leave = phases(o, time + lead, duration).leave;
  const exitStyle = o.exit === "match" ? o.enter : o.exit;
  const p = Math.min(
    o.enter === "draw" ? enter : 1,
    exitStyle === "draw" ? leave : 1,
  );
  if (
    p <= 0 ||
    (o.enter !== "draw" && enter <= 0) ||
    (exitStyle !== "draw" && leave <= 0)
  )
    return [];
  const c = context(o, a, p, time, duration, target, box, key);
  const drawn = overlaySpecs[o.kind].draw(c);
  if (!drawn.length) return [];
  const styled = styleParts(o, drawn, c);
  return motion(o, c, styled, enter, leave, exitStyle);
}

type Motion = { opacity: number; transform: string[]; clip?: OverlayBox };
/** The entrance or exit envelope at progress `q` (1 = settled). */
function envelope(
  style: string,
  q: number,
  c: Ctx,
  m: Motion,
  pivot: P,
  salt: number,
) {
  if (q >= 1 || style === "draw") return;
  const [px, py] = pivot;
  const about = (t: string) =>
    `translate(${f(px)} ${f(py)}) ${t} translate(${f(-px)} ${f(-py)})`;
  switch (style) {
    case "fade":
      m.opacity *= q;
      return;
    case "pop":
      m.transform.push(about(`scale(${f(Math.max(0.001, backOut(q)))})`));
      m.opacity *= Math.min(1, q * 4);
      return;
    case "zoom":
      m.transform.push(about(`scale(${f(1 + (1 - smooth(q)) * 0.7)})`));
      m.opacity *= q;
      return;
    case "drop":
      m.transform.push(
        `translate(0 ${f(-(1 - backOut(q, 1.2)) * (c.H2 + c.P + c.S(1, 0.25)))})`,
      );
      m.opacity *= Math.min(1, q * 3);
      return;
    case "slide":
      m.transform.push(
        `translate(${f(-(1 - outPow(q, 3)) * (c.W2 + c.P + c.S(1, 0.25)))} 0)`,
      );
      m.opacity *= q;
      return;
    case "wipe": {
      const R = Math.max(c.W2, c.H2) * 1.6 + c.P * 2 + c.S(2, 0.5);
      m.clip = { x: c.cx - R + R * q, y: c.cy, w: 2 * R * q, h: R * 4 };
      return;
    }
    case "flicker":
      m.opacity *=
        effectRandom(c.o.seed + salt, Math.floor(c.time * 20)) < q ? 1 : 0.08;
      return;
  }
}

/** Entrance, exit, loop and placement applied to an overlay's parts. */
function motion(
  o: Overlay,
  c: Ctx,
  parts: OverlayPart[],
  enter: number,
  leave: number,
  exitStyle: string,
): OverlayPart[] {
  const pivot: P = [c.cx + (c.pivot?.[0] ?? 0), c.cy + (c.pivot?.[1] ?? 0)];
  const m: Motion = { opacity: 1, transform: [] };
  // Outermost first: placement, loop, exit, entrance.
  const [px, py] = pivot;
  const about = (t: string) =>
    `translate(${f(px)} ${f(py)}) ${t} translate(${f(-px)} ${f(-py)})`;
  if (o.offsetX || o.offsetY)
    m.transform.push(`translate(${f(o.offsetX)} ${f(o.offsetY)})`);
  if (o.rotate) m.transform.push(about(`rotate(${f(o.rotate)})`));
  if (o.loop !== "none") {
    const d = o.loopDepth;
    const beat = c.time / (60 / o.tempo);
    const amp = d * Math.max(0.12, 0.03 * c.m);
    switch (o.loop) {
      case "pulse":
        m.transform.push(
          about(`scale(${f(1 + d * 0.22 * Math.exp(-(beat % 1) * 5))})`),
        );
        break;
      case "spin":
        m.transform.push(about(`rotate(${f(beat * 90 * d)})`));
        break;
      case "sway":
        m.transform.push(
          about(`rotate(${f(Math.sin((beat * Math.PI) / 2) * 14 * d)})`),
        );
        break;
      case "bob":
        m.transform.push(
          `translate(0 ${f(Math.sin((beat * Math.PI) / 2) * amp)})`,
        );
        break;
      case "breathe":
        m.transform.push(
          about(`scale(${f(1 + d * 0.12 * Math.sin((beat * Math.PI) / 2))})`),
        );
        break;
      case "flicker":
        m.opacity *=
          effectRandom(o.seed + 5, Math.floor(beat * 4)) < d * 0.6 ? 0.12 : 1;
        break;
      case "jitter": {
        const k = Math.floor(beat * 4);
        m.transform.push(
          `translate(${f((effectRandom(o.seed, k) - 0.5) * amp * 2)} ${f((effectRandom(o.seed + 1, k) - 0.5) * amp * 2)})`,
        );
        break;
      }
    }
  }
  envelope(exitStyle, leave, c, m, pivot, 77);
  envelope(o.enter, enter, c, m, pivot, 33);
  const prefix = m.transform.join(" ");
  const mirror = o.mirror ? `translate(${f(c.cx * 2)} 0) scale(-1 1)` : "";
  if (!prefix && !mirror && m.opacity === 1 && !m.clip) return parts;
  return parts.flatMap((part) => {
    const opacity = part.opacity * m.opacity;
    if (opacity <= 0.001) return [];
    const own = part.transform ?? "";
    if (part.text !== undefined && o.mirror && !own) {
      // Labels stay readable: only their position mirrors.
      const x = 2 * c.cx - (part.x ?? 0);
      const align =
        part.align === "start"
          ? "end"
          : part.align === "end"
            ? "start"
            : part.align;
      return [
        {
          ...part,
          x,
          align,
          opacity,
          transform: prefix || undefined,
          clip: m.clip,
        },
      ];
    }
    const transform = [prefix, part.text === undefined ? mirror : "", own]
      .filter(Boolean)
      .join(" ");
    return [
      { ...part, opacity, transform: transform || undefined, clip: m.clip },
    ];
  });
}

/** Every visible part of an element's overlays, in stacking order. */
export function overlayStack(
  uses: OverlayUse[],
  time: number,
  duration: number,
  target: OverlayTarget,
) {
  return uses.flatMap((u, i) =>
    overlayParts(u.overlay, u.amount, time, duration, target, i),
  );
}
export { timecode } from "./overlay-kit";
export const overlayMono = '"IBM Plex Mono", ui-monospace, monospace';
/** CSS font stacks for overlay text. */
export const overlayFontStacks: Record<OverlayFont, string> = {
  mono: overlayMono,
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  hand: '"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive',
  element: "inherit",
};

// --------------------------------------------------------------- migration

const legacyArtDecor = [
  "print",
  "shadowblock",
  "offsetframe",
  "brackets",
  "cropmarks",
  "label",
  "tape",
];
const legacyTextDecor = ["brackets", "label"];
type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Earlier definitions drew framing decorations as artwork treatments
 * (`art`) or text looks (`text`). They are overlays now; convert them so
 * saved projects and bundles keep their marks.
 */
export function migrateLegacyDecor<T>(effect: T): T {
  if (!isObject(effect) || effect.overlay !== undefined) return effect;
  const art = effect.art;
  if (isObject(art) && legacyArtDecor.includes(art.kind as string)) {
    const { art: _art, ...rest } = effect;
    const num = (k: string, d: number) =>
      typeof art[k] === "number" ? (art[k] as number) : d;
    return {
      ...rest,
      overlay: makeOverlay(
        art.kind as OverlayKind,
        {
          color: typeof art.color === "string" ? art.color : undefined,
          secondary:
            typeof art.secondary === "string" ? art.secondary : undefined,
          strength: clamp01(num("strength", 1)),
          // Artwork sizes were fractions of the frame's short side.
          pad: Math.min(10, num("distance", 0.03) / 0.025),
          angle: num("angle", 0),
          count: Math.round(Math.min(24, Math.max(1, num("count", 1)))),
          seconds: Math.min(30, Math.max(0.02, num("seconds", 0.4))),
          timing: "in",
          ...(typeof art.label === "string" ? { label: art.label } : {}),
          ...(typeof art.seed === "number" ? { seed: art.seed } : {}),
        } as Partial<Overlay>,
      ),
    } as T;
  }
  const text = effect.text;
  if (isObject(text) && legacyTextDecor.includes(text.kind as string)) {
    const { text: _text, ...rest } = effect;
    const seed = typeof text.seed === "number" ? text.seed : 17;
    return {
      ...rest,
      overlay: makeOverlay(text.kind as OverlayKind, {
        ...(typeof text.color === "string" ? { color: text.color } : {}),
        seconds:
          typeof text.seconds === "number"
            ? Math.min(30, Math.max(0.02, text.seconds))
            : 0.5,
        timing: "in",
        count: (seed % 99) + 1,
        ...(typeof text.label === "string" ? { label: text.label } : {}),
        seed,
      }),
    } as T;
  }
  return effect;
}
/** Migrates a project-like object's effects and per-instance snapshots. */
export function migrateProjectDecor(input: unknown): unknown {
  if (!isObject(input)) return input;
  const out: Loose = { ...input };
  if (Array.isArray(input.effects))
    out.effects = input.effects.map(migrateLegacyDecor);
  if (Array.isArray(input.layers))
    out.layers = input.layers.map((layer) =>
      isObject(layer) && Array.isArray(layer.effects)
        ? {
            ...layer,
            effects: layer.effects.map((instance) =>
              isObject(instance) && isObject(instance.settings)
                ? {
                    ...instance,
                    settings: migrateLegacyDecor(instance.settings),
                  }
                : instance,
            ),
          }
        : layer,
    );
  return out;
}

// --------------------------------------------------------------- controls

export type OverlayField =
  | "anchor"
  | "placement"
  | "pad"
  | "size"
  | "weight"
  | "angle"
  | "count"
  | "seconds"
  | "timing"
  | "speed"
  | "wobble"
  | "boil"
  | "label"
  | "strength"
  | "color"
  | "secondary"
  | "variant"
  | "tempo"
  | "font";
/** Editor labels for the shape settings each kind uses. */
export const overlayControls = Object.fromEntries(
  overlayKinds.map((k) => [k, specs[k].controls]),
) as Record<OverlayKind, Partial<Record<OverlayField, string>>>;
/** Names of each kind's shape variants. */
export const overlayVariants = Object.fromEntries(
  overlayKinds.map((k) => [k, specs[k].variants ?? []]),
) as Record<OverlayKind, readonly string[]>;
