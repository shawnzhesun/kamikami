import { isKineticKind } from "./kinetic-type";
import { isLookKind } from "./text-looks";
import { isLayoutKind } from "./text-layouts";
import { z } from "zod";
import { FieldSchema, ParticleSchema } from "./motion";
import { titleKinds } from "./title-effects";

export const visualKinds = [
  "vignette",
  "spotlight",
  "bloom",
  "flare",
  "grain",
  "scanlines",
  "chromatic",
  "distortion",
  "silhouette",
  "duotone",
  "flash",
  "hatch",
  "hexagons",
  "particles",
  "wipe",
  "iris",
  "shatter",
  "echo",
  "letterbox",
  "palette",
  "smear",
  "repeat",
  "rings",
  "blinds",
  "warp",
  "bevel",
  "extrude",
  "sheen",
  "paper",
  "ink",
  "pixel",
  "dissolve",
  "goo",
  "glow",
  "lens",
  "shape",
  "doors",
  "clock",
  "feather",
  "lumawipe",
  "reflection",
  "tiltshift",
  "oldfilm",
  "ripple",
  "cells",
] as const;
export const visualNames: Record<(typeof visualKinds)[number], string> = {
  vignette: "Vignette",
  spotlight: "Soft spotlight",
  bloom: "Highlight bloom",
  flare: "Horizontal flare",
  grain: "Film grain",
  scanlines: "CRT scanlines",
  chromatic: "RGB separation",
  distortion: "Signal distortion",
  silhouette: "Color silhouette",
  duotone: "Two-color grade",
  flash: "Light flash",
  hatch: "Diagonal hatching",
  hexagons: "Hexagon field",
  particles: "Floating flecks",
  wipe: "Panel wipe",
  iris: "Iris reveal",
  shatter: "Fragment breakup",
  echo: "Graphic echoes",
  letterbox: "Letterbox",
  palette: "Color remap",
  smear: "Motion smear",
  repeat: "Image repetition",
  rings: "Graphic rings",
  blinds: "Blinds reveal",
  warp: "Organic warp",
  bevel: "Bevel & emboss",
  extrude: "Solid extrusion",
  sheen: "Light sweep",
  paper: "Paper cutout",
  ink: "Comic ink",
  pixel: "Pixel art",
  dissolve: "Noise dissolve",
  goo: "Gooey morph",
  glow: "Energy edge",
  lens: "Lens bulge",
  shape: "Shape iris",
  doors: "Barn doors",
  clock: "Clock wipe",
  feather: "Feathered wipe",
  lumawipe: "Luma wipe",
  reflection: "Reflection",
  tiltshift: "Tilt-shift",
  oldfilm: "Old film",
  ripple: "Ripple",
  cells: "Cell reveal",
};
/** Kinds and mode fields added with kamikami-visual-v6. */
export const v6Kinds: readonly string[] = [
  "warp",
  "bevel",
  "extrude",
  "sheen",
  "paper",
  "ink",
  "pixel",
  "dissolve",
  "goo",
  "glow",
  "lens",
];
export const VisualPassSchema = z.object({
  field: FieldSchema.optional(),
  particles: ParticleSchema.optional(),
  kind: z.enum(visualKinds),
  strength: z.number().min(0).max(1),
  size: z.number().min(0).max(1),
  speed: z.number().min(0).max(10),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  angle: z.number().min(-180).max(180),
  timing: z.enum(["constant", "in", "out", "pulse"]),
  seconds: z.number().min(0.05).max(30),
  seed: z.number().int().min(0).max(65535),
  blindsDirection: z.enum(["horizontal", "vertical"]).optional(),
  paletteMode: z.enum(["negative", "solarize", "posterize"]).optional(),
  smearMode: z.enum(["zoom", "spin", "directional"]).optional(),
  repeatMode: z.enum(["grid", "mirror", "kaleidoscope", "tunnel"]).optional(),
  distortionMode: z.enum(["bands", "blocks", "wave"]).optional(),
  screenPattern: z.enum(["lines", "dots"]).optional(),
  particleStyle: z.enum(["paper", "burst"]).optional(),
  silhouetteStyle: z.enum(["fill", "outline"]).optional(),
  count: z.number().int().min(2).max(12).optional(),
  warpMode: z.enum(["boil", "liquid", "melt"]).optional(),
  sheenStyle: z.enum(["gloss", "foil"]).optional(),
  pixelMode: z.enum(["pixelate", "dither", "gameboy"]).optional(),
  shapeMode: z.enum(["star", "heart", "flower", "diamond", "rect"]).optional(),
  doorMode: z.enum(["horizontal", "vertical", "bowtie"]).optional(),
  clockMode: z.enum(["clock", "pinwheel"]).optional(),
  cellMode: z.enum(["squares", "random", "checker", "dots"]).optional(),
  rippleMode: z.enum(["ripple", "shockwave", "drop"]).optional(),
  lumaOrder: z.enum(["dark", "bright"]).optional(),
});
export type VisualPass = z.infer<typeof VisualPassSchema>;
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const u = clamp01(n);
  return u * u * (3 - 2 * u);
};
export function effectRandom(seed: number, index: number) {
  let n = (seed + Math.imul(index + 1, 374761393)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function visualFrame(
  pass: VisualPass,
  time: number,
  duration: number,
  amount: number,
) {
  const t = Math.max(0, time);
  const period = Math.min(pass.seconds, Math.max(duration, 0.05));
  const envelope =
    pass.timing === "in"
      ? 1 - smooth(t / period)
      : pass.timing === "out"
        ? smooth((t - duration + period) / period)
        : pass.timing === "pulse"
          ? Math.pow((1 + Math.cos(t * pass.speed * Math.PI * 2)) / 2, 6)
          : 1;
  return {
    strength: clamp01(pass.strength * amount * envelope),
    time: t * pass.speed,
    tick: Math.floor(t * pass.speed * 12),
    progress: clamp01(t / Math.max(duration, 0.05)),
  };
}

const v6Channels = ["scaleX", "scaleY", "skewX", "rotateX"];
const v6Curves = ["back", "elastic", "bounce", "damped", "anticipate"];
/** Dependency-free capability check used before writing to a possibly stale service. */
export function usesV6Features(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const effect = value as {
    passes?: Record<string, unknown>[];
    channels?: {
      property?: string;
      curve?: string;
      seconds?: number;
      align?: string;
    }[];
  };
  return (
    !!effect.passes?.some(
      (p) =>
        v6Kinds.includes(String(p.kind)) ||
        p.warpMode !== undefined ||
        p.sheenStyle !== undefined ||
        p.pixelMode !== undefined,
    ) ||
    !!effect.channels?.some(
      (c) =>
        v6Channels.includes(c.property ?? "") ||
        v6Curves.includes(c.curve ?? "") ||
        c.seconds !== undefined ||
        c.align !== undefined,
    )
  );
}

/** Bundle engines in capability order; a reader accepts its own and older ones. */
export const effectEngines = [
  "frameforge-curves-v1",
  "kamikami-visual-v2",
  "kamikami-visual-v3",
  "kamikami-visual-v4",
  "kamikami-visual-v5",
  "kamikami-visual-v6",
  "kamikami-visual-v7",
  "kamikami-visual-v8",
] as const;
export type EffectEngine = (typeof effectEngines)[number];
export const engineAtLeast = (engine: unknown, minimum: EffectEngine) =>
  effectEngines.indexOf(engine as EffectEngine) >=
  effectEngines.indexOf(minimum);
const titleTextKinds: readonly string[] = titleKinds;
const v7Kinds = [
  "shape",
  "doors",
  "clock",
  "feather",
  "lumawipe",
  "reflection",
  "tiltshift",
  "oldfilm",
  "ripple",
  "cells",
];
/** Title-pack text kinds and their direction/variant fields need kamikami-visual-v7. */
export function usesV7Features(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const effect = value as {
    text?: Record<string, unknown>;
    passes?: Record<string, unknown>[];
    origin?: unknown;
  };
  const text = effect.text;
  return (
    (!!text &&
      (titleTextKinds.includes(String(text.kind)) ||
        text.direction !== undefined ||
        text.variant !== undefined)) ||
    effect.origin !== undefined ||
    !!effect.passes?.some(
      (p) =>
        v7Kinds.includes(String(p.kind)) ||
        [
          "shapeMode",
          "doorMode",
          "clockMode",
          "cellMode",
          "rippleMode",
          "lumaOrder",
        ].some((key) => p[key] !== undefined),
    )
  );
}

/** Kinetic type, text treatments, artwork treatments, holds' tempo and center/edges stagger need kamikami-visual-v8. */
export function usesV8Features(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if ((value as { art?: unknown }).art !== undefined) return true;
  const text = (value as { text?: Record<string, unknown> }).text;
  const order = (text?.motion as { order?: unknown } | undefined)?.order;
  return (
    !!text &&
    (isKineticKind(String(text.kind)) ||
      isLookKind(String(text.kind)) ||
      isLayoutKind(String(text.kind)) ||
      text.tempo !== undefined ||
      text.angle !== undefined ||
      text.label !== undefined ||
      order === "center" ||
      order === "edges")
  );
}
