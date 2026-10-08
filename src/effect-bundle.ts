import { z } from "zod";
import {
  EffectSchema,
  validateProject,
  type Effect,
  type Project,
} from "./model";
import { builtinEffects } from "./builtin-effects";
export function effectEngine(effect: Effect) {
  if (
    effect.passes?.some(
      (p) =>
        ["palette", "smear", "repeat", "rings"].includes(p.kind) ||
        p.paletteMode !== undefined ||
        p.smearMode !== undefined ||
        p.repeatMode !== undefined ||
        p.distortionMode !== undefined ||
        p.screenPattern !== undefined ||
        p.particleStyle !== undefined ||
        p.silhouetteStyle !== undefined ||
        p.count !== undefined,
    )
  )
    return "kamikami-visual-v3" as const;
  const legacyProperties = [
    "x",
    "y",
    "scale",
    "rotation",
    "opacity",
    "blur",
    "brightness",
  ];
  const legacyCurves = ["linear", "ease", "sine", "pulse"];
  return effect.passes !== undefined ||
    effect.channels.some(
      (c) =>
        !legacyProperties.includes(c.property) ||
        !legacyCurves.includes(c.curve),
    )
    ? ("kamikami-visual-v2" as const)
    : ("frameforge-curves-v1" as const);
}
export const EffectBundleSchema = z
  .object({
    format: z.literal("frameforge-effect"),
    version: z.literal(1),
    engine: z.enum([
      "frameforge-curves-v1",
      "kamikami-visual-v2",
      "kamikami-visual-v3",
    ]),
    name: z.string().min(1).max(80),
    author: z.string().max(100).default(""),
    license: z.string().max(200).default("Free to use and share"),
    description: z.string().max(400).default(""),
    effect: EffectSchema.strict(),
  })
  .strict()
  .refine(
    (bundle) =>
      [
        "frameforge-curves-v1",
        "kamikami-visual-v2",
        "kamikami-visual-v3",
      ].indexOf(bundle.engine) >=
      [
        "frameforge-curves-v1",
        "kamikami-visual-v2",
        "kamikami-visual-v3",
      ].indexOf(effectEngine(bundle.effect)),
    {
      message:
        "Effect parameters require a newer engine: visual passes use kamikami-visual-v2; remap, repetition, smear and pattern modes use kamikami-visual-v3.",
      path: ["engine"],
    },
  );
export type EffectBundle = z.infer<typeof EffectBundleSchema>;
export type UserEffect = {
  id: string;
  savedAt: string;
  collection?: "mine" | "library";
  bundle: EffectBundle;
};

export function effectCollections(project: Project, entries: UserEffect[]) {
  const mine = entries.filter((e) => e.collection !== "library");
  const library = [
    ...builtinEffects.map(
      (effect) => project.effects.find((e) => e.id === effect.id) ?? effect,
    ),
    ...entries
      .filter((e) => e.collection === "library")
      .map((e) => e.bundle.effect),
  ];
  return { mine, library };
}
export function applyEffectToLayers(
  project: Project,
  effect: Effect,
  layerIds: string[],
) {
  if (
    !layerIds.length ||
    layerIds.some((id) => !project.layers.some((l) => l.id === id))
  )
    throw new Error("Choose an existing visual layer.");
  if (project.layers.some((l) => layerIds.includes(l.id) && l.type === "audio"))
    throw new Error("Visual effects cannot be applied to audio clips.");
  const existing = project.effects.find((e) => e.id === effect.id);
  if (
    existing &&
    JSON.stringify(EffectSchema.parse(existing)) !==
      JSON.stringify(EffectSchema.parse(effect))
  )
    throw new Error(
      "Effect ID conflicts with an existing definition. Import it with a new ID.",
    );
  return validateProject({
    ...project,
    effects: existing ? project.effects : [...project.effects, effect],
    layers: project.layers.map((l) =>
      layerIds.includes(l.id)
        ? {
            ...l,
            effects: l.effects.some((i) => i.effectId === effect.id)
              ? l.effects
              : [
                  ...l.effects,
                  { effectId: effect.id, amount: 1, enabled: true },
                ],
          }
        : l,
    ),
  });
}
export const EFFECT_DRAG_TYPE = "application/x-kamikami-effect";
