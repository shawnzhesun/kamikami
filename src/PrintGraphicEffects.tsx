import React from "react";
import { effectRandom, type VisualPass } from "./visual-effects";
import { png, stretchedImage, wholeCell } from "./graphic-maps";
import type { styleControls } from "./StyleGraphicEffects";

/**
 * The riso print pass (kamikami-visual-v9). Each spot ink is its own plate:
 * its coverage is how much of the picture's color that ink absorbs, screened
 * into dots whose size follows the tone, at the ink's own screen angle. The
 * plates print out of register and multiply, so overlaps make the darks;
 * there is no black ink. A pure function of the frame, settings and seed.
 */
export const printKinds = ["riso"] as const;
export const isPrintKind = (
  kind: string,
): kind is (typeof printKinds)[number] =>
  (printKinds as readonly string[]).includes(kind);

export const printControls: Record<
  (typeof printKinds)[number],
  (typeof styleControls)[keyof typeof styleControls]
> = {
  riso: {
    size: "Dot size",
    speed: "Press wobble (steps per second)",
    angle: "Screen angle",
    seed: true,
    color: "Paper color",
    note: "Darks come from overprinting inks. At clip start grows the dots from bare paper; at clip end prints them away.",
  },
};

/** Classic riso screen angles, one per plate, turned by the pass angle. */
const plateAngles = [15, 75, 0];
const defaultInks = ["#0078bf", "#ff48b0"];
export const risoInks = (pass: VisualPass) =>
  pass.risoInks ?? (pass.secondary ? [pass.secondary] : defaultInks);

/**
 * One repeating cell of a rotated dot screen as a threshold map: a pixel
 * takes ink when its plate's coverage exceeds π·d²/pitch², d being the
 * distance to the nearest dot center, so a dot's area matches the tone. The
 * corners between dots only print near full coverage, as on a real screen.
 * The grid repeats at a rational slope n/m, so the cell is whole pixels.
 */
export function thresholdMap(pitch: number, angle: number) {
  const quarter = (((((angle + 45) % 90) + 90) % 90) - 45) * (Math.PI / 180);
  let m = 1,
    n = 0;
  for (let mm = 1; mm <= 6; mm++)
    for (let nn = -6; nn <= 6; nn++)
      if (
        Math.abs(Math.atan2(nn, mm) - quarter) <
        Math.abs(Math.atan2(n, m) - quarter) - 1e-9
      ) {
        m = mm;
        n = nn;
      }
  const r = Math.hypot(m, n);
  const period = pitch * r;
  const fit = wholeCell(
    period,
    Math.ceil(period),
    Math.ceil(period) + Math.ceil(period) * 2,
  );
  const size = fit.size;
  const gap = size / (Math.max(1, fit.count) * r);
  const c = m / r,
    s = n / r;
  const threshold = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      const u = (px * c + py * s) / gap,
        v = (-px * s + py * c) / gap;
      const du = u - Math.round(u),
        dv = v - Math.round(v);
      threshold[y * size + x] = Math.min(
        0.995,
        Math.max(0.004, Math.PI * (du * du + dv * dv)),
      );
    }
  return { size, threshold };
}

const thresholdCells = new Map<string, { href: string; size: number }>();
/** `thresholdMap` as an image with the threshold in alpha, for feTile. */
export function thresholdCell(pitch: number, angle: number) {
  const key = `${pitch.toFixed(3)}|${angle.toFixed(2)}`;
  const cached = thresholdCells.get(key);
  if (cached) return cached;
  const { size, threshold } = thresholdMap(pitch, angle);
  const rgba = new Uint8Array(size * size * 4);
  threshold.forEach((t, i) => (rgba[i * 4 + 3] = Math.round(t * 255)));
  const cell = { href: png(rgba, size, size), size };
  // A keyframed dot size makes a new cell each frame; keep the cache small.
  if (thresholdCells.size > 64) thresholdCells.clear();
  thresholdCells.set(key, cell);
  return cell;
}

const grainCells = new Map<string, { href: string; size: number }>();
/**
 * A tileable patch of uneven ink in alpha: soft blotches a few dots across
 * plus fine speckle, squared so most ink stays solid and some starves.
 */
export function grainCell(unit: number, seed: number) {
  const lattice = Math.max(3, Math.round(4 * unit));
  const cells = 16;
  const size = lattice * cells;
  const key = `${size}|${seed}`;
  const cached = grainCells.get(key);
  if (cached) return cached;
  const at = (i: number, j: number) =>
    effectRandom(seed, ((i + cells) % cells) * cells + ((j + cells) % cells));
  const ease = (t: number) => t * t * (3 - 2 * t);
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = x / lattice,
        gy = y / lattice;
      const i = Math.floor(gx),
        j = Math.floor(gy);
      const fx = ease(gx - i),
        fy = ease(gy - j);
      const top = at(i, j) * (1 - fx) + at(i + 1, j) * fx;
      const bottom = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx;
      const blotch = top * (1 - fy) + bottom * fy;
      const speck = effectRandom(seed + 7, y * size + x);
      const v = Math.pow(0.65 * blotch + 0.35 * speck, 2.2);
      rgba[(y * size + x) * 4 + 3] = Math.round(Math.min(1, v * 1.6) * 255);
    }
  const cell = { href: png(rgba, size, size), size };
  if (grainCells.size > 16) grainCells.clear();
  grainCells.set(key, cell);
  return cell;
}

const channels = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
/**
 * The color-matrix row that gives an ink's coverage: how much of the light
 * that ink absorbs is missing from the picture, measured against the paper,
 * so paper-colored areas take no ink. A little gain fills the solids.
 */
function coverageRow(ink: string, paper: string) {
  const absorbed = channels(ink).map((v) => 1 - v);
  const sum = absorbed.reduce((a, b) => a + b, 0) || 1;
  const white = channels(paper).map((v) => Math.max(0.2, v));
  const gain = 1.35;
  const [r, g, b] = absorbed.map((a, i) => (-gain * a) / sum / white[i]);
  return `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${r} ${g} ${b} ${gain} 0`;
}

type Context = {
  pass: VisualPass;
  w: number;
  h: number;
  unit: number;
  /** Print over the unprinted element, 0–1. */
  s: number;
  /** Ink laid down so far, 0–1: grows in, prints away. */
  ink: number;
  time: number;
};

export function risoFilterNodes(c: Context): React.ReactNode {
  const { pass, w, h, unit, s, ink } = c;
  const inks = risoInks(pass);
  const pitch = (2.5 + pass.size * 9) * unit;
  const miss = (pass.registration ?? 0.35) * 7 * unit;
  const grain = pass.inkGrain ?? 0.3;
  // Press wobble: the plates land somewhere new a few times a second.
  const step = pass.speed > 0 ? Math.floor(c.time) : 0;
  const offset = (i: number, axis: number) =>
    (effectRandom(pass.seed + step * 131, i * 2 + axis) - 0.5) * 2 * miss;
  const grainTile = grainCell(unit, pass.seed);
  const paper = pass.risoPaper !== "clear";
  const plates = inks.map((color, i) => {
    const cell = thresholdCell(pitch, pass.angle + plateAngles[i]);
    return (
      <React.Fragment key={i}>
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values={coverageRow(color, paper ? pass.color : "#ffffff")}
          result={`cover${i}`}
        />
        <feComponentTransfer in={`cover${i}`} result={`tone${i}`}>
          <feFuncA type="gamma" amplitude={ink} exponent={0.85} offset={0} />
        </feComponentTransfer>
        <feComposite
          in={`tone${i}`}
          in2="grain"
          operator="arithmetic"
          k1={-grain}
          k2={1}
          k3={0}
          k4={0}
          result={`starved${i}`}
        />
        <feImage
          href={cell.href}
          x={0}
          y={0}
          width={cell.size}
          height={cell.size}
          result={`cell${i}`}
        />
        <feTile
          in={`cell${i}`}
          x={0}
          y={0}
          width={w}
          height={h}
          result={`screen${i}`}
        />
        <feComposite
          in={`starved${i}`}
          in2={`screen${i}`}
          operator="arithmetic"
          k1={0}
          k2={1}
          k3={-1}
          k4={0}
          result={`above${i}`}
        />
        {/* Above the threshold is ink; the slope keeps dot edges about a pixel soft. */}
        <feComponentTransfer in={`above${i}`} result={`dots${i}`}>
          <feFuncA type="linear" slope={Math.max(2, pitch / 2.2)} />
        </feComponentTransfer>
        <feFlood floodColor={color} result={`ink${i}`} />
        <feComposite
          in={`ink${i}`}
          in2={`dots${i}`}
          operator="in"
          result={`plate${i}`}
        />
        <feOffset
          in={`plate${i}`}
          dx={offset(i, 0)}
          dy={offset(i, 1)}
          result={`placed${i}`}
        />
      </React.Fragment>
    );
  });
  // Cloudy mottling, a warm wash a few hundred pixels across: smooth value
  // noise, so a tiny stretched image carries it at any frame size.
  const blotch = (x: number, y: number, size: number, salt: number) => {
    const gx = x / size,
      gy = y / size;
    const i = Math.floor(gx),
      j = Math.floor(gy);
    const fx = gx - i,
      fy = gy - j;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const at = (a: number, b: number) =>
      effectRandom(pass.seed + salt, (a + 64) * 977 + (b + 64));
    const top = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
    return (
      top * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy
    );
  };
  const mottle = stretchedImage(w, h, (x, y) => {
    const n =
      blotch(x, y, 260 * unit, 3) * 0.65 + blotch(x, y, 110 * unit, 5) * 0.35;
    return [180, 166, 140, n * n * 60];
  });
  let last = paper ? "paper" : "placed0";
  const stack = inks.slice(paper ? 0 : 1).map((_, k) => {
    const i = paper ? k : k + 1;
    const result = `printed${i}`;
    const node = (
      <feBlend
        key={i}
        in={`placed${i}`}
        in2={last}
        mode="multiply"
        result={result}
      />
    );
    last = result;
    return node;
  });
  return (
    <>
      <feImage
        href={grainTile.href}
        x={0}
        y={0}
        width={grainTile.size}
        height={grainTile.size}
        result="grainCell"
      />
      <feTile in="grainCell" x={0} y={0} width={w} height={h} result="grain" />
      {plates}
      {paper && (
        <>
          <feFlood floodColor={pass.color} result="paperFill" />
          <feImage
            href={mottle.href}
            x={mottle.x}
            y={mottle.y}
            width={mottle.width}
            height={mottle.height}
            preserveAspectRatio="none"
            result="mottle"
          />
          <feBlend in="mottle" in2="paperFill" mode="multiply" result="sheet" />
          <feComposite
            in="sheet"
            in2="SourceAlpha"
            operator="in"
            result="paper"
          />
        </>
      )}
      {stack}
      <feComposite
        in={last}
        in2="SourceGraphic"
        operator="arithmetic"
        k1={0}
        k2={s}
        k3={1 - s}
        k4={0}
      />
    </>
  );
}
