import { brotliDecompressSync, inflateSync } from "node:zlib";

const MAX_EXPANDED = 64 * 1024 * 1024;
const wanted = new Set(["name", "OS/2", "fvar", "post"]);
const woffTags = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill",
];
function slice(bytes: Buffer, offset: number, length: number) {
  if (offset < 0 || length < 0 || offset + length > bytes.length)
    throw new Error("Truncated font file");
  return bytes.subarray(offset, offset + length);
}
function tables(bytes: Buffer) {
  const result = new Map<string, Buffer>();
  const tags = new Set<string>();
  const signature = slice(bytes, 0, 4).toString("ascii");
  const isWoff = signature === "wOFF",
    isWoff2 = signature === "wOF2";
  if (
    !isWoff &&
    !isWoff2 &&
    !["OTTO", "true"].includes(signature) &&
    bytes.readUInt32BE(0) !== 0x10000
  )
    throw new Error(
      "Import a TTF, OTF, WOFF, or WOFF2 font (font collections are not supported)",
    );
  if (isWoff || isWoff2) {
    slice(bytes, 0, isWoff2 ? 48 : 44);
    if (bytes.readUInt32BE(8) !== bytes.length)
      throw new Error("Invalid font file length");
    if (bytes.readUInt32BE(16) > MAX_EXPANDED)
      throw new Error("Expanded font exceeds 64 MB");
  }
  const count = bytes.readUInt16BE(isWoff || isWoff2 ? 12 : 4);
  if (count < 1 || count > 256) throw new Error("Invalid font table count");
  if (isWoff2) {
    let pos = 48,
      offset = 0;
    const uint128 = () => {
      let n = 0;
      for (let i = 0; i < 5; i++) {
        const b = slice(bytes, pos++, 1)[0];
        if ((i === 0 && b === 0x80) || n > 0x1ffffff)
          throw new Error("Invalid WOFF2 table length");
        n = n * 128 + (b & 127);
        if (!(b & 128)) return n;
      }
      throw new Error("Invalid WOFF2 table length");
    };
    const entries: {
      tag: string;
      offset: number;
      length: number;
      transformed: boolean;
    }[] = [];
    for (let i = 0; i < count; i++) {
      const flag = slice(bytes, pos++, 1)[0];
      const tag =
        (flag & 63) === 63
          ? slice(bytes, pos, 4).toString("ascii")
          : woffTags[flag & 63];
      if ((flag & 63) === 63) pos += 4;
      const originalLength = uint128();
      const version = flag >> 6;
      const transformed = ["glyf", "loca"].includes(tag)
        ? version !== 3
        : version !== 0;
      const length = transformed ? uint128() : originalLength;
      if (tags.has(tag)) throw new Error("Duplicate font table");
      tags.add(tag);
      entries.push({ tag, offset, length, transformed });
      offset += length;
      if (offset > MAX_EXPANDED) throw new Error("Expanded font exceeds 64 MB");
    }
    const data = brotliDecompressSync(
      slice(bytes, pos, bytes.readUInt32BE(20)),
      { maxOutputLength: MAX_EXPANDED },
    );
    if (data.length !== offset) throw new Error("Invalid WOFF2 table data");
    for (const entry of entries) {
      if (!wanted.has(entry.tag)) continue;
      if (entry.transformed)
        throw new Error("Unsupported transformed font metadata");
      result.set(entry.tag, slice(data, entry.offset, entry.length));
    }
  } else {
    const start = isWoff ? 44 : 12,
      stride = isWoff ? 20 : 16;
    slice(bytes, start, count * stride);
    for (let i = 0; i < count; i++) {
      const p = start + i * stride;
      const tag = bytes.toString("ascii", p, p + 4);
      if (tags.has(tag)) throw new Error("Duplicate font table");
      tags.add(tag);
      const offset = bytes.readUInt32BE(p + (isWoff ? 4 : 8));
      const length = bytes.readUInt32BE(p + (isWoff ? 8 : 12));
      const data = slice(bytes, offset, length);
      if (!wanted.has(tag)) continue;
      const original = isWoff ? bytes.readUInt32BE(p + 12) : length;
      if (original > MAX_EXPANDED || length > original)
        throw new Error("Invalid font table size");
      const table =
        length < original
          ? inflateSync(data, { maxOutputLength: MAX_EXPANDED })
          : data;
      if (table.length !== original) throw new Error("Invalid font table data");
      result.set(tag, table);
    }
  }
  for (const tag of ["head", "cmap", "maxp", "name"])
    if (!tags.has(tag)) throw new Error(`Invalid font: missing ${tag} table`);
  return result;
}

/** Read only naming and face metadata; browsers perform glyph validation with FontFace. */
export function readFontMetadata(bytes: Buffer) {
  try {
    const data = tables(bytes);
    const name = data.get("name")!;
    const count = name.readUInt16BE(2),
      stringOffset = name.readUInt16BE(4);
    slice(name, 6, count * 12);
    const names: { id: number; value: string; priority: number }[] = [];
    for (let i = 0; i < count; i++) {
      const p = 6 + i * 12;
      const platform = name.readUInt16BE(p),
        language = name.readUInt16BE(p + 4),
        id = name.readUInt16BE(p + 6);
      if (![0, 1, 2, 13, 16, 17].includes(id) || ![0, 1, 3].includes(platform))
        continue;
      const raw = slice(
        name,
        stringOffset + name.readUInt16BE(p + 10),
        name.readUInt16BE(p + 8),
      );
      const value = (
        platform === 1
          ? raw.toString("latin1")
          : new TextDecoder("utf-16be").decode(raw)
      )
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim();
      names.push({
        id,
        value,
        priority: language === 0x409 ? 0 : platform === 0 ? 1 : 2,
      });
    }
    const get = (id: number) =>
      names
        .filter((n) => n.id === id)
        .sort((a, b) => a.priority - b.priority)[0]?.value;
    const family = (get(16) || get(1) || "").slice(0, 100);
    if (!family) throw new Error("Font has no family name");
    const os2 = data.get("OS/2");
    let weightMin = os2 && os2.length >= 6 ? os2.readUInt16BE(4) : 400;
    let weightMax = weightMin;
    const fvar = data.get("fvar");
    if (fvar) {
      const offset = fvar.readUInt16BE(4),
        axes = fvar.readUInt16BE(8),
        size = fvar.readUInt16BE(10);
      if (size < 20 || axes > 64) throw new Error("Invalid variable font axes");
      slice(fvar, offset, size * axes);
      for (let i = 0; i < axes; i++) {
        const p = offset + i * size;
        if (fvar.toString("ascii", p, p + 4) === "wght") {
          weightMin = Math.ceil(fvar.readInt32BE(p + 4) / 65536);
          weightMax = Math.floor(fvar.readInt32BE(p + 12) / 65536);
        }
      }
    }
    if (weightMin < 1 || weightMax > 1000 || weightMin > weightMax)
      throw new Error("Invalid font weight range");
    const italic =
      os2 && os2.length >= 64
        ? !!(os2.readUInt16BE(62) & 1)
        : /italic|oblique/i.test(get(17) || get(2) || "");
    const post = data.get("post");
    const monospace = !!(post && post.length >= 16 && post.readUInt32BE(12));
    const panose = os2 && os2.length >= 34 ? [os2[32], os2[33]] : [0, 0];
    return {
      family,
      weightMin,
      weightMax,
      style: italic ? ("italic" as const) : ("normal" as const),
      monospace,
      category: monospace
        ? ("Monospace" as const)
        : panose[0] === 3
          ? ("Handwriting" as const)
          : panose[0] === 4
            ? ("Display" as const)
            : panose[0] === 2 && panose[1] >= 2 && panose[1] <= 10
              ? ("Serif" as const)
              : ("Sans serif" as const),
      copyright: get(0) ?? "",
      license: get(13) ?? "",
    };
  } catch (e) {
    if (e instanceof RangeError)
      throw new Error("Truncated or invalid font file");
    throw e;
  }
}
