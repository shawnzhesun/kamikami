import React from "react";
import { AbsoluteFill } from "remotion";
import type { Backdrop } from "./backdrops";
import { seeded } from "./motion";

const alpha = (c: string, a: number) =>
  c +
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
const fract = (v: number) => v - Math.floor(v);

/** A full-frame background or finishing overlay at time `t` (clip seconds). */
export function BackdropArt({
  backdrop: b,
  t,
  width: W,
  height: H,
  id,
}: {
  backdrop: Backdrop;
  t: number;
  width: number;
  height: number;
  id: string;
}) {
  const s = t * b.speed;
  const d = b.density;
  const unitSize = Math.min(W, H);
  const fill: React.CSSProperties = { width: W, height: H, overflow: "hidden" };
  switch (b.kind) {
    case "gradient":
      return (
        <AbsoluteFill
          style={{
            ...fill,
            background: `radial-gradient(ellipse at ${50 + 8 * Math.sin(s * 0.3)}% ${42 + 6 * Math.cos(s * 0.23)}%, ${b.secondary}, ${b.color} ${55 + 30 * d}%)`,
          }}
        />
      );
    case "rings": {
      const gap = unitSize * (0.12 - 0.07 * d);
      const count = Math.ceil(Math.hypot(W, H) / 2 / gap) + 1;
      const drift = fract(s * 0.25) * gap;
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          <svg width={W} height={H}>
            {Array.from({ length: count }, (_, k) => (
              <circle
                key={k}
                cx={W / 2}
                cy={H / 2}
                r={k * gap + drift}
                fill="none"
                stroke={b.secondary}
                strokeWidth={gap * 0.12}
                opacity={0.9}
              />
            ))}
          </svg>
        </AbsoluteFill>
      );
    }
    case "halftone": {
      const cell = unitSize * (0.012 + 0.02 * (1 - d));
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(circle, ${b.secondary} 32%, transparent 36%)`,
              backgroundSize: `${cell}px ${cell}px`,
              backgroundPosition: `${(s * cell * 0.5) % cell}px 0`,
              WebkitMaskImage: `linear-gradient(${b.angle}deg, #000 0%, #0008 45%, transparent 85%)`,
              maskImage: `linear-gradient(${b.angle}deg, #000 0%, #0008 45%, transparent 85%)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "rays": {
      const n = Math.round(12 + 36 * d);
      const step = 360 / n;
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: Math.hypot(W, H) * 1.1,
              height: Math.hypot(W, H) * 1.1,
              transform: `translate(-50%,-50%) rotate(${s * 6 + b.angle}deg)`,
              background: `repeating-conic-gradient(${b.secondary} 0deg ${step / 2}deg, transparent ${step / 2}deg ${step}deg)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "stripes": {
      const w = unitSize * (0.02 + 0.08 * (1 - d));
      return (
        <AbsoluteFill
          style={{
            ...fill,
            background: `repeating-linear-gradient(${b.angle}deg, ${b.secondary} 0 ${w}px, ${b.color} ${w}px ${w * 2.4}px)`,
            backgroundPosition: `${s * w}px 0`,
          }}
        />
      );
    }
    case "dots": {
      const cell = unitSize * (0.025 + 0.05 * (1 - d));
      return (
        <AbsoluteFill
          style={{
            ...fill,
            background: b.color,
            backgroundImage: `radial-gradient(circle, ${b.secondary} ${cell * 0.08}px, transparent ${cell * 0.1}px)`,
            backgroundSize: `${cell}px ${cell}px`,
            backgroundPosition: `${(s * cell * 0.2) % cell}px ${(s * cell * 0.1) % cell}px`,
          }}
        />
      );
    }
    case "stars": {
      const n = Math.round(60 + 240 * d);
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          <svg width={W} height={H}>
            {Array.from({ length: n }, (_, k) => {
              const z = seeded(b.seed + 3, k);
              const x = fract(seeded(b.seed, k) - s * 0.01 * (0.3 + z)) * W;
              const y = seeded(b.seed + 1, k) * H;
              const twinkle =
                0.45 +
                0.55 *
                  Math.abs(Math.sin(t * (1 + 3 * seeded(b.seed + 2, k)) + k));
              return (
                <circle
                  key={k}
                  cx={x}
                  cy={y}
                  r={unitSize * (0.0008 + 0.0022 * z)}
                  fill={k % 9 === 0 ? b.accent : b.secondary}
                  opacity={twinkle * (0.4 + 0.6 * z)}
                />
              );
            })}
          </svg>
        </AbsoluteFill>
      );
    }
    case "bars": {
      const n = Math.round(24 + 40 * d);
      const w = W / n;
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          <svg width={W} height={H}>
            {Array.from({ length: n }, (_, k) => {
              // A beat-like envelope: a few sines with seeded phases per bar.
              const level =
                0.18 +
                0.32 * Math.abs(Math.sin(s * 2.1 + seeded(b.seed, k) * 6.28)) +
                0.22 *
                  Math.abs(Math.sin(s * 4.7 + k * 0.35)) *
                  (1 - Math.abs(k / n - 0.5));
              const h = H * 0.42 * level;
              return (
                <rect
                  key={k}
                  x={k * w + w * 0.15}
                  y={H - h}
                  width={w * 0.7}
                  height={h}
                  fill={b.secondary}
                />
              );
            })}
            {Array.from({ length: n }, (_, k) => {
              const peak = 0.55 + 0.3 * Math.abs(Math.sin(s * 1.3 + k));
              return (
                <rect
                  key={`p${k}`}
                  x={k * w + w * 0.15}
                  y={H - H * 0.42 * peak - 8}
                  width={w * 0.7}
                  height={4}
                  fill={b.accent}
                />
              );
            })}
          </svg>
        </AbsoluteFill>
      );
    }
    case "scan": {
      const bands = Math.round(3 + 6 * d);
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          {Array.from({ length: bands }, (_, k) => {
            const h = H * (0.02 + 0.08 * seeded(b.seed, k));
            const y =
              fract(
                seeded(b.seed + 1, k) +
                  s * 0.05 * (0.5 + seeded(b.seed + 2, k)),
              ) *
                (H + h) -
              h;
            return (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: y,
                  height: h,
                  background: alpha(
                    b.secondary,
                    0.18 + 0.25 * seeded(b.seed + 4, k),
                  ),
                  filter: `blur(${h * 0.15}px)`,
                }}
              />
            );
          })}
          <AbsoluteFill
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, ${alpha("#000000", 0.18)} 0 2px, transparent 2px 5px)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "grid": {
      const lines = Math.round(10 + 14 * d);
      const scroll = fract(s * 0.4);
      return (
        <AbsoluteFill
          style={{
            ...fill,
            background: `linear-gradient(${b.color} 0 48%, ${alpha(b.accent, 0.35)} 52%, ${b.color} 60%)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "-50%",
              right: "-50%",
              top: "52%",
              height: "100%",
              transformOrigin: "50% 0%",
              transform: "perspective(600px) rotateX(68deg)",
              backgroundImage: `linear-gradient(${b.secondary} 3px, transparent 3px), linear-gradient(90deg, ${b.secondary} 3px, transparent 3px)`,
              backgroundSize: `${(W * 2) / lines}px ${(W * 2) / lines}px`,
              backgroundPosition: `0 ${scroll * ((W * 2) / lines)}px`,
              WebkitMaskImage: "linear-gradient(transparent, #000 30%)",
              maskImage: "linear-gradient(transparent, #000 30%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "40%",
              width: unitSize * 0.3,
              height: unitSize * 0.3,
              opacity: 0.75,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background: `linear-gradient(${b.accent}, ${b.secondary})`,
              WebkitMaskImage: `linear-gradient(#000 55%, transparent 55% 60%, #000 60% 66%, transparent 66% 70%, #000 70% 75%, transparent 75% 78%, #000 78% 82%, transparent 82%)`,
              maskImage: `linear-gradient(#000 55%, transparent 55% 60%, #000 60% 66%, transparent 66% 70%, #000 70% 75%, transparent 75% 78%, #000 78% 82%, transparent 82%)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "ticker": {
      const rows = Math.round(8 + 14 * d);
      const size = H / rows;
      const phrase = (b.text?.trim() || "KAMIKAMI") + "   /   ";
      const row = phrase.repeat(
        Math.ceil((W * 2.2) / (size * 0.55 * phrase.length)) + 1,
      );
      return (
        <AbsoluteFill style={{ ...fill, background: b.color }}>
          {Array.from({ length: rows }, (_, k) => (
            <div
              key={k}
              style={{
                position: "absolute",
                left: 0,
                top: k * size,
                whiteSpace: "pre",
                fontFamily: "Arial, sans-serif",
                fontWeight: 800,
                fontSize: size * 0.72,
                lineHeight: `${size}px`,
                color: k % 4 === 1 ? b.accent : b.secondary,
                transform: `translateX(${-(fract(s * 0.05 * (k % 2 ? 1 : -1) + seeded(b.seed, k)) * W)}px)`,
              }}
            >
              {row}
            </div>
          ))}
        </AbsoluteFill>
      );
    }
    case "split": {
      const p = 50 + 4 * Math.sin(s * 0.5);
      return (
        <AbsoluteFill
          style={{
            ...fill,
            background: `linear-gradient(${90 + b.angle}deg, ${b.color} ${p - 0.4}%, ${b.accent} ${p - 0.4}% ${p + 0.4}%, ${b.secondary} ${p + 0.4}%)`,
          }}
        />
      );
    }
    case "grain": {
      const tick = Math.floor(t * 12);
      return (
        <AbsoluteFill style={{ ...fill, opacity: 0.25 + 0.75 * d }}>
          <svg width={W} height={H}>
            <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency={0.9}
                numOctaves={2}
                seed={(b.seed + tick * 17) % 1000}
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width={W} height={H} filter={`url(#grain-${id})`} />
          </svg>
        </AbsoluteFill>
      );
    }
    case "scanlines": {
      const pitch = Math.max(3, Math.round(H / 270));
      return (
        <AbsoluteFill
          style={{
            ...fill,
            backgroundImage: `repeating-linear-gradient(0deg, ${alpha(b.color, 0.25 + 0.6 * d)} 0 ${Math.max(1, pitch / 3)}px, transparent ${Math.max(1, pitch / 3)}px ${pitch}px)`,
          }}
        />
      );
    }
    case "vignette":
      return (
        <AbsoluteFill
          style={{
            ...fill,
            background: `radial-gradient(ellipse at center, transparent ${70 - 40 * d}%, ${alpha(b.color, 0.5 + 0.5 * d)} 100%)`,
          }}
        />
      );
    case "leak": {
      const x = 15 + 70 * fract(s * 0.05 + seeded(b.seed, 1));
      return (
        <AbsoluteFill
          style={{
            ...fill,
            opacity: 0.4 + 0.6 * d,
            background: `radial-gradient(ellipse 60% 90% at ${x}% 10%, ${alpha(b.color, 0.85)}, transparent 60%), radial-gradient(ellipse 40% 70% at ${100 - x}% 95%, ${alpha(b.secondary, 0.7)}, transparent 65%)`,
          }}
        />
      );
    }
  }
}
