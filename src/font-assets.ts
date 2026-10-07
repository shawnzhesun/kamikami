import { z } from "zod";
import catalog from "./font-catalog.json";

export const fontCategories = [
  "Sans serif",
  "Serif",
  "Display",
  "Handwriting",
  "Monospace",
] as const;
export const FontVariantSchema = z
  .object({
    src: z
      .string()
      .regex(
        /^\/fonts\/(builtin|imported)\/[a-zA-Z0-9_-]+\.(ttf|otf|woff|woff2)$/,
      ),
    weightMin: z.number().int().min(1).max(1000),
    weightMax: z.number().int().min(1).max(1000),
    style: z.enum(["normal", "italic"]),
  })
  .refine((v) => v.weightMin <= v.weightMax, "Invalid font weight range");
export const FontAssetSchema = z.object({
  id: z.string().regex(/^(builtin-[a-z0-9-]+|custom-[a-f0-9]{24})$/),
  family: z.string().trim().min(1).max(100),
  category: z.enum(fontCategories),
  variants: z.array(FontVariantSchema).min(1).max(32),
});
export type FontAsset = z.infer<typeof FontAssetSchema>;
export type FontVariant = z.infer<typeof FontVariantSchema>;
export type FontStyle = FontVariant["style"];
export type AvailableFont = FontAsset & { missing?: boolean };
export const builtinFonts: FontAsset[] = z
  .array(FontAssetSchema)
  .parse(catalog);
export const fontIdSchema = FontAssetSchema.shape.id;

export function resolveFont(id: string | undefined, fonts: FontAsset[] = []) {
  if (!id) return undefined;
  return (
    builtinFonts.find((f) => f.id === id) ?? fonts.find((f) => f.id === id)
  );
}
export function fontVariant(font: FontAsset, weight: number, style: FontStyle) {
  return font.variants.find(
    (v) => v.style === style && weight >= v.weightMin && weight <= v.weightMax,
  );
}
export function fontWeights(font: FontAsset, style: FontStyle) {
  const weights = new Set<number>();
  for (const v of font.variants.filter((v) => v.style === style)) {
    weights.add(v.weightMin);
    weights.add(v.weightMax);
    for (let w = 100; w <= 900; w += 100)
      if (w >= v.weightMin && w <= v.weightMax) weights.add(w);
  }
  return [...weights].sort((a, b) => a - b);
}
export function fontChoice(
  font: FontAsset,
  weight = 400,
  style: FontStyle = "normal",
) {
  const nextStyle = font.variants.some((v) => v.style === style)
    ? style
    : font.variants[0].style;
  const weights = fontWeights(font, nextStyle);
  const nextWeight = fontVariant(font, weight, nextStyle)
    ? weight
    : weights.reduce((best, w) =>
        Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
      );
  return { fontId: font.id, fontWeight: nextWeight, fontStyle: nextStyle };
}
export function assetFontFamily(id: string) {
  return `KamiKami-${id}`;
}
export function fontFaceName(
  font: FontAsset,
  weight: number,
  style: FontStyle,
) {
  const variant = fontVariant(font, weight, style);
  return assetFontFamily(
    `${font.id}-${variant?.src.split("/").at(-1)?.replace(/\./g, "-") ?? "missing"}`,
  );
}
export function fontCSS(font: FontAsset, weight: number, style: FontStyle) {
  return `"${fontFaceName(font, weight, style)}", sans-serif`;
}
export const weightNames: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};
