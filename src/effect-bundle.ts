import { isFrameArt } from "./artwork";
import { migrateLegacyDecor } from "./overlays";
import { usesSpatialMotion } from "./motion";
import { z } from "zod";
import {
  EffectSchema,
  LIMITS,
  effectSettings,
  validateProject,
  type Effect,
  type Project,
} from "./model";
import { builtinEffects, allBuiltinEffects } from "./builtin-effects";
import {
  effectEngines,
  engineAtLeast,
  usesV6Features,
  usesV7Features,
  usesV8Features,
} from "./visual-effects";
export function effectEngine(effect: Effect) {
  if (usesV8Features(effect)) return "kamikami-visual-v8" as const;
  if (usesV7Features(effect)) return "kamikami-visual-v7" as const;
  if (usesV6Features(effect)) return "kamikami-visual-v6" as const;
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
    engine: z.enum(effectEngines),
    name: z.string().min(1).max(80),
    author: z.string().max(100).default(""),
    license: z.string().max(200).default("Free to use and share"),
    description: z.string().max(400).default(""),
    // Framing decorations from earlier v8 bundles are overlays now.
    effect: z.preprocess(migrateLegacyDecor, EffectSchema.strict()),
  })
  .strict()
  .refine(
    (bundle) =>
      effectEngines.indexOf(bundle.engine) >=
      effectEngines.indexOf(effectEngine(bundle.effect)),
    {
      message:
        "Effect parameters require a newer engine: visual passes use kamikami-visual-v2; remap, repetition, smear and pattern modes use kamikami-visual-v3; text animation and blinds require kamikami-visual-v4; spatial motion and text glitches require kamikami-visual-v5; spring curves, stretch/skew/tilt channels and the illustration, 3D-look and organic passes require kamikami-visual-v6; title-pack text kinds require kamikami-visual-v7; kinetic type, text treatments, kinetic layouts, artwork treatments and overlays require kamikami-visual-v8.",
      path: ["engine"],
    },
  );
export type EffectBundle = z.infer<typeof EffectBundleSchema>;
/**
 * presetFamilyId postdates the first v4 readers, whose strict schema rejects
 * it. Only v5 readers are guaranteed to know it, so older engines omit it.
 */
export function portableBundle(bundle: EffectBundle): EffectBundle {
  if (
    engineAtLeast(bundle.engine, "kamikami-visual-v5") ||
    !bundle.effect.presetFamilyId
  )
    return bundle;
  const { presetFamilyId: _family, ...effect } = bundle.effect;
  return { ...bundle, effect };
}
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
/**
 * Applies `effect` to elements. `settings` gives each new instance different
 * settings from the definition, such as one of the card's named variations.
 */
export function applyEffectToLayers(
  project: Project,
  effect: Effect,
  layerIds: string[],
  settings: Effect = effect,
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
  if (
    effect.art &&
    isFrameArt(effect.art.kind) &&
    project.layers.some(
      (layer) => layerIds.includes(layer.id) && layer.type === "title",
    )
  )
    throw new Error(
      "Artwork copies and slices apply to images, video, shapes and backdrops. Use a text treatment for text.",
    );
  const full = project.layers.find(
    (l) =>
      layerIds.includes(l.id) &&
      !l.effects.some((i) => i.effectId === effect.id) &&
      l.effects.length >= LIMITS.elementEffects,
  );
  if (full)
    throw new Error(
      `“${full.name}” already has ${LIMITS.elementEffects} effects, the most one element can hold. Remove one to add ${effect.name}.`,
    );
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
                    settings: effectSettings(settings),
                  },
                ],
          }
        : l,
    ),
  });
}
export const EFFECT_DRAG_TYPE = "application/x-kamikami-effect";
