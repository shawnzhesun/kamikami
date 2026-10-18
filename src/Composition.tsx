import { FontText } from "./FontText";
import { GraphicEffects } from "./GraphicEffects";
import { orderedElements } from "./model";
import { instanceAmountAt, resolveEffectInstanceAt } from "./effect-instance";
import { animationTime } from "./keyframes";
import { shapePath } from "./shapes";
import { BackdropArt } from "./BackdropArt";
import React, { useCallback } from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  OffthreadVideo,
  Audio,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  artUses,
  elementTime,
  overlayPeers,
  overlayUses,
  frameUnit,
  layerAtTime,
  layerVolume,
  type Project,
  type Layer,
} from "./model";
import { isFrameArt } from "./artwork";
import { ArtworkStack } from "./ArtworkLayer";

/**
 * The artwork is drawn on a 1920×1080 board. Other frame shapes crop it
 * around the sign and the figure instead of the board's center, so the
 * subject stays in view from 9:16 to ultra-wide.
 */
export function stationView(width: number, height: number) {
  const aspect = width / height;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  if (aspect <= 1920 / 1080) {
    const w = 1080 * aspect;
    return { x: clamp(1365 - w / 2, 0, 1920 - w), y: 0, w, h: 1080 };
  }
  const h = 1920 / aspect;
  return { x: 0, y: clamp(560 - h / 2, 0, 1080 - h), w: 1920, h };
}
function Station({ width, height }: { width: number; height: number }) {
  const view = stationView(width, height);
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#08151c" />
          <stop offset=".68" stopColor="#194441" />
          <stop offset="1" stopColor="#08131b" />
        </linearGradient>
        <radialGradient id="halo">
          <stop stopColor="#f47750" stopOpacity=".5" />
          <stop offset="1" stopColor="#ee7850" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="floor" x2="0" y2="1">
          <stop stopColor="#294c48" />
          <stop offset="1" stopColor="#060c12" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="13" />
        </filter>
      </defs>
      <rect width="1920" height="1080" fill="url(#sky)" />
      <circle cx="1420" cy="350" r="570" fill="url(#halo)" />
      <g fill="#11292e">
        {Array.from({ length: 20 }, (_, i) => (
          <rect
            key={i}
            x={i * 104}
            y={380 - (i % 4) * 35}
            width={80}
            height={420}
          />
        ))}
      </g>
      <path d="M0 690 L1920 635 L1920 1080 L0 1080Z" fill="url(#floor)" />
      <path
        d="M0 740 L1920 695 M0 770 L1920 718 M0 970 L1920 790"
        stroke="#6ca197"
        strokeOpacity=".2"
        strokeWidth="4"
      />
      <path d="M0 80 L1920 5 L1920 120 L0 340Z" fill="#070e15" />
      <path d="M0 325 L1920 112" stroke="#46615e" strokeWidth="8" />
      <g fill="#111e26">
        <path d="M90 220 L120 215 L120 880 L90 892Z" />
        <path d="M1040 116 L1078 114 L1078 765 L1040 780Z" />
        <path d="M1760 56 L1790 54 L1790 726 L1760 736Z" />
      </g>
      <path
        d="M280 278 L775 223 M1210 168 L1570 128"
        stroke="#e6c5a5"
        strokeWidth="9"
      />
      <path
        d="M280 278 L775 223 M1210 168 L1570 128"
        stroke="#fcae70"
        strokeWidth="28"
        opacity=".35"
        filter="url(#glow)"
      />
      <g transform="translate(1170 360)">
        <rect
          width="260"
          height="84"
          rx="2"
          fill="#12252b"
          stroke="#51716a"
          strokeWidth="3"
        />
        <text
          x="24"
          y="35"
          fill="#9fae9d"
          fontFamily="sans-serif"
          fontSize="18"
          letterSpacing="5"
        >
          LAST DEPARTURE
        </text>
        <text x="25" y="67" fill="#f08765" fontFamily="monospace" fontSize="24">
          23:48 →
        </text>
      </g>
      <g transform="translate(1460 470)">
        <ellipse cx="0" cy="322" rx="104" ry="16" fill="#03070d" opacity=".6" />
        <path
          d="M-31 185 L-45 315 L-17 318 L9 203 L27 316 L52 316 L40 179Z"
          fill="#09121b"
        />
        <path d="M-26 63 Q0 45 33 68 L55 191 L-47 197Z" fill="#bd4d40" />
        <path
          d="M-24 67 L-56 147 L-38 154 L0 79 M29 66 L64 147 L47 159 L9 83"
          fill="#973b36"
        />
        <path d="M-13 31 L-12 69 L17 77 L21 30" fill="#bc9280" />
        <ellipse cy="12" rx="31" ry="37" fill="#bf9a87" />
        <path
          d="M-33 18 L-34 -12 L-18 -36 L13 -33 L39 -12 L30 31 L12 1 L-13 12 L-18 35 L-23 9Z"
          fill="#10161f"
        />
        <path d="M-26 63 L22 73 L63 116 L18 91 L-29 88Z" fill="#f2694b" />
      </g>
      <g stroke="#99c9ba" opacity=".12">
        {Array.from({ length: 32 }, (_, i) => (
          <path key={i} d={`M${i * 67} ${80 + (i % 7) * 67} l-25 85`} />
        ))}
      </g>
      {/* The dark rim frames whatever part of the board is visible. */}
      <rect
        x={view.x}
        y={view.y}
        width={view.w}
        height={view.h}
        fill="none"
        stroke="#030811"
        strokeWidth="80"
        opacity=".4"
      />
    </svg>
  );
}

function VisualLayer({
  layer,
  project,
  mediaOrigin,
  missing,
}: {
  layer: Layer;
  project: Project;
  mediaOrigin: string;
  missing: boolean;
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const t = frame / fps;
  const src = layer.src ? mediaOrigin + layer.src : "";
  const uses = artUses(layer, project.effects, t);
  // Text draws its own overlays around the measured text block.
  const overlays =
    layer.type === "title"
      ? []
      : overlayUses(layer, project.effects, animationTime(layer, t));
  // Copies and slices draw from the element's pixels; text has its own treatments.
  const framed =
    layer.type !== "title" &&
    (overlays.length > 0 || uses.some((u) => isFrameArt(u.art.kind)));
  // Measure whenever the element has overlays, so they don't jump in mid-clip.
  const box = useArtworkBox(
    layer,
    src,
    project,
    layer.type !== "title" &&
      layer.effects.some(
        (i) =>
          !!(i.settings ?? project.effects.find((e) => e.id === i.effectId))
            ?.overlay,
      ),
  );
  const unit = frameUnit(project);
  // Remotion re-evaluates the whole clip's volume curve whenever this function
  // changes identity, so keep it stable across frames.
  const volume = useCallback(
    (f: number) => layerVolume(layer, project.layers, f / fps, fps),
    [layer, project.layers, fps],
  );
  if (missing)
    return layer.type === "audio" ? null : (
      <AbsoluteFill
        style={{
          background: "#413333",
          color: "#F5EBDD",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: 40 * unit,
        }}
      >
        Missing media: {layer.name}
        <span style={{ fontSize: 24 * unit, marginTop: 20 * unit }}>
          Relink the file in the Media library
        </span>
      </AbsoluteFill>
    );
  if (layer.type === "audio")
    return src ? (
      <Audio
        src={src}
        volume={volume}
        startFrom={Math.round(layer.offset * fps)}
      />
    ) : null;
  const style = (at: number): React.CSSProperties => {
    const v = layerAtTime(layer, project.effects, at, project);
    // A 3D transform or a filter gives the element its own compositing layer,
    // even at neutral values, and every layer adds work to each played frame.
    const tilt =
      v.rotateX || v.rotateY
        ? ` perspective(${v.perspective}px) rotateX(${v.rotateX}deg) rotateY(${v.rotateY}deg)`
        : "";
    const filter = [
      v.blur ? `blur(${v.blur}px)` : "",
      v.brightness !== 1 ? `brightness(${v.brightness})` : "",
      v.contrast !== 1 ? `contrast(${v.contrast})` : "",
      v.saturation !== 1 ? `saturate(${v.saturation})` : "",
      v.invert ? `invert(${v.invert})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      justifyContent: "center",
      alignItems: "center",
      transform: `translate(${v.x}px,${v.y}px) scale(${v.scale}) rotate(${v.rotation}deg)${tilt} scale(${v.scaleX},${v.scaleY}) skewX(${v.skewX}deg)`,
      opacity: v.opacity,
      // Finishes blend with every layer below them.
      ...(layer.backdrop && layer.backdrop.blend !== "normal"
        ? { mixBlendMode: layer.backdrop.blend }
        : {}),
      transformOrigin: `${50 + v.originX * 50}% ${50 + v.originY * 50}%`,
      ...(filter ? { filter } : {}),
    };
  };
  // Stop-motion stutter holds effects and text animation along with the transform.
  const content = (at: number, copy = false) => {
    const tt = elementTime(layer, project.effects, at);
    return (
      <GraphicEffects
        layer={layer}
        effects={project.effects}
        time={tt}
        width={project.width}
        height={project.height}
      >
        {layer.type === "scene" && (
          <Station width={project.width} height={project.height} />
        )}
        {layer.type === "title" && (
          <FontText
            layer={layer}
            project={project}
            mediaOrigin={mediaOrigin}
            letterSpacing={
              layerAtTime(layer, project.effects, at, project).letterSpacing
            }
            time={tt}
          />
        )}
        {layer.type === "image" && src && (
          <Img
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
        {layer.type === "shape" && layer.shape && (
          <ShapeArt layer={layer} time={tt} project={project} />
        )}
        {layer.type === "backdrop" && layer.backdrop && (
          <BackdropArt
            backdrop={layer.backdrop}
            t={Math.max(0, tt + layer.effectOffset)}
            width={project.width}
            height={project.height}
            id={copy ? `${layer.id}-copy` : layer.id}
          />
        )}
        {layer.type === "video" && src && (
          // In a render, a <video> element seeks per frame and, with several
          // tabs on the GPU, sometimes shows a neighbouring frame, so exported
          // clips stutter. OffthreadVideo takes the exact frame from ffmpeg;
          // in the preview it plays as a <video> element.
          <OffthreadVideo
            src={src}
            startFrom={Math.round(layer.offset * fps)}
            // Copies are silent: only the element itself plays its sound.
            volume={copy ? 0 : volume}
            muted={copy}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
        {layer.type !== "title" &&
          layer.type !== "shape" &&
          layer.type !== "backdrop" &&
          layer.effects
            .filter((i) => i.enabled)
            .map((i) => {
              const time = animationTime(layer, tt);
              const e = resolveEffectInstanceAt(i, project.effects, time);
              const amount = instanceAmountAt(i, time);
              return e && e.tint > 0 && amount > 0 ? (
                <AbsoluteFill
                  key={i.effectId}
                  style={{
                    background: e.color,
                    opacity: Math.min(1, e.tint * amount),
                    mixBlendMode: "screen",
                    pointerEvents: "none",
                  }}
                />
              ) : null;
            })}
      </GraphicEffects>
    );
  };
  if (!framed)
    return <AbsoluteFill style={style(t)}>{content(t)}</AbsoluteFill>;
  return (
    <AbsoluteFill>
      <ArtworkStack
        id={`art-${layer.id}`}
        uses={uses}
        overlays={overlays}
        position={{ x: layer.x, y: layer.y }}
        peers={
          overlays.length
            ? overlayPeers(project.layers, layer, layer.start + t, 1)
            : undefined
        }
        t={t}
        time={animationTime(layer, t)}
        projectTime={layer.start + t}
        duration={layer.effectDuration || layer.duration}
        width={project.width}
        height={project.height}
        box={box}
        start={layer.start}
        frameStyle={style}
        content={(at) => content(at, at !== t)}
      />
    </AbsoluteFill>
  );
}
/** The visible box of an element in stage pixels, for framing decorations. */
function useArtworkBox(
  layer: Layer,
  src: string,
  project: Project,
  measure: boolean,
) {
  const W = project.width,
    H = project.height;
  const image = measure && layer.type === "image" && !!src;
  const [natural, setNatural] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  // Hold the frame until the artwork's size is known so exports frame it exactly.
  const [handle] = React.useState(() =>
    image ? delayRender(`Measuring ${layer.name}`) : null,
  );
  React.useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () =>
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => setNatural({ width: W, height: H });
    img.src = src;
  }, [image, src, W, H]);
  React.useEffect(() => {
    if (handle !== null && natural) continueRender(handle);
  }, [handle, natural]);
  if (layer.type === "shape" && layer.shape) {
    const outline = layer.shape.stroke ? (layer.shape.strokeWidth ?? 0) : 0;
    return {
      width: layer.shape.width + outline,
      height: layer.shape.height + outline,
    };
  }
  if (image && natural?.width && natural.height) {
    const fit = Math.min(W / natural.width, H / natural.height);
    return { width: natural.width * fit, height: natural.height * fit };
  }
  return { width: W, height: H };
}
/** A vector shape at its own size; effect tints color the shape, not the frame. */
function ShapeArt({
  layer,
  time,
  project,
}: {
  layer: Layer;
  time: number;
  project: Project;
}) {
  const shape = layer.shape!;
  const d = shapePath(shape);
  const strokeWidth = shape.stroke ? (shape.strokeWidth ?? 0) : 0;
  const local = animationTime(layer, time);
  const tints = layer.effects
    .filter((i) => i.enabled)
    .map((i) => {
      const e = resolveEffectInstanceAt(i, project.effects, local);
      const amount = instanceAmountAt(i, local);
      return e && e.tint > 0 && amount > 0
        ? { color: e.color, opacity: Math.min(1, e.tint * amount) }
        : null;
    })
    .filter((x) => !!x);
  // Centered in a full-frame box: effect passes wrap children in frame-sized layers.
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <svg
        width={shape.width}
        height={shape.height}
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        style={{ overflow: "visible", flex: "none" }}
      >
        <path
          d={d}
          fill={shape.filled === false ? "none" : layer.color}
          stroke={strokeWidth > 0 ? shape.stroke : "none"}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        {tints.map((tint, i) => (
          <path
            key={i}
            d={d}
            fill={shape.filled === false ? "none" : tint.color}
            stroke={strokeWidth > 0 ? tint.color : "none"}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            opacity={tint.opacity}
            style={{ mixBlendMode: "screen" }}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
}
export function Composition({
  project,
  mediaOrigin = "",
  missingSources = [],
}: {
  project: Project;
  mediaOrigin?: string;
  missingSources?: string[];
}) {
  return (
    <AbsoluteFill style={{ background: "#070b12", overflow: "hidden" }}>
      {orderedElements(project)
        .filter((l) => l.visible)
        .map((layer) => (
          <Sequence
            key={layer.id}
            from={Math.round(layer.start * project.fps)}
            durationInFrames={Math.max(
              1,
              Math.round(layer.duration * project.fps),
            )}
          >
            <VisualLayer
              layer={layer}
              project={project}
              mediaOrigin={mediaOrigin}
              missing={missingSources.includes(layer.src)}
            />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
}
