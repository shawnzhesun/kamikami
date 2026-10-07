/** Inverse affine sampling maps; all geometry is independent of wall-clock time. */
export type SampleMatrix = [number, number, number, number, number, number];
export type MapRegion = {
  matrix: SampleMatrix;
  path: string;
  bounds?: [number, number, number, number];
};
export const svgImage = (body: string, width: number, height: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)}`;
export const rectangle = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}h${w}v${h}h${-w}Z`;

export function centeredMatrix(
  w: number,
  h: number,
  scale: number,
  angle: number,
): SampleMatrix {
  const a = Math.cos(angle) / scale,
    b = Math.sin(angle) / scale;
  return [
    a,
    b,
    -b,
    a,
    w / 2 - (a * w) / 2 + (b * h) / 2,
    h / 2 - (b * w) / 2 - (a * h) / 2,
  ];
}

export function samplePoint(m: SampleMatrix, x: number, y: number) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Two linear-gradient maps encode X in red and Y in green, combined by the filter. */
export function affineMaps(regions: MapRegion[], w: number, h: number) {
  let maximum = 0;
  for (const { matrix: m, bounds = [0, 0, w, h] } of regions) {
    const [left, top, rw, rh] = bounds;
    for (const [x, y] of [
      [left, top],
      [left + rw, top],
      [left, top + rh],
      [left + rw, top + rh],
    ]) {
      const p = samplePoint(m, x, y);
      maximum = Math.max(maximum, Math.abs(p[0] - x), Math.abs(p[1] - y));
    }
  }
  // Keep quantization small for short smears. Gradient maps avoid per-frame canvas capture.
  const scale = Math.max(1, maximum * 2.01);
  const maps = [0, 1].map((axis) => {
    let defs = "",
      paths = "";
    regions.forEach(({ matrix: m, path, bounds = [0, 0, w, h] }, i) => {
      const [left, top, rw, rh] = bounds,
        cx = left + rw / 2,
        cy = top + rh / 2;
      const a = axis === 0 ? m[0] - 1 : m[1];
      const b = axis === 0 ? m[2] : m[3] - 1;
      const c = axis === 0 ? m[4] : m[5];
      const norm = a * a + b * b;
      const center = a * cx + b * cy + c;
      const extent = (Math.abs(a) * rw + Math.abs(b) * rh) / 2;
      const color = (d: number) => {
        const value = Math.max(0, Math.min(255, (0.5 + d / scale) * 255));
        return axis === 0 ? `rgb(${value},0,0)` : `rgb(0,${value},0)`;
      };
      if (norm < 1e-12)
        paths += `<path d="${path}" fill="${color(c)}" stroke="${color(c)}" stroke-width="1"/>`;
      else {
        const dx = (a * extent) / norm,
          dy = (b * extent) / norm;
        defs += `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${cx - dx}" y1="${cy - dy}" x2="${cx + dx}" y2="${cy + dy}" color-interpolation="sRGB"><stop stop-color="${color(center - extent)}"/><stop offset="1" stop-color="${color(center + extent)}"/></linearGradient>`;
        paths += `<path d="${path}" fill="url(#g${i})" stroke="url(#g${i})" stroke-width="1"/>`;
      }
    });
    return svgImage(`<defs>${defs}</defs>${paths}`, w, h);
  });
  return { x: maps[0], y: maps[1], scale };
}

export function repeatRegions(
  mode: "grid" | "mirror" | "kaleidoscope" | "tunnel",
  count: number,
  size: number,
  angle: number,
  w: number,
  h: number,
): MapRegion[] {
  const regions: MapRegion[] = [];
  if (mode === "kaleidoscope") {
    const sectors = Math.max(4, Math.round(count / 2) * 2),
      radius = Math.hypot(w, h);
    const step = (Math.PI * 2) / sectors;
    for (let i = 0; i < sectors; i++) {
      const start = i * step,
        end = start + step;
      // Fold alternate wedges into the same source wedge.
      const phi = (i % 2 ? end : -start) + angle;
      const sign = i % 2 ? -1 : 1;
      const zoom = (Math.hypot(w, h) / Math.min(w, h)) * (0.65 + size * 0.5);
      const sourceX = w * 0.3,
        sourceY = h * 0.4;
      const a = Math.cos(phi) / zoom,
        b = Math.sin(phi) / zoom;
      const m: SampleMatrix = [
        a,
        b,
        -b * sign,
        a * sign,
        sourceX - (a * w) / 2 + (b * sign * h) / 2,
        sourceY - (b * w) / 2 - (a * sign * h) / 2,
      ];
      regions.push({
        matrix: m,
        path: `M${w / 2} ${h / 2}L${w / 2 + radius * Math.cos(start)} ${h / 2 + radius * Math.sin(start)}L${w / 2 + radius * Math.cos(end)} ${h / 2 + radius * Math.sin(end)}Z`,
      });
    }
  } else if (mode === "tunnel") {
    for (let i = 0; i < count; i++) {
      const factor = Math.pow(0.48 + size * 0.4, i),
        rw = w * factor,
        rh = h * factor;
      const x = (w - rw) / 2,
        y = (h - rh) / 2;
      regions.push({
        matrix: [1 / factor, 0, 0, 1 / factor, -x / factor, -y / factor],
        path: rectangle(x, y, rw, rh),
        bounds: [x, y, rw, rh],
      });
    }
  } else {
    const cols = mode === "mirror" ? 2 : count;
    const rows =
      mode === "mirror"
        ? size >= 0.5
          ? 2
          : 1
        : Math.max(1, Math.round((cols * h) / w));
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const flipX = mode === "mirror" && x % 2 ? -1 : 1;
        const flipY = mode === "mirror" && y % 2 ? -1 : 1;
        regions.push({
          matrix: [
            cols * flipX,
            0,
            0,
            rows * flipY,
            -x * w * flipX + (flipX < 0 ? w : 0),
            -y * h * flipY + (flipY < 0 ? h : 0),
          ],
          path: rectangle((x * w) / cols, (y * h) / rows, w / cols, h / rows),
          bounds: [(x * w) / cols, (y * h) / rows, w / cols, h / rows],
        });
      }
  }
  return regions;
}
