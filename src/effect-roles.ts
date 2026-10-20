import type { Effect } from "./model";
import { isCameraArt } from "./artwork";
import { isKineticKind, kineticRole, type KineticKind } from "./kinetic-type";
import { isLayoutKind, type LayoutKind } from "./text-layouts";
import { isLookKind, type LookKind } from "./text-looks";
import { isTitleKind, titleControls, type TitleKind } from "./title-effects";
import { overlayFeelNames, overlaySpecs, type OverlayKind } from "./overlays";

/**
 * Roles sort the gallery by the job an effect does in a shot, so cards from
 * every engine combine freely: one lane for how an element arrives, one for
 * what it does while it's on screen, one for how it leaves, plus graphics
 * attached to it, its surface, its word arrangement, hand-offs between shots
 * and finishing of the whole frame. Feels group each role by what you see.
 */
export const effectRoles = [
  "in",
  "throughout",
  "out",
  "overlay",
  "style",
  "arrange",
  "between",
  "finish",
] as const;
export type EffectRole = (typeof effectRoles)[number];
export const roleNames: Record<EffectRole, string> = {
  in: "In",
  throughout: "Throughout",
  out: "Out",
  overlay: "Overlay",
  style: "Style",
  arrange: "Arrange",
  between: "Between",
  finish: "Finish",
};
export const roleHints: Record<EffectRole, string> = {
  in: "How it arrives, at the start of the clip",
  throughout: "What it does while it's on screen",
  out: "How it leaves, at the end of the clip",
  overlay: "Graphics drawn around it",
  style: "Its surface: fill, outline, glow, material",
  arrange: "Where its words sit and move",
  between: "Hand-offs from one shot to the next",
  finish: "Grade, light and texture for the frame",
};
export const roleFeels: Record<EffectRole, readonly string[]> = {
  in: ["Build", "Reveal", "Arrive", "Type on"],
  throughout: ["Pulse", "Drift", "Signal", "Color", "Camera"],
  out: ["Break", "Conceal", "Depart", "Type off"],
  overlay: [...overlayFeelNames, "Pattern"],
  style: ["Fill", "Outline & shadow", "Glow", "Plate", "Copies", "Material"],
  arrange: ["Emphasis", "Sequence", "Path", "Stack"],
  between: ["Wipe", "Shape", "Dissolve", "Flash"],
  finish: ["Grade", "Light", "Texture", "Signal", "Illustration", "Matte"],
};
/** An entrance played backwards becomes the matching kind of exit. */
const exitFeel: Record<string, string> = {
  Build: "Break",
  Reveal: "Conceal",
  Arrive: "Depart",
  "Type on": "Type off",
};
export type RoleInfo = { role: EffectRole; feel: string };
const R = (role: EffectRole, feel: string): RoleInfo => ({ role, feel });

const kineticFeels: Record<KineticKind, string> = {
  spring: "Arrive",
  hop: "Arrive",
  wheel: "Arrive",
  hinge: "Arrive",
  spin: "Arrive",
  slam: "Arrive",
  fan: "Build",
  drum: "Reveal",
  shuffle: "Build",
  cardflip: "Arrive",
  ripple: "Arrive",
  lens: "Reveal",
  glint: "Reveal",
  brush: "Reveal",
  ink: "Reveal",
  decode: "Type on",
  rain: "Type on",
  push: "Arrive",
  flash: "Type on",
  inertia: "Arrive",
  gather: "Build",
  plates: "Build",
  inkstroke: "Reveal",
  kick: "Depart",
  launch: "Depart",
  flutter: "Depart",
  domino: "Break",
  closegap: "Depart",
  burn: "Conceal",
  tornado: "Break",
  blast: "Break",
  crumble: "Break",
  wipeoff: "Conceal",
  aperture: "Conceal",
  channels: "Break",
  melt: "Conceal",
  pluck: "Pulse",
  beathop: "Pulse",
  colorrun: "Color",
  dangle: "Drift",
  rock: "Pulse",
  ride: "Pulse",
  breathe: "Drift",
  pulse: "Pulse",
  lean: "Pulse",
  lubdub: "Pulse",
  gust: "Drift",
  afterimage: "Drift",
};
const titleRoles: Record<TitleKind, RoleInfo> = {
  mask: R("in", "Reveal"),
  focus: R("in", "Arrive"),
  stretch: R("in", "Arrive"),
  swipe: R("in", "Arrive"),
  slot: R("in", "Type on"),
  bounce: R("in", "Arrive"),
  turn: R("in", "Arrive"),
  highlight: R("in", "Reveal"),
  underline: R("in", "Reveal"),
  outline: R("in", "Reveal"),
  echo: R("in", "Build"),
  split: R("in", "Build"),
  draw: R("in", "Reveal"),
  flicker: R("in", "Type on"),
  count: R("in", "Type on"),
  circle: R("arrange", "Path"),
  blurrise: R("in", "Arrive"),
  karaoke: R("throughout", "Color"),
  shimmer: R("throughout", "Color"),
  prism: R("in", "Reveal"),
  bubbles: R("in", "Build"),
  flap: R("in", "Type on"),
  roll: R("in", "Arrive"),
  odometer: R("in", "Type on"),
  retype: R("in", "Type on"),
  rotate: R("arrange", "Sequence"),
  typeloop: R("arrange", "Sequence"),
  morph: R("arrange", "Sequence"),
};
const lookRoles: Record<LookKind, RoleInfo> = {
  outlined: R("style", "Outline & shadow"),
  keyline: R("style", "Outline & shadow"),
  doubleline: R("style", "Outline & shadow"),
  extrude: R("style", "Outline & shadow"),
  longshadow: R("style", "Outline & shadow"),
  offset: R("style", "Outline & shadow"),
  stack: R("style", "Outline & shadow"),
  neontube: R("style", "Glow"),
  chrome: R("style", "Fill"),
  sticker: R("style", "Fill"),
  halftone: R("style", "Fill"),
  accent: R("style", "Fill"),
  ghost: R("style", "Copies"),
  reflection: R("style", "Copies"),
  cutshift: R("style", "Copies"),
  wordbox: R("style", "Plate"),
  plate: R("style", "Plate"),
  rules: R("overlay", "Frame"),
  tape: R("overlay", "Frame"),
  ticker: R("overlay", "Pattern"),
  burst: R("overlay", "Energy"),
};
const layoutFeels: Record<LayoutKind, string> = {
  slamstack: "Stack",
  keyword: "Emphasis",
  steps: "Emphasis",
  giant: "Emphasis",
  swap: "Sequence",
  typeslam: "Sequence",
  flowsnap: "Sequence",
  bandhide: "Sequence",
  seesaw: "Path",
  arc: "Path",
};
const overlayFeels = (kind: OverlayKind) => overlaySpecs[kind].feel;
/** Pass and channel recipes, by built-in card ID. */
const cardRoles: Record<string, RoleInfo> = {
  "barn-doors": R("between", "Wipe"),
  "blinds-reveal": R("between", "Wipe"),
  "clock-wipe": R("between", "Wipe"),
  "feathered-wipe": R("between", "Wipe"),
  "luma-wipe": R("between", "Wipe"),
  "memory-panel": R("between", "Wipe"),
  "cell-reveal": R("between", "Shape"),
  "shape-iris": R("between", "Shape"),
  "memory-iris": R("between", "Shape"),
  "gooey-morph": R("between", "Dissolve"),
  "noise-dissolve": R("between", "Dissolve"),
  "memory-fade": R("between", "Dissolve"),
  "motion-smear": R("between", "Dissolve"),
  "color-flash": R("between", "Flash"),
  "memory-shatter": R("out", "Break"),
  "exit-crossout": R("out", "Conceal"),
  "memory-type": R("in", "Arrive"),
  "memory-impact": R("in", "Arrive"),
  "memory-whip": R("in", "Arrive"),
  "spring-motion": R("in", "Arrive"),
  "card-3d": R("in", "Arrive"),
  "memory-focus": R("in", "Reveal"),
  "camera-zoom": R("throughout", "Camera"),
  "depth-motion": R("throughout", "Camera"),
  "memory-jitter": R("throughout", "Camera"),
  "memory-pan": R("throughout", "Camera"),
  "memory-perspective": R("throughout", "Camera"),
  "memory-roll": R("throughout", "Camera"),
  drift: R("throughout", "Drift"),
  "lens-bulge": R("throughout", "Drift"),
  pulse: R("throughout", "Pulse"),
  "bevel-emboss": R("style", "Material"),
  "solid-extrusion": R("style", "Material"),
  "floor-reflection": R("style", "Material"),
  "holo-card": R("style", "Material"),
  "energy-edge": R("style", "Glow"),
  "color-silhouette": R("style", "Fill"),
  "memory-echo": R("style", "Copies"),
  "image-repetition": R("style", "Copies"),
  "graphic-rings": R("overlay", "Pattern"),
  "memory-hex": R("overlay", "Pattern"),
  "memory-flecks": R("overlay", "Energy"),
  "color-grade": R("finish", "Grade"),
  "color-remap": R("finish", "Grade"),
  "cel-tones": R("finish", "Illustration"),
  "memory-bloom": R("finish", "Light"),
  "memory-vignette": R("finish", "Light"),
  "scene-light": R("finish", "Light"),
  "light-sweep": R("finish", "Light"),
  "memory-grain": R("finish", "Texture"),
  "memory-hatch": R("finish", "Texture"),
  "old-film": R("finish", "Texture"),
  "liquid-warp": R("finish", "Texture"),
  ripple: R("finish", "Texture"),
  "tilt-shift": R("finish", "Texture"),
  "memory-crt": R("finish", "Signal"),
  "memory-rgb": R("finish", "Signal"),
  "memory-signal-tear": R("finish", "Signal"),
  "comic-ink": R("finish", "Illustration"),
  "line-boil": R("finish", "Illustration"),
  "paper-cutout": R("finish", "Illustration"),
  "pixel-art": R("finish", "Illustration"),
  "memory-letterbox": R("finish", "Matte"),
};

/** Entrances that play backwards as exits (`motion.direction: "out"`). */
export function isReversibleEntrance(effect: Effect) {
  const text = effect.text;
  if (!text || text.motion?.direction === "out") return false;
  if (isKineticKind(text.kind)) return kineticRole(text.kind) === "enter";
  if (isTitleKind(text.kind))
    return (
      !!titleControls[text.kind].entrance && titleRoles[text.kind].role === "in"
    );
  return text.kind === "stagger";
}
/** The exit counterpart of an entrance name: "Hop in" → "Hop out". */
export function exitName(name: string) {
  const swaps: [RegExp, string][] = [
    [/ in$/i, " out"],
    [/ on$/i, " off"],
    [/ open$/i, " shut"],
    [/ reveal$/i, " hide"],
    [/ draw$/i, " erase"],
    [/ unroll$/i, " roll-up"],
    [/ fill$/i, " drain"],
  ];
  for (const [from, to] of swaps)
    if (from.test(name)) return name.replace(from, to);
  return `${name} out`;
}

/** Role and feel of any effect: built-in table first, then its recipe. */
export function effectRole(effect: Effect): RoleInfo {
  const known =
    cardRoles[effect.id] ??
    (effect.presetFamilyId ? cardRoles[effect.presetFamilyId] : undefined);
  if (known) return known;
  if (effect.overlay) return R("overlay", overlayFeels(effect.overlay.kind));
  const text = effect.text;
  if (text) {
    const out = text.motion?.direction === "out";
    const swap = (info: RoleInfo) =>
      out && info.role === "in"
        ? R("out", exitFeel[info.feel] ?? "Conceal")
        : info;
    if (isLayoutKind(text.kind)) return R("arrange", layoutFeels[text.kind]);
    if (isLookKind(text.kind)) return lookRoles[text.kind];
    if (isKineticKind(text.kind)) {
      const role = kineticRole(text.kind);
      const feel = kineticFeels[text.kind];
      return role === "hold"
        ? R("throughout", feel)
        : role === "exit"
          ? R("out", feel)
          : swap(R("in", feel));
    }
    if (isTitleKind(text.kind)) return swap(titleRoles[text.kind]);
    switch (text.kind) {
      case "typewriter":
      case "scramble":
        return R("in", "Type on");
      case "stagger":
        return swap(R("in", "Arrive"));
      case "wave":
        return R("throughout", "Drift");
      case "gradient":
        return R("style", "Fill");
      case "neon":
        return R("style", "Glow");
      case "glitch":
        return text.glitch?.timing === "entrance"
          ? R("in", "Type on")
          : text.glitch?.timing === "exit"
            ? R("out", "Type off")
            : R("throughout", "Signal");
    }
  }
  const art = effect.art;
  if (art) {
    if (isCameraArt(art.kind))
      return R(
        "throughout",
        art.kind === "drift"
          ? "Camera"
          : art.kind === "stutter"
            ? "Signal"
            : "Pulse",
      );
    if (art.kind === "trail") return R("throughout", "Drift");
    return art.timing === "in"
      ? R("in", "Build")
      : art.timing === "out"
        ? R("out", "Break")
        : R("throughout", "Signal");
  }
  // A riso print grows its dots in, prints them away, or stays a print.
  const riso = effect.passes?.find((p) => p.kind === "riso");
  if (riso)
    return riso.timing === "in"
      ? R("in", "Reveal")
      : riso.timing === "out"
        ? R("out", "Conceal")
        : R("finish", "Illustration");
  // Custom pass and channel recipes: transitions by timing, else a finish.
  const timed = effect.passes?.find(
    (p) => p.timing === "in" || p.timing === "out",
  );
  if (timed) return R("between", "Wipe");
  if (effect.passes?.length) return R("finish", "Texture");
  if (effect.depth) return R("throughout", "Camera");
  if (effect.channels.some((c) => c.seconds !== undefined && c.align === "end"))
    return R("out", "Depart");
  if (effect.channels.some((c) => c.seconds !== undefined))
    return R("in", "Arrive");
  return R("throughout", "Drift");
}

export type EffectTarget = "text" | "picture" | "any";
/** What an effect can be applied to. */
export function effectTarget(effect: Effect): EffectTarget {
  if (effect.text) return "text";
  if (effect.art && !isCameraArt(effect.art.kind)) return "picture";
  return "any";
}
export const targetNames: Record<EffectTarget, string> = {
  text: "Text",
  picture: "Images, video, shapes and backdrops",
  any: "Any element",
};
/** Whether an effect fits an element type; null if it fits. */
export function targetMismatch(effect: Effect, type: string) {
  const target = effectTarget(effect);
  if (type === "audio") return "Effects apply to visual elements.";
  if (target === "text" && type !== "title") return "Applies to text only.";
  if (target === "picture" && type === "title")
    return "Applies to images, video, shapes and backdrops.";
  return null;
}
