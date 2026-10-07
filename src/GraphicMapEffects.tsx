import React, { memo } from "react";
import {
  affineMaps,
  centeredMatrix,
  rectangle,
  repeatRegions,
} from "./graphic-maps";
import type { VisualPass } from "./visual-effects";

function MappedSample({
  maps,
  name,
  width,
  height,
}: {
  maps: ReturnType<typeof affineMaps>;
  name: string;
  width: number;
  height: number;
}) {
  return (
    <>
      <feImage
        href={maps.x}
        width={width}
        height={height}
        x={0}
        y={0}
        result={`${name}x`}
      />
      <feImage
        href={maps.y}
        width={width}
        height={height}
        x={0}
        y={0}
        result={`${name}y`}
      />
      <feComposite
        in={`${name}x`}
        in2={`${name}y`}
        operator="arithmetic"
        k2={1}
        k3={1}
        result={`${name}map`}
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2={`${name}map`}
        scale={maps.scale}
        xChannelSelector="R"
        yChannelSelector="G"
        result={name}
      />
    </>
  );
}

/** Sample SourceGraphic directly: never mount extra video/audio players for copies. */
export const GraphicMapEffects = memo(function GraphicMapEffects({
  pass,
  strength,
  time,
  width: w,
  height: h,
}: {
  pass: VisualPass;
  strength: number;
  time: number;
  width: number;
  height: number;
}) {
  if (pass.kind === "repeat") {
    const maps = affineMaps(
      repeatRegions(
        pass.repeatMode ?? "mirror",
        pass.count ?? 6,
        pass.size,
        (pass.angle * Math.PI) / 180 + time * 0.15,
        w,
        h,
      ),
      w,
      h,
    );
    return (
      <>
        <MappedSample maps={maps} name="repeat" width={w} height={h} />
        <feComposite
          in="repeat"
          in2="SourceGraphic"
          operator="arithmetic"
          k2={strength}
          k3={1 - strength}
        />
      </>
    );
  }
  const samples = 12,
    mode = pass.smearMode ?? "zoom";
  return (
    <>
      {Array.from({ length: samples }, (_, i) => {
        const u = i / (samples - 1),
          amount = pass.size * strength * u;
        const angle = (pass.angle * Math.PI) / 180;
        const matrix =
          mode === "directional"
            ? ([
                1,
                0,
                0,
                1,
                Math.cos(angle) * w * amount * 0.16,
                Math.sin(angle) * h * amount * 0.28,
              ] as [number, number, number, number, number, number])
            : centeredMatrix(
                w,
                h,
                mode === "zoom" ? 1 + amount * 0.65 : 1,
                mode === "spin" ? amount * angle : 0,
              );
        const maps = affineMaps(
          [{ matrix, path: rectangle(0, 0, w, h) }],
          w,
          h,
        );
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <MappedSample
                maps={maps}
                name={`sample${i}`}
                width={w}
                height={h}
              />
            )}
            {i === 0 ? (
              <feOffset in="SourceGraphic" dx={0} dy={0} result="average0" />
            ) : (
              <feComposite
                in={`sample${i}`}
                in2={`average${i - 1}`}
                operator="arithmetic"
                k2={1 / (i + 1)}
                k3={i / (i + 1)}
                result={`average${i}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
});
