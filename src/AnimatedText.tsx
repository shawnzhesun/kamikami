import React, { createContext, useContext, useId } from "react";
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
  titleControls,
} from "./title-effects";
import {
  estimateWidth,
  holdEnvelope,
  isKineticKind,
  isNeutralKinetic,
  kineticFrame,
  kineticRole,
  mergeKinetic,
  neutralKineticFrame,
  textGeometry,
  type KineticCopy,
  type KineticEnv,
  type KineticFrame,
  type KineticMark,
  type Measure,
} from "./kinetic-type";
import {
  blockDecor,
  copyLooks,
  ghostCopies,
  lineHalves,
  isLookKind,
  keyWordIndex,
  lookGlyph,
  lookPaint,
  wordDecor,
  type LookDecor,
} from "./text-looks";
import { isLayoutKind, layoutFrames, layoutHolds } from "./text-layouts";
import { overlayStack } from "./overlays";
import { overlayPeers, overlayUses } from "./model";
import { OverlaySvg } from "./OverlayLayer";

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
function Decor({ items, behind }: { items: LookDecor[]; behind: boolean }) {
  return (
    <>
      {items
        .filter((d) => d.behind === behind)
        .map((d) => (
          <span
            key={d.key}
            aria-hidden="true"
            style={{ ...d.style, ...(behind ? { zIndex: -1 } : {}) }}
          >
            {d.text}
          </span>
        ))}
    </>
  );
}

/** Measures loaded text in em; absent until the element's font is ready. */
export const TextMetricsContext = createContext<Measure | null>(null);

/** CSS for a kinetic frame applied to a glyph, word wrapper or the whole run. */
function kineticStyle(f: KineticFrame, color: string): React.CSSProperties {
  if (isNeutralKinetic(f)) return {};
  return {
    transform: `translate(${f.x}em,${f.y}em) rotate(${f.rotation}deg)${f.rotateY ? ` perspective(6em) rotateY(${f.rotateY}deg)` : ""} scale(${f.scale}) scale(${f.scaleX},${f.scaleY}) skewX(${f.skewX}deg)`,
    transformOrigin: f.origin ?? "50% 60%",
    opacity: f.opacity,
    ...(f.blur > 0 ? { filter: `blur(${f.blur}em)` } : {}),
    ...(f.tint ? { color: mixHex(color, f.tint.color, f.tint.amount) } : {}),
  };
}
function KineticMarks({ marks }: { marks: KineticMark[] }) {
  return (
    <>
      {marks.map((m, k) => (
        <span
          key={`mark-${k}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `calc(50% + ${m.x}em)`,
            top: `calc(50% + ${m.y}em)`,
            width: `${m.w}em`,
            height: `${m.h}em`,
            transform: `translate(-50%,-50%) rotate(${m.rotation ?? 0}deg)`,
            background: m.kind === "ring" ? "transparent" : m.color,
            border: m.kind === "ring" ? `0.04em solid ${m.color}` : undefined,
            borderRadius:
              m.kind === "dot" || m.kind === "ring"
                ? "50%"
                : m.kind === "block"
                  ? "0.06em"
                  : 0,
            opacity: m.opacity,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}
/** Extra renders of a unit (trails, ghosts, light bands). */
function KineticCopies({
  copies,
  text,
  paint,
}: {
  copies: KineticCopy[];
  text: string;
  paint: React.CSSProperties;
}) {
  return (
    <>
      {copies.map((c, k) => (
        <span
          key={`copy-${k}`}
          aria-hidden="true"
          data-text-fill
          style={{
            ...paint,
            ...(c.color
              ? { color: c.color, backgroundImage: "none", textShadow: "none" }
              : {}),
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            textAlign: "center",
            whiteSpace: "pre",
            opacity: c.opacity,
            clipPath: c.clip,
            transform: `translate(${c.x}em,${c.y}em)${c.rotation ? ` rotate(${c.rotation}deg)` : ""}${c.scale !== undefined ? ` scale(${c.scale})` : ""}`,
            ...(c.origin ? { transformOrigin: c.origin } : {}),
            ...(c.blend ? { mixBlendMode: c.blend } : {}),
            pointerEvents: "none",
          }}
        >
          {c.glyph ?? text}
        </span>
      ))}
    </>
  );
}

/** A shared, frame-derived text renderer for the composition and library previews. */
export function AnimatedText({
  layer,
  effects,
  time,
  stage,
}: {
  layer: Layer;
  effects: Effect[];
  time: number;
  /** Frame size, so overlays can pick the side with free space, and the
   * other elements, for overlays that link to them. */
  stage?: { width: number; height: number; layers?: Layer[] };
}) {
  const measure = useContext(TextMetricsContext);
  const animation = Math.max(0, time + layer.effectOffset);
  const uses = overlayUses(layer, effects, animation);
  const body = <TextBody layer={layer} effects={effects} time={time} />;
  if (!uses.length) return body;
  // Overlays measure the text block in em, centered on the rendered run.
  const g = textGeometry(layer.text, measure ?? estimateWidth);
  const words = layer.text.split(/\s+/u).filter(Boolean);
  const k = keyWordIndex(words);
  const lineBoxes = layer.text.split("\n").map((_, li) => {
    const ws = g.words.filter((w) => w.line === li);
    const x0 = Math.min(...ws.map((w) => w.x - w.w / 2)),
      x1 = Math.max(...ws.map((w) => w.x + w.w / 2));
    return ws.length
      ? {
          x: (x0 + x1) / 2,
          y: (li - (g.lines - 1) / 2) * g.lead,
          w: x1 - x0,
          h: g.lead * 0.9,
        }
      : null;
  });
  const keyBox = g.words[k]
    ? { x: g.words[k].x, y: g.words[k].y, w: g.words[k].w, h: g.lead * 0.9 }
    : undefined;
  const wordBoxes = g.words.map((w) => ({
    x: w.x,
    y: w.y,
    w: w.w,
    h: g.lead * 0.9,
  }));
  const first = g.glyphs.find((gl) => gl.word >= 0);
  const px = layer.fontSize * layer.scale;
  const box = {
    x: 0,
    y: 0,
    w: Math.max(0.2, g.width),
    h: Math.max(0.2, g.height),
  };
  const room = stage && {
    left: (stage.width / 2 + layer.x) / px - box.w / 2,
    right: (stage.width / 2 - layer.x) / px - box.w / 2,
    top: (stage.height / 2 + layer.y) / px - box.h / 2,
    bottom: (stage.height / 2 - layer.y) / px - box.h / 2,
  };
  const parts = overlayStack(
    uses,
    animation,
    layer.effectDuration || layer.duration,
    {
      box,
      key: keyBox,
      lines: lineBoxes.filter((b) => !!b),
      words: wordBoxes,
      initial: first && {
        x: first.x,
        y: first.y,
        w: first.w,
        h: g.lead * 0.9,
      },
      text: layer.text,
      word: words[k],
      peers: overlayPeers(stage?.layers, layer, layer.start + time, px),
      unitPx: layer.fontSize,
      room,
      start: layer.start,
      position: { x: layer.x, y: layer.y },
    },
  );
  const id = `ov-${layer.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const svg = (behind: boolean) => (
    <OverlaySvg
      id={id}
      parts={parts}
      width={box.w}
      height={box.h}
      unit={(n) => `${n}em`}
      behind={behind}
    />
  );
  return (
    <span
      data-text-overlays
      style={{
        position: "relative",
        display: "inline-block",
        isolation: "isolate",
      }}
    >
      {svg(true)}
      {/* Positioned so it paints above the overlays drawn under it. */}
      <span style={{ position: "relative", display: "inline-block" }}>
        {body}
      </span>
      {svg(false)}
    </span>
  );
}

function TextBody({
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
  // Copy looks render extra whole-text copies: lagged ghosts, reflections, halves.
  const copies = layer.effects.flatMap((instance) => {
    if (!instance.enabled) return [];
    const effect = resolveEffectInstanceAt(instance, effects, animation)?.text;
    const amount = instanceAmountAt(instance, animation);
    return effect && copyLooks.includes(effect.kind as never) && amount > 0
      ? [{ instance, effect, amount: Math.min(1, amount) }]
      : [];
  });
  if (!copies.length)
    return <TextRun layer={layer} effects={effects} time={time} />;
  const plain = {
    ...layer,
    effects: layer.effects.filter(
      (instance) => !copies.some((c) => c.instance === instance),
    ),
  };
  const lines = layer.text.split("\n").length;
  const ghost = copies.find((c) => c.effect.kind === "ghost");
  const cut = copies.find((c) => c.effect.kind === "cutshift");
  const reflection = copies.find((c) => c.effect.kind === "reflection");
  const shift = cut
    ? (0.06 + 0.1 * cut.effect.distance) *
      cut.amount *
      (1 -
        (1 - Math.min(1, animation / Math.max(0.05, cut.effect.seconds))) ** 3)
    : 0;
  const main = <TextRun layer={plain} effects={effects} time={time} />;
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      data-text-copies
    >
      {ghost &&
        ghostCopies(ghost.effect, ghost.amount).map((g, k) => (
          <span
            key={`ghost-${k}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              color: g.color,
              textShadow: "none",
              opacity: ghost.amount,
              transform: `translate(${g.x}em,${g.y}em)`,
              pointerEvents: "none",
            }}
          >
            <TextRun
              layer={{ ...plain, color: g.color }}
              effects={effects}
              time={Math.max(0, time - g.lag)}
              flat
            />
          </span>
        ))}
      {reflection && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `calc(100% + ${0.02 + 0.1 * reflection.effect.distance}em)`,
            height: "100%",
            transform: "scaleY(-0.72)",
            transformOrigin: "50% 0%",
            translate: "0 72%",
            opacity: 0.42 * reflection.amount,
            WebkitMaskImage: "linear-gradient(to top, #000, transparent 75%)",
            maskImage: "linear-gradient(to top, #000, transparent 75%)",
            pointerEvents: "none",
          }}
        >
          {main}
        </span>
      )}
      <span
        style={{
          position: "relative",
          display: "inline-block",
          ...(cut ? { clipPath: lineHalves(lines, true) } : {}),
        }}
      >
        {main}
      </span>
      {cut && (
        <>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              clipPath: lineHalves(lines, false),
              transform: `translateX(${shift}em)`,
            }}
          >
            {main}
          </span>
          {Array.from({ length: lines }, (_, i) => (
            <span
              key={`cut-${i}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-0.3em",
                right: "-0.3em",
                top: `${((i + 0.55) / lines) * 100}%`,
                height: "0.022em",
                minHeight: 1,
                background: cut.effect.color,
                opacity: cut.amount,
                transform: `scaleX(${Math.min(1, animation / Math.max(0.05, cut.effect.seconds * 0.6))})`,
                transformOrigin: i % 2 ? "right" : "left",
              }}
            />
          ))}
        </>
      )}
    </span>
  );
}

function TextRun({
  layer,
  effects,
  time,
  flat = false,
}: {
  layer: Layer;
  effects: Effect[];
  time: number;
  /** Ghost copies: one flat color, no paint looks or decorations. */
  flat?: boolean;
}) {
  const active = activeTextEffects(layer, effects, time);
  const gooId = `goo-${useId().replace(/:/g, "")}`;
  const measure = useContext(TextMetricsContext);
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
  // Text looks: paint treatments and decorations (copies render in AnimatedText).
  const looks = flat
    ? []
    : active.filter(
        ({ effect }) =>
          isLookKind(effect.kind) && !copyLooks.includes(effect.kind),
      );
  if (flat)
    for (const key of Object.keys(paint))
      delete paint[key as keyof typeof paint];
  else if (looks.length) {
    const look = lookPaint(looks, baseColor, t);
    const shadow = [look.textShadow, paint.textShadow]
      .filter((v) => v && v !== "none")
      .join(", ");
    Object.assign(paint, look);
    if (shadow) paint.textShadow = shadow;
  }
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
  // Kinetic type: rigid frames per glyph, per word wrapper or for the whole run.
  const kinetic = motion.filter(({ effect }) => isKineticKind(effect.kind));
  // Layouts move whole words into a composed arrangement (they shape ghosts too).
  const layouts = motion.filter(({ effect }) => isLayoutKind(effect.kind));
  const glyphKinetic = new Map<number, KineticFrame>();
  const wordKinetic = new Map<number, KineticFrame>();
  const behindWords = new Set<number>();
  let runKinetic: KineticFrame | null = null;
  if (kinetic.length || layouts.length) {
    const geometry = textGeometry(text, measure ?? estimateWidth);
    // Holds wait for this element's entrances and stop before its exits.
    let entranceEnd = 0,
      exitStart = duration;
    for (const { effect } of active) {
      const exit =
        effect.motion?.direction === "out" ||
        (isKineticKind(effect.kind) && kineticRole(effect.kind) === "exit");
      const timed = isKineticKind(effect.kind)
        ? kineticRole(effect.kind) !== "hold"
        : isLayoutKind(effect.kind)
          ? !layoutHolds.includes(effect.kind)
          : isTitleKind(effect.kind)
            ? !!titleControls[effect.kind].entrance
            : ["typewriter", "scramble", "stagger"].includes(effect.kind);
      if (!timed) continue;
      if (exit) exitStart = Math.min(exitStart, duration - effect.seconds);
      else entranceEnd = Math.max(entranceEnd, effect.seconds);
    }
    const hold = holdEnvelope(t, entranceEnd, exitStart);
    const keyWord = keyWordIndex(words.filter((w) => !/^\s+$/u.test(w)));
    for (const { effect, amount } of layouts) {
      const result = layoutFrames(effect, {
        time: t,
        duration,
        amount,
        geometry,
        hold,
        keyWord,
      });
      result.words.forEach((f, i) =>
        wordKinetic.set(
          i,
          mergeKinetic(f, wordKinetic.get(i) ?? neutralKineticFrame()),
        ),
      );
      result.behind.forEach((i) => behindWords.add(i));
      if (result.marks.length)
        runKinetic = mergeKinetic(runKinetic ?? neutralKineticFrame(), {
          ...neutralKineticFrame(),
          marks: result.marks,
        });
    }
    for (const { effect, amount } of kinetic) {
      const env: KineticEnv = {
        effect,
        time: t,
        duration,
        amount,
        geometry,
        hold,
        color: layer.color,
      };
      if (effect.unit === "title") {
        runKinetic = mergeKinetic(
          runKinetic ?? neutralKineticFrame(),
          kineticFrame(env, {
            index: 0,
            count: 1,
            x: 0,
            y: 0,
            w: geometry.width,
            line: 0,
            inLine: 0,
            lineLength: 1,
          }),
        );
      } else if (effect.unit === "word") {
        geometry.words.forEach((w, index) => {
          const line = geometry.words.filter((v) => v.line === w.line);
          const frame = kineticFrame(env, {
            index,
            count: geometry.words.length,
            x: w.x,
            y: w.y,
            w: w.w,
            line: w.line,
            inLine: line.indexOf(w),
            lineLength: line.length,
          });
          wordKinetic.set(
            index,
            mergeKinetic(
              wordKinetic.get(index) ?? neutralKineticFrame(),
              frame,
            ),
          );
        });
      } else {
        let position = 0;
        units.forEach((u, index) => {
          const g = geometry.glyphs[index];
          if (/^\s+$/u.test(u) || !g) return;
          const frame = kineticFrame(env, {
            index: position++,
            count: charCount,
            x: g.x,
            y: g.y,
            w: g.w,
            line: g.line,
            inLine: g.inLine,
            lineLength: g.lineLength,
          });
          glyphKinetic.set(
            index,
            mergeKinetic(
              glyphKinetic.get(index) ?? neutralKineticFrame(),
              frame,
            ),
          );
        });
      }
    }
  }
  // Looks: the accent word, each glyph's place in its line and word decorations.
  const visibleWords = words.filter((w) => !/^\s+$/u.test(w));
  const keyWord = keyWordIndex(visibleWords);
  const lineIndex: number[] = [];
  {
    let k = 0;
    for (const u of units) {
      if (u === "\n") k = 0;
      lineIndex.push(/^\s+$/u.test(u) ? -1 : k++);
    }
  }
  const wordLooks = looks.filter(({ effect }) =>
    ["wordbox", "plate"].includes(effect.kind),
  );
  const wordDecors = new Map<number, LookDecor[]>();
  const plateColor = new Map<number, string>();
  if (wordLooks.length)
    for (let w = 0; w < wordCount; w++) {
      const d = wordDecor(wordLooks, t, w, wordCount);
      wordDecors.set(w, d.decor);
      if (d.color) plateColor.set(w, d.color);
    }
  const decor = looks.length
    ? blockDecor(looks, t, {
        text,
        lines: text.split("\n").length,
        start: layer.start,
        mono: MONO,
      })
    : [];
  const circle = active.find(({ effect }) => effect.kind === "circle")?.effect;
  const ring = circle ? circleLayout(circle, units.length, t) : null;
  const px = layer.fontSize;
  const flapBoard = active.some(({ effect }) => effect.kind === "flap");
  const bubbleBoard = active.some(({ effect }) => effect.kind === "bubbles");
  let charIndex = 0;
  const nodes = units.map((unit, index) => {
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
      if (isKineticKind(effect.kind) || isLookKind(effect.kind)) continue;
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
          boxColor = effect.kind === "flap" ? effect.secondary : effect.color;
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
    const glyphLook =
      looks.length && !whitespace
        ? lookGlyph(
            looks,
            t,
            {
              index: position,
              word: wordIndices[index],
              inLine: lineIndex[index],
            },
            keyWord,
          )
        : null;
    if (glyphLook) {
      opacity *= glyphLook.opacity;
      scale *= glyphLook.scale;
    }
    const kf = glyphKinetic.get(index);
    if (kf) {
      opacity *= kf.opacity;
      x += kf.x;
      y += kf.y;
      rotation += kf.rotation;
      scale *= kf.scale;
      title.scaleX *= kf.scaleX;
      title.scaleY *= kf.scaleY;
      title.skewX += kf.skewX;
      title.rotateY += kf.rotateY;
      title.blur += kf.blur;
      if (kf.tint) title.tint = kf.tint;
      if (kf.glyph) {
        replacement = kf.glyph;
        scrambleAmount = 1;
      }
    }
    // Paint each text leaf, not its transformed ancestor. Chromium can omit
    // descendant glyphs from an ancestor's background-clip:text mask.
    const glyphPaint: React.CSSProperties = { ...paint };
    if (rgb)
      glyphPaint.textShadow = `${rgb}em 0 #ff365a, ${-rgb}em 0 #36d9ff${paint.textShadow && paint.textShadow !== "none" ? `, ${paint.textShadow}` : ""}`;
    if (
      paint.backgroundImage &&
      active.some(({ effect }) => effect.kind === "gradient")
    ) {
      glyphPaint.backgroundSize = `${Math.max(2, charCount * 2) * 100}% 100%`;
      const gradient = active
        .filter(({ effect }) => effect.kind === "gradient")
        .at(-1)!.effect;
      glyphPaint.backgroundPosition = `${25 + 50 * (charCount > 1 ? position / (charCount - 1) : 0.5) + 25 * Math.sin(t * gradient.speed * Math.PI)}% 50%`;
    }
    if (title.blur > 0)
      glyphPaint.filter = [paint.filter, `blur(${title.blur * px}px)`]
        .filter(Boolean)
        .join(" ");
    const lookColor = plateColor.get(wordIndices[index]) ?? glyphLook?.color;
    if (lookColor && !paint.backgroundImage) glyphPaint.color = lookColor;
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
    const clipped = kf?.clip ? (
      <span style={{ display: "inline-block", clipPath: kf.clip }}>
        {glyphs}
      </span>
    ) : (
      glyphs
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
          transformOrigin: ring ? "50% 50%" : (kf?.origin ?? "50% 70%"),
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
              {clipped}
            </span>
          </span>
        ) : (
          clipped
        )}
        {kf && kf.copies.length > 0 && (
          <KineticCopies copies={kf.copies} text={unit} paint={glyphPaint} />
        )}
        {kf && kf.marks.length > 0 && <KineticMarks marks={kf.marks} />}
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
  });
  // Word-level kinetic frames wrap each word so it moves as one rigid piece.
  const content: React.ReactNode[] = [];
  if ((wordKinetic.size || wordDecors.size) && !ring) {
    let i = 0;
    while (i < nodes.length) {
      const w = wordIndices[i];
      if (
        /^\s+$/u.test(units[i]) ||
        (!wordKinetic.has(w) && !wordDecors.has(w))
      ) {
        content.push(nodes[i++]);
        continue;
      }
      const start = i;
      while (
        i < nodes.length &&
        !/^\s+$/u.test(units[i]) &&
        wordIndices[i] === w
      )
        i++;
      const f = wordKinetic.get(w) ?? neutralKineticFrame();
      const inner = nodes.slice(start, i);
      const around = wordDecors.get(w) ?? [];
      content.push(
        <span
          key={`word-${start}`}
          data-kinetic-word={w}
          style={{
            display: "inline-block",
            position: "relative",
            whiteSpace: "nowrap",
            ...(around.length ? { isolation: "isolate" } : {}),
            ...kineticStyle(f, layer.color),
            ...(behindWords.has(w) ? { zIndex: -1 } : {}),
          }}
        >
          <Decor items={around} behind />
          {f.clip ? (
            <span style={{ display: "inline-block", clipPath: f.clip }}>
              {inner}
            </span>
          ) : (
            inner
          )}
          {f.copies.length > 0 && (
            <KineticCopies
              copies={f.copies}
              text={units.slice(start, i).join("")}
              paint={paint}
            />
          )}
          {f.marks.length > 0 && <KineticMarks marks={f.marks} />}
          <Decor items={around} behind={false} />
        </span>,
      );
    }
  } else content.push(...nodes);
  const run = runKinetic ?? neutralKineticFrame();
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
          : {
              ...style,
              ...(decor.length || behindWords.size
                ? { position: "relative", isolation: "isolate" }
                : {}),
              ...(runKinetic
                ? { position: "relative", ...kineticStyle(run, layer.color) }
                : {}),
            }
      }
      aria-label={layer.text}
      data-animated-text="run"
    >
      <Decor items={decor} behind />
      {run.clip ? (
        <span style={{ display: "inline-block", clipPath: run.clip }}>
          {content}
        </span>
      ) : (
        content
      )}
      {run.copies.length > 0 && (
        <KineticCopies copies={run.copies} text={text} paint={paint} />
      )}
      {run.marks.length > 0 && <KineticMarks marks={run.marks} />}
      <Decor items={decor} behind={false} />
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
