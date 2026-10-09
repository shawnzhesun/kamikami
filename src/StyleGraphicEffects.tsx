import React from "react";
import { effectRandom, type VisualPass } from "./visual-effects";
import { svgImage } from "./graphic-maps";

/**
 * Illustration, 3D-look, light and organic transition passes. Every primitive
 * is a pure function of the frame time and seed, so preview and export match.
 */
export const styleKinds = [
  "warp",
  "bevel",
  "extrude",
  "sheen",
  "paper",
  "ink",
  "pixel",
  "dissolve",
  "goo",
  "glow",
  "lens",
] as const;
export type StyleKind = (typeof styleKinds)[number];
export const isStyleKind = (kind: string): kind is StyleKind =>
  (styleKinds as readonly string[]).includes(kind);
/** Passes whose output extends beyond the element's own alpha. */
export const styleMarginKinds: StyleKind[] = [
  "warp",
  "extrude",
  "paper",
  "goo",
  "glow",
];

/** Settings-dialog controls, so each kind only shows parameters it reads. */
export const styleControls: Record<
  StyleKind,
  {
    size?: string;
    speed?: string;
    angle?: string;
    seed?: boolean;
    color?: string;
    secondary?: string;
    mode?: {
      key: "warpMode" | "sheenStyle" | "pixelMode";
      label: string;
      fallback: string;
      options: [string, string][];
    };
    note?: string;
  }
> = {
  warp: {
    size: "Warp scale",
    speed: "Evolution / boil rate",
    seed: true,
    mode: {
      key: "warpMode",
      label: "Warp style",
      fallback: "boil",
      options: [
        ["boil", "Line boil (stepped)"],
        ["liquid", "Liquid (smooth)"],
        ["melt", "Melt (downward)"],
      ],
    },
    note: "Boil steps the noise at speed × 12 frames per second for a hand-drawn wobble.",
  },
  bevel: {
    size: "Bevel depth",
    speed: "Light orbit speed",
    angle: "Light direction",
    color: "Highlight color",
  },
  extrude: {
    size: "Extrusion depth",
    angle: "Direction",
    color: "Side color",
    secondary: "Far edge color",
    note: "Strength sets side opacity; keyframe Extrusion depth to grow the solid.",
  },
  sheen: {
    size: "Band width",
    speed: "Sweeps per second ÷ 2",
    angle: "Band angle",
    color: "Sheen color",
    mode: {
      key: "sheenStyle",
      label: "Sheen style",
      fallback: "gloss",
      options: [
        ["gloss", "Gloss band"],
        ["foil", "Holographic foil"],
      ],
    },
  },
  paper: {
    size: "Border width",
    speed: "Stop-motion rate",
    angle: "Shadow direction",
    seed: true,
    color: "Paper color",
    secondary: "Shadow color",
  },
  ink: {
    size: "Line weight",
    color: "Ink color",
    note: "Strength blends the toon render; detail lines come from image edges.",
  },
  pixel: {
    size: "Pixel size",
    color: "Light color",
    secondary: "Dark color",
    mode: {
      key: "pixelMode",
      label: "Pixel style",
      fallback: "pixelate",
      options: [
        ["pixelate", "Pixelate"],
        ["dither", "1-bit dither"],
        ["gameboy", "Four-tone handheld"],
      ],
    },
    note: "Use timing At clip start for a pixel-in transition.",
  },
  dissolve: {
    size: "Noise scale",
    seed: true,
    color: "Burn edge color",
    note: "Strength 1 is fully dissolved; At clip start reveals, At clip end burns away.",
  },
  goo: {
    size: "Melt radius",
    note: "Blurs and re-thresholds alpha so shapes merge like liquid.",
  },
  glow: {
    size: "Glow size",
    speed: "Flicker speed",
    seed: true,
    color: "Glow color",
    secondary: "Core color",
  },
  lens: {
    size: "Lens radius",
    speed: "Sweep speed",
    angle: "Sweep angle",
    color: "Rim color",
    note: "Speed 0 parks the lens at the center.",
  },
};

const hex = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
const fract = (n: number) => n - Math.floor(n);

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
  overlay: (
    body: string,
    mode?: "normal" | "screen" | "multiply",
  ) => React.ReactNode;
  merge: (names: string[]) => React.ReactNode;
};

/** Crossfade two noise seeds so displacement evolves smoothly instead of popping. */
function evolvingNoise(
  c: Context,
  baseFrequency: string,
  octaves: number,
  result: string,
) {
  const step = Math.floor(c.time);
  const blend = c.time - step;
  return (
    <>
      <feTurbulence
        type="fractalNoise"
        baseFrequency={baseFrequency}
        numOctaves={octaves}
        seed={(c.pass.seed + step) % 65535}
        result={`${result}-a`}
      />
      <feTurbulence
        type="fractalNoise"
        baseFrequency={baseFrequency}
        numOctaves={octaves}
        seed={(c.pass.seed + step + 1) % 65535}
        result={`${result}-b`}
      />
      <feComposite
        in={`${result}-a`}
        in2={`${result}-b`}
        operator="arithmetic"
        k2={1 - blend}
        k3={blend}
        result={result}
      />
    </>
  );
}

export function styleFilterNodes(c: Context): React.ReactNode {
  const { pass, w, h, unit, s, z } = c;
  switch (pass.kind) {
    case "warp": {
      const mode = pass.warpMode ?? "boil";
      if (mode === "boil") {
        const frequency = (0.012 + (1 - z) * 0.04) / unit;
        return (
          <>
            <feTurbulence
              type="turbulence"
              baseFrequency={frequency}
              numOctaves={2}
              seed={(pass.seed + c.tick) % 65535}
              result="boil"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="boil"
              scale={(2 + z * 10) * unit * s * 2}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </>
        );
      }
      const frequency = (0.0015 + (1 - z) * 0.006) / unit;
      if (mode === "liquid")
        return (
          <>
            {evolvingNoise(c, String(frequency), 2, "flow")}
            <feDisplacementMap
              in="SourceGraphic"
              in2="flow"
              scale={(30 + z * 140) * unit * s}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </>
        );
      // Melt: horizontal streaks displace sampling upward only, so paint drips down.
      return (
        <>
          {evolvingNoise(c, `${frequency * 6} ${frequency * 0.6}`, 1, "drip")}
          <feColorMatrix
            in="drip"
            type="matrix"
            values="0 0 0 0 0.5  0 1 0 0 -0.5  0 0 0 0 0  0 0 0 0 1"
            result="down"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="down"
            scale={(80 + z * 320) * unit * s}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </>
      );
    }
    case "bevel": {
      const blur = (1.5 + z * 9) * unit;
      const elevation = 40;
      // Normalize diffuse light so flat faces keep their original brightness.
      const diffuse = 1 / Math.sin((elevation * Math.PI) / 180);
      const light = (
        <feDistantLight
          azimuth={pass.angle + c.time * 60}
          elevation={elevation}
        />
      );
      return (
        <>
          <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="bump" />
          <feDiffuseLighting
            in="bump"
            surfaceScale={3 + z * 10}
            diffuseConstant={diffuse}
            lightingColor="#ffffff"
            result="diffuse"
          >
            {light}
          </feDiffuseLighting>
          <feBlend
            in="diffuse"
            in2="SourceGraphic"
            mode="multiply"
            result="shaded"
          />
          <feComposite
            in="shaded"
            in2="SourceAlpha"
            operator="in"
            result="lit"
          />
          <feSpecularLighting
            in="bump"
            surfaceScale={3 + z * 10}
            specularConstant={0.9}
            specularExponent={22}
            lightingColor={pass.color}
            result="specular"
          >
            {light}
          </feSpecularLighting>
          <feComposite
            in="specular"
            in2="SourceAlpha"
            operator="in"
            result="shine"
          />
          <feComposite
            in="lit"
            in2="shine"
            operator="arithmetic"
            k2={1}
            k3={0.85}
            result="bevelled"
          />
          <feComposite
            in="bevelled"
            in2="SourceGraphic"
            operator="arithmetic"
            k2={s}
            k3={1 - s}
          />
        </>
      );
    }
    case "extrude": {
      const depth = Math.max(1, (2 + z * 120) * unit);
      const a = (pass.angle * Math.PI) / 180;
      const nodes: React.ReactNode[] = [];
      // Union of shifted alphas by doubling steps: log2(depth) primitives, not depth.
      let current = "SourceAlpha",
        covered = 0,
        step = 1;
      for (let i = 0; covered < depth && i < 9; i++) {
        const shift = Math.min(step, depth - covered);
        nodes.push(
          <feOffset
            key={`o${i}`}
            in={current}
            dx={Math.cos(a) * shift}
            dy={Math.sin(a) * shift}
            result={`shift${i}`}
          />,
          <feMerge key={`m${i}`} result={`solid${i}`}>
            <feMergeNode in={current} />
            <feMergeNode in={`shift${i}`} />
          </feMerge>,
        );
        current = `solid${i}`;
        covered += shift;
        step *= 2;
      }
      const near = hex(pass.color),
        far = hex(pass.secondary);
      return (
        <>
          {nodes}
          {/* Side shading runs from the near color to the far color along the extrusion. */}
          <feImage
            href={svgImage(
              `<defs><linearGradient id="g" x1="0.5" y1="0.5" x2="${0.5 + Math.cos(a) * 0.5}" y2="${0.5 + Math.sin(a) * 0.5}"><stop stop-color="${pass.color}"/><stop offset="1" stop-color="${pass.secondary}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
              w,
              h,
            )}
            x={0}
            y={0}
            width={w}
            height={h}
            result="sidePaint"
          />
          <feFlood
            floodColor={`rgb(${near.map((n, i) => Math.round(((n + far[i]) / 2) * 255)).join(",")})`}
            result="sideFlat"
          />
          <feMerge result="sideFill">
            <feMergeNode in="sideFlat" />
            <feMergeNode in="sidePaint" />
          </feMerge>
          <feComposite
            in="sideFill"
            in2={current}
            operator="in"
            result="sides"
          />
          <feComponentTransfer in="sides" result="sidesFaded">
            <feFuncA type="linear" slope={s} />
          </feComponentTransfer>
          {c.merge(["sidesFaded", "SourceGraphic"])}
        </>
      );
    }
    case "sheen": {
      const foil = pass.sheenStyle === "foil";
      const p = fract(c.time * 0.5) * 1.8 - 0.4;
      const width = 0.04 + z * 0.3;
      const band = `<stop offset="${p - width}" stop-color="${pass.color}" stop-opacity="0"/><stop offset="${p}" stop-color="${pass.color}" stop-opacity="1"/><stop offset="${p + width}" stop-color="${pass.color}" stop-opacity="0"/>`;
      const hues = Array.from({ length: 7 }, (_, i) => {
        const hue = (i * 60 + c.time * 90) % 360;
        return `<stop offset="${i / 6}" stop-color="hsl(${hue},90%,65%)"/>`;
      }).join("");
      const rotate = `rotate(${pass.angle} .5 .5)`;
      const body = foil
        ? `<defs><linearGradient id="f" gradientTransform="${rotate}" spreadMethod="reflect" x2="0.5">${hues}</linearGradient><linearGradient id="g" gradientTransform="${rotate}">${band}</linearGradient></defs><rect width="100%" height="100%" fill="url(#f)" opacity="${s * 0.45}"/><rect width="100%" height="100%" fill="url(#g)" opacity="${s * 0.8}"/>`
        : `<defs><linearGradient id="g" gradientTransform="${rotate}">${band}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" opacity="${s}"/>`;
      return c.overlay(body, "screen");
    }
    case "paper": {
      const border = (4 + z * 22) * unit;
      const a = (pass.angle * Math.PI) / 180;
      const shadow = (4 + z * 10) * unit;
      // Stop-motion: the torn edge re-randomizes a few times per second.
      const seed = (pass.seed + Math.floor(c.time * 6)) % 65535;
      return (
        <>
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={border}
            result="grown"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.035 / unit}
            numOctaves={3}
            seed={seed}
            result="tear"
          />
          <feDisplacementMap
            in="grown"
            in2="tear"
            scale={border * 1.4}
            xChannelSelector="R"
            yChannelSelector="G"
            result="cut"
          />
          <feFlood floodColor={pass.color} result="paperColor" />
          <feComposite in="paperColor" in2="cut" operator="in" result="sheet" />
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.6 / unit}
            numOctaves={2}
            seed={pass.seed}
            result="fiber"
          />
          <feColorMatrix
            in="fiber"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.35 0.35 0.35 0 -0.3"
            result="fiberShade"
          />
          <feComposite
            in="fiberShade"
            in2="sheet"
            operator="atop"
            result="textured"
          />
          <feGaussianBlur in="cut" stdDeviation={shadow * 0.6} result="soft" />
          <feOffset
            in="soft"
            dx={Math.cos(a) * shadow}
            dy={Math.sin(a) * shadow}
            result="dropped"
          />
          <feFlood
            floodColor={pass.secondary}
            floodOpacity={0.5}
            result="shade"
          />
          <feComposite in="shade" in2="dropped" operator="in" result="shadow" />
          <feMerge result="cutout">
            <feMergeNode in="shadow" />
            <feMergeNode in="textured" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
          <feComposite
            in="cutout"
            in2="SourceGraphic"
            operator="arithmetic"
            k2={s}
            k3={1 - s}
          />
        </>
      );
    }
    case "ink": {
      const weight = Math.max(0.5, (0.5 + z * 3) * unit);
      const levels = 4;
      const steps = Array.from(
        { length: levels },
        (_, i) => i / (levels - 1),
      ).join(" ");
      return (
        <>
          <feComponentTransfer in="SourceGraphic" result="flat">
            <feFuncR type="discrete" tableValues={steps} />
            <feFuncG type="discrete" tableValues={steps} />
            <feFuncB type="discrete" tableValues={steps} />
          </feComponentTransfer>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"
            result="luma"
          />
          <feConvolveMatrix
            in="luma"
            order={3}
            kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
            preserveAlpha="true"
            result="edges"
          />
          <feColorMatrix
            in="edges"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 4 4 0 -0.35"
            result="detail"
          />
          <feMorphology
            in="SourceAlpha"
            operator="erode"
            radius={weight}
            result="inner"
          />
          <feComposite
            in="SourceAlpha"
            in2="inner"
            operator="out"
            result="contour"
          />
          <feMerge result="lineMask">
            <feMergeNode in="detail" />
            <feMergeNode in="contour" />
          </feMerge>
          <feMorphology
            in="lineMask"
            operator="dilate"
            radius={weight * 0.5}
            result="lines"
          />
          <feFlood floodColor={pass.color} result="inkColor" />
          <feComposite in="inkColor" in2="lines" operator="in" result="ink" />
          <feComposite
            in="ink"
            in2="SourceAlpha"
            operator="in"
            result="inked"
          />
          <feMerge result="toon">
            <feMergeNode in="flat" />
            <feMergeNode in="inked" />
          </feMerge>
          <feComposite
            in="toon"
            in2="SourceGraphic"
            operator="arithmetic"
            k2={s}
            k3={1 - s}
          />
        </>
      );
    }
    case "pixel": {
      const mode = pass.pixelMode ?? "pixelate";
      const target = Math.max(3, (4 + z * 44) * unit);
      const cell = Math.max(1, Math.round(1 + (target - 1) * s));
      if (cell <= 1 && mode === "pixelate") return null;
      // A sample patch of a third of the cell survives downscaled previews,
      // where a 1-unit dot would fall below one device pixel.
      const dot = Math.max(1, cell / 3);
      const half = (cell - dot) / 2;
      // Classic sample-and-dilate pixelation: one sample per cell, grown to fill it.
      const pixelate = (
        <>
          <feFlood x={half} y={half} width={dot} height={dot} result="dot" />
          <feComposite
            in="dot"
            in2="dot"
            operator="over"
            x={0}
            y={0}
            width={cell}
            height={cell}
            result="cell"
          />
          <feTile in="cell" x={0} y={0} width={w} height={h} result="grid" />
          <feComposite
            in="SourceGraphic"
            in2="grid"
            operator="in"
            result="samples"
          />
          <feMorphology
            in="samples"
            operator="dilate"
            radius={half}
            result="pixels"
          />
        </>
      );
      if (mode === "pixelate") return pixelate;
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      const tile = bayer
        .map(
          (v, i) =>
            `<rect x="${(i % 4) * cell}" y="${Math.floor(i / 4) * cell}" width="${cell}" height="${cell}" fill="rgb(${Math.round(((v + 0.5) / 16) * 255)},0,0)"/>`,
        )
        .join("");
      const palette =
        mode === "gameboy"
          ? ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"]
          : [pass.secondary, pass.color];
      const table = (channel: number) =>
        palette.map((color) => hex(color)[channel]).join(" ");
      const levels = palette.length - 1;
      return (
        <>
          {pixelate}
          <feColorMatrix
            in="pixels"
            type="matrix"
            values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"
            result="gray"
          />
          <feImage
            href={svgImage(tile, cell * 4, cell * 4)}
            x={0}
            y={0}
            width={cell * 4}
            height={cell * 4}
            result="bayerCell"
          />
          <feTile
            in="bayerCell"
            x={0}
            y={0}
            width={w}
            height={h}
            result="bayer"
          />
          <feColorMatrix
            in="bayer"
            type="matrix"
            values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"
            result="threshold"
          />
          {/* gray + (bayer - 0.5) / levels, then quantize into the palette. */}
          <feComposite
            in="gray"
            in2="threshold"
            operator="arithmetic"
            k2={1}
            k3={1 / levels}
            k4={-0.5 / levels}
            result="dithered"
          />
          <feComponentTransfer in="dithered" result="paletted">
            <feFuncR type="discrete" tableValues={table(0)} />
            <feFuncG type="discrete" tableValues={table(1)} />
            <feFuncB type="discrete" tableValues={table(2)} />
          </feComponentTransfer>
          <feComposite in="paletted" in2="pixels" operator="in" />
        </>
      );
    }
    case "dissolve": {
      const frequency = (0.003 + (1 - z) * 0.02) / unit;
      // Spread noise to 0..1, then threshold at a progress that sweeps past both ends.
      const threshold = -0.08 + s * 1.16;
      const sharp = 18;
      const edge = 0.1;
      return (
        <>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={frequency}
            numOctaves={3}
            seed={pass.seed}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${2.4 * sharp} 0 0 0 ${(-0.7 - threshold) * sharp}`}
            result="keep"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${2.4 * sharp} 0 0 0 ${(-0.7 - threshold + edge) * sharp}`}
            result="keepWide"
          />
          <feComposite
            in="SourceGraphic"
            in2="keep"
            operator="in"
            result="kept"
          />
          <feComposite in="keepWide" in2="keep" operator="out" result="rim" />
          <feFlood floodColor={pass.color} result="burnColor" />
          <feComposite in="burnColor" in2="rim" operator="in" result="burnt" />
          <feComposite
            in="burnt"
            in2="SourceAlpha"
            operator="in"
            result="burn"
          />
          <feGaussianBlur in="burn" stdDeviation={4 * unit} result="ember" />
          {c.merge(["kept", "ember", "burn"])}
        </>
      );
    }
    case "goo": {
      const blur = (4 + z * 60) * unit * s;
      return (
        <>
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={blur}
            result="blurred"
          />
          <feColorMatrix
            in="blurred"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            result="goo"
          />
          <feComposite
            in="SourceGraphic"
            in2="goo"
            operator="atop"
            result="inside"
          />
          {c.merge(["goo", "inside"])}
        </>
      );
    }
    case "glow": {
      const size = 0.5 + z * 2;
      const flicker =
        0.7 + 0.3 * effectRandom(pass.seed, Math.floor(c.time * 12));
      const strength = s * flicker;
      return (
        <>
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={(1 + z * 3) * unit}
            result="outer"
          />
          <feComposite
            in="outer"
            in2="SourceAlpha"
            operator="out"
            result="edge"
          />
          <feTurbulence
            type="turbulence"
            baseFrequency={0.02 / unit}
            numOctaves={2}
            seed={(pass.seed + c.tick) % 65535}
            result="arc"
          />
          <feDisplacementMap
            in="edge"
            in2="arc"
            scale={(4 + z * 14) * unit}
            xChannelSelector="R"
            yChannelSelector="G"
            result="charged"
          />
          <feFlood floodColor={pass.secondary} result="coreColor" />
          <feComposite
            in="coreColor"
            in2="charged"
            operator="in"
            result="core"
          />
          <feFlood floodColor={pass.color} result="glowColor" />
          <feComposite
            in="glowColor"
            in2="charged"
            operator="in"
            result="tinted"
          />
          {[4, 12, 32].map((radius, i) => (
            <React.Fragment key={radius}>
              <feGaussianBlur
                in="tinted"
                stdDeviation={radius * unit * size}
                result={`blur${i}`}
              />
              <feComponentTransfer in={`blur${i}`} result={`halo${i}`}>
                <feFuncA type="linear" slope={strength * (2.2 - i * 0.5)} />
              </feComponentTransfer>
            </React.Fragment>
          ))}
          <feComponentTransfer in="core" result="coreFaded">
            <feFuncA type="linear" slope={strength} />
          </feComponentTransfer>
          {c.merge(["halo2", "halo1", "halo0", "SourceGraphic", "coreFaded"])}
        </>
      );
    }
    case "lens": {
      const radius = Math.min(w, h) * (0.08 + z * 0.35);
      const a = (pass.angle * Math.PI) / 180;
      const travel = pass.speed > 0 ? fract(c.time * 0.25) * 2 - 1 : 0;
      const reach = (Math.hypot(w, h) / 2 + radius) * travel;
      const cx = w / 2 + Math.cos(a) * reach,
        cy = h / 2 + Math.sin(a) * reach;
      const magnify = 1 + s * 0.9;
      // Linear ramps inside the circle give uniform magnification (8-bit steps ≈ 1px).
      const map = (axis: "x" | "y") =>
        svgImage(
          `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${axis === "x" ? cx - radius : cx}" y1="${axis === "y" ? cy - radius : cy}" x2="${axis === "x" ? cx + radius : cx}" y2="${axis === "y" ? cy + radius : cy}"><stop stop-color="${axis === "x" ? "#000000" : "#000000"}"/><stop offset="1" stop-color="${axis === "x" ? "#ff0000" : "#00ff00"}"/></linearGradient></defs><rect width="100%" height="100%" fill="${axis === "x" ? "#800000" : "#008000"}"/><circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#g)"/>`,
          w,
          h,
        );
      return (
        <>
          <feImage
            href={map("x")}
            x={0}
            y={0}
            width={w}
            height={h}
            result="mapX"
          />
          <feImage
            href={map("y")}
            x={0}
            y={0}
            width={w}
            height={h}
            result="mapY"
          />
          <feComposite
            in="mapX"
            in2="mapY"
            operator="arithmetic"
            k2={1}
            k3={1}
            result="map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={2 * radius * (1 / magnify - 1)}
            xChannelSelector="R"
            yChannelSelector="G"
            result="magnified"
          />
          {c.image(
            `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${pass.color}" stroke-width="${3 * unit}" opacity="${0.35 + s * 0.4}"/><circle cx="${cx - radius * 0.35}" cy="${cy - radius * 0.4}" r="${radius * 0.18}" fill="${pass.color}" opacity="${0.12 * s}"/>`,
            "rim",
          )}
          <feComposite
            in="rim"
            in2="SourceAlpha"
            operator="in"
            result="rimClip"
          />
          {c.merge(["magnified", "rimClip"])}
        </>
      );
    }
  }
  return null;
}
