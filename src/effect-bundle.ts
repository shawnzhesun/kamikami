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
  usesV6Features,
  usesV7Features,
  usesV8Features,
  usesV9Features,
} from "./visual-effects";
export function effectEngine(effect: Effect) {
  if (usesV9Features(effect)) return "kamikami-visual-v9" as const;
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
/**
 * Every shared effect is free to use and share, so effect files carry no
 * license. Files written before that kept one; it is dropped on read.
 */
function withoutLicense(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const { license: _license, ...rest } = input as Record<string, unknown>;
  if (Array.isArray(rest.effects))
    rest.effects = rest.effects.map(withoutLicense);
  return rest;
}
const BundleObject = z
  .object({
    format: z.literal("frameforge-effect"),
    version: z.literal(1),
    engine: z.enum(effectEngines),
    name: z.string().min(1).max(80),
    author: z.string().max(100).default(""),
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
        "Effect parameters require a newer engine: visual passes use kamikami-visual-v2; remap, repetition, smear and pattern modes use kamikami-visual-v3; text animation and blinds require kamikami-visual-v4; spatial motion and text glitches require kamikami-visual-v5; spring curves, stretch/skew/tilt channels and the illustration, 3D-look and organic passes require kamikami-visual-v6; title-pack text kinds require kamikami-visual-v7; kinetic type, text treatments, kinetic layouts, artwork treatments and overlays require kamikami-visual-v8; the riso print pass and the halftone overlay require kamikami-visual-v9.",
      path: ["engine"],
    },
  );
export const EffectBundleSchema = z.preprocess(withoutLicense, BundleObject);
export type EffectBundle = z.infer<typeof EffectBundleSchema>;

const engineIndex = (engine: string) =>
  effectEngines.indexOf(engine as (typeof effectEngines)[number]);
/** The lowest engine that reads every effect in the list. */
export function packEngine(effects: Effect[]) {
  return effects
    .map(effectEngine)
    .reduce((a, b) => (engineIndex(b) > engineIndex(a) ? b : a));
}
export const packIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** A pack ID from its name: lowercase words joined by hyphens. */
export function packSlug(name: string) {
  return (
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64)
      .replace(/-+$/, "") || "effects"
  );
}
/**
 * Several effects in one portable file (`.kamikami-effects.json`). `id`
 * names the pack across versions: importing a pack with an ID that is
 * already installed updates it in place, keeping its effects' IDs.
 */
const PackObject = z
  .object({
    format: z.literal("kamikami-effect-pack"),
    version: z.literal(1),
    engine: z.enum(effectEngines),
    id: z
      .string()
      .regex(
        packIdPattern,
        "Pack IDs use lowercase letters, digits and hyphens.",
      ),
    name: z.string().trim().min(1).max(80),
    author: z.string().max(100).default(""),
    description: z.string().max(1000).default(""),
    effects: z
      .array(
        z
          .object({
            // Only where an effect's author differs from the pack's.
            author: z.string().max(100).optional(),
            effect: z.preprocess(migrateLegacyDecor, EffectSchema.strict()),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.packEffects),
  })
  .strict()
  .refine(
    (pack) =>
      new Set(pack.effects.map((e) => e.effect.id)).size ===
      pack.effects.length,
    { message: "Each effect in a pack needs its own ID.", path: ["effects"] },
  )
  .refine(
    (pack) =>
      engineIndex(pack.engine) >=
      engineIndex(packEngine(pack.effects.map((e) => e.effect))),
    {
      message:
        "The pack's engine is older than one of its effects needs. Export it again from KamiKami.",
      path: ["engine"],
    },
  );
export const EffectPackSchema = z.preprocess(withoutLicense, PackObject);
export type EffectPack = z.infer<typeof EffectPackSchema>;
export type PackInfo = Pick<
  EffectPack,
  "id" | "name" | "author" | "description"
>;
/** The pack's effects as single bundles, with the pack's author filled in. */
export function packBundles(pack: EffectPack): EffectBundle[] {
  return pack.effects.map((item) => ({
    format: "frameforge-effect",
    version: 1,
    engine: pack.engine,
    name: item.effect.name.slice(0, 80),
    author: item.author ?? pack.author,
    description: item.effect.description.slice(0, 400),
    effect: item.effect,
  }));
}
/** Reads a single-effect bundle or a pack, whichever the file holds. */
export function parseEffectFile(input: unknown): {
  pack?: PackInfo;
  bundles: EffectBundle[];
} {
  const format = (input as { format?: unknown } | null)?.format;
  if (format === "kamikami-effect-pack") {
    const pack = EffectPackSchema.parse(input);
    const {
      effects: _effects,
      format: _f,
      version: _v,
      engine: _e,
      ...info
    } = pack;
    return { pack: info, bundles: packBundles(pack) };
  }
  if (format === "frameforge-effect")
    return { bundles: [EffectBundleSchema.parse(input)] };
  throw new Error(
    "This isn't a KamiKami effect file. Choose a .kamikami-effects.json or .kamikami-effect.json file.",
  );
}
/** Writes entries as one pack. Each effect keeps its own author where it differs from the pack's. */
export function makeEffectPack(
  info: Omit<PackInfo, "id"> & { id?: string },
  entries: { author?: string; effect: Effect }[],
): EffectPack {
  if (!entries.length) throw new Error("Choose at least one effect to export.");
  const name = info.name.trim();
  if (!name) throw new Error("Name the pack before exporting it.");
  const author = info.author.trim();
  return EffectPackSchema.parse({
    format: "kamikami-effect-pack",
    version: 1,
    engine: packEngine(entries.map((e) => e.effect)),
    id: info.id || packSlug(name),
    name,
    author,
    description: info.description.trim(),
    effects: entries.map((entry) => ({
      ...(entry.author && entry.author !== author
        ? { author: entry.author }
        : {}),
      effect: entry.effect,
    })),
  });
}
/** File name for a downloaded pack. */
export const packFileName = (pack: { id: string }) =>
  `${pack.id}.kamikami-effects.json`;
export type UserEffect = {
  id: string;
  savedAt: string;
  collection?: "mine" | "library";
  bundle: EffectBundle;
  /** The pack it was imported from; imported effects only. */
  pack?: PackInfo;
  /** Its ID inside that pack, which matches it when the pack is updated. */
  packEffectId?: string;
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
export type EffectImport = {
  pack?: PackInfo;
  imported: UserEffect[];
  updated: number;
  removed: number;
};
const effects = (n: number) => `${n} effect${n === 1 ? "" : "s"}`;
/** One status line for an import. */
export function importSummary({
  pack,
  imported,
  updated,
  removed,
}: EffectImport) {
  if (!pack) return `Imported ${imported[0]?.bundle.name ?? "the effect"}`;
  const added = imported.length - updated;
  if (!updated && !removed) return `Imported ${pack.name} (${effects(added)})`;
  return `Updated ${pack.name}: ${[
    updated && `${effects(updated)} updated`,
    added && `${added} added`,
    removed && `${removed} removed`,
  ]
    .filter(Boolean)
    .join(", ")}`;
}
