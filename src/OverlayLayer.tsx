import React from "react";
import { overlayMono, type OverlayPart } from "./overlays";

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
    (p) => p.behind === behind && (p.draw === undefined || p.draw > 0.001),
  );
  if (!shown.length) return null;
  // Blended parts get their own SVG so they blend with what lies beneath it.
  const groups: OverlayPart[][] = [];
  for (const part of shown) {
    const last = groups.at(-1);
    if (last && (last[0].blend ?? "") === (part.blend ?? "")) last.push(part);
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
          {group.some((p) => p.shadow) && (
            <defs>
              {group
                .filter((p) => p.shadow)
                .map((p) => (
                  <filter
                    key={p.key}
                    id={`${id}-${p.key}-shadow`}
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feDropShadow
                      dx="0"
                      dy={p.shadow! * 0.35}
                      stdDeviation={p.shadow}
                      floodColor="#000"
                      floodOpacity={0.5}
                    />
                  </filter>
                ))}
            </defs>
          )}
          {group.map((p) =>
            p.text !== undefined ? (
              <text
                key={p.key}
                x={p.x}
                y={p.y}
                fontSize={p.size}
                textAnchor={p.align ?? "start"}
                fontFamily={p.mono ? overlayMono : "inherit"}
                fontWeight={p.bold ? 700 : 500}
                letterSpacing="0.12em"
                fill={p.fill}
                opacity={p.opacity}
                transform={p.transform}
                style={{ whiteSpace: "pre" }}
              >
                {p.text}
              </text>
            ) : (
              <path
                key={p.key}
                d={p.d}
                fill={p.fill ?? "none"}
                fillRule={p.evenodd ? "evenodd" : undefined}
                stroke={p.stroke ?? "none"}
                strokeWidth={p.stroke ? p.width : undefined}
                strokeLinecap={p.cap ?? "round"}
                strokeLinejoin="round"
                opacity={p.opacity}
                transform={p.transform}
                filter={p.shadow ? `url(#${id}-${p.key}-shadow)` : undefined}
                {...(p.draw !== undefined && p.draw < 1
                  ? {
                      pathLength: 1,
                      strokeDasharray: "1 1",
                      strokeDashoffset: 1 - p.draw,
                    }
                  : {})}
              />
            ),
          )}
        </svg>
      ))}
    </>
  );
}
