import { z } from "zod";

/**
 * Backdrop elements: full-frame procedural backgrounds and finishing overlays
 * (kamikami-visual-v8). Backgrounds sit under artwork and text; finishes such
 * as grain, scanlines, vignette and light leaks sit on top and blend with
 * everything below. They animate with time and take transforms, effects and
 * keyframes like other visual elements.
 */
export const backgroundKinds = [
  "gradient",
  "rings",
  "halftone",
  "rays",
  "stripes",
  "dots",
  "stars",
  "bars",
  "scan",
  "grid",
  "ticker",
  "split",
] as const;
export const finishKinds = ["grain", "scanlines", "vignette", "leak"] as const;
export const backdropKinds = [...backgroundKinds, ...finishKinds] as const;
export type BackdropKind = (typeof backdropKinds)[number];
export const isFinishKind = (kind: string) =>
  (finishKinds as readonly string[]).includes(kind);
export const blendModes = [
  "normal",
  "screen",
  "multiply",
  "overlay",
  "soft-light",
] as const;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const BackdropSchema = z
  .object({
    kind: z.enum(backdropKinds),
    /** Base color (backgrounds) or tint (finishes). */
    color: hex,
    /** Pattern color. */
    secondary: hex,
    /** Accent for highlights and seams. */
    accent: hex,
    /** Pattern amount or intensity, 0–1. */
    density: z.number().min(0).max(1),
    /** Animation speed; 0 holds still. */
    speed: z.number().min(0).max(10),
    angle: z.number().min(-180).max(180),
    blend: z.enum(blendModes),
    /** Ticker text. */
    text: z.string().max(200).optional(),
    seed: z.number().int().min(0).max(65535),
  })
  .strict();
export type Backdrop = z.infer<typeof BackdropSchema>;

export const backdropNames: Record<BackdropKind, string> = {
  gradient: "Soft gradient",
  rings: "Concentric rings",
  halftone: "Halftone fade",
  rays: "Sunburst rays",
  stripes: "Moving stripes",
  dots: "Dot grid",
  stars: "Starfield",
  bars: "Equalizer bars",
  scan: "Scan bands",
  grid: "Retro grid",
  ticker: "Text wall",
  split: "Split color",
  grain: "Film grain",
  scanlines: "Scanlines",
  vignette: "Vignette",
  leak: "Light leak",
};

const base = (kind: BackdropKind, patch: Partial<Backdrop> = {}): Backdrop => ({
  kind,
  color: "#0b0d12",
  secondary: "#f1eee7",
  accent: "#f2765e",
  density: 0.5,
  speed: 1,
  angle: 0,
  blend: isFinishKind(kind)
    ? kind === "leak"
      ? "screen"
      : kind === "vignette" || kind === "scanlines"
        ? "multiply"
        : "overlay"
    : "normal",
  seed: 7,
  ...patch,
});
export type BackdropPreset = { id: string; label: string; backdrop: Backdrop };
/** The + Backdrop menu. Backgrounds go under everything, finishes on top. */
export const backdropPresets: BackdropPreset[] = [
  {
    id: "gradient",
    label: "Soft gradient",
    backdrop: base("gradient", { secondary: "#2a3346" }),
  },
  {
    id: "rings",
    label: "Rings",
    backdrop: base("rings", {
      color: "#ecebe6",
      secondary: "#c9c6bd",
      density: 0.55,
    }),
  },
  {
    id: "halftone",
    label: "Halftone",
    backdrop: base("halftone", {
      color: "#2b2bd9",
      secondary: "#5a63ff",
      angle: 90,
    }),
  },
  {
    id: "rays",
    label: "Sunburst",
    backdrop: base("rays", {
      color: "#5b582b",
      secondary: "#7a7744",
      speed: 0.4,
    }),
  },
  {
    id: "stripes",
    label: "Stripes",
    backdrop: base("stripes", {
      color: "#141414",
      secondary: "#f5c84c",
      angle: -45,
      density: 0.35,
    }),
  },
  {
    id: "dots",
    label: "Dot grid",
    backdrop: base("dots", { color: "#101216", secondary: "#3a414d" }),
  },
  {
    id: "stars",
    label: "Starfield",
    backdrop: base("stars", {
      color: "#07080c",
      secondary: "#e9f2ff",
      accent: "#16f4d4",
    }),
  },
  {
    id: "bars",
    label: "Equalizer",
    backdrop: base("bars", {
      color: "#0a0e0d",
      secondary: "#2e8c74",
      accent: "#9cff3a",
    }),
  },
  {
    id: "scan",
    label: "Scan bands",
    backdrop: base("scan", {
      color: "#1b1be8",
      secondary: "#8c8cff",
      density: 0.4,
    }),
  },
  {
    id: "grid",
    label: "Retro grid",
    backdrop: base("grid", {
      color: "#0b0414",
      secondary: "#ff4fd8",
      accent: "#22e6ff",
    }),
  },
  {
    id: "ticker",
    label: "Text wall",
    backdrop: base("ticker", {
      color: "#0d0f13",
      secondary: "#2a2f3a",
      text: "MIDNIGHT TRAIN",
    }),
  },
  {
    id: "split",
    label: "Split",
    backdrop: base("split", {
      color: "#c8103f",
      secondary: "#140509",
      accent: "#39f2c8",
      angle: 18,
    }),
  },
  {
    id: "grain",
    label: "Film grain",
    backdrop: base("grain", { color: "#808080", density: 0.45 }),
  },
  {
    id: "scanlines",
    label: "Scanlines",
    backdrop: base("scanlines", { color: "#000000", density: 0.35 }),
  },
  {
    id: "vignette",
    label: "Vignette",
    backdrop: base("vignette", { color: "#000000", density: 0.6 }),
  },
  {
    id: "leak",
    label: "Light leak",
    backdrop: base("leak", {
      color: "#ff8a3d",
      secondary: "#ff3b8d",
      density: 0.5,
      speed: 0.5,
    }),
  },
];
export const makeBackdropSettings = base;
