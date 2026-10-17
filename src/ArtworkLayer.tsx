import React, { type CSSProperties, type ReactNode } from "react";
import { sliceBands, trailCopies, type ArtUse } from "./artwork";
import { overlayStack, type OverlayUse } from "./overlays";
import { OverlaySvg } from "./OverlayLayer";

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

/**
 * Draws one element with its artwork treatments and overlays: lagged color
 * copies behind it, slices of its pixels, and overlay marks that follow its
 * transform.
 * `frameStyle(t)` and `content(t)` render the element at a clip-local time.
 */
export function ArtworkStack({
  id,
  uses,
  overlays = [],
  position,
  peers,
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
  overlays?: OverlayUse[];
  /** Element center relative to the frame center, pixels. */
  position?: { x: number; y: number };
  /** Centers of the other elements on screen, pixels from this one. */
  peers?: [number, number][];
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
  const copies = trail ? trailCopies(trail.art, trail.amount, side) : [];
  // Overlay units are 2.5% of the frame's shorter side.
  const u = side * 0.025;
  const ow = box.width / u,
    oh = box.height / u;
  const parts = overlays.length
    ? overlayStack(overlays, time, duration, {
        box: { x: 0, y: 0, w: ow, h: oh },
        unitPx: u,
        room: {
          left: (width / 2 + (position?.x ?? 0)) / u - ow / 2,
          right: (width / 2 - (position?.x ?? 0)) / u - ow / 2,
          top: (height / 2 + (position?.y ?? 0)) / u - oh / 2,
          bottom: (height / 2 - (position?.y ?? 0)) / u - oh / 2,
        },
        start,
        position,
        peers: peers?.map(([x, y]) => [x / u, y / u] as [number, number]),
      })
    : [];
  const marks = (behind: boolean) =>
    parts.length ? (
      <OverlaySvg
        id={`${id}-ov`}
        parts={parts}
        width={ow}
        height={oh}
        unit={(n) => `${n * u}px`}
        behind={behind}
      />
    ) : null;
  const bands = slices
    ? sliceBands(slices.art, slices.amount, time, projectTime, duration, side)
    : [];
  // One filter moves bands of a single copy: copying the element per band
  // repeated all of its effects, and a full-frame filter per band stalled
  // playback.
  const main = bands.some((b) => b.x || b.y) ? (
    <div style={{ ...fill, filter: `url(#${id}-slices)` }}>{content(t)}</div>
  ) : (
    content(t)
  );
  const across = slices?.art.direction !== "vertical";
  const reach = Math.max(0, ...bands.map((b) => Math.abs(b.x + b.y)));
  return (
    <>
      {(copies.length > 0 || bands.length > 0) && (
        <svg width="0" height="0" style={{ position: "absolute" }}>
          {copies.map((c, i) => (
            <TintFilter key={i} id={`${id}-trail-${i}`} color={c.color} />
          ))}
          {bands.length > 0 && (
            <filter
              id={`${id}-slices`}
              filterUnits="userSpaceOnUse"
              primitiveUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
              x={across ? -width / 2 - reach : 0}
              y={across ? 0 : -height / 2 - reach}
              width={across ? width * 2 + reach * 2 : width}
              height={across ? height : height * 2 + reach * 2}
            >
              {bands.map((b, i) => (
                <feOffset
                  key={i}
                  in="SourceGraphic"
                  dx={b.x}
                  dy={b.y}
                  {...(across
                    ? {
                        x: -width / 2 + b.x,
                        width: width * 2,
                        y: b.start * height,
                        height: (b.end - b.start) * height,
                      }
                    : {
                        x: b.start * width,
                        width: (b.end - b.start) * width,
                        y: -height / 2 + b.y,
                        height: height * 2,
                      })}
                  result={`band${i}`}
                />
              ))}
              <feMerge>
                {bands.map((_, i) => (
                  <feMergeNode key={i} in={`band${i}`} />
                ))}
              </feMerge>
            </filter>
          )}
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
        {marks(true)}
        {/* Positioned so it paints above the overlays drawn under it. */}
        <div style={fill}>{main}</div>
        {marks(false)}
      </div>
    </>
  );
}
