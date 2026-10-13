import { z } from "zod";
import { artControls, artNames } from "./artwork";
import {
  builtinEffects,
  effectVariationPatch,
  getEffectFamily,
} from "./builtin-effects";
import {
  effectRole,
  effectRoles,
  effectTarget,
  roleFeels,
  roleHints,
  targetMismatch,
  targetNames,
  type EffectRole,
} from "./effect-roles";
import { effectEngine } from "./effect-bundle";
import { kineticControls } from "./kinetic-type";
import { EffectSchema, type Effect } from "./model";
import { overlaySpecs, OverlaySchema } from "./overlays";
import { layoutControls } from "./text-layouts";
import { lookControls } from "./text-looks";
import { textEffectNames, TextEffectSchema } from "./text-effects";
import { titleControls } from "./title-effects";
import { visualNames } from "./visual-effects";

/**
 * The effect catalog as the assistant sees it: a compact, searchable list of
 * cards (role, feel, what they fit, variations), and a full description of one
 * card (every setting with its range and meaning, and each variation as a
 * patch). Everything derives from the same tables as the gallery and the
 * settings panel, so the assistant and the editor never disagree.
 */
export type CatalogSource = "builtin" | "mine" | "library";
export type CatalogEntry = { effect: Effect; source: CatalogSource };
export type ElementType =
  "title" | "image" | "video" | "shape" | "scene" | "backdrop";

const fitsNames = {
  text: "text only",
  picture: "images, video, shapes, scenes and backdrops (not text)",
  any: "any visual element",
} as const;

/** What a card is, in a few words, from its recipe. */
function kindOf(effect: Effect) {
  if (effect.overlay) return `overlay ${effect.overlay.kind}`;
  if (effect.text) return `text ${effect.text.kind}`;
  if (effect.art) return `art ${effect.art.kind}`;
  if (effect.passes?.length)
    return `passes ${effect.passes.map((p) => p.kind).join("+")}`;
  if (effect.depth) return "depth";
  return effect.channels.length
    ? `channels ${[...new Set(effect.channels.map((c) => c.property))].join("+")}`
    : "color wash";
}

function row(entry: CatalogEntry) {
  const { effect } = entry;
  const { role, feel } = effectRole(effect);
  const family = getEffectFamily(effect.presetFamilyId ?? effect.id);
  return {
    id: effect.id,
    name: effect.name,
    role,
    feel,
    fits: effectTarget(effect),
    kind: kindOf(effect),
    description: effect.description,
    ...(family && family.variations.length > 1
      ? {
          variations: family.variations.map((v) => ({
            id: v.id,
            name: v.name,
          })),
        }
      : {}),
    ...(entry.source !== "builtin" ? { source: entry.source } : {}),
  };
}

/** Also the find_effects tool input, so the tool and the endpoint agree. */
export const FindEffectsSchema = z
  .object({
    query: z
      .string()
      .max(200)
      .optional()
      .describe("Words to match in names, descriptions, feels and variations"),
    role: z.enum(effectRoles).optional(),
    feel: z
      .string()
      .max(60)
      .optional()
      .describe("A gallery section within a role, e.g. Comic or Arrive"),
    fits: z.enum(["text", "picture"]).optional(),
    elementType: z
      .enum(["title", "image", "video", "shape", "scene", "backdrop"])
      .optional()
      .describe("Only effects that can apply to this element type"),
    includeVariations: z.boolean().optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(200).optional().describe("Default 40"),
  })
  .strict();
export type FindEffects = z.infer<typeof FindEffectsSchema>;

/** Searches and filters the catalog; rows are compact enough to scan many. */
export function findEffects(entries: CatalogEntry[], input: FindEffects) {
  const words = (input.query ?? "").toLowerCase().split(/\s+/u).filter(Boolean);
  const matches = entries.map(row).filter((r) => {
    if (input.role && r.role !== input.role) return false;
    if (input.feel && r.feel.toLowerCase() !== input.feel.toLowerCase())
      return false;
    if (input.fits && r.fits !== input.fits && r.fits !== "any") return false;
    if (input.elementType) {
      const effect = entries.find((e) => e.effect.id === r.id)!.effect;
      if (targetMismatch(effect, input.elementType)) return false;
    }
    if (!words.length) return true;
    const haystack = [
      r.id,
      r.name,
      r.role,
      r.feel,
      r.kind,
      r.description,
      ...(r.variations?.map((v) => v.name) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 40;
  const page = matches.slice(offset, offset + limit).map((r) =>
    input.includeVariations === false
      ? (({ variations, ...rest }) => ({
          ...rest,
          ...(variations ? { variationCount: variations.length } : {}),
        }))(r)
      : r,
  );
  return {
    total: matches.length,
    offset,
    returned: page.length,
    ...(offset + page.length < matches.length
      ? { next: offset + page.length }
      : {}),
    effects: page,
    ...(offset === 0 && !input.role && !words.length
      ? {
          roles: Object.fromEntries(
            effectRoles.map((role) => [
              role,
              { hint: roleHints[role], feels: roleFeels[role] },
            ]),
          ),
        }
      : {}),
  };
}

// ------------------------------------------------------------- describing

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  minimum?: number;
  pattern?: string;
  maximum?: number;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
};
const sectionSchemas = (() => {
  const json = z.toJSONSchema(EffectSchema, { io: "input" }) as JsonSchema;
  return json.properties ?? {};
})();
const overlayJson = z.toJSONSchema(OverlaySchema, {
  io: "input",
}) as JsonSchema;
const textJson = z.toJSONSchema(TextEffectSchema, {
  io: "input",
}) as JsonSchema;

/** A setting's accepted values, in a few characters. */
function range(s: JsonSchema | undefined): string | undefined {
  if (!s) return undefined;
  if (s.anyOf) return s.anyOf.map(range).filter(Boolean).join(" | ");
  if (s.enum) return s.enum.join(" | ");
  if (s.type === "number" || s.type === "integer") {
    const kind = s.type === "integer" ? "integer " : "";
    if (s.minimum !== undefined && s.maximum !== undefined)
      return `${kind}${s.minimum}–${s.maximum}`;
    return s.type;
  }
  if (s.type === "string")
    return s.pattern?.includes("#") ? "#rrggbb color" : "text";
  if (s.type === "boolean") return "true | false";
  if (s.type === "object") return "object";
  if (s.type === "array") return "list";
  return undefined;
}

/** Plain meanings of the overlay settings every kind shares. */
const overlayStyleHelp: Record<string, string> = {
  color: "Ink color",
  secondary: "Accent color (fills, plates, second color)",
  strength: "Opacity",
  anchor:
    "What it marks on text: the whole block, the key word (longest word), each line or each word in turn, or the first letter",
  placement: "Side for labels and marks; auto picks the roomiest",
  timing:
    "envelope draws on at the start and retracts at the end; in draws on only; out draws near the clip end; constant is always shown",
  seconds: "Draw-on length",
  wobble: "Hand-drawn irregularity, 0 ruled to 1 loose",
  boil: "Redraws per second, like pencil animation",
  label:
    "Text; {time} {start} {clock} {length} {pct} {index} {x} {y} {w} {h} {bpm} {text} {word} fill in live",
  seed: "Seed for the random layout",
  variant: "Shape variant (see variants)",
  stroke: "Line style",
  roughness: "Pencil and sketch roughness",
  fill: "Fill style of closed shapes; auto keeps the kind's own",
  fillColor: "Fill color (omit to use the shape's own)",
  fillOpacity: "Fill opacity",
  density: "Hatching and dot density",
  enter: "Entrance; draw is the kind's own draw-on",
  exit: "Exit; match plays the entrance backwards",
  loop: "Loop while shown",
  tempo: "Tempo for loops and beat kinds, BPM; use the song's",
  loopDepth: "Loop strength",
  offsetX:
    "Nudge right, in overlay units (1 em on text, 2.5% of the frame's short side on pictures)",
  offsetY: "Nudge down, in overlay units",
  rotate: "Rotate the whole mark, degrees",
  mirror: "Flip horizontally (labels stay readable)",
  blend: "Blend mode",
  layer: "Draw behind or in front of the element",
  font: "Label typeface",
  caps: "Capitals in labels",
  shadow: "Soft drop shadow, 0–1",
  stagger: "Delay between words or lines when the mark repeats",
};

type Setting = {
  path: string;
  value: unknown;
  range?: string;
  meaning?: string;
};
function settings(
  section: string,
  value: Record<string, unknown>,
  schema: JsonSchema | undefined,
  labels: Record<string, unknown> = {},
  only?: Set<string>,
): Setting[] {
  const props = schema?.properties ?? {};
  const keys = new Set([...Object.keys(value), ...Object.keys(props)]);
  return [...keys]
    .filter((k) => k !== "kind" && (!only || only.has(k)))
    .map((k) => {
      const label = labels[k];
      return {
        path: `${section}.${k}`,
        value: value[k],
        ...(range(props[k]) ? { range: range(props[k]) } : {}),
        ...(typeof label === "string"
          ? { meaning: label }
          : Array.isArray(label)
            ? {
                meaning: label
                  .map((o) =>
                    Array.isArray(o) ? `${o[0]} = ${o[1]}` : String(o),
                  )
                  .join(", "),
              }
            : {}),
      };
    });
}

/** Shallow differences from the card, so variations read as patches. */
function diff(base: unknown, next: unknown): unknown {
  if (JSON.stringify(base) === JSON.stringify(next)) return undefined;
  // An empty list and a missing one draw the same.
  const empty = (v: unknown) =>
    v === undefined || (Array.isArray(v) && !v.length);
  if (empty(base) && empty(next)) return undefined;
  if (
    base &&
    next &&
    typeof base === "object" &&
    typeof next === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(next)
  ) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(next)])) {
      const d = diff(
        (base as Record<string, unknown>)[k],
        (next as Record<string, unknown>)[k],
      );
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return next ?? null;
}

/** The kind's own editor labels: what each setting does for this kind. */
function textLabels(kind: string): Record<string, unknown> {
  const tables = [
    kineticControls,
    titleControls,
    lookControls,
    layoutControls,
  ] as Record<string, Record<string, unknown>>[];
  for (const table of tables) if (table[kind]) return table[kind];
  return {};
}

/** Everything needed to choose and tune one card. */
export function describeEffect(entries: CatalogEntry[], id: string) {
  const entry =
    entries.find((e) => e.effect.id === id) ??
    entries.find((e) =>
      getEffectFamily(e.effect.id)?.variations.some((v) => v.id === id),
    );
  if (!entry)
    throw new Error(`No effect ${id}. Use find_effects to look one up.`);
  const effect = entry.effect;
  const { role, feel } = effectRole(effect);
  const fits = effectTarget(effect);
  const out: Record<string, unknown> = {
    ...row(entry),
    roleHint: roleHints[role as EffectRole],
    fitsDescription: fitsNames[fits],
    notFor:
      fits === "text"
        ? "images, video, shapes, scenes, backdrops and audio"
        : fits === "picture"
          ? "text and audio"
          : "audio",
    requiresEngine: effectEngine(effect),
  };
  const list: Setting[] = [];
  if (effect.overlay) {
    const spec = overlaySpecs[effect.overlay.kind];
    out.overlayKind = {
      kind: effect.overlay.kind,
      name: spec.name,
      section: spec.feel,
      description: spec.description,
      ...(spec.variants?.length
        ? { variants: spec.variants.map((name, i) => `${i} = ${name}`) }
        : {}),
      takesFills: !!spec.fills,
    };
    // Kind-specific meanings first, then the shared styles.
    const own = spec.controls as Record<string, string>;
    list.push(
      ...settings("overlay", effect.overlay, overlayJson, {
        ...overlayStyleHelp,
        ...own,
      }).sort(
        (a, b) =>
          Number(!(a.path.slice(8) in own)) - Number(!(b.path.slice(8) in own)),
      ),
    );
  }
  if (effect.text) {
    const labels = textLabels(effect.text.kind);
    out.textKind = {
      kind: effect.text.kind,
      name: textEffectNames[effect.text.kind as keyof typeof textEffectNames],
      ...(typeof labels.note === "string" ? { note: labels.note } : {}),
    };
    // The text schema covers every kind; show the timing settings and the
    // ones this kind's editor exposes.
    const used = new Set([
      "seconds",
      "stagger",
      "unit",
      "tempo",
      "motion",
      ...Object.keys(labels).filter((k) => k !== "note"),
    ]);
    list.push(
      ...settings(
        "text",
        effect.text as Record<string, unknown>,
        textJson,
        {
          seconds: "Entrance (or exit) duration",
          stagger: "Delay between units, 0–1",
          unit: "What moves: character, word or title",
          tempo: "Beat kinds' tempo, BPM; use the song's",
          motion:
            "order (start/end/center/edges/random) and direction (in, or out to play as an exit)",
          ...labels,
        },
        used,
      ),
    );
  }
  if (effect.art) {
    out.artKind = { kind: effect.art.kind, name: artNames[effect.art.kind] };
    list.push(
      ...settings(
        "art",
        effect.art as Record<string, unknown>,
        sectionSchemas.art,
        artControls[effect.art.kind] as Record<string, string>,
      ),
    );
  }
  effect.passes?.forEach((pass, i) => {
    list.push({
      path: `passes.${i}.kind`,
      value: pass.kind,
      meaning: visualNames[pass.kind],
    });
    list.push(
      ...settings(
        `passes.${i}`,
        pass as Record<string, unknown>,
        sectionSchemas.passes?.items,
        {},
      ).filter(
        (s) =>
          (pass as Record<string, unknown>)[s.path.split(".").pop()!] !==
          undefined,
      ),
    );
  });
  effect.channels.forEach((channel, i) =>
    list.push({
      path: `channels.${i}`,
      value: channel,
      meaning:
        "A curve on one property: from → to over the clip (or seconds at its start/end); frequency is cycles per second",
    }),
  );
  if (effect.depth)
    list.push(
      ...settings(
        "depth",
        effect.depth as Record<string, unknown>,
        sectionSchemas.depth,
      ),
    );
  out.settings = list.map((s) =>
    Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)),
  );
  const family = getEffectFamily(effect.presetFamilyId ?? effect.id);
  if (family && family.variations.length > 1)
    out.variations = family.variations.map((v) => {
      const patch = effectVariationPatch(effect, v.id);
      const base = EffectSchema.parse(effect);
      const varied = patch ? EffectSchema.parse({ ...effect, ...patch }) : base;
      return { id: v.id, name: v.name, changes: diff(base, varied) ?? {} };
    });
  out.howToUse =
    "apply_effect with this id (and optionally variationId) applies it; update_effect_instance with a settings patch tunes one element afterwards. Use the song's tempo for every beat-timed setting.";
  return out;
}

/** The built-in cards plus saved and imported ones. */
export function catalogEntries(
  user: { collection?: string; bundle: { effect: Effect } }[] = [],
): CatalogEntry[] {
  return [
    ...builtinEffects.map((effect) => ({ effect, source: "builtin" as const })),
    ...user.map((u) => ({
      effect: u.bundle.effect,
      source: (u.collection === "library"
        ? "library"
        : "mine") as CatalogSource,
    })),
  ];
}
export { targetNames };

/** What get_capabilities reports about the library: roles, their feels and counts. */
export function libraryOverview(entries: CatalogEntry[]) {
  const rows = entries.map(row);
  return {
    effects: rows.length,
    roles: effectRoles.map((role) => {
      const inRole = rows.filter((r) => r.role === role);
      const feels: Record<string, number> = {};
      for (const r of inRole) feels[r.feel] = (feels[r.feel] ?? 0) + 1;
      return { role, hint: roleHints[role], effects: inRole.length, feels };
    }),
  };
}
