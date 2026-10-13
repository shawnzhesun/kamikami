import { getLength, getPointAtLength, getSubpaths } from "@remotion/paths";
import { getStroke } from "perfect-freehand";
import rough from "roughjs";
import { f, timecode, type Ctx } from "./overlay-kit";
import type { Overlay, OverlayPart, OverlayPath } from "./overlays";

/**
 * Shared line and fill styles for every overlay kind. Kinds draw plain
 * centerlines; this turns them into marker, pencil, brush, chalk or neon
 * strokes and fills closed shapes with hatching, dots or halftone. Rough.js
 * draws the sketchy lines and hand fills (seeded, so every frame of an
 * export matches); perfect-freehand outlines the pressure-tapered strokes.
 */

const generator = rough.generator();
const cache = new Map<string, OverlayPath[]>();
function memo(key: string, make: () => OverlayPath[]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = make();
  if (cache.size > 600) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
}

/** Points along each subpath of `d`, spaced about `step` apart. */
function sample(d: string, step: number): [number, number][][] {
  let subpaths: string[];
  try {
    subpaths = getSubpaths(d);
  } catch {
    return [];
  }
  return subpaths.flatMap((sub) => {
    const len = getLength(sub);
    if (!(len > 1e-6)) return [];
    const n = Math.max(6, Math.min(220, Math.ceil(len / Math.max(1e-4, step))));
    return [
      Array.from({ length: n + 1 }, (_, i) => {
        const pt = getPointAtLength(sub, (len * i) / n) ?? { x: 0, y: 0 };
        return [pt.x, pt.y] as [number, number];
      }),
    ];
  });
}
/** A closed outline polygon as a smooth path. */
function outline(points: number[][]) {
  if (points.length < 3) return "";
  let d = `M${f(points[0][0])} ${f(points[0][1])}Q`;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    d += `${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)} `;
  }
  return d + "Z";
}
/**
 * Both libraries are tuned for pixel coordinates (a stroke a few pixels wide);
 * overlay units are far smaller, so paths are drawn at this scale and shrunk
 * back.
 */
const PX = (width: number) => 4 / Math.max(1e-4, width);
/** Scales a path about the origin (arc flags and rotations stay put). */
function scaled(d: string, k: number) {
  return d.replace(
    /([a-zA-Z])([^a-zA-Z]*)/g,
    (_, cmd: string, args: string) => {
      const nums = args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
      const arc = cmd === "A" || cmd === "a";
      return (
        cmd +
        nums
          .map((n, i) => {
            const v = Number(n);
            return arc && [2, 3, 4].includes(i % 7)
              ? String(v)
              : String(+(v * k).toFixed(4));
          })
          .join(" ")
      );
    },
  );
}
/** A pressure-tapered stroke along `d`, as filled outlines. */
function freehand(
  d: string,
  width: number,
  options: Parameters<typeof getStroke>[1] = {},
): string {
  const k = PX(width);
  const taper = (t: unknown) => (typeof t === "number" ? t * k : t);
  return sample(d, width * 0.35)
    .map((pts) =>
      outline(
        getStroke(
          pts.map(([x, y]) => [x * k, y * k]),
          {
            ...options,
            size: width * k,
            start: options.start && {
              ...options.start,
              taper: taper(options.start.taper) as number,
            },
            end: options.end && {
              ...options.end,
              taper: taper(options.end.taper) as number,
            },
          },
        ).map(([x, y]) => [x / k, y / k]),
      ),
    )
    .join("");
}
/** Rough.js paths for `d`, drawn at pixel scale. */
function roughPaths(
  d: string,
  width: number,
  options: Record<string, unknown>,
) {
  const k = PX(width);
  return generator
    .toPaths(
      generator.path(scaled(d, k), {
        ...options,
        strokeWidth: (options.strokeWidth as number) * k,
        ...(options.hachureGap
          ? { hachureGap: (options.hachureGap as number) * k }
          : {}),
        ...(options.fillWeight
          ? { fillWeight: (options.fillWeight as number) * k }
          : {}),
      }),
    )
    .map((info) => ({
      ...info,
      d: scaled(info.d, 1 / k),
      strokeWidth: info.strokeWidth / k,
    }));
}
const lighten = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) =>
    Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * k);
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, "0")).join("")}`;
};
const roughFill: Record<string, string> = {
  hatch: "hachure",
  crosshatch: "cross-hatch",
  zigzag: "zigzag",
  dots: "dots",
};
const hand = (o: Overlay) => o.stroke === "pencil" || o.stroke === "sketch";

/** Sub-paths for a stroked part in the overlay's line style. */
function strokePaths(
  o: Overlay,
  part: OverlayPart,
  seed: number,
): OverlayPath[] | null {
  const d = part.d!;
  const width = part.width ?? 0.1;
  const color = part.stroke!;
  const key = `${o.stroke}|${f(width)}|${color}|${o.roughness}|${seed}|${d}`;
  switch (o.stroke) {
    case "marker":
      return memo(key, () => [
        {
          d: freehand(d, width * 2, {
            thinning: 0,
            smoothing: 0.6,
            streamline: 0.3,
            simulatePressure: false,
          }),
          fill: color,
          opacity: 0.92,
        },
      ]);
    case "brush":
      return memo(key, () => [
        {
          d: freehand(d, width * 2.6, {
            thinning: 0.6,
            smoothing: 0.6,
            streamline: 0.45,
            simulatePressure: false,
            start: { taper: width * 8 },
            end: { taper: width * 10 },
          }),
          fill: color,
        },
      ]);
    case "chalk":
      return memo(key, () => [
        {
          d: freehand(d, width * 1.8, {
            thinning: 0.15,
            smoothing: 0.4,
            streamline: 0.2,
            simulatePressure: false,
          }),
          fill: color,
          opacity: 0.9,
          grain: width,
        },
      ]);
    case "pencil":
    case "sketch": {
      const pencil = o.stroke === "pencil";
      return memo(key, () =>
        roughPaths(d, width, {
          seed: Math.max(1, seed),
          roughness: o.roughness * (pencil ? 0.7 : 1.3),
          bowing: pencil ? 0.8 : 1.6,
          stroke: color,
          strokeWidth: width * (pencil ? 0.55 : 0.9),
          disableMultiStroke: false,
        }).map((info) => ({
          d: info.d,
          stroke: info.stroke,
          width: info.strokeWidth,
          opacity: pencil ? 0.85 : 1,
        })),
      );
    }
    case "double": {
      const k = width * 0.9;
      return [
        {
          d,
          stroke: color,
          width: width * 0.55,
          transform: `translate(${f(-k * 0.7)} ${f(-k * 0.7)})`,
        },
        {
          d,
          stroke: color,
          width: width * 0.55,
          transform: `translate(${f(k * 0.7)} ${f(k * 0.7)})`,
        },
      ];
    }
    case "neon":
      return [
        {
          d,
          stroke: color,
          width: width * 2.4,
          opacity: 0.55,
          glow: width * 1.6,
        },
        { d, stroke: lighten(color, 0.65), width: width * 0.75 },
      ];
    default:
      return null;
  }
}

/** A fill for a closed part in the overlay's fill style, or null for none. */
function fillPart(
  o: Overlay,
  part: OverlayPart,
  c: Ctx,
  color: string,
  seed: number,
): Partial<OverlayPart> | null {
  const style = o.fill;
  const gap = Math.max(0.1, 0.03 * c.m) / o.density;
  if (style === "solid") return { fill: o.fillColor ?? color };
  if (hand(o) && roughFill[style]) {
    const d = part.d!;
    const weight = Math.max(0.01, (part.width ?? c.lw) * 0.5);
    const paths = memo(
      `fill|${style}|${f(gap)}|${color}|${seed}|${o.roughness}|${d}`,
      () =>
        roughPaths(d, weight * 2, {
          seed: Math.max(1, seed),
          roughness: o.roughness,
          stroke: "none",
          strokeWidth: weight,
          fill: o.fillColor ?? color,
          fillStyle: roughFill[style],
          hachureGap: gap,
          hachureAngle: -41,
          fillWeight: weight,
        })
          .filter((info) => info.stroke !== "none" || info.fill)
          .map((info) => ({
            d: info.d,
            stroke: info.stroke === "none" ? undefined : info.stroke,
            fill: info.fill && info.fill !== "none" ? info.fill : undefined,
            width: info.strokeWidth,
          })),
    );
    return { paths, fill: undefined, stroke: undefined };
  }
  if (
    style === "hatch" ||
    style === "crosshatch" ||
    style === "zigzag" ||
    style === "dots" ||
    style === "halftone"
  )
    return {
      pattern: {
        style,
        color: o.fillColor ?? color,
        gap,
        width: Math.max(0.01, gap * 0.22),
      },
    };
  return null;
}

/** Applies the shared styles to one overlay's parts. */
export function styleParts(
  o: Overlay,
  parts: OverlayPart[],
  c: Ctx,
): OverlayPart[] {
  const out: OverlayPart[] = [];
  parts.forEach((part, i) => {
    if (part.text !== undefined) {
      out.push(textStyle(o, part, c));
      return;
    }
    let next: OverlayPart = { ...part };
    const seed = o.seed * 31 + i + 1;
    // Fills of closed shapes.
    if (part.closed && o.fill !== "auto") {
      const color = part.fill ?? part.stroke ?? o.color;
      if (o.fill === "none") {
        if (part.fill && !part.stroke)
          next = {
            ...next,
            fill: undefined,
            stroke: part.fill,
            width: part.width ?? c.lw,
          };
        else next = { ...next, fill: undefined };
      } else {
        const fill = fillPart(o, part, c, color, seed);
        if (fill) {
          if (part.fill && !part.stroke) {
            // A solid shape takes the fill in place, outlined so hatching reads.
            next = {
              ...next,
              ...fill,
              ...(fill.pattern || fill.paths
                ? {
                    fill: undefined,
                    stroke: color,
                    width: part.width ?? c.thin * 1.5,
                  }
                : {}),
            };
          } else {
            out.push({
              ...part,
              key: `${part.key}-fill`,
              stroke: undefined,
              width: undefined,
              fill: undefined,
              draw: undefined,
              dash: undefined,
              ...fill,
              opacity: part.opacity * (part.draw ?? 1),
              behind: part.encloses ? true : part.behind,
            });
          }
        }
      }
    }
    if (o.fillOpacity < 1 && (next.fill || next.pattern))
      next = { ...next, fillOpacity: o.fillOpacity };
    // Line styles.
    if (next.stroke && next.d && o.stroke !== "plain" && !next.paths) {
      if (o.stroke === "dashed" && !next.dash)
        next = {
          ...next,
          dash: [(next.width ?? 0.1) * 3, (next.width ?? 0.1) * 2.2],
          cap: "butt",
        };
      else if (o.stroke === "dotted")
        next = {
          ...next,
          dash: [0.001, (next.width ?? 0.1) * 2.4],
          cap: "round",
        };
      else {
        const paths = strokePaths(o, next, seed);
        if (paths) {
          // Solid fills ride along under the styled line.
          const under: OverlayPath[] =
            next.fill || next.pattern
              ? [
                  {
                    d: next.d,
                    fill: next.fill,
                    pattern: next.pattern,
                    opacity: next.fillOpacity,
                  },
                ]
              : [];
          next = { ...next, paths: [...under, ...paths] };
        }
      }
    }
    if (o.shadow > 0)
      next = {
        ...next,
        shadow: Math.max(next.shadow ?? 0, o.shadow * c.S(0.08, 0.025)),
      };
    out.push(next);
  });
  return out.map((part) => {
    let next = part;
    if (o.layer !== "auto") next = { ...next, behind: o.layer === "behind" };
    if (o.blend !== "auto")
      next = { ...next, blend: o.blend === "normal" ? undefined : o.blend };
    return next;
  });
}

/** Fonts, capitals and live readouts in labels. */
function textStyle(o: Overlay, part: OverlayPart, c: Ctx): OverlayPart {
  let text = part.text!;
  if (text.includes("{")) text = fillReadouts(text, o, c);
  if (o.caps) text = text.toUpperCase();
  const font =
    o.font !== "auto"
      ? o.font
      : (part.font ?? (part.mono ? "mono" : undefined));
  return {
    ...part,
    text,
    font,
    mono: font === "mono",
    ...(o.shadow > 0 ? { shadow: o.shadow * c.S(0.06, 0.02) } : {}),
    ...(o.layer !== "auto" ? { behind: o.layer === "behind" } : {}),
  };
}

/** Replaces `{time}`, `{x}` and friends with values from the frame. */
export function fillReadouts(text: string, o: Overlay, c: Ctx) {
  const t = c.target;
  const pos = t.position ?? { x: 0, y: 0 };
  const values: Record<string, string> = {
    time: timecode(c.time),
    start: timecode(t.start),
    clock: timecode(t.start + c.time),
    length: timecode(c.duration),
    pct: String(
      Math.round(
        Math.max(0, Math.min(1, c.time / Math.max(0.01, c.duration))) * 100,
      ),
    ),
    index: String(o.count).padStart(2, "0"),
    x: String(Math.round(pos.x)),
    y: String(Math.round(-pos.y)),
    w: String(Math.round(c.w * t.unitPx)),
    h: String(Math.round(c.h * t.unitPx)),
    bpm: String(o.tempo),
    text: (t.text ?? "").replace(/\s+/gu, " ").trim(),
    word: t.word ?? "",
  };
  return text.replace(/\{(\w+)\}/g, (all, name: string) => values[name] ?? all);
}
