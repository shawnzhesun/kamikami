import React from "react";
import { fieldFrames, particleFrames, particleFrame } from "./motion";
import { affineMaps, svgImage, type SampleMatrix } from "./graphic-maps";
import { MappedSample } from "./GraphicMapEffects";
import type { VisualPass } from "./visual-effects";
import { frameUnit } from "./model";

/** Repeated artwork samples one SourceGraphic; media decoders are never duplicated. */
export function ObjectField({
  pass,
  time,
  strength,
  width: w,
  height: h,
}: {
  pass: VisualPass;
  time: number;
  strength: number;
  width: number;
  height: number;
}) {
  const frames = fieldFrames(pass.field!, time, pass.seed).filter(
    (f) => f.opacity > 0.001,
  );
  return (
    <>
      {frames.map((f) => {
        const theta = (f.rotation * Math.PI) / 180;
        const sx = Math.max(0.01, f.scale * Math.cos((f.tilt * Math.PI) / 180)),
          sy = f.scale;
        const cx = w / 2 + (f.x * w) / 2,
          cy = h / 2 + (f.y * h) / 2;
        const a = Math.cos(theta) / sx,
          c = Math.sin(theta) / sx;
        const b = -Math.sin(theta) / sy,
          d = Math.cos(theta) / sy;
        const matrix: SampleMatrix = [
          a,
          b,
          c,
          d,
          w / 2 - a * cx - c * cy,
          h / 2 - b * cx - d * cy,
        ];
        const points = [
          [-w / 2, -h / 2],
          [w / 2, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ].map(([x, y]) => [
          cx + Math.cos(theta) * x * sx - Math.sin(theta) * y * sy,
          cy + Math.sin(theta) * x * sx + Math.cos(theta) * y * sy,
        ]);
        const path =
          points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + "Z";
        const left = Math.min(...points.map((p) => p[0])),
          top = Math.min(...points.map((p) => p[1]));
        const right = Math.max(...points.map((p) => p[0])),
          bottom = Math.max(...points.map((p) => p[1]));
        const maps = affineMaps(
          [{ matrix, path, bounds: [left, top, right - left, bottom - top] }],
          w,
          h,
        );
        const name = `object${f.id}`;
        return (
          <React.Fragment key={f.id}>
            <MappedSample maps={maps} name={name} width={w} height={h} />
            <feImage
              href={svgImage(`<path d="${path}" fill="white"/>`, w, h)}
              x={0}
              y={0}
              width={w}
              height={h}
              result={`${name}mask`}
            />
            <feComposite
              in={name}
              in2={`${name}mask`}
              operator="in"
              result={`${name}cut`}
            />
            <feGaussianBlur
              in={`${name}cut`}
              stdDeviation={f.blur * frameUnit({ width: w, height: h })}
              result={`${name}blur`}
            />
            <feComponentTransfer in={`${name}blur`} result={`${name}alpha`}>
              <feFuncA type="linear" slope={strength * f.opacity} />
            </feComponentTransfer>
          </React.Fragment>
        );
      })}
      <feComponentTransfer in="SourceGraphic" result="original">
        <feFuncA type="linear" slope={1 - strength} />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="original" />
        {frames.map((f) => (
          <feMergeNode key={f.id} in={`object${f.id}alpha`} />
        ))}
      </feMerge>
    </>
  );
}

export function depthParticleSvg(
  pass: VisualPass,
  time: number,
  strength: number,
  w: number,
  h: number,
) {
  const config = pass.particles!;
  const unit = frameUnit({ width: w, height: h });
  return particleFrames(config, time, pass.seed)
    .map((f) => {
      if (f.opacity < 0.001) return "";
      const x = w / 2 + (f.x * w) / 2,
        y = h / 2 + (f.y * h) / 2;
      const size = (1 + pass.size * 18) * unit * f.scale;
      const color = f.colorIndex < 0.5 ? pass.color : pass.secondary;
      const shape =
        config.shape === "paper"
          ? `<path d="M${-size} ${-size / 2}L${size} ${-size / 2}L${size * 0.7} ${size / 2}L${-size} ${size / 2}Z"/>`
          : config.shape === "spark"
            ? `<path d="M${-size * 2} 0H${size * 2}" stroke="${color}" stroke-width="${Math.max(0.2, size * 0.4)}"/>`
            : `<circle r="${size}"/>`;
      const previous = particleFrame(
        config,
        Math.max(0, time - config.trails * 0.25),
        pass.seed,
        f.id,
      );
      const trail =
        config.trails > 0 && previous.life <= f.life
          ? `<path d="M${w / 2 + (previous.x * w) / 2} ${h / 2 + (previous.y * h) / 2}L${x} ${y}" stroke="${color}" stroke-width="${Math.max(0.2, size * 0.5)}" opacity="${strength * f.opacity * 0.5}" stroke-linecap="round"/>`
          : "";
      const blur = f.blur * unit;
      return `${blur > 0.1 ? `<defs><filter id="b${f.id}" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>` : ""}${trail}<g fill="${color}" opacity="${strength * f.opacity}" transform="translate(${x} ${y}) rotate(${f.rotation})" ${blur > 0.1 ? `filter="url(#b${f.id})"` : ""}>${shape}</g>`;
    })
    .join("");
}
