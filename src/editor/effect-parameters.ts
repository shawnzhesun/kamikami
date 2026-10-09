import { EffectSettingsSchema, type EffectSettings } from "../model";
import { numberRangeAt } from "../keyframes";
import { visualNames } from "../visual-effects";
import { textEffectNames } from "../text-effects";

const words = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const skipped = new Set(["seed"]);

/** Numeric settings that can be keyframed, with readable labels and schema ranges. */
export function animatableParameters(settings: EffectSettings | undefined) {
  const result: { path: string; label: string; min: number; max: number }[] =
    [];
  if (!settings) return result;
  const visit = (value: unknown, path: string[], label: string) => {
    if (typeof value === "number") {
      const key = path.join(".");
      const range = numberRangeAt(EffectSettingsSchema, key);
      if (range && !skipped.has(path.at(-1)!))
        result.push({
          path: key,
          label: `${label} · ${words(path.at(-1)!)}`,
          ...range,
        });
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value))
      visit(child, [...path, key], label);
  };
  settings.channels.forEach((c, i) =>
    (["from", "to", "frequency", "phase"] as const).forEach((key) =>
      visit(c[key], ["channels", String(i), key], `${words(c.property)} curve`),
    ),
  );
  settings.passes?.forEach((p, i) =>
    Object.entries(p).forEach(([key, value]) => {
      const name = visualNames[p.kind];
      if (key === "field" || key === "particles")
        visit(value, ["passes", String(i), key], `${name} ${key}`);
      else visit(value, ["passes", String(i), key], name);
    }),
  );
  if (settings.text)
    Object.entries(settings.text).forEach(([key, value]) =>
      visit(value, ["text", key], textEffectNames[settings.text!.kind]),
    );
  if (settings.depth)
    Object.entries(settings.depth).forEach(([key, value]) =>
      visit(value, ["depth", key], "Depth"),
    );
  visit(settings.tint, ["tint"], "Color wash");
  return result;
}
