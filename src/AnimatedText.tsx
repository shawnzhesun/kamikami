import React from "react";
import type { Layer, Effect } from "./model";
import {
  activeTextEffects,
  mixTextColor,
  scrambledText,
  textEffectTime,
  textUnitFrame,
  textUnits,
} from "./text-effects";

/** A shared, frame-derived text renderer for the composition and library previews. */
export function AnimatedText({
  layer,
  effects,
  time,
}: {
  layer: Layer;
  effects: Effect[];
  time: number;
}) {
  const active = activeTextEffects(layer, effects);
  if (!active.length) return <>{layer.text}</>;
  const t = textEffectTime(layer, time);
  const duration = layer.effectDuration || layer.duration;
  const style: React.CSSProperties = {
    display: "inline-block",
    whiteSpace: "inherit",
  };
  const paint: React.CSSProperties = {};
  let baseColor = layer.color;
  for (const { effect, amount } of active) {
    if (effect.kind === "gradient") {
      const a = mixTextColor(baseColor, effect.color, amount),
        b = mixTextColor(baseColor, effect.secondary, amount);
      paint.backgroundImage = `linear-gradient(90deg, ${a}, ${b}, ${a})`;
      paint.backgroundSize = "200% 100%";
      paint.backgroundPosition = `${50 + 50 * Math.sin(t * effect.speed * Math.PI)}% 50%`;
      paint.backgroundClip = "text";
      paint.WebkitBackgroundClip = "text";
      paint.color = "transparent";
      paint.textShadow = "none";
    }
    if (effect.kind === "neon") {
      const flicker =
        0.75 + 0.25 * Math.sin(t * effect.speed * Math.PI * 2) ** 2;
      const glow = (0.05 + effect.distance * 0.45) * amount * flicker;
      baseColor = mixTextColor(baseColor, effect.color, amount);
      if (paint.color !== "transparent") paint.color = baseColor;
      paint.textShadow = `0 0 ${glow * 0.25}em ${effect.color}, 0 0 ${glow}em ${effect.color}, 0 0 ${glow * 2}em ${effect.secondary}`;
    }
  }
  // Combine motion per grapheme while keeping the original layout for scrambles.
  const motion = active.filter(
    ({ effect }) => !["gradient", "neon"].includes(effect.kind),
  );
  if (!motion.length)
    return <span style={{ ...style, ...paint }}>{layer.text}</span>;
  // Word timing maps back to graphemes so multiple operations share a stable layout.
  const units = textUnits(layer.text, "character");
  const words = textUnits(layer.text, "word");
  const wordIndices: number[] = [];
  let wordCount = 0;
  for (const word of words) {
    const index = wordCount;
    if (!/^\s+$/u.test(word)) wordCount++;
    for (const _ of textUnits(word, "character")) wordIndices.push(index);
  }
  const charCount = units.filter((unit) => !/^\s+$/u.test(unit)).length;
  let charIndex = 0;
  return (
    <span style={style} aria-label={layer.text} data-animated-text="run">
      {units.map((unit, index) => {
        const whitespace = /^\s+$/u.test(unit);
        const position = charIndex;
        if (!whitespace) charIndex++;
        let opacity = 1,
          y = 0,
          rotateX = 0,
          scale = 1,
          replacement: string | null = null,
          scrambleAmount = 0;
        let cursor: "before" | "after" | undefined;
        for (const { effect, amount } of motion) {
          const count = effect.unit === "word" ? wordCount : charCount;
          const i = effect.unit === "word" ? wordIndices[index] : position;
          const frame = textUnitFrame(effect, t, i, count, duration, amount);
          if (!whitespace) {
            opacity *= frame.opacity;
            y += frame.y;
            rotateX += frame.rotateX;
            scale *= frame.scale;
            if (frame.scramble) {
              replacement = scrambledText(
                unit,
                effect.seed,
                index,
                t,
                effect.speed,
              );
              scrambleAmount = amount;
            }
            if (
              effect.kind === "typewriter" &&
              effect.cursor &&
              frame.progress < 1 &&
              Math.floor(t * 2) % 2 === 0
            ) {
              const revealed = Math.floor(frame.progress * count);
              if (revealed === 0 && position === 0) cursor = "before";
              if (
                revealed > 0 &&
                i === revealed - 1 &&
                (index === units.length - 1 ||
                  effect.unit === "character" ||
                  wordIndices[index + 1] !== i)
              )
                cursor = "after";
            }
          }
        }
        // Paint each text leaf, not its transformed ancestor. Chromium can omit
        // descendant glyphs from an ancestor's background-clip:text mask.
        const glyphPaint: React.CSSProperties = { ...paint };
        if (paint.backgroundImage) {
          glyphPaint.backgroundSize = `${Math.max(2, charCount * 2) * 100}% 100%`;
          const gradient = active
            .filter(({ effect }) => effect.kind === "gradient")
            .at(-1)!.effect;
          glyphPaint.backgroundPosition = `${25 + 50 * (charCount > 1 ? position / (charCount - 1) : 0.5) + 25 * Math.sin(t * gradient.speed * Math.PI)}% 50%`;
        }
        return (
          <span
            key={index}
            aria-hidden="true"
            style={{
              display: whitespace ? "inline" : "inline-block",
              position: "relative",
              transform:
                whitespace || (y === 0 && rotateX === 0 && scale === 1)
                  ? undefined
                  : `${rotateX ? `perspective(8em) rotateX(${rotateX}deg) ` : ""}translateY(${y}em) scale(${scale})`,
              transformOrigin: "50% 70%",
            }}
          >
            <span
              data-text-fill
              style={{ ...glyphPaint, opacity: opacity * (1 - scrambleAmount) }}
            >
              {unit}
            </span>
            {replacement !== null && (
              <span
                data-text-fill
                style={{
                  ...glyphPaint,
                  position: "absolute",
                  left: 0,
                  top: 0,
                  opacity: opacity * scrambleAmount,
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {replacement}
              </span>
            )}
            {cursor && (
              <span
                style={{
                  position: "absolute",
                  left: cursor === "before" ? 0 : "100%",
                  top: "5%",
                  width: "0.045em",
                  height: "0.9em",
                  background: layer.color,
                }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
