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

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** An uncompressed RGBA PNG; `rgba` holds rows top first. */
export function png(rgba: Uint8Array, width: number, height: number) {
  const u32 = (v: number) =>
    Uint8Array.of(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const chunk = (type: string, data: Uint8Array) => {
    const body = concat([Uint8Array.from(type, (c) => c.charCodeAt(0)), data]);
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return concat([u32(data.length), body, u32((crc ^ 0xffffffff) >>> 0)]);
  };
  const row = width * 4;
  const raw = new Uint8Array(height * (row + 1));
  for (let y = 0; y < height; y++)
    raw.set(rgba.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
  // zlib with stored deflate blocks.
  let a = 1,
    b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const blocks: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.subarray(i, i + 65535);
    const last = i + 65535 >= raw.length ? 1 : 0;
    const n = part.length;
    blocks.push(
      Uint8Array.of(last, n & 255, n >> 8, ~n & 255, (~n >> 8) & 255),
    );
    blocks.push(part);
  }
  blocks.push(u32(((b << 16) | a) >>> 0));
  const bytes = concat([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk(
      "IHDR",
      concat([u32(width), u32(height), Uint8Array.of(8, 6, 0, 0, 0)]),
    ),
    chunk("IDAT", concat(blocks)),
    chunk("IEND", new Uint8Array()),
  ]);
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(text)}`;
}

/**
 * A smooth full-frame image as a tiny PNG that an feImage stretches over the
 * frame. Chrome draws a filter's images again whenever the filter or the
 * content under it changes, so a full-frame image costs 20–60 ms per played
 * frame; a stretched 32×32 one costs almost nothing. `pixel(x, y)` gives the
 * RGBA (0–255) at a point in frame pixels. Pixel centers 1 and size − 2 sit
 * on the frame edges, so the stretch is smooth all the way to them. Only
 * smooth content survives the stretch (gradients, linear maps).
 */
export function stretchedImage(
  w: number,
  h: number,
  pixel: (x: number, y: number) => [number, number, number, number],
  size = 32,
) {
  const sx = w / (size - 3),
    sy = h / (size - 3);
  const rgba = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++)
      rgba.set(
        pixel((i - 1) * sx, (j - 1) * sy).map((v) =>
          Math.max(0, Math.min(255, Math.round(v))),
        ),
        (j * size + i) * 4,
      );
  return {
    href: png(rgba, size, size),
    x: -1.5 * sx,
    y: -1.5 * sy,
    width: size * sx,
    height: size * sy,
  };
}

/**
 * The same sampling map as `affineMaps` for one matrix over the whole
 * frame, as two stretched images that hold X and Y in alpha. Alpha is never
 * color-managed, so the map survives a display color space unchanged.
 */
export function affineAlphaMaps(m: SampleMatrix, w: number, h: number) {
  const shift = (x: number, y: number) => [
    m[0] * x + m[2] * y + m[4] - x,
    m[1] * x + m[3] * y + m[5] - y,
  ];
  // The outermost pixel centers of the stretched image, one pixel past the
  // frame edges.
  const size = 32,
    [sx, sy] = [w / (size - 3), h / (size - 3)];
  let maximum = 0;
  for (const [x, y] of [
    [-sx, -sy],
    [w + sx, -sy],
    [-sx, h + sy],
    [w + sx, h + sy],
  ])
    maximum = Math.max(maximum, ...shift(x, y).map(Math.abs));
  const scale = Math.max(1, maximum * 2.01);
  const [x, y] = [0, 1].map((axis) =>
    stretchedImage(
      w,
      h,
      (px, py) => [0, 0, 0, (0.5 + shift(px, py)[axis] / scale) * 255],
      size,
    ),
  );
  return { x, y, scale };
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

/**
 * The whole number of pixels, within `min`–`max`, that holds a whole number
 * of repeats closest to one every `period` pixels (none when `period` is 0
 * or longer than the cell).
 */
export function wholeCell(period: number, min: number, max: number) {
  let best = { size: min, count: 0, error: Infinity };
  for (let size = min; size <= max; size++) {
    const count = period ? Math.round(size / period) : 0;
    const error = Math.abs(count / size - (period ? 1 / period : 0));
    if (error < best.error - 1e-12) best = { size, count, error };
  }
  return best;
}
