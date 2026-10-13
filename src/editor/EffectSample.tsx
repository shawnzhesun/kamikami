import { AnimatedText } from "../AnimatedText";
import { isTitleKind } from "../title-effects";
import { isKineticKind, kineticRole } from "../kinetic-type";
import { isLookKind } from "../text-looks";
import { isLayoutKind } from "../text-layouts";
import React from "react";
import { GraphicEffects } from "../GraphicEffects";
import { layerAtTime, makeLayer, type Effect } from "../model";
import { isFrameArt } from "../artwork";
import { effectRole } from "../effect-roles";
import { phaseSeconds } from "./envelope";
import { overlaySpecs, type Overlay, type OverlayKind } from "../overlays";
import { ArtworkStack } from "../ArtworkLayer";

const sample = { ...makeLayer("scene", "Preview"), duration: 6 };
export const SAMPLE_TEXT = "Your story\nstarts here";
/**
 * Where a hover preview starts its loop: exits loop over the end of the
 * six-second sample so they play right away instead of after a long wait.
 */
/** Thumbnails are a tenth of the frame: thicken picture marks so they read. */
const previewOverlay = (o: Overlay): Overlay => ({
  ...o,
  weight: Math.min(5, o.weight * 3),
  size: Math.min(5, o.size * 1.5),
  pad: Math.min(10, o.pad * 1.5),
});
export function previewStart(effect: Effect) {
  if (effectRole(effect).role !== "out") return 0;
  const seconds = phaseSeconds(effect) ?? 1.5;
  return Math.max(0, 6 - Math.min(6, seconds + 1.2));
}
/** Overlays previewed around a word; the rest frame a small picture. */
const textOverlay = (kind: OverlayKind) => !!overlaySpecs[kind].text;
export function effectPosterTime(effect: Effect) {
  if (effect.text?.kind === "glitch") return 0.04;
  // Layouts read best once arranged; swaps mid-sequence; holds after a beat.
  if (effect.text && isLayoutKind(effect.text.kind)) {
    const k = effect.text.kind;
    if (k === "swap") return (60 / (effect.text.tempo ?? 120)) * 1.3;
    if (k === "seesaw") return 1.1;
    if (k === "typeslam") return effect.text.seconds * 0.7;
    if (k === "bandhide") return effect.text.seconds * 0.6;
    return Math.min(6, effect.text.seconds + 0.4);
  }
  // Overlays once drawn; marks that land at the clip end just after they land.
  const overlay = effect.overlay;
  if (overlay)
    return overlay.timing === "out"
      ? 6 - Math.min(3, overlay.seconds) * 0.2
      : Math.min(3, Math.max(1.2, overlay.seconds + 0.25));
  // Artwork: beat kinds just after a beat, slides mid-move.
  const art = effect.art;
  if (art) {
    if (art.kind === "strobe") return 0.02;
    if (art.kind === "slices" && art.timing !== "beat")
      return art.timing === "in"
        ? Math.min(6, art.seconds) * 0.3
        : art.timing === "out"
          ? 6 - Math.min(6, art.seconds) * 0.6
          : 1.5;
    if (["punch", "jolt", "slices"].includes(art.kind))
      return 60 / art.tempo + 0.03;
    return 1.5;
  }
  // Looks read best once their decorations have drawn in.
  if (effect.text && isLookKind(effect.text.kind))
    return Math.min(6, Math.max(1.2, effect.text.seconds + 0.2));
  // Kinetic entrances read best mid-move; exits mid-exit; holds after a beat.
  if (effect.text && isKineticKind(effect.text.kind)) {
    const role = kineticRole(effect.text.kind);
    const seconds = Math.min(6, effect.text.seconds);
    // The sample is one word: word and title units move alone, so sample them early.
    const into =
      effect.text.unit === "character"
        ? role === "exit"
          ? 0.25
          : 0.5
        : Math.max(0.15, (1 - effect.text.stagger) * 0.4);
    return role === "hold"
      ? 1.35
      : role === "exit" || effect.text.motion?.direction === "out"
        ? Math.max(0, 6 - seconds * (1 - into))
        : seconds * into;
  }
  // Title-pack looks read best mid-entrance (exits: mid-exit); circles show their ring.
  if (effect.text && isTitleKind(effect.text.kind))
    return effect.text.kind === "circle"
      ? 0
      : ["rotate", "morph"].includes(effect.text.kind)
        ? 2.15
        : effect.text.kind === "typeloop"
          ? 0.6
          : effect.text.motion?.direction === "out"
            ? Math.max(0, 6 - Math.min(6, effect.text.seconds) * 0.5)
            : Math.min(6, effect.text.seconds) * 0.45;
  if (effect.depth) return effect.depth.seconds * 0.35;
  if (
    effect.text &&
    ["typewriter", "scramble", "stagger"].includes(effect.text.kind)
  )
    return effect.text.motion?.direction === "out"
      ? Math.max(0, 6 - Math.min(6, effect.text.seconds) * 0.5)
      : Math.min(6, effect.text.seconds);
  // Span-timed channels (spring and 3D card moves) read best mid-move.
  const span = effect.channels.find((c) => c.seconds !== undefined);
  if (span && !effect.passes?.length)
    return span.align === "end"
      ? Math.max(0, 6 - Math.min(6, span.seconds!) * 0.5)
      : Math.min(6, span.seconds!) * 0.35;
  const transition = effect.passes?.find(
    (p) => p.timing === "in" || p.timing === "out",
  );
  // Clamp into the six-second preview loop for long transitions.
  if (transition)
    return Math.max(
      0,
      Math.min(
        6,
        transition.timing === "out"
          ? 6 - Math.min(6, transition.seconds) / 2
          : Math.min(6, transition.seconds) / 2,
      ),
    );
  // A pulse envelope is zero at many fixed times; t = 0 is always its peak.
  return effect.passes?.some((p) => p.timing === "pulse") ? 0 : 1.5;
}

export function isTextEffectPreview(effect: Effect) {
  return (
    !!effect.text ||
    (!!effect.overlay && textOverlay(effect.overlay.kind)) ||
    !!effect.passes?.some(
      (pass) => pass.field && pass.field.unit !== "whole",
    ) ||
    effect.channels.some((channel) => channel.property === "letterSpacing") ||
    !!effect.passes?.some((pass) => pass.kind === "shatter")
  );
}

/** Uses the composition's curve and graphics pipeline at thumbnail resolution. */
export function EffectSample({
  effect,
  time,
}: {
  effect: Effect;
  time: number;
}) {
  const title = isTextEffectPreview(effect);
  // One phrase for every text preview; counters still need digits to count.
  const sampleText = ["count", "odometer"].includes(effect.text?.kind ?? "")
    ? "1,250"
    : effect.text?.kind === "circle"
      ? "YOUR STORY STARTS HERE · "
      : SAMPLE_TEXT;
  const fontSize = effect.text?.kind === "circle" ? 9 : 22;
  const layer = {
    ...sample,
    type: title ? ("title" as const) : ("scene" as const),
    text: sampleText,
    fontSize,
    color: "#fff7e9",
    effects: [{ effectId: effect.id, amount: 1, enabled: true }],
  };
  const art = effect.art && isFrameArt(effect.art.kind) ? effect.art : null;
  // Picture overlays need room around a smaller print; copies read on a cutout.
  const framedPrint = !!effect.overlay && !title;
  const cutout =
    art?.kind === "trail" ||
    effect.passes?.some((p) =>
      // Alpha-aware passes read best on isolated artwork.
      [
        "silhouette",
        "echo",
        "paper",
        "extrude",
        "bevel",
        "glow",
        "goo",
      ].includes(p.kind),
    );
  const frameStyle = (at: number): React.CSSProperties => {
    const v = layerAtTime(layer, [effect], at);
    return {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: `translate(${(v.x * 180) / 1920}px,${(v.y * 96) / 1080}px) rotate(${v.rotation}deg) scale(${v.scale}) perspective(${(v.perspective * 180) / 1920}px) rotateX(${v.rotateX}deg) rotateY(${v.rotateY}deg) scale(${v.scaleX},${v.scaleY}) skewX(${v.skewX}deg)`,
      opacity: v.opacity,
      transformOrigin: `${50 + v.originX * 50}% ${50 + v.originY * 50}%`,
      filter: `brightness(${v.brightness}) contrast(${v.contrast}) saturate(${v.saturation}) blur(${(v.blur * 180) / 1920}px)${v.invert ? ` invert(${v.invert})` : ""}`,
    };
  };
  const content = (at: number) => {
    const letterSpacing = layerAtTime(layer, [effect], at).letterSpacing;
    return (
      <GraphicEffects
        layer={layer}
        effects={[effect]}
        time={at}
        width={180}
        height={96}
      >
        {title ? (
          <span
            style={{
              color: "#fff7e9",
              font: `bold ${fontSize}px Georgia, serif`,
              letterSpacing: (letterSpacing * 180) / 1920,
              whiteSpace: "pre",
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            <AnimatedText
              layer={layer}
              effects={[effect]}
              time={at}
              stage={{ width: 1920, height: 1080 }}
            />
          </span>
        ) : (
          <svg
            viewBox="0 0 180 96"
            width={framedPrint ? 104 : 180}
            height={framedPrint ? 56 : 96}
          >
            {cutout ? (
              <g>
                <circle cx="85" cy="24" r="13" fill="#f8dab8" />
                <path d="M73 38 Q85 32 97 38L105 68H65Z" fill="#f2765e" />
                <path d="m73 65-5 29h11l6-23 8 23h11L97 65Z" fill="#d5e2df" />
                <path
                  d="M75 37 52 57l5 7 26-18M94 38l20 16-5 8-22-16"
                  fill="#f2765e"
                />
              </g>
            ) : (
              <>
                <rect width="180" height="96" fill="#315b8c" />
                <circle cx="137" cy="27" r="16" fill="#ffc89b" />
                <path
                  d="M0 96 54 23 107 96M65 96 118 47 180 96"
                  fill="#f5ebdd"
                />
                <path d="m34 51 20-28 21 29-21-8Z" fill="#f2765e" />
                <path d="M0 83h180v13H0Z" fill="#182e39" />
              </>
            )}
          </svg>
        )}
        {!title && effect.tint > 0 && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: effect.color,
              opacity: effect.tint,
              mixBlendMode: "screen",
            }}
          />
        )}
      </GraphicEffects>
    );
  };
  return (
    <svg
      viewBox="0 0 180 96"
      width="180"
      height="96"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <foreignObject width="180" height="96">
        <div style={{ position: "relative", width: 180, height: 96 }}>
          {art || framedPrint ? (
            <ArtworkStack
              id={`sample-${effect.id}`}
              uses={art ? [{ art, amount: 1 }] : []}
              overlays={
                framedPrint
                  ? [{ overlay: previewOverlay(effect.overlay!), amount: 1 }]
                  : []
              }
              t={time}
              time={time}
              projectTime={time}
              duration={sample.duration}
              width={180}
              height={96}
              box={
                framedPrint
                  ? { width: 104, height: 56 }
                  : { width: 180, height: 96 }
              }
              start={8.5}
              peers={[[-74, -30]]}
              frameStyle={frameStyle}
              content={content}
            />
          ) : (
            <div style={frameStyle(time)}>{content(time)}</div>
          )}
        </div>
      </foreignObject>
    </svg>
  );
}
