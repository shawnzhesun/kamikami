import { z } from "zod";

/**
 * Vector shape elements. A shape is a sized box (composition pixels, like an
 * image's fitted size) holding one path, filled with the element's `color`
 * and optionally outlined. Transforms, effects and keyframes apply exactly as
 * they do for images.
 */
export const shapeKinds = [
  "rectangle",
  "ellipse",
  "polygon",
  "star",
  "arrow",
  "heart",
] as const;
export type ShapeKind = (typeof shapeKinds)[number];
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const ShapeSchema = z
  .object({
    kind: z.enum(shapeKinds),
    width: z.number().min(2).max(8192),
    height: z.number().min(2).max(8192),
    /** False draws only the outline. Defaults to true. */
    filled: z.boolean().optional(),
    stroke: hex.optional(),
    strokeWidth: z.number().min(0).max(400).optional(),
    /** Corner radius in pixels (rectangle). */
    radius: z.number().min(0).max(4096).optional(),
    /** Polygon sides or star points. */
    sides: z.number().int().min(3).max(24).optional(),
    /** Star inner radius as a fraction of the outer radius. */
    innerRadius: z.number().min(0.1).max(0.95).optional(),
  })
  .strict();
export type Shape = z.infer<typeof ShapeSchema>;

export type ShapePreset = {
  id: string;
  label: string;
  shape: Shape;
};
/** The Add shape menu. Presets are ordinary shapes, so every one stays editable. */
export const shapePresets: ShapePreset[] = [
  {
    id: "rectangle",
    label: "Rectangle",
    shape: { kind: "rectangle", width: 640, height: 400 },
  },
  {
    id: "rounded",
    label: "Rounded rectangle",
    shape: { kind: "rectangle", width: 640, height: 400, radius: 80 },
  },
  {
    id: "circle",
    label: "Circle",
    shape: { kind: "ellipse", width: 420, height: 420 },
  },
  {
    id: "ellipse",
    label: "Ellipse",
    shape: { kind: "ellipse", width: 640, height: 400 },
  },
  {
    id: "triangle",
    label: "Triangle",
    shape: { kind: "polygon", width: 480, height: 420, sides: 3 },
  },
  {
    id: "diamond",
    label: "Diamond",
    shape: { kind: "polygon", width: 420, height: 520, sides: 4 },
  },
  {
    id: "pentagon",
    label: "Pentagon",
    shape: { kind: "polygon", width: 440, height: 420, sides: 5 },
  },
  {
    id: "hexagon",
    label: "Hexagon",
    shape: { kind: "polygon", width: 460, height: 420, sides: 6 },
  },
  {
    id: "star",
    label: "Star",
    shape: {
      kind: "star",
      width: 460,
      height: 440,
      sides: 5,
      innerRadius: 0.45,
    },
  },
  {
    id: "arrow",
    label: "Arrow",
    shape: { kind: "arrow", width: 560, height: 280 },
  },
  {
    id: "heart",
    label: "Heart",
    shape: { kind: "heart", width: 440, height: 400 },
  },
  {
    id: "line",
    label: "Line",
    shape: { kind: "rectangle", width: 720, height: 12, radius: 6 },
  },
  {
    id: "ring",
    label: "Ring",
    shape: {
      kind: "ellipse",
      width: 420,
      height: 420,
      filled: false,
      stroke: "#f1eee7",
      strokeWidth: 28,
    },
  },
];
/** Swatches offered next to the shapes; any color can be picked afterwards. */
export const shapeColors = [
  "#f1eee7",
  "#141414",
  "#f2765e",
  "#f5c84c",
  "#5fbf8f",
  "#4f8fd8",
  "#8a6fd6",
  "#e85d9a",
];

const round = (n: number) => Math.round(n * 100) / 100;
/** Stretch unit points so their bounding box fills the w × h box. */
function fit(points: [number, number][], w: number, h: number) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  return points.map(
    ([x, y]) =>
      [
        ((x - minX) / (maxX - minX || 1)) * w,
        ((y - minY) / (maxY - minY || 1)) * h,
      ] as [number, number],
  );
}
const polygon = (points: [number, number][]) =>
  `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`;

/** SVG path data for a shape in its own w × h box (origin top-left). */
export function shapePath(shape: Shape) {
  const { width: w, height: h } = shape;
  if (shape.kind === "rectangle") {
    const r = Math.min(shape.radius ?? 0, w / 2, h / 2);
    if (r <= 0) return `M0 0H${w}V${h}H0Z`;
    return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  }
  if (shape.kind === "ellipse") {
    const rx = w / 2,
      ry = h / 2;
    return `M0 ${ry}A${rx} ${ry} 0 1 1 ${w} ${ry}A${rx} ${ry} 0 1 1 0 ${ry}Z`;
  }
  if (shape.kind === "polygon" || shape.kind === "star") {
    const n = shape.sides ?? (shape.kind === "star" ? 5 : 6);
    const inner = shape.kind === "star" ? (shape.innerRadius ?? 0.45) : 1;
    const count = shape.kind === "star" ? n * 2 : n;
    const points: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      // First vertex points straight up, like most design tools.
      const angle = (i / count) * Math.PI * 2;
      const r = shape.kind === "star" && i % 2 ? inner : 1;
      points.push([Math.sin(angle) * r, -Math.cos(angle) * r]);
    }
    return polygon(fit(points, w, h));
  }
  if (shape.kind === "arrow") {
    const head = Math.min(w * 0.45, h);
    const shaft = h * 0.2;
    return polygon([
      [0, h / 2 - shaft],
      [w - head, h / 2 - shaft],
      [w - head, 0],
      [w, h / 2],
      [w - head, h],
      [w - head, h / 2 + shaft],
      [0, h / 2 + shaft],
    ]);
  }
  // Heart: two lobes meeting at a bottom point, drawn in a 0–1 box.
  const p = (x: number, y: number) => `${round(x * w)} ${round(y * h)}`;
  return `M${p(0.5, 0.25)}C${p(0.5, 0.05)} ${p(0.25, 0)} ${p(0.12, 0.05)}C${p(-0.04, 0.12)} ${p(-0.02, 0.4)} ${p(0.12, 0.55)}C${p(0.25, 0.7)} ${p(0.42, 0.85)} ${p(0.5, 1)}C${p(0.58, 0.85)} ${p(0.75, 0.7)} ${p(0.88, 0.55)}C${p(1.02, 0.4)} ${p(1.04, 0.12)} ${p(0.88, 0.05)}C${p(0.75, 0)} ${p(0.5, 0.05)} ${p(0.5, 0.25)}Z`;
}
