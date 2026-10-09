import React from "react";
import { effectRandom, type VisualPass } from "./visual-effects";
import { affineMaps, svgImage } from "./graphic-maps";
import { MappedSample } from "./GraphicMapEffects";

/**
 * Shaped and procedural reveals plus lens/film looks, reimplemented from the
 * ideas in open transition and filter catalogs (gl-transitions, PixiJS filters).
 * For reveals, strength 1 means fully hidden: "At clip start" timing reveals,
 * "At clip end" hides. All geometry is a pure function of time and seed.
 */
export const revealKinds = [
  "shape",
  "doors",
  "clock",
  "feather",
  "lumawipe",
  "reflection",
  "tiltshift",
  "oldfilm",
  "ripple",
  "cells",
] as const;
export type RevealKind = (typeof revealKinds)[number];
export const isRevealKind = (kind: string): kind is RevealKind =>
  (revealKinds as readonly string[]).includes(kind);
export const revealMarginKinds: RevealKind[] = ["tiltshift"];

type Control = {
  size?: string;
  speed?: string;
  angle?: string;
  seed?: boolean;
  color?: string;
  secondary?: string;
  count?: string;
  mode?: {
    key:
      | "shapeMode"
      | "doorMode"
      | "clockMode"
      | "cellMode"
      | "rippleMode"
      | "lumaOrder";
    label: string;
    fallback: string;
    options: [string, string][];
  };
  note?: string;
};
export const revealControls: Record<RevealKind, Control> = {
  shape: {
    size: "Edge softness",
    angle: "Rotation",
    color: "Rim color",
    mode: {
      key: "shapeMode",
      label: "Shape",
      fallback: "star",
      options: [
        ["star", "Star"],
        ["heart", "Heart"],
        ["flower", "Flower"],
        ["diamond", "Diamond"],
        ["rect", "Rectangle"],
      ],
    },
    note: "Strength 1 hides the element; At clip start grows the shape open.",
  },
  doors: {
    size: "Edge softness",
    mode: {
      key: "doorMode",
      label: "Doors",
      fallback: "horizontal",
      options: [
        ["horizontal", "Horizontal slit"],
        ["vertical", "Vertical slit"],
        ["bowtie", "Bow-tie"],
      ],
    },
  },
  clock: {
    size: "Edge softness",
    angle: "Start angle",
    count: "Blades",
    mode: {
      key: "clockMode",
      label: "Sweep",
      fallback: "clock",
      options: [
        ["clock", "Clock hand"],
        ["pinwheel", "Pinwheel"],
      ],
    },
  },
  feather: {
    size: "Feather",
    angle: "Direction",
    note: "0° wipes left to right; any angle works, e.g. 45° for a diagonal.",
  },
  lumawipe: {
    size: "Edge sharpness",
    color: "Edge glow",
    mode: {
      key: "lumaOrder",
      label: "Order",
      fallback: "dark",
      options: [
        ["dark", "Dark areas first"],
        ["bright", "Bright areas first"],
      ],
    },
  },
  reflection: {
    size: "Floor height",
    speed: "Ripple speed",
    note: "Mirrors the element below a floor line; strength is reflection opacity. Best on titles and logos with transparency.",
  },
  tiltshift: {
    size: "Sharp band",
    angle: "Band angle",
    note: "Strength sets the blur; adds a little saturation for the miniature look.",
  },
  oldfilm: {
    speed: "Flicker and scratch rate",
    seed: true,
    note: "Sepia, flicker, scratches and dust; combine with Print grain and Memory vignette.",
  },
  ripple: {
    size: "Wavelength",
    speed: "Wave speed",
    mode: {
      key: "rippleMode",
      label: "Ripple",
      fallback: "ripple",
      options: [
        ["ripple", "Continuous ripples"],
        ["shockwave", "Shockwave ring"],
        ["drop", "Water drop"],
      ],
    },
  },
  cells: {
    size: "Cell size",
    seed: true,
    mode: {
      key: "cellMode",
      label: "Cells",
      fallback: "squares",
      options: [
        ["squares", "Growing squares"],
        ["random", "Random tiles"],
        ["checker", "Checkerboard"],
        ["dots", "Polka-dot curtain"],
      ],
    },
  },
};

type Context = {
  pass: VisualPass;
  w: number;
  h: number;
  unit: number;
  s: number;
  z: number;
  time: number;
  tick: number;
  image: (body: string, result?: string) => React.ReactNode;
  merge: (names: string[]) => React.ReactNode;
};
const smooth = (u: number) => {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
};
const fract = (n: number) => n - Math.floor(n);

/** Shape outline as a closed path around (0,0) with radius ~1. */
function shapePoints(shape: string, w: number, h: number): [number, number][] {
  const polar = (n: number, r: (a: number) => number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(a) * r(a), Math.sin(a) * r(a)] as [number, number];
    });
  if (shape === "heart")
    return Array.from({ length: 96 }, (_, i) => {
      const t = (i / 96) * Math.PI * 2;
      return [
        (16 * Math.sin(t) ** 3) / 17,
        -(
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)
        ) / 17,
      ];
    });
  if (shape === "flower")
    return polar(120, (a) => (Math.cos(5 * (a + Math.PI / 2)) + 4) / 5);
  if (shape === "diamond") return polar(4, () => 1);
  if (shape === "rect") {
    const k = w / h;
    return [
      [-k, -1],
      [k, -1],
      [k, 1],
      [-k, 1],
    ].map(([x, y]) => [x / k, y / k] as [number, number]);
  }
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 0.45 : 1;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
/** Radius at which each shape's inner boundary clears the frame corners. */
const coverage: Record<string, number> = {
  star: 2.5,
  heart: 1.9,
  flower: 1.35,
  diamond: 1.45,
  rect: 1.05,
};

const softMask = (c: Context, body: string, blur: number, name = "mask") => (
  <>
    {c.image(body, `${name}-raw`)}
    <feGaussianBlur in={`${name}-raw`} stdDeviation={blur} result={name} />
  </>
);
const reveal = (name = "mask") => (
  <feComposite in="SourceGraphic" in2={name} operator="in" result="revealed" />
);

export function revealFilterNodes(c: Context): React.ReactNode {
  const { pass, w, h, unit, s, z } = c;
  const open = 1 - s;
  const cx = w / 2,
    cy = h / 2;
  const blur = Math.max(0.01, z * 30 * unit);
  switch (pass.kind as RevealKind) {
    case "shape": {
      const shape = pass.shapeMode ?? "star";
      const radius = (Math.hypot(w, h) / 2) * (coverage[shape] ?? 1.5) * open;
      // Stars and flowers turn as they open; other shapes stay aligned to the frame.
      const spin = shape === "star" || shape === "flower" ? open * 40 : 0;
      const rotation = ((pass.angle + spin) * Math.PI) / 180;
      const path = (r: number) =>
        "M" +
        shapePoints(shape, w, h)
          .map(([x, y]) => {
            const px = x * Math.cos(rotation) - y * Math.sin(rotation);
            const py = x * Math.sin(rotation) + y * Math.cos(rotation);
            return `${cx + px * r},${cy + py * r}`;
          })
          .join("L") +
        "Z";
      if (open >= 1) return null;
      const rim = (6 + z * 30) * unit;
      return (
        <>
          {softMask(c, `<path d="${path(radius)}" fill="white"/>`, blur)}
          {reveal()}
          {c.image(
            `<path d="${path(radius)}" fill="none" stroke="${pass.color}" stroke-width="${rim}" stroke-linejoin="round"/>`,
            "rim",
          )}
          <feComposite
            in="rim"
            in2="SourceAlpha"
            operator="in"
            result="rimIn"
          />
          {c.merge(["revealed", "rimIn"])}
        </>
      );
    }
    case "doors": {
      const mode = pass.doorMode ?? "horizontal";
      let body: string;
      if (mode === "bowtie") {
        const reach = open * w * 1.6,
          half = open * h * 1.5;
        body = `<polygon points="0,${cy - half} ${reach},${cy} 0,${cy + half}" fill="white"/><polygon points="${w},${cy - half} ${w - reach},${cy} ${w},${cy + half}" fill="white"/>`;
      } else if (mode === "vertical")
        body = `<rect x="${cx - (open * w) / 2}" y="0" width="${open * w}" height="${h}" fill="white"/>`;
      else
        body = `<rect x="0" y="${cy - (open * h) / 2}" width="${w}" height="${open * h}" fill="white"/>`;
      return (
        <>
          {softMask(c, body, blur)}
          {reveal()}
        </>
      );
    }
    case "clock": {
      const pinwheel = pass.clockMode === "pinwheel";
      const blades = pinwheel ? Math.max(2, pass.count ?? 8) : 1;
      const sector = (Math.PI * 2) / blades;
      const sweep = open * sector;
      const r = Math.hypot(w, h);
      const spin = pinwheel ? c.time * 0.5 : 0;
      const start = ((pass.angle - 90) * Math.PI) / 180 + spin;
      const wedge = (a0: number) => {
        if (sweep >= Math.PI * 2 - 1e-3)
          return `<rect width="${w}" height="${h}" fill="white"/>`;
        const a1 = a0 + sweep;
        const large = sweep > Math.PI ? 1 : 0;
        return `<path d="M${cx},${cy} L${cx + Math.cos(a0) * r},${cy + Math.sin(a0) * r} A${r},${r} 0 ${large} 1 ${cx + Math.cos(a1) * r},${cy + Math.sin(a1) * r} Z" fill="white"/>`;
      };
      const body = Array.from({ length: blades }, (_, i) =>
        wedge(start + i * sector),
      ).join("");
      return (
        <>
          {softMask(c, body, blur)}
          {reveal()}
        </>
      );
    }
    case "feather": {
      const a = (pass.angle * Math.PI) / 180;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const span = Math.abs(dx) * w + Math.abs(dy) * h;
      const feather = 0.02 + z * 0.45;
      const edge = open * (1 + feather) - feather;
      const body = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${cx - (dx * span) / 2}" y1="${cy - (dy * span) / 2}" x2="${cx + (dx * span) / 2}" y2="${cy + (dy * span) / 2}"><stop offset="${Math.max(0, edge)}" stop-color="white"/><stop offset="${Math.min(1, Math.max(0, edge + feather))}" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`;
      if (open <= 0) return null;
      return (
        <>
          {c.image(body, "mask")}
          {reveal()}
        </>
      );
    }
    case "lumawipe": {
      // Threshold the image's own brightness, like a luma-matte wipe.
      const sharp = 6 + (1 - z) * 40;
      const threshold = -0.06 + s * 1.12;
      const bright = pass.lumaOrder === "bright";
      const row = (shift: number) => {
        const k = bright ? -sharp : sharp;
        const offset = bright
          ? sharp * (1 - threshold + shift)
          : -sharp * (threshold - shift);
        return `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${0.3 * k} ${0.59 * k} ${0.11 * k} 0 ${offset}`;
      };
      return (
        <>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values={row(0)}
            result="keep"
          />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values={row(0.08)}
            result="keepWide"
          />
          <feComposite
            in="SourceGraphic"
            in2="keep"
            operator="in"
            result="kept"
          />
          <feComposite in="keepWide" in2="keep" operator="out" result="band" />
          <feFlood floodColor={pass.color} result="edgeColor" />
          <feComposite
            in="edgeColor"
            in2="band"
            operator="in"
            result="edgePaint"
          />
          <feComposite
            in="edgePaint"
            in2="SourceAlpha"
            operator="in"
            result="edge"
          />
          <feGaussianBlur in="edge" stdDeviation={3 * unit} result="edgeGlow" />
          {c.merge(["kept", "edgeGlow", "edge"])}
        </>
      );
    }
    case "reflection": {
      const floor = h * (0.55 + z * 0.4);
      const depth = h - floor;
      // Exact mirror about the floor via an affine sampling map, then a rippling fade.
      const maps = affineMaps(
        [
          {
            matrix: [1, 0, 0, -1, 0, 2 * floor],
            path: `M0 ${floor}h${w}v${depth}h${-w}Z`,
            bounds: [0, floor, w, depth],
          },
        ],
        w,
        h,
      );
      const phase = c.time * Math.PI * 2;
      const stops = Array.from({ length: 17 }, (_, i) => {
        const v = Math.round(
          (0.5 + 0.5 * Math.sin((i / 16) * Math.PI * 2 + phase)) * 255,
        );
        return `<stop offset="${i / 16}" stop-color="rgb(${v},128,0)"/>`;
      }).join("");
      return (
        <>
          <MappedSample maps={maps} name="mirror" width={w} height={h} />
          <feImage
            href={svgImage(
              `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${28 * unit}" spreadMethod="repeat">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
              w,
              h,
            )}
            x={0}
            y={0}
            width={w}
            height={h}
            result="waves"
          />
          <feDisplacementMap
            in="mirror"
            in2="waves"
            scale={6 * unit}
            xChannelSelector="R"
            yChannelSelector="G"
            result="rippled"
          />
          <feGaussianBlur
            in="rippled"
            stdDeviation={1.2 * unit}
            result="soft"
          />
          {c.image(
            `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="${floor / h}" stop-color="white" stop-opacity="${0.55 * s}"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect y="${floor}" width="${w}" height="${depth}" fill="url(#f)"/>`,
            "fade",
          )}
          <feComposite in="soft" in2="fade" operator="in" result="reflected" />
          {c.merge(["reflected", "SourceGraphic"])}
        </>
      );
    }
    case "tiltshift": {
      const a = pass.angle;
      const band = h * (0.06 + z * 0.3);
      const ramp = h * 0.18;
      const mask = (from: number, to: number) => {
        const o = (d: number) => Math.max(0, Math.min(1, 0.5 + d / h));
        return `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}" gradientTransform="rotate(${a} ${cx} ${cy})"><stop offset="${o(-to)}" stop-color="white"/><stop offset="${o(-from)}" stop-color="white" stop-opacity="0"/><stop offset="${o(from)}" stop-color="white" stop-opacity="0"/><stop offset="${o(to)}" stop-color="white"/></linearGradient></defs><rect x="${-w}" y="${-h}" width="${w * 3}" height="${h * 3}" fill="url(#g)"/>`;
      };
      return (
        <>
          <feColorMatrix
            in="SourceGraphic"
            type="saturate"
            values={String(1 + 0.4 * s)}
            result="vivid"
          />
          <feGaussianBlur
            in="vivid"
            stdDeviation={4 * unit * s}
            result="blurA"
          />
          <feGaussianBlur
            in="vivid"
            stdDeviation={11 * unit * s}
            result="blurB"
          />
          {c.image(mask(band, band + ramp), "maskA")}
          {c.image(mask(band + ramp, band + ramp * 2), "maskB")}
          <feComposite in="blurA" in2="maskA" operator="in" result="a" />
          <feComposite in="blurB" in2="maskB" operator="in" result="b" />
          {c.merge(["vivid", "a", "b"])}
        </>
      );
    }
    case "oldfilm": {
      const tick = Math.floor(c.time * 12);
      const rnd = (n: number) => effectRandom(pass.seed + tick * 977, n);
      const flicker = 1 + (rnd(0) - 0.5) * 0.18 * s;
      let marks = "";
      const scratches = Math.floor(rnd(1) * 3.2);
      for (let i = 0; i < scratches; i++) {
        const x = rnd(10 + i) * w;
        const light = rnd(20 + i) > 0.5;
        marks += `<line x1="${x}" y1="0" x2="${x + (rnd(30 + i) - 0.5) * 12 * unit}" y2="${h}" stroke="${light ? "#fff8e8" : "#1a120a"}" stroke-width="${(0.8 + rnd(40 + i) * 1.6) * unit}" opacity="${0.25 + rnd(50 + i) * 0.4}"/>`;
      }
      const specks = Math.floor(rnd(2) * 7);
      for (let i = 0; i < specks; i++)
        marks += `<ellipse cx="${rnd(60 + i) * w}" cy="${rnd(70 + i) * h}" rx="${(1 + rnd(80 + i) * 4) * unit}" ry="${(1 + rnd(90 + i) * 6) * unit}" fill="#120c06" opacity="${0.35 + rnd(100 + i) * 0.4}"/>`;
      // Sepia tone (luminance into warm channels), mixed by strength.
      return (
        <>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0"
            result="sepia"
          />
          <feComposite
            in="sepia"
            in2="SourceGraphic"
            operator="arithmetic"
            k2={0.85 * s}
            k3={1 - 0.85 * s}
            result="toned"
          />
          <feComponentTransfer in="toned" result="flickered">
            <feFuncR type="linear" slope={flicker} />
            <feFuncG type="linear" slope={flicker} />
            <feFuncB type="linear" slope={flicker} />
          </feComponentTransfer>
          {c.image(`<g opacity="${s}">${marks}</g>`, "marks")}
          <feComposite
            in="marks"
            in2="SourceAlpha"
            operator="in"
            result="marksIn"
          />
          {c.merge(["flickered", "marksIn"])}
        </>
      );
    }
    case "ripple": {
      const mode = pass.rippleMode ?? "ripple";
      const rmax = Math.hypot(w, h) / 2;
      const wavelength = (30 + z * 160) * unit;
      const stopsN = 160;
      const t = c.time;
      const profile = (rho: number) => {
        const k = (rho / wavelength) * Math.PI * 2;
        if (mode === "shockwave") {
          const ring = fract(t * 0.25) * rmax * 1.2;
          const d = (rho - ring) / (wavelength * 0.8);
          return Math.abs(d) < 1 ? Math.sin(d * Math.PI) * (1 - d * d) : 0;
        }
        if (mode === "drop") {
          const front = t * wavelength * 1.5;
          const envelope =
            rho < front ? Math.exp(-(front - rho) / (wavelength * 3)) : 0;
          return Math.sin(k - t * 6) * envelope * Math.exp(-t * 0.25);
        }
        return Math.sin(k - t * Math.PI * 2) * (1 - rho / (rmax * 1.1));
      };
      // Direction ramps scale with distance; divide here so wave amplitude stays uniform.
      const stops = Array.from({ length: stopsN + 1 }, (_, i) => {
        const rho = (i / stopsN) * rmax;
        const value =
          profile(rho) * Math.min(4, rmax / Math.max(rho, rmax * 0.05));
        const v = Math.round(
          Math.max(0, Math.min(1, 0.5 + value * 0.125)) * 255,
        );
        return `<stop offset="${i / stopsN}" stop-color="rgb(${v},${v},0)"/>`;
      }).join("");
      const wave = svgImage(
        `<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rmax}">${stops}</radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
        w,
        h,
      );
      const ramp = (axis: "x" | "y") =>
        svgImage(
          `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${axis === "x" ? cx - rmax : 0}" y1="${axis === "y" ? cy - rmax : 0}" x2="${axis === "x" ? cx + rmax : 0}" y2="${axis === "y" ? cy + rmax : 0}"><stop stop-color="${axis === "x" ? "#000000" : "#000000"}"/><stop offset="1" stop-color="${axis === "x" ? "#ff0000" : "#00ff00"}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
          w,
          h,
        );
      return (
        <>
          <feImage
            href={ramp("x")}
            x={0}
            y={0}
            width={w}
            height={h}
            result="dirX"
          />
          <feImage
            href={ramp("y")}
            x={0}
            y={0}
            width={w}
            height={h}
            result="dirY"
          />
          <feComposite
            in="dirX"
            in2="dirY"
            operator="arithmetic"
            k2={1}
            k3={1}
            result="dir"
          />
          <feImage href={wave} x={0} y={0} width={w} height={h} result="wave" />
          {/* Signed product around 0.5: 0.5 + 2(d−0.5)(w−0.5). */}
          <feComposite
            in="dir"
            in2="wave"
            operator="arithmetic"
            k1={2}
            k2={-1}
            k3={-1}
            k4={1}
            result="field"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="field"
            scale={s * (40 + z * 60) * unit * 4}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </>
      );
    }
    case "cells": {
      const cols = Math.max(4, Math.round(4 + z * 20));
      const cell = w / cols;
      const rows = Math.ceil(h / cell);
      const mode = pass.cellMode ?? "squares";
      let body = "";
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const ccx = (x + 0.5) * cell,
            ccy = (y + 0.5) * cell;
          let v: number;
          if (mode === "random")
            v = smooth((open - effectRandom(pass.seed, i) * 0.85) / 0.15);
          else if (mode === "checker") {
            const phase = (x + y) % 2 ? 0.5 : 0;
            v = smooth((open - phase) / 0.5);
          } else if (mode === "dots") {
            const d =
              Math.hypot(ccx - w / 2, ccy - h / 2) / (Math.hypot(w, h) / 2);
            v = smooth((open * 1.6 - d * 0.6) / 1);
          } else {
            const order = (ccx / w + ccy / h) / 2;
            v = smooth((open * 1.5 - order * 0.5) / 1);
          }
          if (v <= 0) continue;
          if (mode === "dots")
            body += `<circle cx="${ccx}" cy="${ccy}" r="${v * cell * 0.75}" fill="white"/>`;
          else {
            const size = v * cell + 1;
            body += `<rect x="${ccx - size / 2}" y="${ccy - size / 2}" width="${size}" height="${size}" fill="white"/>`;
          }
        }
      if (open >= 1) return null;
      return (
        <>
          {c.image(body, "mask")}
          {reveal()}
        </>
      );
    }
  }
  return null;
}
