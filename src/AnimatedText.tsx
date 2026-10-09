import React, { useId } from "react";
import type { Layer, Effect } from "./model";
import type { TextEffect } from "./text-effects";
import { instanceAmountAt, resolveEffectInstanceAt } from "./effect-instance";
import { fieldFrames } from "./motion";
import { visualFrame } from "./visual-effects";
import {
  activeTextEffects,
  mixTextColor,
  scrambledText,
  textEffectTime,
  textUnitFrame,
  textUnits,
} from "./text-effects";
import {
  circleLayout,
  countedText,
  isSequenceKind,
  isTitleKind,
  mixHex,
  odometerRolls,
  retypeText,
  sequenceLines,
  sequenceStep,
  typeLoopText,
  neutralTitleFrame,
  slotStrip,
  titleUnitFrame,
} from "./title-effects";

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
  const animation = Math.max(0, time + layer.effectOffset);
  const fieldInstance = layer.effects.find(
    (instance) =>
      instance.enabled &&
      instanceAmountAt(instance, animation) > 0 &&
      resolveEffectInstanceAt(instance, effects, animation)?.passes?.some(
        (pass) =>
          pass.kind === "repeat" && pass.field && pass.field.unit !== "whole",
      ),
  );
  const pass =
    fieldInstance &&
    resolveEffectInstanceAt(fieldInstance, effects, animation)?.passes?.find(
      (pass) =>
        pass.kind === "repeat" && pass.field && pass.field.unit !== "whole",
    );
  if (pass?.field && fieldInstance) {
    const parts = textUnits(
      layer.text,
      pass.field.unit === "word" ? "word" : "character",
    ).filter((v) => !/^\s+$/u.test(v));
    const { strength, time: fieldTime } = visualFrame(
      pass,
      animation,
      layer.effectDuration || layer.duration,
      instanceAmountAt(fieldInstance, animation),
    );
    return (
      <span
        style={{ position: "relative", display: "inline-block" }}
        aria-label={layer.text}
      >
        <span style={{ opacity: 1 - strength }}>
          <TextRun layer={layer} effects={effects} time={time} />
        </span>
        <span aria-hidden="true">
          {fieldFrames(pass.field, fieldTime, pass.seed).map((frame) => (
            <span
              key={frame.id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                whiteSpace: "nowrap",
                opacity: frame.opacity * strength,
                transform: `translate(-50%,-50%) translate(${frame.x * 8}em,${frame.y * 5}em) scale(${frame.scale}) rotate(${frame.rotation}deg) perspective(20em) rotateY(${frame.tilt}deg)`,
                filter: `blur(${frame.blur / 32}em)`,
              }}
            >
              <TextRun
                layer={{
                  ...layer,
                  text: parts[frame.id % Math.max(1, parts.length)] ?? "",
                }}
                effects={effects}
                time={time}
              />
            </span>
          ))}
        </span>
      </span>
    );
  }
  return <TextRun layer={layer} effects={effects} time={time} />;
}

function TextRun({
  layer,
  effects,
  time,
}: {
  layer: Layer;
  effects: Effect[];
  time: number;
}) {
  const active = activeTextEffects(layer, effects, time);
  const gooId = `goo-${useId().replace(/:/g, "")}`;
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
      // Keep a glow set by an earlier neon effect.
      paint.textShadow ??= "none";
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
  const counter = active.find(({ effect }) => effect.kind === "count");
  const sequence = active.find(({ effect }) => isSequenceKind(effect.kind));
  // Rotators and morphs stack every line in one grid cell, so the layout never jumps.
  if (sequence && ["rotate", "morph"].includes(sequence.effect.kind))
    return (
      <SequenceText
        layer={layer}
        effect={sequence.effect}
        amount={sequence.amount}
        time={t}
        duration={duration}
        paint={paint}
        filterId={gooId}
      />
    );
  const typeLoop =
    sequence?.effect.kind === "typeloop"
      ? typeLoopText(layer.text, sequence.effect, t, duration)
      : null;
  let text = counter
    ? countedText(layer.text, counter.effect, t, duration)
    : layer.text;
  if (sequence?.effect.kind === "retype")
    text = retypeText(layer.text, sequence.effect, t, duration).text;
  if (typeLoop) text = typeLoop.text;
  const odometer = active.find(({ effect }) => effect.kind === "odometer");
  const rolls = odometer
    ? odometerRolls(text, odometer.effect, t, duration)
    : null;
  const caret =
    typeLoop &&
    sequence!.effect.cursor &&
    (typeLoop.typing || Math.floor(t * 2) % 2 === 0) ? (
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "0.06em",
          height: "0.9em",
          marginLeft: "0.04em",
          verticalAlign: "-0.1em",
          background: layer.color,
        }}
      />
    ) : null;
  if (!motion.length) return <span style={{ ...style, ...paint }}>{text}</span>;
  // Word timing maps back to graphemes so multiple operations share a stable layout.
  const units = textUnits(text, "character");
  const words = textUnits(text, "word");
  const wordIndices: number[] = [];
  let wordCount = 0;
  for (const word of words) {
    const index = wordCount;
    if (!/^\s+$/u.test(word)) wordCount++;
    for (const _ of textUnits(word, "character")) wordIndices.push(index);
  }
  const charCount = units.filter((unit) => !/^\s+$/u.test(unit)).length;
  // Position of each grapheme inside its word, for word-wide horizontal masks.
  const inWord: number[] = [];
  const wordLength = new Map<number, number>();
  units.forEach((unit, index) => {
    const w = wordIndices[index];
    const k = /^\s+$/u.test(unit) ? 0 : (wordLength.get(w) ?? 0);
    inWord.push(k);
    if (!/^\s+$/u.test(unit)) wordLength.set(w, k + 1);
  });
  const circle = active.find(({ effect }) => effect.kind === "circle")?.effect;
  const ring = circle ? circleLayout(circle, units.length, t) : null;
  const px = layer.fontSize;
  const flapBoard = active.some(({ effect }) => effect.kind === "flap");
  const bubbleBoard = active.some(({ effect }) => effect.kind === "bubbles");
  let charIndex = 0;
  return (
    <span
      style={
        ring
          ? {
              ...style,
              position: "relative",
              width: `${ring.radius * 2 + 1}em`,
              height: `${ring.radius * 2 + 1}em`,
            }
          : style
      }
      aria-label={layer.text}
      data-animated-text="run"
    >
      {units.map((unit, index) => {
        const whitespace = /^\s+$/u.test(unit);
        const position = charIndex;
        if (!whitespace) charIndex++;
        let opacity = 1,
          x = 0,
          y = 0,
          rotation = 0,
          rgb = 0,
          slice = 0,
          rotateX = 0,
          scale = 1,
          replacement: string | null = null,
          scrambleAmount = 0;
        let cursor: "before" | "after" | undefined;
        // Title-pack layers: masks, boxes, outlines, strokes and reels.
        const title = neutralTitleFrame();
        let boxColor = "",
          boxShade = "",
          rollColor = "",
          lineColor = "",
          echoColor = "",
          drawColor = "",
          echoSpread = 0.6,
          splitDistance = 0.6,
          slotSeed = 0;
        for (const { effect, amount } of motion) {
          const count =
            effect.unit === "title"
              ? 1
              : effect.unit === "word"
                ? wordCount
                : charCount;
          const i =
            effect.unit === "title"
              ? 0
              : effect.unit === "word"
                ? wordIndices[index]
                : position;
          if (isTitleKind(effect.kind)) {
            // Box and line decorations sweep across spaces too.
            const f = titleUnitFrame(effect, t, i, count, duration, amount);
            if (f.box && !(whitespace && f.box.shape === "circle")) {
              title.box = f.box;
              boxColor =
                effect.kind === "flap" ? effect.secondary : effect.color;
              boxShade = effect.secondary;
            }
            if (f.line !== null) {
              title.line = f.line;
              lineColor = effect.color;
            }
            if (whitespace) continue;
            title.opacity *= f.opacity;
            title.x += f.x;
            title.y += f.y;
            title.scale *= f.scale;
            title.scaleX *= f.scaleX;
            title.scaleY *= f.scaleY;
            title.skewX += f.skewX;
            title.rotateY += f.rotateY;
            title.blur += f.blur;
            title.maskX += f.maskX;
            title.maskY += f.maskY;
            if (f.slot !== null) {
              title.slot = Math.max(title.slot ?? 0, f.slot);
              slotSeed = effect.seed;
            }
            title.outline = Math.max(title.outline, f.outline);
            if (f.echo > title.echo) {
              title.echo = f.echo;
              echoColor = effect.color;
              echoSpread = effect.distance;
            }
            if (f.split > title.split) {
              title.split = f.split;
              splitDistance = effect.distance;
            }
            if (f.sweep) {
              const length =
                effect.unit === "character"
                  ? 1
                  : (wordLength.get(wordIndices[index]) ?? 1);
              const k = effect.unit === "character" ? 0 : inWord[index];
              const order = f.sweep.from === "left" ? k : length - 1 - k;
              const reveal = Math.max(
                0,
                Math.min(1, f.sweep.progress * length - order),
              );
              title.sweep = {
                progress: Math.min(title.sweep?.progress ?? 1, reveal),
                from: f.sweep.from,
              };
            }
            if (f.draw !== null) {
              title.draw = Math.min(title.draw ?? 1, f.draw);
              drawColor = effect.color;
            }
            if (f.tint) title.tint = f.tint;
            if (f.flap) title.flap = f.flap;
            if (f.roll !== null) {
              title.roll = f.roll;
              rollColor = effect.color;
            }
            continue;
          }
          const frame = textUnitFrame(effect, t, i, count, duration, amount);
          if (!whitespace) {
            opacity *= frame.opacity;
            y += frame.y;
            x += frame.x;
            rotation += frame.rotation;
            rgb = Math.max(rgb, frame.rgb);
            slice += frame.slice;
            rotateX += frame.rotateX;
            scale *= frame.scale;
            if (frame.scramble) {
              replacement = scrambledText(
                unit,
                effect.seed,
                index,
                t,
                effect.speed,
                effect.glitch?.alphabet,
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
        opacity *= title.opacity;
        x += title.x;
        y += title.y;
        scale *= title.scale;
        // Paint each text leaf, not its transformed ancestor. Chromium can omit
        // descendant glyphs from an ancestor's background-clip:text mask.
        const glyphPaint: React.CSSProperties = { ...paint };
        if (rgb)
          glyphPaint.textShadow = `${rgb}em 0 #ff365a, ${-rgb}em 0 #36d9ff${paint.textShadow && paint.textShadow !== "none" ? `, ${paint.textShadow}` : ""}`;
        if (paint.backgroundImage) {
          glyphPaint.backgroundSize = `${Math.max(2, charCount * 2) * 100}% 100%`;
          const gradient = active
            .filter(({ effect }) => effect.kind === "gradient")
            .at(-1)!.effect;
          glyphPaint.backgroundPosition = `${25 + 50 * (charCount > 1 ? position / (charCount - 1) : 0.5) + 25 * Math.sin(t * gradient.speed * Math.PI)}% 50%`;
        }
        if (title.blur > 0) glyphPaint.filter = `blur(${title.blur * px}px)`;
        if (title.tint && !paint.backgroundImage)
          glyphPaint.color = title.tint.color.startsWith("#")
            ? mixHex(
                String(paint.color ?? layer.color),
                title.tint.color,
                title.tint.amount,
              )
            : title.tint.amount > 0.5
              ? title.tint.color
              : String(paint.color ?? layer.color);
        const roll = rolls?.get(index);
        const fillOpacity =
          opacity *
          (1 - scrambleAmount) *
          (1 - title.outline) *
          (title.draw !== null ||
          title.flap ||
          title.roll !== null ||
          roll !== undefined
            ? 0
            : 1);
        const moved =
          x !== 0 ||
          y !== 0 ||
          rotation !== 0 ||
          rotateX !== 0 ||
          scale !== 1 ||
          title.rotateY !== 0 ||
          title.scaleX !== 1 ||
          title.scaleY !== 1 ||
          title.skewX !== 0;
        const transform = `${rotateX ? `perspective(8em) rotateX(${rotateX}deg) ` : ""}${title.rotateY ? `perspective(6em) rotateY(${title.rotateY}deg) ` : ""}translate(${x}em,${y}em) rotate(${rotation}deg) scale(${scale}) scale(${title.scaleX},${title.scaleY}) skewX(${title.skewX}deg)`;
        const placed = ring
          ? `translate(-50%,-50%) rotate(${ring.angle(index)}deg) translateY(${-ring.radius}em) `
          : "";
        const masked = title.maskX !== 0 || title.maskY !== 0;
        if (title.sweep && title.sweep.progress < 1) {
          const hidden = (1 - title.sweep.progress) * 100;
          glyphPaint.clipPath =
            title.sweep.from === "left"
              ? `inset(-0.3em ${hidden}% -0.3em -0.3em)`
              : `inset(-0.3em -0.3em -0.3em ${hidden}%)`;
          glyphPaint.display = "inline-block";
          glyphPaint.transform = `translateX(${(title.sweep.from === "left" ? -1 : 1) * (1 - title.sweep.progress) * 0.35}em)`;
        }
        const stroke = (color: string, width = 0.03) =>
          ({
            color: "transparent",
            WebkitTextStroke: `${width}em ${color}`,
            textShadow: "none",
          }) as React.CSSProperties;
        const fill = (
          <span
            data-text-fill
            style={{
              ...glyphPaint,
              position: "relative",
              opacity: fillOpacity,
              ...(slice
                ? {
                    clipPath:
                      "polygon(0 0,100% 0,100% 35%,0 35%,0 55%,100% 55%,100% 100%,0 100%)",
                  }
                : title.split
                  ? {
                      clipPath: "inset(0 0 50% 0)",
                      display: "inline-block",
                      transform: `translateX(${-title.split * (0.3 + splitDistance * 2)}em)`,
                    }
                  : {}),
            }}
          >
            {unit}
          </span>
        );
        const half = (
          glyph: string,
          top: boolean,
          extra: React.CSSProperties = {},
        ) => (
          <span
            data-text-fill
            style={{
              ...glyphPaint,
              position: "absolute",
              inset: 0,
              textAlign: "center",
              opacity,
              clipPath: top
                ? "inset(-0.1em -0.1em 50% -0.1em)"
                : "inset(50% -0.1em -0.1em -0.1em)",
              ...extra,
            }}
          >
            {glyph}
          </span>
        );
        const glyphs = (
          <>
            {fill}
            {title.flap && (
              <>
                {/* Board flap: new top and old bottom are static; a hinged flap covers the change. */}
                {half(title.flap.to, true)}
                {half(title.flap.from, false)}
                {title.flap.phase < 0.5
                  ? half(title.flap.from, true, {
                      transform: `perspective(3em) rotateX(${-title.flap.phase * 180}deg)`,
                      transformOrigin: "50% 50%",
                      filter: `brightness(${1 - title.flap.phase})`,
                    })
                  : half(title.flap.to, false, {
                      transform: `perspective(3em) rotateX(${(1 - title.flap.phase) * 180}deg)`,
                      transformOrigin: "50% 50%",
                      filter: `brightness(${0.5 + title.flap.phase / 2})`,
                    })}
              </>
            )}
            {title.roll !== null &&
              [0, 1].map((face) => (
                <span
                  key={face}
                  data-text-fill
                  style={{
                    ...glyphPaint,
                    ...(face === 0 ? { color: rollColor } : {}),
                    position: "absolute",
                    inset: 0,
                    textAlign: "center",
                    opacity,
                    backfaceVisibility: "hidden",
                    transformOrigin: "50% 50% -0.5em",
                    transform: `perspective(4em) rotateX(${face === 0 ? title.roll! * 90 : (title.roll! - 1) * 90}deg)`,
                  }}
                >
                  {unit}
                </span>
              ))}
            {roll !== undefined && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  clipPath: "inset(0)",
                  opacity,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    width: "100%",
                    textAlign: "center",
                    transform: `translateY(${-roll * 1.3}em)`,
                  }}
                >
                  {"01234567890".split("").map((digit, k) => (
                    <span
                      key={k}
                      data-text-fill
                      style={{
                        ...glyphPaint,
                        position: "absolute",
                        left: 0,
                        width: "100%",
                        top: `${k * 1.3}em`,
                      }}
                    >
                      {digit}
                    </span>
                  ))}
                </span>
              </span>
            )}
            {!!title.split && (
              <span
                data-text-fill
                style={{
                  ...glyphPaint,
                  position: "absolute",
                  inset: 0,
                  opacity: fillOpacity,
                  clipPath: "inset(50% 0 0 0)",
                  transform: `translateX(${title.split * (0.3 + splitDistance * 2)}em)`,
                }}
              >
                {unit}
              </span>
            )}
            {title.outline > 0 && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: opacity * title.outline,
                  ...stroke(layer.color),
                }}
              >
                {unit}
              </span>
            )}
            {title.draw !== null && (
              <svg
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  overflow: "visible",
                  opacity,
                }}
              >
                <text
                  x="50%"
                  y="0.86em"
                  textAnchor="middle"
                  fill={layer.color}
                  fillOpacity={Math.max(0, (title.draw - 0.55) / 0.45)}
                  stroke={drawColor}
                  strokeWidth={0.025 * px}
                  strokeDasharray={px * 3}
                  strokeDashoffset={px * 3 * (1 - title.draw)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {unit}
                </text>
              </svg>
            )}
            {title.slot !== null &&
              title.slot > 0 &&
              slotStrip(unit, slotSeed, index).map((glyph, k) => (
                <span
                  key={k}
                  data-text-fill
                  style={{
                    ...glyphPaint,
                    position: "absolute",
                    left: 0,
                    width: "100%",
                    textAlign: "center",
                    top: `${-(k + 1) * 1.3}em`,
                    opacity,
                  }}
                >
                  {glyph}
                </span>
              ))}
          </>
        );
        return (
          <span
            key={index}
            aria-hidden="true"
            style={{
              // Decorated spaces become boxes so highlights and lines stay continuous.
              display:
                (whitespace && !ring && !(title.box || title.line !== null)) ||
                unit === "\n"
                  ? "inline"
                  : "inline-block",
              position: ring ? "absolute" : "relative",
              ...(ring ? { left: "50%", top: "50%" } : {}),
              // Bubbles and board tiles need room so neighbors don't overlap.
              ...(!whitespace && bubbleBoard
                ? { margin: "0 0.15em" }
                : !whitespace && flapBoard
                  ? { margin: "0 0.06em" }
                  : {}),
              transform:
                (whitespace && !ring) || (!moved && !ring)
                  ? undefined
                  : placed + (moved ? transform : ""),
              transformOrigin: ring ? "50% 50%" : "50% 70%",
            }}
          >
            {title.box &&
              (title.box.shape === "circle" ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "52%",
                    width: "0.92em",
                    height: "0.92em",
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 30%, ${boxColor}, ${boxShade})`,
                    transform: "translate(-50%,-50%)",
                  }}
                />
              ) : flapBoard ? null : (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-0.04em",
                    right: "-0.04em",
                    top: "0.04em",
                    bottom: "-0.02em",
                    background: boxColor,
                    transform: `scaleX(${title.box.scale})`,
                    transformOrigin: title.box.origin,
                  }}
                />
              ))}
            {flapBoard && title.box && !whitespace && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-0.03em",
                  right: "-0.03em",
                  top: "-0.04em",
                  bottom: "-0.08em",
                  borderRadius: "0.08em",
                  background: `linear-gradient(${boxColor} 49%, #0008 49%, #0008 51%, ${boxColor} 51%)`,
                }}
              />
            )}
            {title.line !== null && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-0.02em",
                  right: "-0.02em",
                  top: "100%",
                  height: "0.07em",
                  background: lineColor,
                  transform: `scaleX(${title.line})`,
                  transformOrigin: "left",
                }}
              />
            )}
            {title.echo > 0 &&
              [-2, -1, 1, 2].map((k) => (
                <span
                  key={k}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity:
                      opacity * Math.sqrt(title.echo) * (1 - Math.abs(k) * 0.2),
                    transform: `translateY(${k * (0.5 + echoSpread * 0.8) * title.echo}em)`,
                    ...stroke(echoColor, 0.035),
                  }}
                >
                  {unit}
                </span>
              ))}
            {masked || (title.slot !== null && title.slot > 0) ? (
              // The clip stays put while the glyphs travel, like a mask in a title pack.
              <span
                style={{
                  display: "inline-block",
                  clipPath:
                    title.slot !== null && title.slot > 0
                      ? "inset(0 0)"
                      : "inset(-0.02em -0.3em -0.06em -0.3em)",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    position: "relative",
                    transform: `translate(${title.maskX}em,${title.maskY + (title.slot ?? 0) * 1.3 * 7}em)`,
                  }}
                >
                  {glyphs}
                </span>
              </span>
            ) : (
              glyphs
            )}
            {!!slice && (
              <span
                data-text-fill
                style={{
                  ...glyphPaint,
                  position: "absolute",
                  inset: 0,
                  opacity: opacity * (1 - scrambleAmount),
                  clipPath: "inset(35% 0 45% 0)",
                  transform: `translateX(${slice}em)`,
                }}
              >
                {unit}
              </span>
            )}
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
      {caret}
    </span>
  );
}

/** Word rotator and gooey morph: every line shares one grid cell; the swap animates between them. */
function SequenceText({
  layer,
  effect,
  amount,
  time,
  duration,
  paint,
  filterId,
}: {
  layer: Layer;
  effect: TextEffect;
  amount: number;
  time: number;
  duration: number;
  paint: React.CSSProperties;
  filterId: string;
}) {
  const lines = sequenceLines(layer.text);
  if (!lines.length) return null;
  const step = sequenceStep(lines.length, effect, time, duration);
  const p = 1 - (1 - step.progress) * amount;
  const morph = effect.kind === "morph";
  const line = (text: string, state: "in" | "out" | "hidden", key: number) => {
    const units = textUnits(text, "character");
    return (
      <span
        key={key}
        aria-hidden={state !== "in"}
        style={{
          gridArea: "1 / 1",
          whiteSpace: "pre",
          visibility: state === "hidden" ? "hidden" : "visible",
          ...(morph
            ? {
                // Cross-blur both words; the threshold filter on the parent fuses them.
                filter: `blur(${Math.min(100, state === "in" ? 8 / Math.max(p, 0.01) - 8 : 8 / Math.max(1 - p, 0.01) - 8)}px)`,
                opacity:
                  state === "in" ? Math.pow(p, 0.4) : Math.pow(1 - p, 0.4),
              }
            : {}),
        }}
      >
        {morph ? (
          <span style={paint}>{text}</span>
        ) : (
          units.map((unit, i) => {
            const delay =
              units.length > 1 ? (i / (units.length - 1)) * effect.stagger : 0;
            const local = Math.max(
              0,
              Math.min(1, (p - delay) / Math.max(0.05, 1 - effect.stagger)),
            );
            const eased = 1 - Math.pow(1 - local, 3);
            const y = state === "in" ? (1 - eased) * 1.1 : -eased * 1.1;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  clipPath: "inset(-0.05em -0.2em -0.08em -0.2em)",
                }}
              >
                <span
                  style={{
                    ...paint,
                    display: "inline-block",
                    whiteSpace: "pre",
                    transform: `translateY(${y}em)`,
                  }}
                >
                  {unit}
                </span>
              </span>
            );
          })
        )}
      </span>
    );
  };
  return (
    <span
      aria-label={layer.text}
      style={{
        display: "inline-grid",
        justifyItems: "center",
        ...(morph ? { filter: `url(#${filterId})` } : {}),
      }}
    >
      {morph && (
        <svg
          width={0}
          height={0}
          style={{ position: "absolute" }}
          aria-hidden="true"
        >
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
            />
          </filter>
        </svg>
      )}
      {lines.map((text, i) =>
        line(
          text,
          i === step.index
            ? "in"
            : i === step.previous && p < 1
              ? "out"
              : "hidden",
          i,
        ),
      )}
    </span>
  );
}
