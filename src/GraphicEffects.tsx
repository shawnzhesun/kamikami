import React, { useId } from "react";
import { effectRandom, visualFrame, type VisualPass } from "./visual-effects";
import { frameUnit, type Effect, type Layer } from "./model";
import { instanceAmountAt, resolveEffectInstanceAt } from "./effect-instance";
import { GraphicMapEffects } from "./GraphicMapEffects";
import { stretchedImage, svgImage } from "./graphic-maps";
import { ObjectField, depthParticleSvg } from "./SpatialGraphicEffects";
import {
  isRevealKind,
  revealFilterNodes,
  revealMarginKinds,
} from "./TransitionGraphicEffects";
import {
  isStyleKind,
  styleFilterNodes,
  styleMarginKinds,
} from "./StyleGraphicEffects";

const rgb = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);

/**
 * The whole number of pixels, within `min`–`max`, that holds a whole number
 * of repeats closest to one every `period` pixels (none when `period` is 0
 * or longer than the cell).
 */
function wholeCell(period: number, min: number, max: number) {
  let best = { size: min, count: 0, error: Infinity };
  for (let size = min; size <= max; size++) {
    const count = period ? Math.round(size / period) : 0;
    const error = Math.abs(count / size - (period ? 1 / period : 0));
    if (error < best.error - 1e-12) best = { size, count, error };
  }
  return best;
}

/**
 * One repeating cell of a line or dot screen at `angle` degrees, with its
 * origin `shift` pixels below the cell's top left. feTile repeats a cell
 * of whole pixels, so the cell holds whole repeats of the screen, with the
 * spacing and angle adjusted by a small fraction to fit. The cell stays at
 * the origin, because feTile repeats an offset cell at the wrong period.
 */
export function screenCell(
  pattern: "lines" | "dots" | undefined,
  spacing: number,
  angle: number,
  color: string,
  shift = 0,
) {
  // Big enough that fitting whole repeats barely changes the screen.
  const [min, max] = [Math.ceil(spacing * 4), Math.ceil(spacing * 4) + 160];
  if (pattern !== "dots") {
    const a = (angle * Math.PI) / 180;
    // Lines repeat every spacing / |sin| across and spacing / |cos| down.
    const across = wholeCell(
      Math.abs(Math.sin(a)) < 1e-6 ? 0 : spacing / Math.abs(Math.sin(a)),
      min,
      max,
    );
    const down = wholeCell(
      Math.abs(Math.cos(a)) < 1e-6 ? 0 : spacing / Math.abs(Math.cos(a)),
      min,
      max,
    );
    // The fitted lines: whole cycles per cell in each direction.
    const fx = (Math.sign(-Math.sin(a)) * across.count) / across.size,
      fy = (Math.sign(Math.cos(a)) * down.count) / down.size;
    const gap = 1 / Math.hypot(fx, fy),
      turn = (Math.atan2(-fx, fy) * 180) / Math.PI;
    const t = (turn * Math.PI) / 180;
    // The cell's corners in the rotated space bound the bands it needs.
    const v = [
      [0, 0],
      [across.size, 0],
      [0, down.size],
      [across.size, down.size],
    ].map(([x, y]) => (y - shift) * Math.cos(t) - x * Math.sin(t));
    const reach = across.size + down.size;
    let d = "";
    for (
      let k = Math.floor(Math.min(...v) / gap) - 1;
      k * gap <= Math.max(...v) + gap;
      k++
    )
      d += `M${-reach} ${k * gap}h${2 * reach}v${gap * 0.32}h${-2 * reach}Z`;
    return {
      width: across.size,
      height: down.size,
      body: `<path transform="translate(0 ${shift}) rotate(${turn})" fill="${color}" d="${d}"/>`,
    };
  }
  // A rotated dot grid repeats only at a rational slope n/m, every
  // spacing·√(m²+n²); the grid looks the same every quarter turn.
  const quarter = (((((angle + 45) % 90) + 90) % 90) - 45) * (Math.PI / 180);
  let m = 1,
    n = 0;
  for (let mm = 1; mm <= 16; mm++)
    for (let nn = -16; nn <= 16; nn++)
      if (
        Math.abs(Math.atan2(nn, mm) - quarter) <
        Math.abs(Math.atan2(n, m) - quarter) - 1e-9
      ) {
        m = mm;
        n = nn;
      }
  const r = Math.hypot(m, n);
  const cell = wholeCell(
    spacing * r,
    Math.max(min, Math.ceil(spacing * r)),
    max + Math.ceil(spacing * r),
  );
  const gap = cell.size / (cell.count * r),
    c = m / r,
    s = n / r;
  const reach = Math.ceil(cell.size / gap) + 2;
  let dots = "";
  for (let i = -reach; i <= reach * 2; i++)
    for (let j = -reach; j <= reach * 2; j++) {
      const u = (i + 0.5) * gap,
        w = (j + 0.5) * gap;
      const x = u * c - w * s,
        y = u * s + w * c + shift;
      // Dots near an edge also draw on the far side, so the cell repeats.
      if (x < -gap || y < -gap || x > cell.size + gap || y > cell.size + gap)
        continue;
      dots += `<circle cx="${x}" cy="${y}" r="${gap * 0.22}"/>`;
    }
  return {
    width: cell.size,
    height: cell.size,
    body: `<g fill="${color}">${dots}</g>`,
  };
}

function Pass({
  pass,
  time,
  duration,
  amount,
  width: w,
  height: h,
  children,
}: {
  pass: VisualPass;
  time: number;
  duration: number;
  amount: number;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const id = `fx-${useId().replace(/:/g, "")}`;
  const f = visualFrame(pass, time, duration, amount);
  const s = f.strength,
    z = pass.size;
  // Reference pixels at a 1080 short side, so vertical frames match landscape.
  const unit = frameUnit({ width: w, height: h });
  const image = (body: string, result = "paint") => (
    <feImage
      href={svgImage(body, w, h)}
      x={0}
      y={0}
      width={w}
      height={h}
      result={result}
    />
  );
  const merge = (names: string[]) => (
    <feMerge>
      {names.map((inName) => (
        <feMergeNode key={inName} in={inName} />
      ))}
    </feMerge>
  );
  // Overlay paint is clipped to the existing alpha, so cutouts stay transparent.
  // `paint` is an SVG body, or filter nodes that draw a result named paint.
  const overlay = (
    paint: string | React.ReactNode,
    mode: "normal" | "screen" | "multiply" = "normal",
  ) => (
    <>
      {typeof paint === "string" ? image(paint) : paint}
      <feComposite
        in="paint"
        in2="SourceAlpha"
        operator="in"
        result="clipped"
      />
      <feBlend in="clipped" in2="SourceGraphic" mode={mode} />
    </>
  );
  const radial = (inner: string, outer: string, x = 50, y = 50, radius = 65) =>
    `<defs><radialGradient id="g" cx="${x}%" cy="${y}%" r="${radius}%"><stop stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`;
  let nodes: React.ReactNode = null;
  if (s > 0 && isStyleKind(pass.kind))
    nodes = styleFilterNodes({
      pass,
      w,
      h,
      unit,
      s,
      z,
      time: f.time,
      tick: f.tick,
      image,
      overlay,
      merge,
    });
  else if (s > 0 && isRevealKind(pass.kind))
    nodes = revealFilterNodes({
      pass,
      w,
      h,
      unit,
      s,
      z,
      time: f.time,
      tick: f.tick,
      image,
      merge,
    });
  else if (s > 0)
    switch (pass.kind) {
      case "smear":
      case "repeat":
        nodes =
          pass.kind === "repeat" && pass.field ? (
            <ObjectField
              pass={pass}
              strength={s}
              time={f.time}
              width={w}
              height={h}
            />
          ) : (
            <GraphicMapEffects
              pass={pass}
              strength={s}
              time={f.time}
              width={w}
              height={h}
            />
          );
        break;
      case "palette": {
        const mode = pass.paletteMode ?? "negative";
        const levels = 2 + Math.round(z * 10);
        const values =
          mode === "negative"
            ? "1 0"
            : mode === "solarize"
              ? "0 0.5 1 0.5 0"
              : Array.from({ length: levels }, (_, i) => i / (levels - 1)).join(
                  " ",
                );
        nodes = (
          <>
            <feComponentTransfer in="SourceGraphic" result="remap">
              <feFuncR
                type={mode === "posterize" ? "discrete" : "table"}
                tableValues={values}
              />
              <feFuncG
                type={mode === "posterize" ? "discrete" : "table"}
                tableValues={values}
              />
              <feFuncB
                type={mode === "posterize" ? "discrete" : "table"}
                tableValues={values}
              />
            </feComponentTransfer>
            <feColorMatrix
              in="remap"
              type="hueRotate"
              values={String(pass.angle + f.time * 30)}
              result="shifted"
            />
            <feComposite
              in="shifted"
              in2="SourceGraphic"
              operator="arithmetic"
              k2={s}
              k3={1 - s}
            />
          </>
        );
        break;
      }
      case "blinds": {
        const count = pass.count ?? 8;
        const horizontal = pass.blindsDirection !== "vertical";
        // Flooded regions, not an image: the filter changes every frame of
        // the transition, and Chrome draws its images again each time.
        const slats = Array.from({ length: count }, (_, i) =>
          horizontal
            ? {
                x: 0,
                y: (i * h) / count,
                width: w,
                height: (h / count) * (1 - s),
              }
            : {
                x: (i * w) / count,
                y: 0,
                width: (w / count) * (1 - s),
                height: h,
              },
        );
        nodes = (
          <>
            {slats.map((slat, i) => (
              <feFlood
                key={i}
                floodColor="white"
                {...slat}
                result={`slat${i}`}
              />
            ))}
            <feMerge result="blinds-mask">
              {slats.map((_, i) => (
                <feMergeNode key={i} in={`slat${i}`} />
              ))}
            </feMerge>
            <feComposite in="SourceGraphic" in2="blinds-mask" operator="in" />
          </>
        );
        break;
      }
      case "rings": {
        const count = pass.count ?? 4,
          radius = Math.min(w, h) * (0.12 + z * 0.33);
        const body = Array.from({ length: count }, (_, i) => {
          const r = radius * (0.45 + (0.55 * (i + 1)) / count),
            circumference = 2 * Math.PI * r;
          return `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="none" stroke="${i % 2 ? pass.secondary : pass.color}" stroke-width="${(2 + (i % 3)) * unit}" stroke-dasharray="${circumference * 0.18} ${circumference * 0.06} ${circumference * 0.4} ${circumference * 0.12}" transform="rotate(${pass.angle + f.time * 24 * (i % 2 ? -1 : 1) + i * 37} ${w / 2} ${h / 2})"/>`;
        }).join("");
        nodes = overlay(`<g opacity="${s}">${body}</g>`, "screen");
        break;
      }
      case "vignette": {
        // A stretched tiny image: Chrome draws a full-frame one again on
        // every frame where anything under the vignette changes.
        const inner = 0.12 + (1 - z) * 0.4;
        const [r, g, b] = rgb(pass.color).map((c) => c * 255);
        const shade = stretchedImage(w, h, (x, y) => {
          const t = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2));
          const ramp = Math.max(0, Math.min(1, (t - inner) / (1 - inner)));
          return [r, g, b, ramp * s * 255];
        });
        nodes = overlay(
          <feImage
            href={shade.href}
            preserveAspectRatio="none"
            x={shade.x}
            y={shade.y}
            width={shade.width}
            height={shade.height}
            result="paint"
          />,
        );
        break;
      }
      case "spotlight": {
        const x = 50 + Math.sin(f.time * 0.6) * 16;
        nodes = overlay(
          `<g opacity="${s}">${radial(pass.color, "#000000", x, 44, 20 + z * 50)}</g>`,
          "screen",
        );
        break;
      }
      case "bloom":
        nodes = (
          <>
            <feComponentTransfer in="SourceGraphic" result="highlights">
              <feFuncR type="linear" slope={2} intercept={-0.85} />
              <feFuncG type="linear" slope={2} intercept={-0.85} />
              <feFuncB type="linear" slope={2} intercept={-0.85} />
            </feComponentTransfer>
            <feGaussianBlur
              in="highlights"
              stdDeviation={(3 + z * 38) * unit}
              result="blur"
            />
            <feComponentTransfer in="blur" result="glow">
              <feFuncA type="linear" slope={s} />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="glow" mode="screen" />
          </>
        );
        break;
      case "flare": {
        const x = w * (0.5 + 0.2 * Math.sin(f.time * 0.45));
        const y = h * (0.52 + Math.sin((pass.angle * Math.PI) / 180) * 0.25);
        nodes = overlay(
          `<defs><radialGradient id="g"><stop stop-color="${pass.color}"/><stop offset="1" stop-color="${pass.color}" stop-opacity="0"/></radialGradient></defs><g opacity="${s}"><ellipse cx="${x}" cy="${y}" rx="${w * 0.6}" ry="${(2 + z * 14) * unit}" fill="url(#g)"/><ellipse cx="${x}" cy="${y}" rx="${w * (0.08 + z * 0.2)}" ry="${h * (0.08 + z * 0.16)}" fill="url(#g)"/></g>`,
          "screen",
        );
        break;
      }
      case "grain":
        nodes = (
          <>
            <feTurbulence
              type="fractalNoise"
              baseFrequency={(0.25 + (1 - z) * 0.65) / unit}
              numOctaves={2}
              seed={(pass.seed + f.tick) % 65535}
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="saturate"
              values="0"
              result="mono"
            />
            <feComponentTransfer in="mono" result="faded">
              <feFuncA type="linear" slope={s * 0.65} />
            </feComponentTransfer>
            <feComposite
              in="faded"
              in2="SourceAlpha"
              operator="in"
              result="clipped"
            />
            {/* Noise is the top layer; the image is the soft-light backdrop. */}
            <feBlend in="clipped" in2="SourceGraphic" mode="soft-light" />
          </>
        );
        break;
      case "scanlines":
      case "hatch": {
        const spacing = (3 + z * 16) * unit;
        const angle = pass.kind === "hatch" ? pass.angle : 0;
        const color = pass.kind === "scanlines" ? "#000000" : pass.color;
        // A filter is rebuilt whenever any of its values change, and every
        // feImage is rasterized again with it: a full-frame screen costs
        // 30–100 ms a frame. One small repeating cell costs almost nothing.
        const cell = screenCell(
          pass.screenPattern,
          spacing,
          angle,
          color,
          (f.time * spacing) % spacing,
        );
        nodes = (
          <>
            <feImage
              href={svgImage(cell.body, cell.width, cell.height)}
              x={0}
              y={0}
              width={cell.width}
              height={cell.height}
              result="cell"
            />
            <feTile
              in="cell"
              x={0}
              y={0}
              width={w}
              height={h}
              result="screen"
            />
            <feComponentTransfer in="screen" result="paint">
              <feFuncA type="linear" slope={s} />
            </feComponentTransfer>
            <feComposite
              in="paint"
              in2="SourceAlpha"
              operator="in"
              result="clipped"
            />
            <feBlend in="clipped" in2="SourceGraphic" mode="normal" />
          </>
        );
        break;
      }
      case "chromatic": {
        const d = (2 + z * 22) * s * unit * (0.8 + 0.2 * Math.sin(f.time * 3));
        nodes = (
          <>
            <feColorMatrix
              in="SourceGraphic"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="red"
            />
            <feOffset in="red" dx={d} dy={0} result="redShift" />
            <feColorMatrix
              in="SourceGraphic"
              values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="cyan"
            />
            <feOffset in="cyan" dx={-d} dy={0} result="cyanShift" />
            <feBlend
              in="redShift"
              in2="cyanShift"
              mode="screen"
              result="split"
            />
            <feComposite in="split" in2="SourceAlpha" operator="in" />
          </>
        );
        break;
      }
      case "distortion": {
        const rows = 18 + Math.round(z * 48);
        let stripes = Array.from({ length: rows }, (_, i) => {
          const r = Math.round(effectRandom(pass.seed + f.tick, i) * 255);
          return `<rect y="${(i * h) / rows}" width="${w}" height="${h / rows + 1}" fill="rgb(${r},128,128)"/>`;
        }).join("");
        if (pass.distortionMode === "blocks") {
          const cols = 8 + Math.round(z * 16);
          stripes = Array.from({ length: rows * cols }, (_, i) => {
            const r = effectRandom(pass.seed + f.tick, i);
            const value =
              r < 0.72
                ? 128
                : Math.round(effectRandom(pass.seed + f.tick + 11, i) * 255);
            return `<rect x="${((i % cols) * w) / cols}" y="${(Math.floor(i / cols) * h) / rows}" width="${w / cols + 1}" height="${h / rows + 1}" fill="rgb(${value},128,128)"/>`;
          }).join("");
        } else if (pass.distortionMode === "wave") {
          const stops = Array.from(
            { length: 129 },
            (_, i) =>
              `<stop offset="${i / 128}" stop-color="rgb(${127.5 + Math.sin((i / 128) * Math.PI * (2 + z * 10) + f.time * 4) * 127.5},128,128)"/>`,
          ).join("");
          stripes = `<defs><linearGradient id="wave" x2="0" y2="1">${stops}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#wave)"/>`;
        }
        nodes = (
          <>
            {image(stripes, "map")}
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={(15 + z * 100) * s * unit}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </>
        );
        break;
      }
      case "silhouette":
      case "flash":
        nodes = (
          <>
            {pass.kind === "silhouette" &&
              pass.silhouetteStyle === "outline" && (
                <>
                  {/* Sub-pixel radii round to zero on thumbnails; keep at least 1px. */}
                  <feMorphology
                    in="SourceAlpha"
                    operator="dilate"
                    radius={Math.max(1, (1 + z * 12) * unit)}
                    result="expanded"
                  />
                  <feMorphology
                    in="SourceAlpha"
                    operator="erode"
                    radius={Math.max(1, (1 + z * 12) * unit)}
                    result="contracted"
                  />
                  <feComposite
                    in="expanded"
                    in2="contracted"
                    operator="out"
                    result="outline"
                  />
                </>
              )}
            <feFlood floodColor={pass.color} result="paint" />
            <feComposite
              in="paint"
              in2={
                pass.kind === "silhouette" && pass.silhouetteStyle === "outline"
                  ? "outline"
                  : "SourceAlpha"
              }
              operator="in"
              result="clipped"
            />
            <feComposite
              in="clipped"
              in2="SourceGraphic"
              operator="arithmetic"
              k1={0}
              k2={s}
              k3={1 - s}
              k4={0}
            />
          </>
        );
        break;
      case "duotone": {
        const lo = rgb(pass.secondary),
          hi = rgb(pass.color);
        nodes = (
          <>
            <feColorMatrix
              in="SourceGraphic"
              type="saturate"
              values="0"
              result="gray"
            />
            <feComponentTransfer in="gray" result="tone">
              <feFuncR type="table" tableValues={`${lo[0]} ${hi[0]}`} />
              <feFuncG type="table" tableValues={`${lo[1]} ${hi[1]}`} />
              <feFuncB type="table" tableValues={`${lo[2]} ${hi[2]}`} />
            </feComponentTransfer>
            <feComposite
              in="tone"
              in2="SourceGraphic"
              operator="arithmetic"
              k1={0}
              k2={s}
              k3={1 - s}
              k4={0}
            />
          </>
        );
        break;
      }
      case "hexagons": {
        const r = 1920 * unit * (0.025 + z * 0.055),
          dx = r * 1.5,
          dy = Math.sqrt(3) * r;
        let body = "";
        const travel = f.time * r * 0.18;
        const shift = travel % (dx * 2);
        // Seed cells by pattern column, not screen column, so fills don't jump on wrap.
        const wrapped = Math.floor(travel / (dx * 2)) * 2;
        for (let c = -2; c < w / dx + 2; c++)
          for (let row = -1; row < h / dy + 1; row++) {
            const x = c * dx + shift,
              y = row * dy + (Math.abs(c % 2) * dy) / 2;
            const points = Array.from(
              { length: 6 },
              (_, i) =>
                `${x + r * Math.cos((i * Math.PI) / 3)},${y + r * Math.sin((i * Math.PI) / 3)}`,
            ).join(" ");
            const index = (c - wrapped + 2) * 100 + row + 1;
            const pulse =
              (1 + Math.sin(f.time * 2 + effectRandom(pass.seed, index) * 12)) /
              2;
            body += `<polygon points="${points}" fill="${pass.secondary}" fill-opacity="${effectRandom(pass.seed, index) > 0.7 ? pulse * s * 0.6 : 0}" stroke="${pass.color}" stroke-width="${2 * unit}" stroke-opacity="${s * 0.7}"/>`;
          }
        nodes = overlay(body, "screen");
        break;
      }
      case "particles": {
        if (pass.particles) {
          const body = depthParticleSvg(pass, f.time, s, w, h);
          nodes = pass.particles.clipToSource ? (
            overlay(body, "screen")
          ) : (
            <>
              {image(body)}
              <feBlend in="paint" in2="SourceGraphic" mode="screen" />
            </>
          );
          break;
        }
        if (pass.particleStyle === "burst") {
          const bursts = pass.count ?? 3;
          let body = "";
          for (let burst = 0; burst < bursts; burst++) {
            const phase = (f.time / 3 + burst / bursts) % 1;
            const cx = w * (0.22 + effectRandom(pass.seed, burst * 2) * 0.56),
              cy = h * (0.2 + effectRandom(pass.seed, burst * 2 + 1) * 0.42);
            for (let i = 0; i < 48; i++) {
              const angle =
                (i / 48) * Math.PI * 2 +
                effectRandom(pass.seed + burst, i) * 0.1;
              const radius =
                h *
                (0.12 + z * 0.36) *
                phase *
                (0.7 + effectRandom(pass.seed + 19, i) * 0.3);
              const gravity = phase * phase * h * 0.14,
                tail = 0.78;
              body += `<path d="M${cx + Math.cos(angle) * radius * tail} ${cy + Math.sin(angle) * radius * tail + gravity * tail}L${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius + gravity}" stroke="${i % 3 ? pass.color : pass.secondary}" stroke-width="${2.5 * unit}" stroke-linecap="round" opacity="${s * Math.sin(Math.PI * phase) * (1 - phase)}"/>`;
            }
          }
          nodes = overlay(body, "screen");
          break;
        }
        const count = 18 + Math.round(z * 55);
        const body = Array.from({ length: count }, (_, i) => {
          const rnd = (offset: number) =>
            effectRandom(pass.seed, i * 7 + offset);
          const x = ((rnd(0) + f.time * (0.008 + rnd(1) * 0.02)) % 1) * w;
          const y = ((rnd(2) + f.time * (0.01 + rnd(3) * 0.025)) % 1) * h;
          const size = (3 + rnd(4) * (7 + z * 20)) * unit;
          const angle = rnd(5) * 360 + f.time * (10 + rnd(6) * 25);
          return `<path d="M0 0L${size} ${-size * 0.2}L${size * 0.8} ${size * 0.4}L${size * 0.1} ${size * 0.6}Z" fill="${pass.color}" opacity="${s * (0.4 + rnd(3) * 0.6)}" transform="translate(${x} ${y}) rotate(${angle})"/>`;
        }).join("");
        nodes = overlay(body);
        break;
      }
      case "letterbox": {
        const bar = h * (0.025 + z * 0.18);
        // Flooded regions draw nothing per frame, unlike an image.
        nodes = overlay(
          <>
            {[0, h - bar].map((y, i) => (
              <feFlood
                key={i}
                floodColor={pass.color}
                floodOpacity={s}
                x={0}
                y={y}
                width={w}
                height={bar}
                result={`bar${i}`}
              />
            ))}
            <feMerge result="paint">
              <feMergeNode in="bar0" />
              <feMergeNode in="bar1" />
            </feMerge>
          </>,
        );
        break;
      }
      case "wipe": {
        const x = w * s;
        nodes = (
          <>
            {image(
              `<rect x="${x}" width="${w}" height="${h}" fill="white"/>`,
              "mask",
            )}
            <feComposite
              in="SourceGraphic"
              in2="mask"
              operator="in"
              result="revealed"
            />
            {image(
              `<rect x="${x - Math.min(x, w * z * 0.18)}" width="${Math.min(x, w * z * 0.18)}" height="${h}" fill="${pass.color}" opacity="${Math.min(1, s * 10)}"/>`,
              "edge",
            )}
            <feComposite
              in="edge"
              in2="SourceAlpha"
              operator="in"
              result="clipped"
            />
            {merge(["revealed", "clipped"])}
          </>
        );
        break;
      }
      case "iris": {
        const radius = Math.hypot(w, h) * (1 - s) * 0.55;
        nodes = (
          <>
            {/* Oversized mask so the blur doesn't pull transparency in from the frame edge. */}
            <feImage
              href={svgImage(
                `<circle cx="${w}" cy="${h}" r="${radius}" fill="white"/>`,
                w * 2,
                h * 2,
              )}
              x={-w / 2}
              y={-h / 2}
              width={w * 2}
              height={h * 2}
              result="mask"
            />
            <feGaussianBlur
              in="mask"
              stdDeviation={(5 + z * 35) * unit}
              result="soft"
            />
            <feComposite in="SourceGraphic" in2="soft" operator="in" />
          </>
        );
        break;
      }
      case "echo": {
        const dx = (20 + z * 120) * unit * (1 + Math.sin(f.time) * 0.25);
        nodes = (
          <>
            {[1, 2, 3].map((i) => (
              <React.Fragment key={i}>
                <feOffset
                  in="SourceGraphic"
                  dx={Math.cos((pass.angle * Math.PI) / 180) * dx * i}
                  dy={Math.sin((pass.angle * Math.PI) / 180) * dx * i}
                  result={`shift${i}`}
                />
                <feComponentTransfer in={`shift${i}`} result={`echo${i}`}>
                  <feFuncA type="linear" slope={s * (0.4 / i)} />
                </feComponentTransfer>
              </React.Fragment>
            ))}
            {merge(["echo3", "echo2", "echo1", "SourceGraphic"])}
          </>
        );
        break;
      }
      case "shatter": {
        const shards: React.ReactNode[] = [],
          names: string[] = [];
        const cols = 4,
          rows = 3;
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < cols; x++)
            for (let half = 0; half < 2; half++) {
              const i = (y * cols + x) * 2 + half,
                name = `shard${i}`;
              const left = (x * w) / cols,
                top = (y * h) / rows,
                right = ((x + 1) * w) / cols,
                bottom = ((y + 1) * h) / rows;
              const points = half
                ? `${left},${top} ${right},${bottom} ${left},${bottom}`
                : `${left},${top} ${right},${top} ${right},${bottom}`;
              const dx =
                ((x + 0.5) / cols -
                  0.4 +
                  (effectRandom(pass.seed, i) - 0.5) * 0.8) *
                w *
                s *
                (0.3 + z);
              const dy = ((y + 0.5) / rows - 0.35) * h * s + s * s * h * 0.6;
              shards.push(
                <React.Fragment key={i}>
                  {image(
                    `<polygon points="${points}" fill="white"/>`,
                    `mask${i}`,
                  )}
                  <feComposite
                    in="SourceGraphic"
                    in2={`mask${i}`}
                    operator="in"
                    result={`cut${i}`}
                  />
                  <feOffset
                    in={`cut${i}`}
                    dx={dx}
                    dy={dy}
                    result={`move${i}`}
                  />
                  <feComponentTransfer in={`move${i}`} result={name}>
                    <feFuncA type="linear" slope={1 - s} />
                  </feComponentTransfer>
                </React.Fragment>,
              );
              names.push(name);
            }
        nodes = (
          <>
            {shards}
            {merge(names)}
          </>
        );
        break;
      }
    }
  const margin =
    ["bloom", "echo", "shatter", "iris"].includes(pass.kind) ||
    (styleMarginKinds as string[]).includes(pass.kind) ||
    (revealMarginKinds as string[]).includes(pass.kind)
      ? 0.5
      : 0;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        width={0}
        height={0}
        aria-hidden="true"
        style={{ position: "absolute", pointerEvents: "none" }}
      >
        <defs>
          <filter
            id={id}
            x={-w * margin}
            y={-h * margin}
            width={w * (1 + margin * 2)}
            height={h * (1 + margin * 2)}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            {nodes}
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: s > 0 && nodes ? `url(#${id})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Shared by timeline composition, exports and built-in library sample cards. */
export function GraphicEffects({
  layer,
  effects,
  time,
  width = 1920,
  height = 1080,
  children,
}: {
  layer: Layer;
  effects: Effect[];
  time: number;
  width?: number;
  height?: number;
  children: React.ReactNode;
}) {
  let result = children;
  let glyphFieldRendered = false;
  const animation = Math.max(0, time + layer.effectOffset);
  for (const instance of layer.effects) {
    const amount = instanceAmountAt(instance, animation);
    if (!instance.enabled || amount === 0) continue;
    const effect = resolveEffectInstanceAt(instance, effects, animation);
    for (const [index, pass] of (effect?.passes ?? []).entries()) {
      // Glyph/word fields are drawn by the shared text renderer.
      if (
        layer.type === "title" &&
        pass.kind === "repeat" &&
        pass.field &&
        pass.field.unit !== "whole" &&
        !glyphFieldRendered
      ) {
        glyphFieldRendered = true;
        continue;
      }
      result = (
        <Pass
          key={`${instance.effectId}-${index}`}
          pass={pass}
          time={animation}
          duration={layer.effectDuration || layer.duration}
          amount={amount}
          width={width}
          height={height}
        >
          {result}
        </Pass>
      );
    }
  }
  return <>{result}</>;
}
