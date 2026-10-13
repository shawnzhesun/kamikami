import React, { type CSSProperties, type ReactNode } from "react";
import {
  artLabel,
  behindDecor,
  decorReveal,
  isDecorArt,
  sliceBands,
  trailCopies,
  type Art,
  type ArtUse,
} from "./artwork";

const fill: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

/** Luminance mapped onto one color, keeping the artwork's detail and alpha. */
function TintFilter({ id, color }: { id: string; color: string }) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => (parseInt(color.slice(i, i + 2), 16) / 255) * 1.35,
  );
  const row = (c: number) => `${0.3 * c} ${0.59 * c} ${0.11 * c} 0 0`;
  return (
    <filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix
        type="matrix"
        values={`${row(r)} ${row(g)} ${row(b)} 0 0 0 1 0`}
      />
    </filter>
  );
}

function Decor({
  art,
  amount,
  time,
  side,
  start,
}: {
  art: Art;
  amount: number;
  time: number;
  side: number;
  start: number;
}) {
  const p = decorReveal(art, time);
  const a = Math.min(1, art.strength * amount);
  const pad = art.distance * side;
  const line = Math.max(1.5, side * 0.0045);
  const rad = (art.angle * Math.PI) / 180;
  const box = (style: CSSProperties): CSSProperties => ({
    position: "absolute",
    pointerEvents: "none",
    ...style,
  });
  switch (art.kind) {
    case "print":
      return (
        <div
          style={box({
            inset: -pad,
            background: art.color,
            boxShadow: `0 ${side * 0.012}px ${side * 0.035}px rgba(0,0,0,${0.5 * a})`,
            opacity: a * p,
            transform: `scale(${0.97 + 0.03 * p})`,
          })}
        />
      );
    case "shadowblock":
    case "offsetframe": {
      const d = pad * p;
      return (
        <div
          style={box({
            inset: 0,
            transform: `translate(${Math.cos(rad) * d}px,${Math.sin(rad) * d}px)`,
            opacity: a * Math.min(1, p * 2),
            ...(art.kind === "shadowblock"
              ? { background: art.color }
              : { border: `${line}px solid ${art.color}` }),
          })}
        />
      );
    }
    case "brackets": {
      const out = pad * (1 + (1 - p) * 1.5);
      const corner = (v: "top" | "bottom", h: "left" | "right") => (
        <div
          key={v + h}
          style={box({
            [v]: -out,
            [h]: -out,
            width: side * 0.07,
            height: side * 0.07,
            [`border${v === "top" ? "Top" : "Bottom"}`]: `${line}px solid ${art.color}`,
            [`border${h === "left" ? "Left" : "Right"}`]: `${line}px solid ${art.color}`,
          })}
        />
      );
      return (
        <div style={box({ inset: 0, opacity: a * p })}>
          {corner("top", "left")}
          {corner("top", "right")}
          {corner("bottom", "left")}
          {corner("bottom", "right")}
        </div>
      );
    }
    case "cropmarks": {
      const thin = Math.max(1, side * 0.0018);
      const len = side * 0.045 * p;
      const gap = pad * 0.5;
      const marks = (["top", "bottom"] as const).flatMap((v) =>
        (["left", "right"] as const).flatMap((h) => [
          // Horizontal and vertical ticks off each corner.
          <div
            key={`${v}${h}h`}
            style={box({
              [v]: -thin / 2,
              [h]: -gap - len,
              width: len,
              height: thin,
              background: art.color,
            })}
          />,
          <div
            key={`${v}${h}v`}
            style={box({
              [v]: -gap - len,
              [h]: -thin / 2,
              width: thin,
              height: len,
              background: art.color,
            })}
          />,
        ]),
      );
      const target = (v: "top" | "bottom") => (
        <div
          key={v}
          style={box({
            [v]: -gap - side * 0.035,
            left: "50%",
            width: side * 0.022,
            height: side * 0.022,
            marginLeft: -side * 0.011,
            borderRadius: "50%",
            border: `${thin}px solid ${art.color}`,
            background: `linear-gradient(${art.color},${art.color}) center/100% ${thin}px no-repeat, linear-gradient(${art.color},${art.color}) center/${thin}px 100% no-repeat`,
            opacity: p,
          })}
        />
      );
      return (
        <div style={box({ inset: 0, opacity: a })}>
          {marks}
          {target("top")}
          {target("bottom")}
        </div>
      );
    }
    case "label":
      return (
        <div
          style={box({
            top: `calc(100% + ${side * 0.022}px)`,
            left: 0,
            color: art.color,
            font: `500 ${side * 0.026}px "IBM Plex Mono", ui-monospace, monospace`,
            letterSpacing: "0.12em",
            whiteSpace: "pre",
            opacity: a,
            clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
          })}
        >
          {artLabel(art, start)}
        </div>
      );
    case "tape": {
      const strip = (h: "left" | "right") => (
        <div
          key={h}
          style={box({
            top: -side * 0.018,
            [h]: -side * 0.045,
            width: side * 0.14,
            height: side * 0.04,
            background: art.color,
            opacity: 0.82,
            boxShadow: `0 1px ${side * 0.004}px rgba(0,0,0,.25)`,
            transform: `rotate(${h === "left" ? -32 : 32}deg) scale(${p})`,
          })}
        />
      );
      return (
        <div style={box({ inset: 0, opacity: a })}>
          {strip("left")}
          {strip("right")}
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Draws one element with its artwork treatments: lagged color copies behind
 * it, slices of its pixels, and framing decorations that follow its transform.
 * `frameStyle(t)` and `content(t)` render the element at a clip-local time.
 */
export function ArtworkStack({
  id,
  uses,
  t,
  time,
  projectTime,
  duration,
  width,
  height,
  box,
  start,
  frameStyle,
  content,
}: {
  id: string;
  uses: ArtUse[];
  /** Clip-local time. */
  t: number;
  /** Animation time (clip-local plus effect offset). */
  time: number;
  projectTime: number;
  duration: number;
  width: number;
  height: number;
  /** The artwork's visible box in stage pixels, centered in the frame. */
  box: { width: number; height: number };
  start: number;
  frameStyle: (t: number) => CSSProperties;
  content: (t: number) => ReactNode;
}) {
  const side = Math.min(width, height);
  const trail = uses.find((u) => u.art.kind === "trail");
  const slices = uses.find((u) => u.art.kind === "slices");
  const decor = uses.filter((u) => isDecorArt(u.art.kind));
  const copies = trail ? trailCopies(trail.art, trail.amount, side) : [];
  const decorBox = (items: ArtUse[]) =>
    items.length ? (
      <div
        style={{
          position: "absolute",
          left: (width - box.width) / 2,
          top: (height - box.height) / 2,
          width: box.width,
          height: box.height,
          pointerEvents: "none",
        }}
      >
        {items.map((u, i) => (
          <Decor
            key={i}
            art={u.art}
            amount={u.amount}
            time={time}
            side={side}
            start={start}
          />
        ))}
      </div>
    ) : null;
  const main = slices
    ? sliceBands(
        slices.art,
        slices.amount,
        time,
        projectTime,
        duration,
        side,
      ).map((band, i) => (
        <div
          key={i}
          style={{
            ...fill,
            clipPath: band.clip,
            transform: `translate(${band.x}px,${band.y}px)`,
          }}
        >
          {content(t)}
        </div>
      ))
    : content(t);
  return (
    <>
      {copies.length > 0 && (
        <svg width="0" height="0" style={{ position: "absolute" }}>
          {copies.map((c, i) => (
            <TintFilter key={i} id={`${id}-trail-${i}`} color={c.color} />
          ))}
        </svg>
      )}
      {copies.map((c, i) => {
        const at = Math.max(0, t - c.lag);
        return (
          <div
            key={`trail-${i}`}
            data-art-copy=""
            style={{ ...fill, ...frameStyle(at), mixBlendMode: "screen" }}
          >
            <div
              style={{
                ...fill,
                transform: `translate(${c.x}px,${c.y}px)`,
                opacity: c.opacity,
                filter: `url(#${id}-trail-${i})`,
              }}
            >
              {content(at)}
            </div>
          </div>
        );
      })}
      <div style={{ ...fill, ...frameStyle(t) }}>
        {decorBox(decor.filter((u) => behindDecor.includes(u.art.kind)))}
        {/* Positioned so it paints above the decorations drawn under it. */}
        <div style={fill}>{main}</div>
        {decorBox(decor.filter((u) => !behindDecor.includes(u.art.kind)))}
      </div>
    </>
  );
}
