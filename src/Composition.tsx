import { fontStack } from "./fonts";
import { orderedElements } from "./model";
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  Video,
  Audio,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { layerAtTime, layerVolume, type Project, type Layer } from "./model";

function Station() {
  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
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
      <rect
        width="1920"
        height="1080"
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
  const t = frame / fps,
    v = layerAtTime(layer, project.effects, t);
  const src = layer.src ? mediaOrigin + layer.src : "";
  if (missing)
    return layer.type === "audio" ? null : (
      <AbsoluteFill
        style={{
          background: "#413333",
          color: "#F5EBDD",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: 40,
        }}
      >
        Missing media: {layer.name}
        <span style={{ fontSize: 24, marginTop: 20 }}>
          Relink the file in the Media library
        </span>
      </AbsoluteFill>
    );
  if (layer.type === "audio")
    return src ? (
      <Audio
        src={src}
        volume={layerVolume(layer, project.layers)}
        startFrom={Math.round(layer.offset * fps)}
      />
    ) : null;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        transform: `translate(${v.x}px,${v.y}px) scale(${v.scale}) rotate(${v.rotation}deg)`,
        opacity: v.opacity,
        filter: `blur(${v.blur}px) brightness(${v.brightness})`,
      }}
    >
      {layer.type === "scene" && <Station />}
      {layer.type === "title" && (
        <div
          data-layer-content={layer.id}
          style={{
            color: layer.color,
            fontFamily: fontStack(layer.fontFamily),
            fontSize: layer.fontSize,
            fontWeight: 800,
            letterSpacing: layer.fontSize > 50 ? "-4px" : "4px",
            lineHeight: 1.03,
            whiteSpace: "pre-wrap",
            textAlign: "left",
            textShadow: "0 4px 40px #0008",
          }}
        >
          {layer.text}
        </div>
      )}
      {layer.type === "image" && src && (
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
      {layer.type === "video" && src && (
        <Video
          src={src}
          startFrom={Math.round(layer.offset * fps)}
          volume={layerVolume(layer, project.layers)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
      {layer.type !== "title" &&
        layer.effects
          .filter((i) => i.enabled)
          .map((i) => {
            const e = project.effects.find((e) => e.id === i.effectId);
            return e && e.tint > 0 ? (
              <AbsoluteFill
                key={i.effectId}
                style={{
                  background: e.color,
                  opacity: Math.min(1, e.tint * i.amount),
                  mixBlendMode: "screen",
                  pointerEvents: "none",
                }}
              />
            ) : null;
          })}
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
