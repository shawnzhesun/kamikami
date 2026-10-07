import {
  fontFaceName,
  fontVariant,
  type FontAsset,
  type FontStyle,
} from "./font-assets";

const loads = new Map<string, Promise<void>>();
export const FONT_IMPORT_EVENT = "kamikami-font-imported";
/** The same browser FontFace loader is used by picker, Player and Chromium export. */
export function loadFontAsset(
  font: FontAsset,
  weight: number,
  style: FontStyle,
  origin = "",
) {
  const variant = fontVariant(font, weight, style);
  if (!variant)
    return Promise.reject(new Error(`Unsupported style for ${font.family}`));
  const key = JSON.stringify([font.id, variant, origin]);
  let promise = loads.get(key);
  if (!promise) {
    promise = (async () => {
      const face = new FontFace(
        fontFaceName(font, weight, style),
        `url(${JSON.stringify(origin + variant.src)})`,
        {
          weight:
            variant.weightMin === variant.weightMax
              ? String(variant.weightMin)
              : `${variant.weightMin} ${variant.weightMax}`,
          style: variant.style,
        },
      );
      await face.load();
      document.fonts.add(face);
    })().catch(() => {
      loads.delete(key);
      throw new Error(
        `Could not load “${font.family}”. Reimport the font or choose a replacement.`,
      );
    });
    loads.set(key, promise);
  }
  return promise;
}

export async function validateFontFile(file: File) {
  if (!/\.(ttf|otf|woff|woff2)$/i.test(file.name))
    throw new Error("Choose a TTF, OTF, WOFF, or WOFF2 file");
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Font files must be 20 MB or smaller");
  try {
    // Validate font bytes using Chromium's font sanitizer before saving a copy.
    await new FontFace(
      "KamiKami-import-check",
      await file.arrayBuffer(),
    ).load();
  } catch {
    throw new Error(`“${file.name}” is not a supported, valid font file`);
  }
}
