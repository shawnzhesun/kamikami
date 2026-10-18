import React from "react";
import {
  overlayFontStacks,
  type OverlayPart,
  type OverlayPath,
  type OverlayPattern,
} from "./overlays";

/** A fill pattern tile in units. */
function Pattern({ id, p }: { id: string; p: OverlayPattern }) {
  const g = p.gap;
  const w = p.width;
  switch (p.style) {
    case "hatch":
    case "crosshatch":
      return (
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={g}
          height={g}
          patternTransform="rotate(45)"
        >
          <path d={`M0 ${g / 2}H${g}`} stroke={p.color} strokeWidth={w} />
          {p.style === "crosshatch" && (
            <path d={`M${g / 2} 0V${g}`} stroke={p.color} strokeWidth={w} />
          )}
        </pattern>
      );
    case "zigzag":
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width={g} height={g}>
          <path
            d={`M0 ${g * 0.7}L${g / 2} ${g * 0.3}L${g} ${g * 0.7}`}
            stroke={p.color}
            strokeWidth={w}
            fill="none"
          />
        </pattern>
      );
    case "dots":
      return (
        <pattern id={id} patternUnits="userSpaceOnUse" width={g} height={g}>
          <circle cx={g / 2} cy={g / 2} r={g * 0.16} fill={p.color} />
        </pattern>
      );
    case "halftone":
      // Staggered dots, larger and tighter: a printed tint.
      return (
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={g * 0.8}
          height={g * 0.8}
          patternTransform="rotate(15)"
        >
          <circle cx={g * 0.2} cy={g * 0.2} r={g * 0.17} fill={p.color} />
          <circle cx={g * 0.6} cy={g * 0.6} r={g * 0.17} fill={p.color} />
        </pattern>
      );
  }
}

/** One part's filters, patterns and draw-on mask. */
function Defs({ id, part }: { id: string; part: OverlayPart }) {
  const items: React.ReactNode[] = [];
  if (part.shadow)
    items.push(
      <filter
        key="s"
        id={`${id}-shadow`}
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feDropShadow
          dx="0"
          dy={part.shadow * 0.35}
          stdDeviation={part.shadow}
          floodColor="#000"
          floodOpacity={0.5}
        />
      </filter>,
    );
  if (part.glow)
    items.push(
      <filter
        key="g"
        id={`${id}-glow`}
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
      >
        <feGaussianBlur stdDeviation={part.glow} />
      </filter>,
    );
  if (part.pattern)
    items.push(<Pattern key="p" id={`${id}-pat`} p={part.pattern} />);
  part.paths?.forEach((path, i) => {
    if (path.glow)
      items.push(
        <filter
          key={`g${i}`}
          id={`${id}-g${i}`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation={path.glow} />
        </filter>,
      );
    if (path.grain)
      // Chalk: a ragged edge and speckled gaps from fractal noise.
      items.push(
        <filter
          key={`c${i}`}
          id={`${id}-c${i}`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={1.6 / Math.max(0.005, path.grain)}
            numOctaves={2}
            seed={3}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={path.grain * 0.9}
            result="ragged"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 2.3"
            result="speckle"
          />
          <feComposite in="ragged" in2="speckle" operator="in" />
        </filter>,
      );
    if (path.pattern)
      items.push(<Pattern key={`p${i}`} id={`${id}-p${i}`} p={path.pattern} />);
  });
  // Styled or dashed lines draw on through a mask along their centerline.
  if (masked(part))
    items.push(
      <mask
        key="m"
        id={`${id}-mask`}
        maskUnits="userSpaceOnUse"
        x="-1e4"
        y="-1e4"
        width="2e4"
        height="2e4"
      >
        <path
          d={part.d}
          fill="none"
          stroke="#fff"
          strokeWidth={(part.width ?? 0.1) * 5 + 0.05}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - part.draw!}
        />
      </mask>,
    );
  if (part.clip)
    items.push(
      <clipPath key="c" id={`${id}-clip`} clipPathUnits="userSpaceOnUse">
        <rect
          x={part.clip.x - part.clip.w / 2}
          y={part.clip.y - part.clip.h / 2}
          width={part.clip.w}
          height={part.clip.h}
        />
      </clipPath>,
    );
  return items.length ? <>{items}</> : null;
}
const masked = (p: OverlayPart) =>
  p.draw !== undefined && p.draw < 1 && !!p.d && (!!p.paths || !!p.dash);

function SubPath({
  id,
  path,
  i,
}: {
  id: string;
  path: OverlayPath;
  i: number;
}) {
  return (
    <path
      d={path.d}
      fill={path.pattern ? `url(#${id}-p${i})` : (path.fill ?? "none")}
      stroke={path.stroke ?? "none"}
      strokeWidth={path.stroke ? path.width : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={path.opacity}
      transform={path.transform}
      filter={
        path.glow
          ? `url(#${id}-g${i})`
          : path.grain
            ? `url(#${id}-c${i})`
            : undefined
      }
    />
  );
}

function Part({ id, p }: { id: string; p: OverlayPart }) {
  const pid = `${id}-${p.key}`;
  let node: React.ReactNode;
  if (p.text !== undefined) {
    const font = p.font ?? (p.mono ? "mono" : undefined);
    node = (
      <text
        x={p.x}
        y={p.y}
        fontSize={p.size}
        textAnchor={p.align ?? "start"}
        fontFamily={font ? overlayFontStacks[font] : "inherit"}
        fontWeight={p.bold ? 700 : 500}
        letterSpacing={`${p.spacing ?? 0.12}em`}
        fill={p.fill}
        opacity={p.opacity}
        transform={p.transform}
        filter={p.shadow ? `url(#${pid}-shadow)` : undefined}
        style={{ whiteSpace: "pre" }}
      >
        {p.text}
      </text>
    );
  } else if (p.paths) {
    node = (
      <g
        opacity={p.opacity}
        transform={p.transform}
        filter={p.shadow ? `url(#${pid}-shadow)` : undefined}
        mask={masked(p) ? `url(#${pid}-mask)` : undefined}
      >
        {p.paths.map((path, i) => (
          <SubPath key={i} id={pid} path={path} i={i} />
        ))}
      </g>
    );
  } else {
    const drawOn = !p.dash && p.draw !== undefined && p.draw < 1;
    const path = (
      <path
        d={p.d}
        fill={p.pattern ? `url(#${pid}-pat)` : (p.fill ?? "none")}
        fillOpacity={p.fillOpacity}
        fillRule={p.evenodd ? "evenodd" : undefined}
        stroke={p.stroke ?? "none"}
        strokeWidth={p.stroke ? p.width : undefined}
        strokeLinecap={p.cap ?? "round"}
        strokeLinejoin="round"
        strokeDasharray={p.dash ? p.dash.join(" ") : drawOn ? "1 1" : undefined}
        opacity={masked(p) ? undefined : p.opacity}
        transform={masked(p) ? undefined : p.transform}
        filter={
          p.glow
            ? `url(#${pid}-glow)`
            : p.shadow
              ? `url(#${pid}-shadow)`
              : undefined
        }
        {...(drawOn ? { pathLength: 1, strokeDashoffset: 1 - p.draw! } : {})}
      />
    );
    node = masked(p) ? (
      <g opacity={p.opacity} transform={p.transform} mask={`url(#${pid}-mask)`}>
        {path}
      </g>
    ) : (
      path
    );
  }
  return (
    <>
      <Defs id={pid} part={p} />
      {p.clip ? <g clipPath={`url(#${pid}-clip)`}>{node}</g> : node}
    </>
  );
}

/**
 * Draws overlay parts in one SVG centered on the element. Coordinates are
 * overlay units (`unit` CSS length per unit: "1em" on text, pixels on
 * pictures); the SVG lets marks spill outside the element's box.
 */
export function OverlaySvg({
  id,
  parts,
  width,
  height,
  unit,
  behind,
}: {
  id: string;
  parts: OverlayPart[];
  /** Element box in units. */
  width: number;
  height: number;
  /** CSS length of one unit. */
  unit: (n: number) => string;
  behind: boolean;
}) {
  const shown = parts.filter(
    (p) =>
      p.behind === behind &&
      p.opacity > 0.001 &&
      (p.draw === undefined || p.draw > 0.001),
  );
  if (!shown.length) return null;
  // Blended parts get their own SVG so they blend with what lies beneath it,
  // other blended parts included: two multiplied inks overprint.
  const groups: OverlayPart[][] = [];
  for (const part of shown) {
    const last = groups.at(-1);
    if (last && !last[0].blend && !part.blend) last.push(part);
    else groups.push([part]);
  }
  return (
    <>
      {groups.map((group, g) => (
        <svg
          key={g}
          aria-hidden="true"
          data-overlay={behind ? "behind" : "front"}
          viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: unit(width),
            height: unit(height),
            transform: "translate(-50%,-50%)",
            overflow: "visible",
            pointerEvents: "none",
            textShadow: "none",
            ...(group[0].blend ? { mixBlendMode: group[0].blend } : {}),
          }}
        >
          {group.map((p) => (
            <Part key={p.key} id={id} p={p} />
          ))}
        </svg>
      ))}
    </>
  );
}
