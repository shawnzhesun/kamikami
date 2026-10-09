import { usesSpatialMotion } from "./motion";
import { z } from "zod";
import {
  EffectSchema,
  effectSettings,
  validateProject,
  type Effect,
  type Project,
} from "./model";
import { builtinEffects, allBuiltinEffects } from "./builtin-effects";
export function effectEngine(effect: Effect) {
  if (usesSpatialMotion(effect)) return "kamikami-visual-v5" as const;
  if (
    effect.text ||
    effect.passes?.some(
      (pass) => pass.kind === "blinds" || pass.blindsDirection !== undefined,
    )
  )
    return "kamikami-visual-v4" as const;
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
      "kamikami-visual-v4",
      "kamikami-visual-v5",
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
        "kamikami-visual-v4",
        "kamikami-visual-v5",
      ].indexOf(bundle.engine) >=
      [
        "frameforge-curves-v1",
        "kamikami-visual-v2",
        "kamikami-visual-v3",
        "kamikami-visual-v4",
        "kamikami-visual-v5",
      ].indexOf(effectEngine(bundle.effect)),
    {
      message:
        "Effect parameters require a newer engine: visual passes use kamikami-visual-v2; remap, repetition, smear and pattern modes use kamikami-visual-v3; text animation and blinds require kamikami-visual-v4; spatial motion and text glitches require kamikami-visual-v5.",
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

export function libraryEffect(
  id: string,
  entries: UserEffect[],
): Effect | undefined {
  return (
    allBuiltinEffects.find((effect) => effect.id === id) ??
    entries.find(
      (entry) =>
        entry.collection === "library" && entry.bundle.effect.id === id,
    )?.bundle.effect
  );
}

export function effectForApplication(
  project: Project,
  entries: UserEffect[],
  id: string,
): Effect | undefined {
  return (
    libraryEffect(id, entries) ??
    project.effects.find((effect) => effect.id === id) ??
    entries.find((entry) => entry.bundle.effect.id === id)?.bundle.effect
  );
}

export function effectCollections(_project: Project, entries: UserEffect[]) {
  const mine = entries.filter((e) => e.collection !== "library");
  const library = [
    ...builtinEffects,
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
  project = validateProject(project);
  if (
    !layerIds.length ||
    layerIds.some((id) => !project.layers.some((l) => l.id === id))
  )
    throw new Error("Choose an existing visual layer.");
  if (project.layers.some((l) => layerIds.includes(l.id) && l.type === "audio"))
    throw new Error("Visual effects cannot be applied to audio clips.");
  if (
    effect.text &&
    project.layers.some(
      (layer) => layerIds.includes(layer.id) && layer.type !== "title",
    )
  )
    throw new Error("Text effects can only be applied to text elements.");
  const existing = project.effects.find((e) => e.id === effect.id);
  // The catalog recipe can differ from a historical project definition.
  // New instances use the supplied recipe; existing snapshots stay untouched.
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
                  {
                    effectId: effect.id,
                    amount: 1,
                    enabled: true,
                    settings: effectSettings(effect),
                  },
                ],
          }
        : l,
    ),
  });
}
export const EFFECT_DRAG_TYPE = "application/x-kamikami-effect";
