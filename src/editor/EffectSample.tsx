import React from "react";
import { GraphicEffects } from "../GraphicEffects";
import { layerAtTime, makeLayer, type Effect } from "../model";

const sample = { ...makeLayer("scene", "Preview"), duration: 6 };
export function effectPosterTime(effect: Effect) {
  const transition = effect.passes?.find(
    (p) => p.timing === "in" || p.timing === "out",
  );
  return transition
    ? transition.timing === "out"
      ? 6 - transition.seconds / 2
      : transition.seconds / 2
    : 1.5;
}

/** Uses the composition's curve and graphics pipeline at thumbnail resolution. */
export function EffectSample({
  effect,
  time,
}: {
  effect: Effect;
  time: number;
}) {
  const layer = {
    ...sample,
    effects: [{ effectId: effect.id, amount: 1, enabled: true }],
  };
  const v = layerAtTime(layer, [effect], time);
  const cutout = effect.passes?.some((p) =>
    ["silhouette", "echo"].includes(p.kind),
  );
  const title =
    effect.channels.some((c) => c.property === "letterSpacing") ||
    effect.passes?.some((p) => p.kind === "shatter");
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translate(${(v.x * 180) / 1920}px,${(v.y * 96) / 1080}px) rotate(${v.rotation}deg) scale(${v.scale}) perspective(169px) rotateY(${v.rotateY}deg)`,
              opacity: v.opacity,
              filter: `brightness(${v.brightness}) contrast(${v.contrast}) saturate(${v.saturation}) blur(${(v.blur * 180) / 1920}px)`,
            }}
          >
            <GraphicEffects
              layer={layer}
              effects={[effect]}
              time={time}
              width={180}
              height={96}
            >
              {title ? (
                <span
                  style={{
                    color: "#f9dfb0",
                    font: "bold 22px Georgia, serif",
                    letterSpacing: (v.letterSpacing * 180) / 1920,
                    whiteSpace: "nowrap",
                  }}
                >
                  MEMORY
                </span>
              ) : (
                <svg viewBox="0 0 180 96" width="180" height="96">
                  {cutout ? (
                    <g>
                      <circle cx="85" cy="24" r="13" fill="#f8dab8" />
                      <path d="M73 38 Q85 32 97 38L105 68H65Z" fill="#f2765e" />
                      <path
                        d="m73 65-5 29h11l6-23 8 23h11L97 65Z"
                        fill="#d5e2df"
                      />
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
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
