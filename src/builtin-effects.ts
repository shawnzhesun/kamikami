import {
  EffectSchema,
  initialProject,
  type Channel,
  type Effect,
} from "./model";
import { builtinTextSettings, TextEffectSchema } from "./text-effects";
import { DepthSchema, FieldSchema, ParticleSchema } from "./motion";
import { type VisualPass } from "./visual-effects";
import { makeArt, type Art, type ArtKind } from "./artwork";
import { overlayCards as overlayLibrary } from "./overlay-cards";
import { exitName, isReversibleEntrance } from "./effect-roles";

const pass = (
  kind: VisualPass["kind"],
  patch: Partial<VisualPass> = {},
): VisualPass => ({
  kind,
  strength: 0.6,
  size: 0.5,
  speed: 1,
  color: "#f8d4b0",
  secondary: "#072d39",
  angle: 0,
  timing: "constant",
  seconds: 0.6,
  seed: 17,
  ...patch,
});
const channel = (
  property: Channel["property"],
  from: number,
  to: number,
  curve: Channel["curve"] = "ease",
  frequency = 1,
  phase = 0,
): Channel => ({ property, from, to, curve, frequency, phase });
type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  at: string;
  description: string;
  channels?: Channel[];
  passes?: VisualPass[];
};
export const animationEffectCatalog: CatalogEntry[] = [
  {
    id: "memory-vignette",
    name: "Memory vignette",
    category: "Light & color",
    at: "00:00–00:08; 03:15–03:27",
    description:
      "Dark, softly feathered edges around a clear center. Apply to a background drawing or a composed scene.",
    passes: [pass("vignette", { strength: 0.85, size: 0.6, color: "#07151d" })],
  },
  {
    id: "memory-spotlight",
    name: "Paper spotlight",
    category: "Light & color",
    at: "00:00–00:08; 03:28–03:36",
    description:
      "Warm diffuse light over a cool, dark perimeter. Uses the element’s existing alpha; add a background layer behind isolated cutouts.",
    passes: [
      pass("spotlight", { strength: 0.8, size: 0.6 }),
      pass("vignette", { strength: 0.65, color: "#07151d" }),
    ],
  },
  {
    id: "memory-sunset",
    name: "Sunset memory",
    category: "Light & color",
    at: "00:09–00:35; 02:09–02:19",
    description:
      "Amber highlights, dark brown shadows and soft bloom for warm memory scenes.",
    channels: [channel("contrast", 1.12, 1.12)],
    passes: [
      pass("duotone", {
        color: "#ffbf78",
        secondary: "#241419",
        strength: 0.5,
      }),
      pass("bloom", { strength: 0.25 }),
      pass("vignette", { strength: 0.5, color: "#170d12" }),
    ],
  },
  {
    id: "memory-teal",
    name: "Midnight teal",
    category: "Light & color",
    at: "00:49–01:13; 02:00–02:08",
    description:
      "Cold cyan light with deep teal shadows, reduced saturation and dark edges.",
    channels: [
      channel("saturation", 0.72, 0.72),
      channel("contrast", 1.16, 1.16),
    ],
    passes: [
      pass("duotone", {
        strength: 0.45,
        color: "#95e6ed",
        secondary: "#031d26",
      }),
      pass("vignette", { strength: 0.6, color: "#020d12" }),
    ],
  },
  {
    id: "memory-bloom",
    name: "Soft highlight bloom",
    category: "Light & color",
    at: "01:39–01:41; 04:05–04:13",
    description:
      "A diffuse glow derived from the bright areas of your artwork, preserving its sharp base image.",
    passes: [pass("bloom", { strength: 0.65, size: 0.45 })],
  },
  {
    id: "memory-flare",
    name: "Horizon flare",
    category: "Light & color",
    at: "00:09–00:16; 00:51–00:52; 04:17–04:20",
    description:
      "A narrow horizontal light streak with a warm central glow. Position follows the element; use on a background plate for a scene-wide flare.",
    passes: [pass("flare", { strength: 0.8, size: 0.3, speed: 0.35 })],
  },
  {
    id: "memory-light-leak",
    name: "Warm light wash",
    category: "Light & color",
    at: "03:46; 03:58; 04:11–04:13",
    description:
      "A drifting warm, diffuse light wash with a faint horizontal streak.",
    passes: [
      pass("spotlight", { strength: 0.55, size: 0.8, speed: 0.35 }),
      pass("flare", { strength: 0.25, size: 0.65, speed: 0.25 }),
    ],
  },
  {
    id: "memory-grain",
    name: "Print grain",
    category: "Texture & signal",
    at: "00:39–00:46; 02:31–02:33",
    description:
      "Fine, deterministic moving grain. Especially useful over drawings and simulated screens.",
    passes: [pass("grain", { strength: 0.2, size: 0.3, speed: 0.7 })],
  },
  {
    id: "memory-crt",
    name: "CRT phosphor",
    category: "Texture & signal",
    at: "00:39–00:47; 01:52–01:56; 02:31–02:33",
    description:
      "Scrolling scanlines, subtle grain, cyan bloom and softened edges. Apply to a screen-content layer before placing it inside a drawn monitor.",
    passes: [
      pass("scanlines", { strength: 0.38, size: 0.35, speed: 0.7 }),
      pass("grain", { strength: 0.13, size: 0.2 }),
      pass("bloom", { strength: 0.24, size: 0.18 }),
    ],
  },
  {
    id: "memory-signal-tear",
    name: "Broken TV signal",
    category: "Texture & signal",
    at: "00:36–00:43",
    description:
      "Stepped horizontal bands, digital blocks or smooth wave displacement, combined with RGB separation and scanlines. Choose the distortion pattern and adjust each component; set scanline or RGB strength to zero for a clean wave warp.",
    passes: [
      pass("distortion", { strength: 0.7, size: 0.45, speed: 1.5 }),
      pass("chromatic", { strength: 0.45, size: 0.3 }),
      pass("scanlines", { strength: 0.45, size: 0.4 }),
    ],
  },
  {
    id: "memory-rgb",
    name: "Chromatic fringe",
    category: "Texture & signal",
    at: "01:17–01:18; 02:22; 03:52; 04:04",
    description:
      "Separate red and cyan edges with a subtle animated offset, preserving transparency.",
    passes: [pass("chromatic", { strength: 0.75, size: 0.35, speed: 1 })],
  },
  {
    id: "memory-hatch",
    name: "Print screen",
    category: "Graphic overlays",
    at: "01:19; 01:44; 02:58",
    description:
      "Lines or dots over the artwork. Adjust spacing, angle, color and movement for diagonal hatching or a dotted screen-print texture.",
    passes: [
      pass("hatch", {
        strength: 0.6,
        size: 0.3,
        angle: -30,
        color: "#bce5e5",
        speed: 0.4,
      }),
    ],
  },
  {
    id: "memory-hex",
    name: "Hexagon field",
    category: "Graphic overlays",
    at: "00:38–00:39; 02:29–02:30",
    description:
      "A drifting honeycomb grid with softly pulsing filled cells. Cyan by default; change the colors for the red variation.",
    passes: [
      pass("hexagons", {
        strength: 0.6,
        size: 0.5,
        color: "#20d9ed",
        secondary: "#075a78",
        speed: 0.65,
      }),
    ],
  },
  {
    id: "memory-flecks",
    name: "Particles",
    category: "Graphic overlays",
    at: "02:17–02:19; 03:15–03:27; 04:17–04:20",
    description:
      "Choose drifting paper flecks or expanding radial bursts with fading spark trails. Adjust size, speed, seed and colors. Apply to a background plate for scene-wide particles; the overlay is confined to the element’s alpha.",
    passes: [
      pass("particles", {
        strength: 0.7,
        size: 0.3,
        color: "#fff4ce",
        speed: 0.5,
      }),
    ],
  },
  {
    id: "memory-letterbox",
    name: "Cinematic matte",
    category: "Graphic overlays",
    at: "01:15–01:19; 01:35–01:37",
    description:
      "Top and bottom mattes, as seen on the widescreen running and inset graphic shots. Size controls the bar height.",
    passes: [pass("letterbox", { strength: 1, size: 0.3, color: "#000000" })],
  },
  {
    id: "memory-red-cutout",
    name: "Red silhouette",
    category: "Cutout treatments",
    at: "00:53; 01:14; 01:42",
    description:
      "Replace every opaque pixel with red. Use an isolated transparent drawing for a character silhouette; a flattened image becomes a solid rectangle.",
    passes: [pass("silhouette", { strength: 1, color: "#f44a51" })],
  },
  {
    id: "memory-black-cutout",
    name: "Shadow silhouette",
    category: "Cutout treatments",
    at: "00:18–00:32; 00:54–00:56; 04:00–04:02",
    description:
      "Turn an isolated drawing into a near-black silhouette while preserving its alpha.",
    passes: [pass("silhouette", { strength: 1, color: "#071118" })],
  },
  {
    id: "memory-echo",
    name: "Cutout echoes",
    category: "Cutout treatments",
    at: "02:52; 04:01; 04:08",
    description:
      "Offset translucent copies of the current drawing create graphic double exposure. This is a spatial echo, not a trail sampled from earlier frames.",
    passes: [pass("echo", { strength: 0.5, size: 0.5, speed: 0.35 })],
  },
  {
    id: "memory-shatter",
    name: "Title fragments out",
    category: "Transitions",
    at: "00:06–00:08",
    description:
      "Break the element into deterministic triangular fragments near its end. Best on a title card or transparent drawing; an approximation of the hand-designed source shards.",
    passes: [
      pass("shatter", { strength: 1, size: 0.55, timing: "out", seconds: 1.2 }),
    ],
  },
  {
    id: "memory-white-flash",
    name: "White flash in",
    category: "Transitions",
    at: "01:32; 01:51; 02:46; 03:05; 04:11",
    description:
      "A short white exposure flash that clears to the artwork at the beginning of a clip. Put it on the incoming layer at a cut.",
    passes: [
      pass("flash", {
        strength: 1,
        color: "#fff7e9",
        timing: "in",
        seconds: 0.35,
      }),
      pass("bloom", { strength: 0.7, timing: "in", seconds: 0.55 }),
    ],
  },
  {
    id: "memory-red-flash",
    name: "Red flash in",
    category: "Transitions",
    at: "01:14; 02:53; 03:00",
    description:
      "A red graphic flash at the start of a clip. Use over a background plate for the full-frame red cutaway.",
    passes: [
      pass("flash", {
        strength: 1,
        color: "#fa162a",
        timing: "in",
        seconds: 0.25,
      }),
    ],
  },
  {
    id: "memory-iris",
    name: "Soft iris in",
    category: "Transitions",
    at: "00:08–00:10; 03:14–03:16",
    description:
      "Open a softly feathered circular window onto the element. Place another layer beneath it to reveal through the transparent area.",
    passes: [
      pass("iris", { strength: 1, size: 0.3, timing: "in", seconds: 0.75 }),
    ],
  },
  {
    id: "memory-panel",
    name: "Graphic panel in",
    category: "Transitions",
    at: "01:18–01:21; 01:35–01:37; 03:53–03:55",
    description:
      "A colored leading panel sweeps across and reveals the artwork. It reveals a single layer; put the preceding shot underneath for a transition.",
    passes: [
      pass("wipe", {
        strength: 1,
        size: 0.2,
        color: "#ef4c57",
        timing: "in",
        seconds: 0.55,
      }),
    ],
  },
  {
    id: "memory-focus",
    name: "Focus pull in",
    category: "Camera & motion",
    at: "00:18–00:19; 01:27–01:28; 03:37–03:40",
    description:
      "Clear from a soft blur into focus across the clip. Short clips make a fast focus snap.",
    channels: [channel("blur", 22, 0, "ease-out")],
  },
  {
    id: "memory-impact",
    name: "Impact zoom",
    category: "Camera & motion",
    at: "01:17–01:18; 01:34; 02:28–02:29; 04:04",
    description:
      "A fast oversized-to-normal zoom with blur and color fringes. Use on a short incoming shot.",
    channels: [
      channel("scale", 1.45, 1, "ease-out"),
      channel("blur", 18, 0, "ease-out"),
    ],
    passes: [
      pass("chromatic", { strength: 0.65, timing: "in", seconds: 0.35 }),
    ],
  },
  {
    id: "memory-whip",
    name: "Whip slide in",
    category: "Camera & motion",
    at: "01:18–01:19; 01:34–01:37; 03:53–03:54",
    description:
      "Rapid lateral entry with directional smear. Best on a short graphic panel or drawing layer.",
    channels: [channel("x", 900, 0, "ease-out")],
    passes: [
      pass("echo", {
        strength: 0.75,
        size: 0.65,
        timing: "in",
        seconds: 0.35,
        speed: 0,
      }),
    ],
  },
  {
    id: "memory-jitter",
    name: "Held-frame jitter",
    category: "Camera & motion",
    at: "00:37–00:43; 01:17–01:18",
    description:
      "Deterministic held position/rotation jitter with slight overscan. It jitters the whole drawing; it does not redraw the character.",
    channels: [
      channel("x", -9, 9, "shake", 12),
      channel("y", -5, 5, "shake", 12, 3),
      channel("rotation", -0.25, 0.25, "shake", 12, 7),
      channel("scale", 1.03, 1.03),
    ],
  },
  {
    id: "memory-pan",
    name: "Drawing pan",
    category: "Camera & motion",
    at: "00:49–00:52; 01:21–01:24; 02:17–02:19",
    description:
      "Slow lateral drift with overscan. For parallax, apply different strengths or directions to separate foreground and background drawings.",
    channels: [channel("x", -90, 90), channel("scale", 1.12, 1.12)],
  },
  {
    id: "memory-pullback",
    name: "Scene pullback",
    category: "Camera & motion",
    at: "00:39–00:46; 01:45–01:47; 04:32–04:36",
    description:
      "A gradual pullback from a detail to the full illustration. Inset picture layouts still require positioning a separate background layer.",
    channels: [channel("scale", 1.35, 1)],
  },
  {
    id: "memory-roll",
    name: "Orbiting composition",
    category: "Camera & motion",
    at: "03:15–03:27",
    description:
      "Rotate and pull back a drawing or arranged group. For the two-person source composition, precompose or give both drawings the same movement.",
    channels: [channel("rotation", -12, 42), channel("scale", 1.18, 1)],
  },
  {
    id: "memory-perspective",
    name: "Angled picture plane",
    category: "Camera & motion",
    at: "00:41–00:46; 01:27–01:28; 04:37–04:39",
    description:
      "A gentle perspective turn for flat drawings, screens, and title cards. It changes the picture plane without generating new 3D geometry.",
    channels: [channel("rotateY", -18, 12), channel("scale", 1.08, 1)],
  },
  {
    id: "memory-type",
    name: "Kinetic title entry",
    category: "Typography",
    at: "01:07–01:09; 02:34–02:35; 04:00–04:02",
    description:
      "Text slides into place, sharpens, and tightens its spacing. Apply to individual text elements; varied word sizes and vertical typesetting remain layout choices.",
    channels: [
      channel("y", 60, 0, "ease-out"),
      channel("opacity", 0, 1, "ease-out"),
      channel("letterSpacing", 18, 0, "ease-out"),
      channel("blur", 5, 0, "ease-out"),
    ],
  },
  {
    id: "memory-fade",
    name: "Fade to dark",
    category: "Transitions",
    at: "00:08; 03:13–03:15; 04:40–04:43",
    description:
      "Fade the element away over its duration. A black background below produces a fade to black.",
    channels: [channel("opacity", 1, 0)],
  },
];
export const animationEffects: Effect[] = animationEffectCatalog.map((entry) =>
  EffectSchema.parse({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    channels: entry.channels ?? [],
    ...(entry.passes ? { passes: entry.passes } : {}),
    color: "#f2765e",
    tint: 0,
  }),
);
export const legacyBuiltinEffects: Effect[] = [
  ...initialProject.effects,
  ...animationEffects,
];

type EffectParameters = Pick<
  Effect,
  | "channels"
  | "passes"
  | "color"
  | "tint"
  | "text"
  | "depth"
  | "origin"
  | "art"
  | "overlay"
>;
type EffectVariation = {
  id: string;
  name: string;
  parameters: EffectParameters;
};
type EffectFamily = {
  id: string;
  name: string;
  category: string;
  description: string;
  variations: EffectVariation[];
};

const parameters = (effect: Effect): EffectParameters => ({
  channels: effect.channels,
  passes: effect.passes ?? [],
  ...(effect.text ? { text: effect.text } : {}),
  ...(effect.depth ? { depth: effect.depth } : {}),
  ...(effect.origin ? { origin: effect.origin } : {}),
  ...(effect.art ? { art: effect.art } : {}),
  ...(effect.overlay ? { overlay: effect.overlay } : {}),
  color: effect.color,
  tint: effect.tint,
});

/** Fill optional components with neutral values so all variations share controls. */
function family(
  definition: Omit<EffectFamily, "variations">,
  members: { id: string; name: string }[],
  passKinds: VisualPass["kind"][] = [],
  properties: Channel["property"][] = [],
): EffectFamily {
  return {
    ...definition,
    variations: members.map(({ id, name }) => {
      const source = legacyBuiltinEffects.find((e) => e.id === id)!;
      return {
        id,
        name,
        parameters: {
          ...parameters(source),
          channels: properties.map(
            (property) =>
              source.channels.find((c) => c.property === property) ??
              channel(property, 1, 1),
          ),
          passes: passKinds.map(
            (kind) =>
              source.passes?.find((p) => p.kind === kind) ?? {
                ...(members
                  .map((member) =>
                    legacyBuiltinEffects
                      .find((e) => e.id === member.id)!
                      .passes?.find((p) => p.kind === kind),
                  )
                  .find(Boolean) ?? pass(kind)),
                strength: 0,
              },
          ),
        },
      };
    }),
  };
}

export const effectFamilies: EffectFamily[] = [
  family(
    {
      id: "color-flash",
      name: "Color flash",
      category: "Transitions",
      description:
        "A colored exposure flash with optional highlight bloom. Start with White or Red, then adjust the color, strength, timing and duration. Set bloom strength to zero for a flat graphic flash.",
    },
    [
      { id: "memory-white-flash", name: "White" },
      { id: "memory-red-flash", name: "Red" },
    ],
    ["flash", "bloom"],
  ),
  family(
    {
      id: "color-silhouette",
      name: "Color silhouette",
      category: "Cutout treatments",
      description:
        "Recolor an isolated drawing or outline its alpha edges. Start with Red or Shadow, then choose any color and switch between fill and outline. Use transparent artwork or text; a flattened image only provides a rectangular boundary.",
    },
    [
      { id: "memory-red-cutout", name: "Red" },
      { id: "memory-black-cutout", name: "Shadow" },
    ],
    ["silhouette"],
  ),
  family(
    {
      id: "color-grade",
      name: "Color grade",
      category: "Light & color",
      description:
        "Two-color grading with adjustable saturation, contrast, bloom and vignette. Start with Sunset memory or Midnight teal, then customize highlight and shadow colors. Set optional pass strengths to zero to disable them.",
    },
    [
      { id: "memory-sunset", name: "Sunset memory" },
      { id: "memory-teal", name: "Midnight teal" },
    ],
    ["duotone", "bloom", "vignette"],
    ["saturation", "contrast"],
  ),
  family(
    {
      id: "scene-light",
      name: "Scene light",
      category: "Light & color",
      description:
        "Combine a soft spotlight, horizontal flare and vignette. Start with Paper spotlight, Horizon flare or Warm light wash, then adjust each component. A strength of zero turns that component off. Apply to a background plate for scene-wide lighting.",
    },
    [
      { id: "memory-spotlight", name: "Paper spotlight" },
      { id: "memory-flare", name: "Horizon flare" },
      { id: "memory-light-leak", name: "Warm light wash" },
    ],
    ["spotlight", "flare", "vignette"],
  ),
  family(
    {
      id: "camera-zoom",
      name: "Camera zoom",
      category: "Camera & motion",
      description:
        "Animate scale over the clip. Start with Slow push or Scene pullback, then adjust the start/end scale and curve for either direction. Impact zoom remains a separate recipe with blur and chromatic fringe.",
    },
    [
      { id: "slow-push", name: "Slow push" },
      { id: "memory-pullback", name: "Scene pullback" },
    ],
    [],
    ["scale"],
  ),
];

const replacedIds = new Set(
  effectFamilies.flatMap((f) => f.variations.map((v) => v.id)),
);
const familyEffects = effectFamilies.map((f) =>
  EffectSchema.parse({
    id: f.id,
    name: f.name,
    description: f.description,
    ...f.variations[0].parameters,
  }),
);

/** Additional operations observed in videoplayback.mp4; modes share a single card. */
export const videoPlaybackEffectCatalog: CatalogEntry[] = [
  {
    id: "color-remap",
    name: "Color remap",
    category: "Light & color",
    at: "00:01–00:03; 00:11–00:28; 01:25–01:29; 02:03–02:14",
    description:
      "Negative, solarized or posterized color mapping with adjustable hue and optional hue cycling. Use Color grade for ordinary two-color grading. This remaps the whole drawing, not selected clothing or painted regions.",
    passes: [
      pass("palette", {
        strength: 1,
        size: 0.3,
        speed: 0,
        angle: 0,
        paletteMode: "negative",
      }),
    ],
  },
  {
    id: "motion-smear",
    name: "Motion smear",
    category: "Camera & motion",
    at: "00:03; 00:17–00:18; 00:46; 00:56; 01:14; 01:20; 02:25; 02:39; 02:51",
    description:
      "Zoom, spin or directional smearing derived from the current frame. Choose the direction, spread and transition timing. Combine with Camera zoom or Orbiting composition for movement. It does not use optical flow or past frames.",
    passes: [
      pass("smear", {
        strength: 1,
        size: 0.6,
        speed: 0,
        angle: 45,
        smearMode: "zoom",
        timing: "in",
        seconds: 0.45,
      }),
    ],
  },
  {
    id: "image-repetition",
    name: "Image repetition",
    category: "Graphic overlays",
    at: "00:27–00:29; 00:44–00:45; 01:13–01:15; 02:37–02:39; 02:51–02:53; 02:55",
    description:
      "Repeat a drawing as a grid, mirrored panels, folded radial sectors or nested frames. Count and size adjust the arrangement. Apply to a background or isolated drawing; arranging different characters around a circle still requires separate elements.",
    passes: [
      pass("repeat", {
        strength: 1,
        size: 0.3,
        speed: 0,
        angle: 0,
        repeatMode: "mirror",
        count: 6,
      }),
    ],
  },
  {
    id: "graphic-rings",
    name: "Graphic rings",
    category: "Graphic overlays",
    at: "00:31–00:34; 01:04–01:08",
    description:
      "Animated concentric segmented rings inspired by the circular title and interface graphics. Adjust radius, count, colors and rotation. Apply to an opaque background plate for a full ring field; lettering, arrows and interface panels are separate artwork.",
    passes: [
      pass("rings", {
        strength: 0.75,
        size: 0.65,
        speed: 0.6,
        color: "#e9fbff",
        secondary: "#87cfe8",
        count: 4,
      }),
    ],
  },
];
export const videoPlaybackEffects: Effect[] = videoPlaybackEffectCatalog.map(
  (entry) =>
    EffectSchema.parse({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      channels: [],
      passes: entry.passes,
      color: "#f2765e",
      tint: 0,
    }),
);

/** Native recipes inspired by lifeprompt-team/remotion-scenes' animation catalog. */
const textRecipe = (id: string, name: string, description: string): Effect =>
  EffectSchema.parse({
    id,
    name,
    description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    text: builtinTextSettings[id],
  });
export const remotionSceneEffects: Effect[] = [
  textRecipe(
    "text-typewriter",
    "Typewriter",
    "Reveal text character by character or word by word, with an optional blinking caret. Duration controls when the complete title is visible. Text elements only.",
  ),
  textRecipe(
    "text-scramble",
    "Text scramble",
    "Deterministic changing glyphs resolve into the original title. Adjust duration, scramble speed and seed. Original spacing and line breaks stay in place. Text elements only.",
  ),
  textRecipe(
    "text-stagger",
    "Staggered text",
    "Bring characters or words in with a rise, a 3D flip or a pop. Duration and stagger control the entrance; distance sets the rise height. Text elements only.",
  ),
  textRecipe(
    "text-wave",
    "Text wave",
    "A continuous wave travels through characters or words. Adjust height, speed and phase spacing. Text elements only.",
  ),
  textRecipe(
    "text-gradient",
    "Flowing text gradient",
    "A flowing two-color gradient fills the title while keeping its font and transparency. Adjust both colors and movement speed. Text elements only.",
  ),
  textRecipe(
    "text-neon",
    "Neon text",
    "Colored lettering with a breathing neon halo. Adjust glow size, pulse speed and the inner and outer glow colors. Text elements only.",
  ),
  EffectSchema.parse({
    id: "blinds-reveal",
    name: "Blinds reveal",
    description:
      "Reveal or hide an element through parallel horizontal or vertical strips. Adjust strip count, timing and transition duration; the original transparency is preserved.",
    channels: [],
    color: "#f2765e",
    tint: 0,
    passes: [
      pass("blinds", {
        strength: 1,
        timing: "in",
        seconds: 0.9,
        count: 8,
        blindsDirection: "horizontal",
      }),
    ],
  }),
];

export const motionEffects: Effect[] = [
  textRecipe(
    "text-glitch",
    "Text glitch",
    "Short seeded bursts of character jitter, slice displacement, RGB separation and optional glyph corruption. Choose continuous glitches or an entrance that settles into readable text.",
  ),
  EffectSchema.parse({
    id: "depth-motion",
    name: "Depth motion",
    description:
      "Move flat artwork toward or away from the camera with perspective, tilt and focus. Each element moves independently; use object fields for layered depth.",
    channels: [],
    color: "#f2765e",
    tint: 0,
    depth: DepthSchema.parse({}),
  }),
];

/** Named starting points for new motion and existing fields; no duplicate gallery cards. */
export const motionEffectFamilies: EffectFamily[] = (() => {
  const find = (id: string) =>
    [
      ...motionEffects,
      ...remotionSceneEffects,
      ...videoPlaybackEffects,
      ...legacyBuiltinEffects,
    ].find((e) => e.id === id)!;
  const build = (
    id: string,
    category: string,
    variations: [string, string, Partial<Effect>][],
  ): EffectFamily => {
    const source = find(id);
    return {
      id,
      name: source.name,
      description: source.description,
      category,
      variations: variations.map(([id, name, patch]) => ({
        id,
        name,
        parameters: parameters(EffectSchema.parse({ ...source, ...patch })),
      })),
    };
  };
  const glitch = (patch: Record<string, unknown>) =>
    TextEffectSchema.parse({ kind: "glitch", speed: 3, glitch: patch });
  const particle = (patch: Record<string, unknown>) => [
    pass("particles", {
      strength: 0.9,
      size: 0.3,
      speed: 1,
      color: "#ffc89b",
      secondary: "#66a3bf",
      particles: ParticleSchema.parse(patch),
    }),
  ];
  const field = (patch: Record<string, unknown>) => [
    pass("repeat", { strength: 1, speed: 1, field: FieldSchema.parse(patch) }),
  ];
  return [
    build("text-glitch", "Typography", [
      // The untouched card must match a named look instead of reading as Custom.
      ["glitch-classic", "Classic", {}],
      [
        "glitch-stutter",
        "Signal stutter",
        { text: glitch({ rgb: 0, slices: 0 }) },
      ],
      [
        "glitch-sliced",
        "Sliced title",
        { text: glitch({ slices: 0.5, jitter: 0.05, affected: 0.8 }) },
      ],
      [
        "glitch-rgb",
        "RGB rupture",
        { text: glitch({ rgb: 0.12, affected: 1, dropout: 0 }) },
      ],
      [
        "glitch-reveal",
        "Corrupted reveal",
        {
          text: glitch({
            timing: "entrance",
            substitute: true,
            affected: 1,
            burst: 0.3,
          }),
        },
      ],
    ]),
    build("depth-motion", "Camera & motion", [
      [
        "depth-approach",
        "Approach and settle",
        { depth: DepthSchema.parse({}) },
      ],
      [
        "depth-recede",
        "Recede",
        { depth: DepthSchema.parse({ from: 0, to: 4, tiltY: 0 }) },
      ],
      [
        "depth-fly-past",
        "Fly past camera",
        {
          depth: DepthSchema.parse({
            from: 3,
            to: -0.98,
            x: 0.2,
            tiltY: -30,
            easing: "linear",
          }),
        },
      ],
      [
        "depth-float",
        "Floating card",
        {
          depth: DepthSchema.parse({
            mode: "float",
            from: 0.2,
            to: 1,
            x: 0.1,
            y: 0.05,
            tiltX: 15,
            seconds: 4,
            blur: 2,
          }),
        },
      ],
    ]),
    build("memory-flecks", "Graphic overlays", [
      ["particles-paper", "Drifting paper", {}],
      [
        "particles-flat-burst",
        "Radial bursts",
        { passes: [pass("particles", { particleStyle: "burst", count: 3 })] },
      ],
      [
        "particles-dust",
        "Floating dust",
        { passes: particle({ mode: "drift", shape: "dot" }) },
      ],
      [
        "particles-confetti",
        "Confetti drift",
        { passes: particle({ shape: "paper", gravity: 0.2, spin: 90 }) },
      ],
      [
        "particles-depth-burst",
        "Depth fireworks",
        {
          passes: particle({
            mode: "burst",
            emitter: "point",
            shape: "spark",
            count: 160,
            velocity: 1.2,
            lifetime: 3,
            gravity: 0.3,
            trails: 0.8,
            drag: 0.7,
          }),
        },
      ],
      [
        "particles-tunnel",
        "Star tunnel",
        {
          passes: particle({
            mode: "tunnel",
            shape: "spark",
            trails: 0.7,
            lifetime: 4,
            turbulence: 0,
            gravity: 0,
          }),
        },
      ],
      [
        "particles-vortex",
        "Vortex",
        {
          passes: particle({
            mode: "vortex",
            velocity: 2,
            gravity: 0,
            trails: 0.4,
          }),
        },
      ],
    ]),
    build("image-repetition", "Graphic overlays", [
      [
        "repetition-grid",
        "Grid",
        {
          passes: [
            pass("repeat", { strength: 1, repeatMode: "grid", count: 4 }),
          ],
        },
      ],
      ["repetition-mirror", "Mirror", {}],
      [
        "repetition-kaleidoscope",
        "Kaleidoscope",
        {
          passes: [
            pass("repeat", {
              strength: 1,
              repeatMode: "kaleidoscope",
              count: 8,
            }),
          ],
        },
      ],
      [
        "repetition-nested",
        "Nested frames",
        {
          passes: [
            pass("repeat", { strength: 1, repeatMode: "tunnel", count: 6 }),
          ],
        },
      ],
      ["repetition-volume", "Floating objects", { passes: field({}) }],
      [
        "repetition-depth-tunnel",
        "Depth tunnel",
        { passes: field({ mode: "tunnel", count: 20, size: 0.3 }) },
      ],
      [
        "repetition-orbit",
        "Orbital field",
        { passes: field({ mode: "orbit", count: 16, faceCamera: false }) },
      ],
      [
        "repetition-glyphs",
        "Glyph field",
        {
          passes: field({ unit: "character", count: 36, size: 0.7, depth: 2 }),
        },
      ],
    ]),
    build("text-stagger", "Typography", [
      [
        "stagger-rise",
        "Rise",
        { text: TextEffectSchema.parse({ kind: "stagger", style: "rise" }) },
      ],
      [
        "stagger-flip",
        "Flip",
        { text: TextEffectSchema.parse({ kind: "stagger", style: "flip" }) },
      ],
      [
        "stagger-pop",
        "Pop",
        { text: TextEffectSchema.parse({ kind: "stagger", style: "pop" }) },
      ],
      [
        "stagger-depth",
        "Depth fly in",
        {
          text: TextEffectSchema.parse({
            kind: "stagger",
            style: "depth",
            motion: {},
          }),
        },
      ],
      [
        "stagger-depth-out",
        "Depth fly out",
        {
          text: TextEffectSchema.parse({
            kind: "stagger",
            style: "depth",
            motion: { direction: "out" },
          }),
        },
      ],
      [
        "stagger-scatter",
        "Scatter assembly",
        {
          text: TextEffectSchema.parse({
            kind: "stagger",
            style: "scatter",
            motion: { order: "random", spread: 4 },
          }),
        },
      ],
      [
        "stagger-spiral",
        "Spiral assembly",
        {
          text: TextEffectSchema.parse({
            kind: "stagger",
            style: "spiral",
            motion: { spread: 3 },
          }),
        },
      ],
    ]),
  ];
})();

/** Spring, illustration, 3D-look, light and organic-transition recipes (kamikami-visual-v6). */
const spring = (
  property: Channel["property"],
  from: number,
  to: number,
  curve: Channel["curve"],
  seconds: number,
  frequency = 1,
  phase = 0,
  align?: "end",
): Channel => ({
  property,
  from,
  to,
  curve,
  frequency,
  phase,
  seconds,
  ...(align ? { align } : {}),
});
type StyleCard = {
  id: string;
  name: string;
  category: string;
  description: string;
  variations: [string, string, Partial<EffectParameters>][];
};
const styleCards: StyleCard[] = [
  {
    id: "spring-motion",
    name: "Spring motion",
    category: "Camera & motion",
    description:
      "Physically flavored entrances and exits: elastic pops, bouncing drops, jelly wobbles, overshooting slides, 3D flips, pendulum swings and an anticipation exit. Each curve runs for its own duration from the clip start (or end), then rests.",
    variations: [
      [
        "spring-elastic-pop",
        "Elastic pop",
        {
          channels: [
            spring("scale", 0.2, 1, "elastic", 1.1, 2.5),
            spring("opacity", 0, 1, "ease-out", 0.25),
          ],
        },
      ],
      [
        "spring-bounce-drop",
        "Bounce drop",
        {
          channels: [
            spring("y", -620, 0, "bounce", 1.5, 3),
            spring("scaleY", 1.18, 1, "damped", 1.5, 2.4),
            spring("scaleX", 0.88, 1, "damped", 1.5, 2.4),
          ],
        },
      ],
      [
        "spring-jelly",
        "Jelly wobble",
        {
          channels: [
            spring("scaleX", 1.28, 1, "damped", 1.6, 2.2),
            spring("scaleY", 0.78, 1, "damped", 1.6, 2.2),
            spring("skewX", 9, 0, "damped", 1.6, 1.6, 1),
          ],
        },
      ],
      [
        "spring-overshoot-slide",
        "Overshoot slide",
        {
          channels: [
            spring("x", -760, 0, "back", 0.85, 1, 0.6),
            spring("skewX", -16, 0, "damped", 1.1, 1.8),
            spring("opacity", 0, 1, "ease-out", 0.3),
          ],
        },
      ],
      [
        "spring-flip-in",
        "3D flip in",
        {
          channels: [
            spring("rotateX", -80, 0, "back", 0.9, 1, 0.4),
            spring("opacity", 0, 1, "ease-out", 0.3),
          ],
        },
      ],
      [
        "spring-pendulum",
        "Pendulum swing",
        {
          channels: [spring("rotation", -28, 0, "damped", 3, 0.9, 0)],
        },
      ],
      [
        "spring-anticipate-out",
        "Anticipation exit",
        {
          channels: [
            spring("scale", 1, 0, "anticipate", 0.7, 1, 0.3, "end"),
            spring("opacity", 1, 0, "ease", 0.7, 1, 0, "end"),
          ],
        },
      ],
    ],
  },
  {
    id: "line-boil",
    name: "Line boil",
    category: "Illustration",
    description:
      "Hand-drawn wobble: edges and lines jitter on held frames like traditional animation that was redrawn each frame. Keep strength low for a subtle 'alive' drawing; raise warp scale for a sketchier look.",
    variations: [
      [
        "boil-subtle",
        "Subtle boil",
        {
          passes: [
            pass("warp", {
              warpMode: "boil",
              strength: 0.45,
              size: 0.35,
              speed: 0.67,
            }),
          ],
        },
      ],
      [
        "boil-sketchy",
        "Sketchy",
        {
          passes: [
            pass("warp", {
              warpMode: "boil",
              strength: 0.9,
              size: 0.7,
              speed: 0.5,
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "liquid-warp",
    name: "Liquid warp",
    category: "Texture & signal",
    description:
      "Smooth, continuously evolving displacement like heat haze or water, or a melt that drips the element downward. Use At clip end timing on Melt to melt an element away.",
    variations: [
      [
        "liquid-flow",
        "Liquid flow",
        {
          passes: [
            pass("warp", {
              warpMode: "liquid",
              strength: 0.6,
              size: 0.4,
              speed: 0.5,
            }),
          ],
        },
      ],
      [
        "liquid-heat",
        "Heat haze",
        {
          passes: [
            pass("warp", {
              warpMode: "liquid",
              strength: 0.25,
              size: 0.05,
              speed: 2,
            }),
          ],
        },
      ],
      [
        "liquid-melt",
        "Melt away",
        {
          passes: [
            pass("warp", {
              warpMode: "melt",
              strength: 1,
              size: 0.5,
              speed: 0.8,
              timing: "out",
              seconds: 1.6,
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "paper-cutout",
    name: "Paper cutout",
    category: "Illustration",
    description:
      "Collage look: a torn white paper border with fiber texture and a soft drop shadow around transparent artwork or text. The stop-motion variation re-tears the edge and jitters the cutout a few times per second.",
    variations: [
      [
        "paper-sticker",
        "Paper sticker",
        {
          passes: [
            pass("paper", {
              strength: 1,
              size: 0.45,
              speed: 0,
              angle: 60,
              color: "#fbf7ee",
              secondary: "#000000",
            }),
          ],
        },
      ],
      [
        "paper-stop-motion",
        "Stop-motion cutout",
        {
          passes: [
            pass("paper", {
              strength: 1,
              size: 0.45,
              speed: 1,
              angle: 60,
              color: "#fbf7ee",
              secondary: "#000000",
            }),
          ],
          channels: [
            channel("x", -4, 4, "shake", 6, 11),
            channel("y", -3, 3, "shake", 6, 23),
            channel("rotation", -1.2, 1.2, "shake", 6, 37),
          ],
        },
      ],
    ],
  },
  {
    id: "comic-ink",
    name: "Comic ink",
    category: "Illustration",
    description:
      "Toon render: flattened color levels with ink contour and detail lines traced from image edges. Works best on photos and painted footage; raise line weight for a bolder cel look.",
    variations: [
      [
        "ink-cel",
        "Cel shade",
        {
          passes: [pass("ink", { strength: 1, size: 0.35, color: "#111111" })],
        },
      ],
      [
        "ink-bold",
        "Bold marker",
        { passes: [pass("ink", { strength: 1, size: 0.9, color: "#1b1030" })] },
      ],
    ],
  },
  {
    id: "pixel-art",
    name: "Pixel art",
    category: "Illustration",
    description:
      "Chunky pixels with optional ordered (Bayer) dithering into a 1-bit or four-tone handheld palette. Pixel-in resolves from big blocks to full resolution at the clip start.",
    variations: [
      [
        "pixel-blocks",
        "Pixelate",
        {
          passes: [
            pass("pixel", { strength: 1, size: 0.3, pixelMode: "pixelate" }),
          ],
        },
      ],
      [
        "pixel-in",
        "Pixel-in transition",
        {
          passes: [
            pass("pixel", {
              strength: 1,
              size: 1,
              pixelMode: "pixelate",
              timing: "in",
              seconds: 0.8,
            }),
          ],
        },
      ],
      [
        "pixel-dither",
        "1-bit dither",
        {
          passes: [
            pass("pixel", {
              strength: 1,
              size: 0.05,
              pixelMode: "dither",
              color: "#f4f0e6",
              secondary: "#1c1b22",
            }),
          ],
        },
      ],
      [
        "pixel-handheld",
        "Four-tone handheld",
        {
          passes: [
            pass("pixel", { strength: 1, size: 0.12, pixelMode: "gameboy" }),
          ],
        },
      ],
    ],
  },
  {
    id: "bevel-emboss",
    name: "Bevel & emboss",
    category: "3D & material",
    description:
      "Raised edges lit by a directional light with a specular highlight, giving flat logos and text a physical, pressed-metal or plastic feel. Orbiting light sweeps the highlight around the edges.",
    variations: [
      [
        "bevel-soft",
        "Soft bevel",
        {
          passes: [
            pass("bevel", {
              strength: 1,
              size: 0.35,
              speed: 0,
              angle: -135,
              color: "#ffffff",
            }),
          ],
        },
      ],
      [
        "bevel-orbit",
        "Orbiting light",
        {
          passes: [
            pass("bevel", {
              strength: 1,
              size: 0.5,
              speed: 1,
              angle: -135,
              color: "#ffe6b0",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "solid-extrusion",
    name: "Solid extrusion",
    category: "3D & material",
    description:
      "Gives flat artwork or text a continuous solid thickness, from an isometric block to a long flat-design shadow. Keyframe Extrusion depth on the applied effect to grow the solid.",
    variations: [
      [
        "extrude-block",
        "Isometric block",
        {
          passes: [
            pass("extrude", {
              strength: 1,
              size: 0.3,
              angle: 45,
              color: "#b8442f",
              secondary: "#4a1a14",
            }),
          ],
        },
      ],
      [
        "extrude-long-shadow",
        "Long shadow",
        {
          passes: [
            pass("extrude", {
              strength: 0.35,
              size: 1,
              angle: 45,
              color: "#000000",
              secondary: "#000000",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "holo-card",
    name: "Holo card",
    category: "3D & material",
    description:
      "A trading-card tilt in 3D with a holographic foil and glare that travel across the surface. Apply to a card, poster or logo plate.",
    variations: [
      [
        "holo-foil",
        "Foil tilt",
        {
          channels: [
            channel("rotateY", -14, 14, "sine", 0.22),
            channel("rotateX", -8, 8, "sine", 0.17, 0.25),
          ],
          passes: [
            pass("sheen", {
              strength: 0.85,
              size: 0.35,
              speed: 0.4,
              angle: 30,
              color: "#ffffff",
              sheenStyle: "foil",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "lens-bulge",
    name: "Lens bulge",
    category: "3D & material",
    description:
      "A magnifying glass lens that sweeps across the element with a glassy rim, or stays parked at the center. It refracts only this element, not layers behind it.",
    variations: [
      [
        "lens-sweep",
        "Magnifier sweep",
        {
          passes: [
            pass("lens", {
              strength: 0.7,
              size: 0.45,
              speed: 0.6,
              angle: 0,
              color: "#ffffff",
            }),
          ],
        },
      ],
      [
        "lens-static",
        "Parked lens",
        {
          passes: [
            pass("lens", {
              strength: 0.6,
              size: 0.6,
              speed: 0,
              color: "#ffffff",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "light-sweep",
    name: "Light sweep",
    category: "Light & color",
    description:
      "A glossy band of light glides across the element only, the classic logo shine. The foil style adds a rainbow holographic sheen.",
    variations: [
      [
        "sheen-gloss",
        "Gloss sweep",
        {
          passes: [
            pass("sheen", {
              strength: 0.8,
              size: 0.25,
              speed: 0.6,
              angle: 25,
              color: "#ffffff",
            }),
          ],
        },
      ],
      [
        "sheen-foil",
        "Holographic foil",
        {
          passes: [
            pass("sheen", {
              strength: 0.8,
              size: 0.3,
              speed: 0.5,
              angle: 25,
              color: "#ffffff",
              sheenStyle: "foil",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "energy-edge",
    name: "Energy edge",
    category: "Light & color",
    description:
      "An electric, flickering glow wraps the element's outline with a hot core and layered halos, in the style of saber and lightning title treatments. Works on any element with transparency.",
    variations: [
      [
        "energy-electric",
        "Electric blue",
        {
          passes: [
            pass("glow", {
              strength: 0.9,
              size: 0.4,
              speed: 1,
              color: "#38a8ff",
              secondary: "#e8f6ff",
            }),
          ],
        },
      ],
      [
        "energy-saber",
        "Saber red",
        {
          passes: [
            pass("glow", {
              strength: 1,
              size: 0.6,
              speed: 0.6,
              color: "#ff2a3c",
              secondary: "#fff0f0",
            }),
          ],
        },
      ],
      [
        "energy-toxic",
        "Toxic green",
        {
          passes: [
            pass("glow", {
              strength: 0.8,
              size: 0.5,
              speed: 1.4,
              color: "#5dff6a",
              secondary: "#f0fff0",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "noise-dissolve",
    name: "Noise dissolve",
    category: "Transitions",
    description:
      "The element appears or disappears through organic noise with a glowing burnt edge. Strength 1 is fully dissolved; Dissolve in reveals at the clip start, Burn away consumes it at the clip end.",
    variations: [
      [
        "dissolve-in",
        "Dissolve in",
        {
          passes: [
            pass("dissolve", {
              strength: 1,
              size: 0.5,
              timing: "in",
              seconds: 1.2,
              color: "#ffb46b",
            }),
          ],
        },
      ],
      [
        "dissolve-burn",
        "Burn away",
        {
          passes: [
            pass("dissolve", {
              strength: 1,
              size: 0.6,
              timing: "out",
              seconds: 1.4,
              color: "#ff6a1f",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "gooey-morph",
    name: "Gooey morph",
    category: "Transitions",
    description:
      "Shapes and letters melt into liquid blobs and re-form, the metaball look of motion-graphics transitions. Use the pulse for a continuously breathing goo.",
    variations: [
      [
        "goo-in",
        "Goo in",
        {
          passes: [
            pass("goo", { strength: 1, size: 0.6, timing: "in", seconds: 0.9 }),
          ],
        },
      ],
      [
        "goo-out",
        "Goo out",
        {
          passes: [
            pass("goo", {
              strength: 1,
              size: 0.6,
              timing: "out",
              seconds: 0.9,
            }),
          ],
        },
      ],
      [
        "goo-pulse",
        "Breathing goo",
        {
          passes: [
            pass("goo", {
              strength: 0.6,
              size: 0.4,
              timing: "pulse",
              speed: 0.5,
            }),
          ],
        },
      ],
    ],
  },
];
export const styleEffects: Effect[] = styleCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    passes: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const styleEffectFamilies: EffectFamily[] = styleCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...styleEffects.find((e) => e.id === card.id)!,
          channels: [],
          passes: [],
          ...patch,
        }),
      ),
    })),
  }));
const styleCategories = new Map(styleCards.map((c) => [c.id, c.category]));

/** Title-pack text animations (kamikami-visual-v7): kinetic, minimal and graphic titles. */
const title = (patch: Record<string, unknown>) => ({
  text: TextEffectSchema.parse(patch),
});
const titleCards: StyleCard[] = [
  {
    id: "title-mask-reveal",
    name: "Mask reveal",
    category: "Typography",
    description:
      "Keynote-style kinetic type: words rise or slide out from behind an invisible baseline mask, one after another. The clip edge stays fixed while the letters travel. Text elements only.",
    variations: [
      [
        "mask-rise",
        "Rise",
        title({
          kind: "mask",
          unit: "word",
          direction: "up",
          seconds: 1,
          stagger: 0.35,
        }),
      ],
      [
        "mask-slide",
        "Slide",
        title({
          kind: "mask",
          unit: "word",
          direction: "left",
          seconds: 0.9,
          stagger: 0.3,
        }),
      ],
    ],
  },
  {
    id: "title-focus-in",
    name: "Focus in",
    category: "Typography",
    description:
      "Letters resolve from soft, oversized blur into crisp type, or slam into place from a huge scale like a stamp. Text elements only.",
    variations: [
      [
        "focus-soft",
        "Soft focus",
        title({ kind: "focus", variant: "soft", seconds: 1.4, stagger: 0.6 }),
      ],
      [
        "focus-slam",
        "Zoom slam",
        title({
          kind: "focus",
          variant: "slam",
          unit: "word",
          seconds: 0.8,
          stagger: 0.4,
        }),
      ],
    ],
  },
  {
    id: "title-stretch-in",
    name: "Stretch in",
    category: "Typography",
    description:
      "Each letter arrives smeared wide and snaps back to its natural width, the elastic 'hype' title look. Text elements only.",
    variations: [
      [
        "stretch-snap",
        "Stretch snap",
        title({ kind: "stretch", seconds: 0.9, stagger: 0.5 }),
      ],
    ],
  },
  {
    id: "title-swipe-in",
    name: "Swipe in",
    category: "Typography",
    description:
      "Words whip in from the side with motion blur and a skew that straightens on arrival. Text elements only.",
    variations: [
      [
        "swipe-whip",
        "Whip",
        title({
          kind: "swipe",
          unit: "word",
          direction: "left",
          seconds: 0.7,
          stagger: 0.3,
        }),
      ],
    ],
  },
  {
    id: "title-slot-roll",
    name: "Slot roll",
    category: "Typography",
    description:
      "Each character rolls through a reel of glyphs and clicks into place with a slight overshoot; digits roll through digits. Text elements only.",
    variations: [
      [
        "slot-reel",
        "Reel",
        title({ kind: "slot", seconds: 1.4, stagger: 0.5 }),
      ],
    ],
  },
  {
    id: "title-bouncy",
    name: "Bouncy letters",
    category: "Typography",
    description:
      "Playful letters that drop and bounce with squash on impact, or pop up with an elastic wobble. Text elements only.",
    variations: [
      [
        "bouncy-drop",
        "Bounce drop",
        title({
          kind: "bounce",
          variant: "bounce",
          seconds: 1.6,
          stagger: 0.5,
          distance: 0.4,
        }),
      ],
      [
        "bouncy-elastic",
        "Elastic pop",
        title({
          kind: "bounce",
          variant: "elastic",
          seconds: 1.2,
          stagger: 0.45,
        }),
      ],
    ],
  },
  {
    id: "title-turn-in",
    name: "Turn in",
    category: "Typography",
    description:
      "Letters turn into view around their vertical axis like cards, in perspective. Text elements only.",
    variations: [
      [
        "turn-cards",
        "Card turn",
        title({ kind: "turn", direction: "left", seconds: 1.1, stagger: 0.55 }),
      ],
    ],
  },
  {
    id: "title-highlight",
    name: "Highlight",
    category: "Typography",
    description:
      "A colored box sweeps across the title: a marker highlight behind the words, or a block that covers the line and wipes away to reveal it. Text elements only.",
    variations: [
      [
        "highlight-marker",
        "Marker swipe",
        title({
          kind: "highlight",
          variant: "marker",
          seconds: 0.9,
          stagger: 0.85,
          color: "#f2c94c",
        }),
      ],
      [
        "highlight-block",
        "Block wipe",
        title({
          kind: "highlight",
          variant: "block",
          seconds: 1.2,
          stagger: 0.85,
          color: "#f2765e",
        }),
      ],
    ],
  },
  {
    id: "title-underline",
    name: "Underline reveal",
    category: "Typography",
    description:
      "A minimal line draws under the title, then the letters rise out of it. Text elements only.",
    variations: [
      [
        "underline-rise",
        "Line and rise",
        title({
          kind: "underline",
          seconds: 1.6,
          stagger: 0.85,
          color: "#f2765e",
        }),
      ],
    ],
  },
  {
    id: "title-outline-fill",
    name: "Outline fill",
    category: "Typography",
    description:
      "Letters appear as hollow outlines in the text color and fill in one after another. Text elements only.",
    variations: [
      [
        "outline-to-fill",
        "Outline to fill",
        title({ kind: "outline", seconds: 1.4, stagger: 0.6 }),
      ],
    ],
  },
  {
    id: "title-echo-stack",
    name: "Echo stack",
    category: "Typography",
    description:
      "Outlined copies of the title stacked above and below collapse into the solid line, a repeat-style hype title. Text elements only.",
    variations: [
      [
        "echo-collapse",
        "Collapse",
        title({ kind: "echo", unit: "title", seconds: 1, color: "#f2765e" }),
      ],
    ],
  },
  {
    id: "title-split-slice",
    name: "Split slice",
    category: "Typography",
    description:
      "The title is sliced through the middle; the halves slide in from opposite sides and lock together. Text elements only.",
    variations: [
      [
        "split-lock",
        "Lock together",
        title({ kind: "split", unit: "title", seconds: 0.9, distance: 0.5 }),
      ],
    ],
  },
  {
    id: "title-stroke-draw",
    name: "Stroke draw",
    category: "Typography",
    description:
      "Letter outlines draw on like a pen stroke, then the fill fades in, for a handwritten signature feel. Text elements only.",
    variations: [
      [
        "draw-pen",
        "Pen draw",
        title({ kind: "draw", seconds: 2.4, stagger: 0.7, color: "#fff7e9" }),
      ],
    ],
  },
  {
    id: "title-flicker-on",
    name: "Flicker on",
    category: "Typography",
    description:
      "Letters buzz on in random order like neon tubes warming up, then stay lit. Combine with Neon text for a sign. Text elements only.",
    variations: [
      [
        "flicker-tubes",
        "Neon tubes",
        title({
          kind: "flicker",
          seconds: 1.6,
          stagger: 0.4,
          motion: { order: "random" },
        }),
      ],
    ],
  },
  {
    id: "title-number-count",
    name: "Number count",
    category: "Typography",
    description:
      "Every number in the title counts up from zero to its value, keeping decimals and thousands separators, for stats and infographics. Text elements only.",
    variations: [
      ["count-up", "Count up", title({ kind: "count", seconds: 2 })],
      ["count-odometer", "Odometer", title({ kind: "odometer", seconds: 2.2 })],
    ],
  },
  {
    id: "title-circle",
    name: "Circle text",
    category: "Typography",
    description:
      "Lays a single line of text around a rotating circle, like a badge or stamp. Letter spacing sets the circle size. Text elements only.",
    variations: [
      [
        "circle-badge",
        "Spinning badge",
        title({ kind: "circle", distance: 0.3, speed: 1 }),
      ],
    ],
  },
  {
    id: "title-blur-rise",
    name: "Blur rise",
    category: "Typography",
    description:
      "Words or letters float up out of a blur, overshoot the baseline slightly and settle, the most common modern title entrance. Text elements only.",
    variations: [
      [
        "blur-rise-words",
        "Words",
        title({
          kind: "blurrise",
          unit: "word",
          seconds: 1.2,
          stagger: 0.45,
          distance: 0.5,
        }),
      ],
      [
        "blur-rise-letters",
        "Letters",
        title({ kind: "blurrise", seconds: 1.3, stagger: 0.6, distance: 0.4 }),
      ],
    ],
  },
  {
    id: "title-karaoke",
    name: "Karaoke",
    category: "Typography",
    description:
      "The line sits ghosted while words light up and take the highlight color one after another, for lyrics and read-along captions. Duration is the reading time. Text elements only.",
    variations: [
      [
        "karaoke-read",
        "Read along",
        title({
          kind: "karaoke",
          unit: "word",
          seconds: 4,
          stagger: 0.9,
          color: "#f2c94c",
        }),
      ],
    ],
  },
  {
    id: "title-shimmer",
    name: "Shimmer",
    category: "Typography",
    description:
      "A bright band sweeps across muted lettering on a loop, the 'loading / premium' shine used in product titles. Text elements only.",
    variations: [
      [
        "shimmer-silver",
        "Silver",
        title({
          kind: "shimmer",
          speed: 1,
          distance: 0.4,
          color: "#ffffff",
          secondary: "#7d8590",
        }),
      ],
    ],
  },
  {
    id: "title-prism",
    name: "Prism reveal",
    category: "Typography",
    description:
      "A rainbow front sweeps through the title: letters appear in spectral colors at the front and settle to the text color behind it. Text elements only.",
    variations: [
      [
        "prism-sweep",
        "Spectrum sweep",
        title({ kind: "prism", seconds: 1.6, stagger: 0.55 }),
      ],
    ],
  },
  {
    id: "title-bubbles",
    name: "Letter bubbles",
    category: "Typography",
    description:
      "Each letter pops in on its own glossy circle, playful and bold. Text elements only.",
    variations: [
      [
        "bubbles-pop",
        "Pop",
        title({
          kind: "bubbles",
          seconds: 1.2,
          stagger: 0.6,
          color: "#ff8a6b",
          secondary: "#c2362b",
        }),
      ],
    ],
  },
  {
    id: "title-split-flap",
    name: "Split-flap board",
    category: "Typography",
    description:
      "Letters sit on dark tiles and flip through random characters before landing, like an airport departure board. Text elements only.",
    variations: [
      [
        "flap-departures",
        "Departures",
        title({ kind: "flap", seconds: 2, stagger: 0.5, secondary: "#1b1d22" }),
      ],
    ],
  },
  {
    id: "title-cube-roll",
    name: "Cube roll",
    category: "Typography",
    description:
      "Each letter rolls like a cube from a colored face onto its final face. Text elements only.",
    variations: [
      [
        "roll-cube",
        "Roll up",
        title({ kind: "roll", seconds: 1.2, stagger: 0.55, color: "#f2765e" }),
      ],
    ],
  },
  {
    id: "title-retype",
    name: "Retype",
    category: "Typography",
    description:
      "Write two lines: the first is overwritten letter by letter into the second, ideal for before/after and correction gags. Text elements only.",
    variations: [
      [
        "retype-overwrite",
        "Overwrite",
        title({ kind: "retype", seconds: 1.5 }),
      ],
    ],
  },
  {
    id: "title-word-rotator",
    name: "Word rotator",
    category: "Typography",
    description:
      "Cycles through the lines of the text: the current word lifts away while the next rises into place letter by letter. Write one word or phrase per line. Text elements only.",
    variations: [
      [
        "rotator-rise",
        "Rise",
        title({ kind: "rotate", seconds: 0.6, stagger: 0.4 }),
      ],
    ],
  },
  {
    id: "title-type-delete",
    name: "Type and delete",
    category: "Typography",
    description:
      "Types each line, holds it, backspaces and types the next, with a blinking caret; the last line stays. Write one phrase per line. Text elements only.",
    variations: [
      ["typeloop-caret", "Caret", title({ kind: "typeloop", speed: 1 })],
    ],
  },
  {
    id: "title-gooey-morph",
    name: "Gooey word morph",
    category: "Typography",
    description:
      "Each line melts into the next through a liquid blur, then re-forms crisp. Write one word per line. Text elements only.",
    variations: [
      ["morph-liquid", "Liquid", title({ kind: "morph", seconds: 0.9 })],
    ],
  },
];
export const titleEffects: Effect[] = titleCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const titleEffectFamilies: EffectFamily[] = titleCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...titleEffects.find((e) => e.id === card.id)!,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of titleCards) styleCategories.set(card.id, card.category);

/** Shaped reveals, 3D card moves, lens and film looks inspired by open transition/filter catalogs. */
const reveal = (kind: VisualPass["kind"], patch: Partial<VisualPass> = {}) =>
  pass(kind, {
    strength: 1,
    size: 0.05,
    speed: 0,
    timing: "in",
    seconds: 1,
    ...patch,
  });
const packCards: StyleCard[] = [
  {
    id: "shape-iris",
    name: "Shape iris",
    category: "Transitions",
    description:
      "Reveal through a growing star, heart, flower, diamond or rectangle with a colored rim. Use At clip end timing to close the shape instead.",
    variations: [
      [
        "iris-star",
        "Star",
        { passes: [reveal("shape", { shapeMode: "star", color: "#ffd36b" })] },
      ],
      [
        "iris-heart",
        "Heart",
        { passes: [reveal("shape", { shapeMode: "heart", color: "#ff6b8b" })] },
      ],
      [
        "iris-flower",
        "Flower",
        {
          passes: [reveal("shape", { shapeMode: "flower", color: "#f2a65e" })],
        },
      ],
      [
        "iris-diamond",
        "Diamond",
        {
          passes: [reveal("shape", { shapeMode: "diamond", color: "#7fd4ff" })],
        },
      ],
      [
        "iris-rect",
        "Rectangle",
        {
          passes: [
            reveal("shape", { shapeMode: "rect", color: "#ffffff", size: 0 }),
          ],
        },
      ],
    ],
  },
  {
    id: "barn-doors",
    name: "Barn doors",
    category: "Transitions",
    description:
      "Opens from a central slit, horizontally or vertically, or through bow-tie wedges from both sides.",
    variations: [
      [
        "doors-horizontal",
        "Horizontal",
        { passes: [reveal("doors", { doorMode: "horizontal", seconds: 0.8 })] },
      ],
      [
        "doors-vertical",
        "Vertical",
        { passes: [reveal("doors", { doorMode: "vertical", seconds: 0.8 })] },
      ],
      [
        "doors-bowtie",
        "Bow-tie",
        { passes: [reveal("doors", { doorMode: "bowtie", seconds: 0.9 })] },
      ],
    ],
  },
  {
    id: "clock-wipe",
    name: "Clock wipe",
    category: "Transitions",
    description:
      "A clock hand sweeps the element into view, or a rotating pinwheel of blades opens it.",
    variations: [
      [
        "clock-hand",
        "Clock hand",
        { passes: [reveal("clock", { clockMode: "clock", size: 0.02 })] },
      ],
      [
        "clock-pinwheel",
        "Pinwheel",
        {
          passes: [
            reveal("clock", {
              clockMode: "pinwheel",
              count: 8,
              speed: 1,
              seconds: 1.2,
              size: 0.02,
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "feathered-wipe",
    name: "Feathered wipe",
    category: "Transitions",
    description:
      "A soft-edged wipe in any direction, from a gentle gradient to a crisp diagonal.",
    variations: [
      [
        "feather-soft",
        "Soft left to right",
        { passes: [reveal("feather", { angle: 0, size: 0.35 })] },
      ],
      [
        "feather-diagonal",
        "Diagonal",
        { passes: [reveal("feather", { angle: 45, size: 0.12 })] },
      ],
      [
        "feather-rise",
        "Rise",
        { passes: [reveal("feather", { angle: -90, size: 0.25 })] },
      ],
    ],
  },
  {
    id: "luma-wipe",
    name: "Luma wipe",
    category: "Transitions",
    description:
      "The picture appears or burns away in order of its own brightness, with a glowing edge. Best on photos and video.",
    variations: [
      [
        "luma-shadows",
        "Shadows first",
        {
          passes: [
            reveal("lumawipe", {
              lumaOrder: "dark",
              seconds: 1.4,
              size: 0.4,
              color: "#ffb46b",
            }),
          ],
        },
      ],
      [
        "luma-highlights",
        "Highlights first",
        {
          passes: [
            reveal("lumawipe", {
              lumaOrder: "bright",
              seconds: 1.4,
              size: 0.4,
              color: "#9fd8ff",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "floor-reflection",
    name: "Reflection",
    category: "3D & material",
    description:
      "Mirrors the element onto a glossy floor below it, with gentle ripples and a fade. Ideal for titles and product shots with transparency.",
    variations: [
      [
        "reflection-floor",
        "Glossy floor",
        {
          passes: [
            pass("reflection", { strength: 0.9, size: 0.3, speed: 0.6 }),
          ],
        },
      ],
    ],
  },
  {
    id: "tilt-shift",
    name: "Tilt-shift",
    category: "Camera & motion",
    description:
      "Miniature-model look: a sharp band with progressively blurred foreground and background, plus a saturation lift.",
    variations: [
      [
        "tilt-miniature",
        "Miniature",
        {
          passes: [
            pass("tiltshift", { strength: 1, size: 0.15, angle: 0, speed: 0 }),
          ],
        },
      ],
    ],
  },
  {
    id: "old-film",
    name: "Old film",
    category: "Texture & signal",
    description:
      "Silent-era projection: sepia tone, exposure flicker, vertical scratches and dust that change twelve times a second.",
    variations: [
      [
        "oldfilm-silent",
        "Silent era",
        {
          passes: [
            pass("oldfilm", { strength: 0.9, speed: 1 }),
            pass("grain", { strength: 0.25, size: 0.4, speed: 1 }),
            pass("vignette", { strength: 0.6, color: "#140c06" }),
          ],
        },
      ],
    ],
  },
  {
    id: "card-3d",
    name: "3D card moves",
    category: "Camera & motion",
    description:
      "The element moves like a physical card: turns in like a cube face, turns away like a page, rolls in from a corner, swings on a hinge, or swaps back into depth. Best on full-frame clips.",
    variations: [
      [
        "card-cube-turn",
        "Cube turn in",
        {
          channels: [
            spring("rotateY", 88, 0, "ease-out", 0.9),
            spring("scale", 0.92, 1, "ease-out", 0.9),
          ],
          origin: { x: -1, y: 0 },
        },
      ],
      [
        "card-page-turn",
        "Page turn out",
        {
          channels: [
            spring("rotateY", 0, 90, "ease", 1, 1, 0, "end"),
            spring("brightness", 1, 0.55, "ease", 1, 1, 0, "end"),
          ],
          origin: { x: -1, y: 0 },
        },
      ],
      [
        "card-corner-roll",
        "Corner roll in",
        {
          channels: [spring("rotation", -90, 0, "back", 0.9, 1, 0.3)],
          origin: { x: -1, y: 1 },
        },
      ],
      [
        "card-hinge",
        "Hinge swing in",
        {
          channels: [spring("rotateX", 75, 0, "damped", 2.2, 1.3)],
          origin: { x: 0, y: -1 },
        },
      ],
      [
        "card-swap-back",
        "Swap back out",
        {
          channels: [
            spring("scale", 1, 0.6, "ease", 0.8, 1, 0, "end"),
            spring("rotateY", 0, 30, "ease", 0.8, 1, 0, "end"),
            spring("opacity", 1, 0, "ease", 0.8, 1, 0, "end"),
          ],
        },
      ],
    ],
  },
  {
    id: "ripple",
    name: "Ripple",
    category: "Texture & signal",
    description:
      "Concentric water ripples, a single expanding shockwave ring, or a water drop whose waves spread and settle.",
    variations: [
      [
        "ripple-waves",
        "Ripples",
        {
          passes: [
            pass("ripple", {
              strength: 0.5,
              size: 0.3,
              speed: 1,
              rippleMode: "ripple",
            }),
          ],
        },
      ],
      [
        "ripple-shockwave",
        "Shockwave",
        {
          passes: [
            pass("ripple", {
              strength: 0.8,
              size: 0.25,
              speed: 1,
              rippleMode: "shockwave",
            }),
          ],
        },
      ],
      [
        "ripple-drop",
        "Water drop",
        {
          passes: [
            pass("ripple", {
              strength: 0.7,
              size: 0.3,
              speed: 1,
              rippleMode: "drop",
            }),
          ],
        },
      ],
    ],
  },
  {
    id: "cell-reveal",
    name: "Cell reveal",
    category: "Transitions",
    description:
      "The element appears through a grid: squares grow along a diagonal wavefront, tiles pop in at random, a checkerboard fills in two beats, or polka dots open from the center.",
    variations: [
      [
        "cells-squares",
        "Growing squares",
        {
          passes: [
            reveal("cells", { cellMode: "squares", size: 0.35, seconds: 1.2 }),
          ],
        },
      ],
      [
        "cells-random",
        "Random tiles",
        {
          passes: [
            reveal("cells", { cellMode: "random", size: 0.5, seconds: 1.2 }),
          ],
        },
      ],
      [
        "cells-checker",
        "Checkerboard",
        {
          passes: [
            reveal("cells", { cellMode: "checker", size: 0.25, seconds: 1 }),
          ],
        },
      ],
      [
        "cells-dots",
        "Polka dots",
        {
          passes: [
            reveal("cells", { cellMode: "dots", size: 0.4, seconds: 1.3 }),
          ],
        },
      ],
    ],
  },
];
export const packEffects: Effect[] = packCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    passes: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const packEffectFamilies: EffectFamily[] = packCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...packEffects.find((e) => e.id === card.id)!,
          channels: [],
          passes: [],
          origin: undefined,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of packCards) styleCategories.set(card.id, card.category);

/** Kinetic type (kamikami-visual-v8): rigid-word and letter motion inspired by lyric videos. */
const kin = (kind: string, patch: Record<string, unknown> = {}) =>
  title({ kind, ...patch });
const out = { motion: { order: "forward", direction: "out" } };
const kineticCards: StyleCard[] = [
  {
    id: "kinetic-spring",
    name: "Spring in",
    category: "Kinetic type",
    description:
      "Letters or words spring in from below and land exactly at rest, stretching along their speed like a rubber toy. Text elements only.",
    variations: [
      [
        "spring-letters",
        "Letters",
        kin("spring", { seconds: 1.1, stagger: 0.45 }),
      ],
      [
        "spring-words",
        "Words",
        kin("spring", {
          unit: "word",
          seconds: 1.2,
          stagger: 0.4,
          distance: 0.9,
        }),
      ],
      [
        "spring-side",
        "Sideways",
        kin("spring", { direction: "left", seconds: 1.1, stagger: 0.4 }),
      ],
    ],
  },
  {
    id: "kinetic-hop",
    name: "Hop in",
    category: "Kinetic type",
    description:
      "Each letter jumps up from below the line, lands with a squash and settles with two small hops. Text elements only.",
    variations: [
      ["hop-letters", "Letters", kin("hop", { seconds: 1.3, stagger: 0.5 })],
      [
        "hop-words",
        "Words",
        kin("hop", { unit: "word", seconds: 1.4, stagger: 0.4 }),
      ],
    ],
  },
  {
    id: "kinetic-roll",
    name: "Roll in",
    category: "Kinetic type",
    description:
      "Letters roll in like wheels, turning exactly as far as they travel, and settle upright. Text elements only.",
    variations: [
      [
        "roll-left",
        "From the left",
        kin("wheel", { direction: "left", seconds: 1.2, stagger: 0.45 }),
      ],
      [
        "roll-right",
        "From the right",
        kin("wheel", {
          direction: "right",
          seconds: 1.2,
          stagger: 0.45,
          motion: { order: "reverse", direction: "in" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-hinge",
    name: "Hinge drop",
    category: "Kinetic type",
    description:
      "Each word swings down from one corner like a sign on a hinge and bounces to rest. Text elements only.",
    variations: [
      [
        "hinge-left",
        "Left hinge",
        kin("hinge", {
          unit: "word",
          direction: "left",
          seconds: 1.2,
          stagger: 0.4,
        }),
      ],
      [
        "hinge-right",
        "Right hinge",
        kin("hinge", {
          unit: "word",
          direction: "right",
          seconds: 1.2,
          stagger: 0.4,
        }),
      ],
    ],
  },
  {
    id: "kinetic-spin",
    name: "Word spin",
    category: "Kinetic type",
    description:
      "Every word spins in as one piece from a tiny size, alternating direction, with an overshoot. Text elements only.",
    variations: [
      [
        "word-spin",
        "Spin",
        kin("spin", { unit: "word", seconds: 1, stagger: 0.45 }),
      ],
    ],
  },
  {
    id: "kinetic-slam",
    name: "Word slam",
    category: "Kinetic type",
    description:
      "Words drop onto the page from huge and tilted, one after another, with an accelerating hit. Text elements only.",
    variations: [
      [
        "slam-words",
        "Words",
        kin("slam", { unit: "word", seconds: 1, stagger: 0.55 }),
      ],
      [
        "slam-title",
        "Whole title",
        kin("slam", { unit: "title", seconds: 0.45, stagger: 0 }),
      ],
    ],
  },
  {
    id: "kinetic-fan",
    name: "Fan open",
    category: "Kinetic type",
    description:
      "The letters start stacked on one rib and fan open around a pivot below the line, like a folding fan. Text elements only.",
    variations: [
      ["fan-open", "Fan", kin("fan", { seconds: 1.2, stagger: 0.15 })],
    ],
  },
  {
    id: "kinetic-drum",
    name: "Drum unroll",
    category: "Kinetic type",
    description:
      "Letters ride a spinning drum, wrapping around its back, then unroll flat into the line. Text elements only.",
    variations: [
      ["drum-unroll", "Drum", kin("drum", { seconds: 1.4, stagger: 0 })],
    ],
  },
  {
    id: "kinetic-shuffle",
    name: "Shuffle",
    category: "Kinetic type",
    description:
      "Letters start scrambled and trade places along arcs, shell-game style, until the word reads. Text elements only.",
    variations: [
      [
        "shuffle",
        "Shuffle",
        kin("shuffle", {
          seconds: 1.3,
          stagger: 0.3,
          motion: { order: "random", direction: "in" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-cardflip",
    name: "Card flip",
    category: "Kinetic type",
    description:
      "Colored tiles pop up and flip over one by one to reveal the letters on their backs. Text elements only.",
    variations: [
      [
        "cardflip-coral",
        "Coral tiles",
        kin("cardflip", {
          seconds: 1.3,
          stagger: 0.55,
          color: "#f2765e",
          secondary: "#1a1410",
        }),
      ],
      [
        "cardflip-ink",
        "Ink tiles",
        kin("cardflip", {
          seconds: 1.3,
          stagger: 0.55,
          color: "#141414",
          secondary: "#000000",
        }),
      ],
    ],
  },
  {
    id: "kinetic-ripple",
    name: "Ripple in",
    category: "Kinetic type",
    description:
      "A wave spreads out from the middle of the title; letters swell and push outward as it passes. Text elements only.",
    variations: [
      [
        "ripple-in",
        "Ripple",
        kin("ripple", {
          seconds: 1.4,
          stagger: 0,
          motion: { order: "center", direction: "in" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-lens",
    name: "Magnifier sweep",
    category: "Kinetic type",
    description:
      "A magnifier passes along the line; letters swell under it and light up once it has passed. Text elements only.",
    variations: [
      ["lens-sweep", "Sweep", kin("lens", { seconds: 1.6, stagger: 0 })],
    ],
  },
  {
    id: "kinetic-glint",
    name: "Glint reveal",
    category: "Kinetic type",
    description:
      "A slanted light band sweeps across, uncovering the text; a faint ghost of the title waits ahead of it. Text elements only.",
    variations: [
      [
        "glint-white",
        "White glint",
        kin("glint", { seconds: 1.3, stagger: 0, color: "#ffffff" }),
      ],
      [
        "glint-gold",
        "Gold glint",
        kin("glint", { seconds: 1.3, stagger: 0, color: "#ffd36b" }),
      ],
    ],
  },
  {
    id: "kinetic-brush",
    name: "Brush reveal",
    category: "Kinetic type",
    description:
      "A dry brush paints each line in turn; bristle strips lag behind the stroke for a ragged edge. Text elements only.",
    variations: [
      ["brush-reveal", "Brush", kin("brush", { seconds: 1.4, stagger: 0 })],
    ],
  },
  {
    id: "kinetic-ink",
    name: "Ink drop",
    category: "Kinetic type",
    description:
      "An ink drop lands on each letter and spreads into a wobbly blot that reveals it. Text elements only.",
    variations: [
      [
        "ink-drop",
        "Ink",
        kin("ink", {
          seconds: 1.5,
          stagger: 0.6,
          motion: { order: "random", direction: "in" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-decode",
    name: "Decode",
    category: "Kinetic type",
    description:
      "A cursor block decodes the text; noisy signs run ahead of it and each letter flashes as it resolves. Text elements only.",
    variations: [
      ["decode", "Decode", kin("decode", { seconds: 1.6, stagger: 0 })],
    ],
  },
  {
    id: "kinetic-rain",
    name: "Matrix rain",
    category: "Kinetic type",
    description:
      "Letters fall as glowing signs trailing copies of themselves, lower lines first, then cool into the real text. Text elements only.",
    variations: [
      [
        "rain-green",
        "Green",
        kin("rain", { seconds: 1.8, stagger: 0.55, color: "#7dff9a" }),
      ],
      [
        "rain-amber",
        "Amber",
        kin("rain", { seconds: 1.8, stagger: 0.55, color: "#ffb347" }),
      ],
    ],
  },
  {
    id: "kinetic-push",
    name: "Push in",
    category: "Kinetic type",
    description:
      "Each word slides in at the end of its line and shoves the words before it back into place. Text elements only.",
    variations: [
      [
        "push-in",
        "Push",
        kin("push", { unit: "word", seconds: 1.4, stagger: 0 }),
      ],
    ],
  },
  {
    id: "kinetic-flash",
    name: "Word flash",
    category: "Kinetic type",
    description:
      "Words flash big in the center one at a time, then the whole line flies into place, a lyric-video staple. Text elements only.",
    variations: [
      [
        "word-flash",
        "Flash",
        kin("flash", { unit: "word", seconds: 2, stagger: 0 }),
      ],
    ],
  },
  {
    id: "kinetic-inertia",
    name: "Inertia slide",
    category: "Kinetic type",
    description:
      "The line slides in and stops front first; trailing letters bunch up and stretch with their speed. Text elements only.",
    variations: [
      [
        "inertia-left",
        "From the left",
        kin("inertia", {
          direction: "left",
          seconds: 1.1,
          stagger: 0.32,
          motion: { order: "reverse", direction: "in" },
        }),
      ],
      [
        "inertia-right",
        "From the right",
        kin("inertia", { direction: "right", seconds: 1.1, stagger: 0.32 }),
      ],
    ],
  },
  {
    id: "kinetic-kick",
    name: "Word kick",
    category: "Kinetic type",
    description:
      "Exit: words get kicked up and down alternately, tumbling out of frame. Plays over the end of the clip. Text elements only.",
    variations: [
      [
        "word-kick",
        "Kick",
        kin("kick", { unit: "word", seconds: 0.9, stagger: 0.35, ...out }),
      ],
    ],
  },
  {
    id: "kinetic-launch",
    name: "Launch",
    category: "Kinetic type",
    description:
      "Exit: a small wind-up, then the line accelerates away with the leading letter first, stretched by speed. Text elements only.",
    variations: [
      [
        "launch-right",
        "To the right",
        kin("launch", {
          direction: "right",
          seconds: 0.9,
          stagger: 0.32,
          motion: { order: "reverse", direction: "out" },
        }),
      ],
      [
        "launch-left",
        "To the left",
        kin("launch", {
          direction: "left",
          seconds: 0.9,
          stagger: 0.32,
          ...out,
        }),
      ],
    ],
  },
  {
    id: "kinetic-flutter",
    name: "Flutter away",
    category: "Kinetic type",
    description:
      "Exit: letters come loose like leaves or paper, swaying, flipping over and falling faster. Text elements only.",
    variations: [
      [
        "flutter-away",
        "Flutter",
        kin("flutter", {
          seconds: 1.6,
          stagger: 0.5,
          secondary: "#c9b48a",
          motion: { order: "random", direction: "out" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-domino",
    name: "Domino topple",
    category: "Kinetic type",
    description:
      "Exit: letters topple over their bottom corners one after another like dominoes. Text elements only.",
    variations: [
      [
        "domino-topple",
        "Topple",
        kin("domino", {
          direction: "right",
          seconds: 1.2,
          stagger: 0.55,
          ...out,
        }),
      ],
    ],
  },
  {
    id: "kinetic-closegap",
    name: "Close the gap",
    category: "Kinetic type",
    description:
      "Exit: words disappear from both ends towards the middle while the rest slide together. Text elements only.",
    variations: [
      [
        "close-gap",
        "Close",
        kin("closegap", { unit: "word", seconds: 1.2, stagger: 0, ...out }),
      ],
    ],
  },
  {
    id: "kinetic-burn",
    name: "Burn away",
    category: "Kinetic type",
    description:
      "Exit: letters heat up, char and burn away from the bottom, throwing off embers. Text elements only.",
    variations: [
      [
        "burn-away",
        "Burn",
        kin("burn", {
          seconds: 1.4,
          stagger: 0.5,
          color: "#ff8a3d",
          secondary: "#2a1a12",
          motion: { order: "random", direction: "out" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-tornado",
    name: "Tornado",
    category: "Kinetic type",
    description:
      "Exit: the letters are pulled into a spinning column that lifts off, shrinking as they pass behind it. Text elements only.",
    variations: [
      [
        "tornado",
        "Tornado",
        kin("tornado", { seconds: 1.4, stagger: 0.2, ...out }),
      ],
    ],
  },
  {
    id: "kinetic-pluck",
    name: "Plucked string",
    category: "Kinetic type",
    description:
      "Hold: the line vibrates like a plucked string, re-plucked every four beats. Waits for entrances, stops before exits. Text elements only.",
    variations: [["pluck", "Pluck", kin("pluck", { tempo: 120 })]],
  },
  {
    id: "kinetic-beathop",
    name: "Beat hop",
    category: "Kinetic type",
    description:
      "Hold: one letter or word hops on every beat, nudging its neighbors. Set the tempo to your song. Text elements only.",
    variations: [
      ["beathop-letters", "Letters", kin("beathop", { tempo: 120 })],
      [
        "beathop-words",
        "Words",
        kin("beathop", { unit: "word", tempo: 120, distance: 0.8 }),
      ],
    ],
  },
  {
    id: "kinetic-colorrun",
    name: "Color run",
    category: "Kinetic type",
    description:
      "Hold: a soft accent highlight runs along the text over and over. Text elements only.",
    variations: [
      ["color-run", "Run", kin("colorrun", { speed: 1, color: "#ffd36b" })],
    ],
  },
  {
    id: "kinetic-dangle",
    name: "Dangle",
    category: "Kinetic type",
    description:
      "Hold: every letter hangs from its top edge and swings gently at its own pace. Text elements only.",
    variations: [["dangle", "Dangle", kin("dangle", { tempo: 100 })]],
  },
  {
    id: "kinetic-rock",
    name: "Counter rock",
    category: "Kinetic type",
    description:
      "Hold: neighboring words rock in opposite directions on the beat. Text elements only.",
    variations: [
      ["counter-rock", "Rock", kin("rock", { unit: "word", tempo: 100 })],
    ],
  },
  {
    id: "kinetic-ride",
    name: "Word ride",
    category: "Kinetic type",
    description:
      "Hold: a wave travels through the line; each word bobs and tilts as it rides it. Text elements only.",
    variations: [
      ["word-ride", "Ride", kin("ride", { unit: "word", tempo: 100 })],
    ],
  },
  {
    id: "kinetic-breathe",
    name: "Gap breath",
    category: "Kinetic type",
    description:
      "Hold: the spaces between words slowly widen and narrow while the words themselves stay still. Text elements only.",
    variations: [
      ["gap-breath", "Breathe", kin("breathe", { unit: "word", tempo: 90 })],
    ],
  },
  {
    id: "kinetic-pulse",
    name: "Word pulse",
    category: "Kinetic type",
    description:
      "Hold: one word swells on each beat, cycling through the line. Text elements only.",
    variations: [
      ["word-pulse", "Pulse", kin("pulse", { unit: "word", tempo: 120 })],
    ],
  },
  {
    id: "kinetic-lean",
    name: "Beat lean",
    category: "Kinetic type",
    description:
      "Hold: words lean into each beat and spring back, alternating sides. Text elements only.",
    variations: [
      ["beat-lean", "Lean", kin("lean", { unit: "word", tempo: 120 })],
    ],
  },
  {
    id: "kinetic-gather",
    name: "Gather",
    category: "Kinetic type",
    description:
      "Entrance: each letter arrives as spinning shards that fly in from a scatter and lock together. Text elements only.",
    variations: [
      [
        "gather-letters",
        "Letters",
        kin("gather", { seconds: 1.2, stagger: 0.5 }),
      ],
      [
        "gather-wide",
        "Wide scatter",
        kin("gather", {
          seconds: 1.5,
          stagger: 0.4,
          distance: 1.4,
          motion: { order: "random", direction: "in" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-plates",
    name: "Plate snap",
    category: "Kinetic type",
    description:
      "Entrance: cyan, magenta and yellow copies slide from misregistration into one sharp print. Text elements only.",
    variations: [
      [
        "plates-words",
        "Words",
        kin("plates", { unit: "word", seconds: 0.9, stagger: 0.35 }),
      ],
      [
        "plates-title",
        "Whole title",
        kin("plates", { unit: "title", seconds: 0.8, distance: 1 }),
      ],
    ],
  },
  {
    id: "kinetic-inkstroke",
    name: "Ink stroke",
    category: "Kinetic type",
    description:
      "Entrance: a wet bristle stroke paints along each line and the type shows once it passes. Text elements only.",
    variations: [
      [
        "inkstroke-coral",
        "Coral",
        kin("inkstroke", { unit: "word", seconds: 1.6, stagger: 0 }),
      ],
      [
        "inkstroke-ink",
        "Ink",
        kin("inkstroke", {
          unit: "word",
          seconds: 1.6,
          stagger: 0,
          color: "#141414",
        }),
      ],
    ],
  },
  {
    id: "kinetic-afterimage",
    name: "Afterimage",
    category: "Kinetic type",
    description:
      "Hold: the text drifts in a slow figure eight and leaves colored echoes of itself behind. Text elements only.",
    variations: [
      [
        "afterimage-neon",
        "Neon",
        kin("afterimage", {
          unit: "title",
          tempo: 120,
          color: "#ff2e88",
          secondary: "#16f4d4",
        }),
      ],
      [
        "afterimage-warm",
        "Warm",
        kin("afterimage", {
          unit: "title",
          tempo: 120,
          color: "#ff8a3d",
          secondary: "#ffe14d",
          distance: 1,
        }),
      ],
    ],
  },
  {
    id: "kinetic-gust",
    name: "Gust",
    category: "Kinetic type",
    description:
      "Hold: every four beats a gust of wind sweeps along the line and the letters bend and spring back. Text elements only.",
    variations: [["gust-letters", "Letters", kin("gust", { tempo: 120 })]],
  },
  {
    id: "kinetic-lubdub",
    name: "Lub-dub",
    category: "Kinetic type",
    description:
      "Hold: the text beats like a heart — a strong pulse and a softer echo — flushing the accent color. Text elements only.",
    variations: [
      [
        "lubdub-red",
        "Red",
        kin("lubdub", { unit: "title", tempo: 120, color: "#ff3b4f" }),
      ],
      [
        "lubdub-words",
        "Words",
        kin("lubdub", { unit: "word", tempo: 120, color: "#ff3b4f" }),
      ],
    ],
  },
  {
    id: "kinetic-burst",
    name: "Burst",
    category: "Kinetic type",
    description:
      "Exit: each letter flashes and blasts apart into spinning shards that drop away. Text elements only.",
    variations: [
      [
        "burst-letters",
        "Letters",
        kin("blast", { seconds: 0.9, stagger: 0.3, color: "#fff4c2", ...out }),
      ],
      [
        "burst-center",
        "From the center",
        kin("blast", {
          seconds: 1,
          stagger: 0.4,
          distance: 1.2,
          color: "#fff4c2",
          motion: { order: "center", direction: "out" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-crumble",
    name: "Crumble",
    category: "Kinetic type",
    description:
      "Exit: letters shudder, crack into shards and fall away one piece at a time. Text elements only.",
    variations: [
      [
        "crumble-letters",
        "Letters",
        kin("crumble", {
          seconds: 1.6,
          stagger: 0.45,
          motion: { order: "random", direction: "out" },
        }),
      ],
    ],
  },
  {
    id: "kinetic-wipeoff",
    name: "Wipe off",
    category: "Kinetic type",
    description:
      "Exit: an accent bar sweeps across the text and wipes it away behind it. Text elements only.",
    variations: [
      [
        "wipeoff-title",
        "Whole title",
        kin("wipeoff", { unit: "title", seconds: 0.7, ...out }),
      ],
      [
        "wipeoff-words",
        "Word by word",
        kin("wipeoff", {
          unit: "word",
          seconds: 1,
          stagger: 0.5,
          color: "#ffe14d",
          ...out,
        }),
      ],
    ],
  },
  {
    id: "kinetic-aperture",
    name: "Aperture",
    category: "Kinetic type",
    description:
      "Exit: a circular iris closes on the text, its ring shrinking to a point. Text elements only.",
    variations: [
      [
        "aperture-title",
        "Whole title",
        kin("aperture", {
          unit: "title",
          seconds: 0.8,
          color: "#f6f2ea",
          ...out,
        }),
      ],
      [
        "aperture-words",
        "Word by word",
        kin("aperture", { unit: "word", seconds: 1, stagger: 0.5, ...out }),
      ],
    ],
  },
  {
    id: "kinetic-channels",
    name: "Channel split",
    category: "Kinetic type",
    description:
      "Exit: the type separates into red, green and blue light that splits apart and fades. Text elements only.",
    variations: [
      [
        "channels-words",
        "Words",
        kin("channels", { unit: "word", seconds: 0.8, stagger: 0.3, ...out }),
      ],
      [
        "channels-title",
        "Whole title",
        kin("channels", { unit: "title", seconds: 0.7, distance: 1, ...out }),
      ],
    ],
  },
  {
    id: "kinetic-melt",
    name: "Melt",
    category: "Kinetic type",
    description:
      "Exit: letters sag and drain downward from the top, trailing drips. Text elements only.",
    variations: [
      [
        "melt-letters",
        "Letters",
        kin("melt", {
          seconds: 1.5,
          stagger: 0.5,
          motion: { order: "random", direction: "out" },
        }),
      ],
    ],
  },
];
export const kineticEffects: Effect[] = kineticCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const kineticEffectFamilies: EffectFamily[] = kineticCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...kineticEffects.find((e) => e.id === card.id)!,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of kineticCards) styleCategories.set(card.id, card.category);

/** Text looks (kamikami-visual-v8): treatments and decorations for art-directed titles. */
const look = (kind: string, patch: Record<string, unknown> = {}) =>
  title({ kind, ...patch });
const lookCards: StyleCard[] = [
  {
    id: "look-outline",
    name: "Outline only",
    category: "Text treatments",
    description: "Hollow letters drawn as a clean stroke in the text color.",
    variations: [
      ["outline-fine", "Fine", look("outlined", { distance: 0.2 })],
      ["outline-bold", "Bold", look("outlined", { distance: 1.2 })],
    ],
  },
  {
    id: "look-keyline",
    name: "Keyline",
    category: "Text treatments",
    description:
      "A thick colored rim drawn behind the letters, the classic poster and sticker outline.",
    variations: [
      ["keyline-coral", "Coral", look("keyline", { color: "#f2765e" })],
      [
        "keyline-ink",
        "Ink",
        look("keyline", { color: "#141414", distance: 0.8 }),
      ],
    ],
  },
  {
    id: "look-double-outline",
    name: "Double outline",
    category: "Text treatments",
    description:
      "An inner gap stroke and an outer outline, like a road sign or a vintage label.",
    variations: [
      [
        "double-outline",
        "Double",
        look("doubleline", { color: "#f5c84c", secondary: "#141414" }),
      ],
    ],
  },
  {
    id: "look-extrude",
    name: "Extrude",
    category: "Text treatments",
    description:
      "Solid 3D letters stepped back along an angle in a darker side color.",
    variations: [
      [
        "extrude-down",
        "Down right",
        look("extrude", { color: "#8a2b1f", angle: 45 }),
      ],
      [
        "extrude-up",
        "Up left",
        look("extrude", { color: "#1d3b6b", angle: -135 }),
      ],
    ],
  },
  {
    id: "look-long-shadow",
    name: "Long shadow",
    category: "Text treatments",
    description:
      "A long flat shadow that fades into the background, the flat-design favorite.",
    variations: [
      [
        "long-shadow",
        "Long",
        look("longshadow", {
          color: "#000000",
          secondary: "#000000",
          angle: 45,
        }),
      ],
    ],
  },
  {
    id: "look-offset",
    name: "Offset shadow",
    category: "Text treatments",
    description:
      "One hard accent copy offset behind the letters, like misregistered screen print.",
    variations: [
      ["offset-coral", "Coral", look("offset", { color: "#f2765e" })],
      ["offset-cyan", "Cyan", look("offset", { color: "#39f2c8", angle: 135 })],
    ],
  },
  {
    id: "look-neon",
    name: "Neon tube",
    category: "Text treatments",
    description:
      "Glass tube letters with a colored glow and an occasional flicker.",
    variations: [
      ["neon-pink", "Pink", look("neontube", { color: "#ff4fd8", speed: 1 })],
      ["neon-cyan", "Cyan", look("neontube", { color: "#22e6ff", speed: 1 })],
    ],
  },
  {
    id: "look-chrome",
    name: "Chrome",
    category: "Text treatments",
    description:
      "Mirrored metal letters with a horizon line and a dark keyline, straight from an 80s logo.",
    variations: [
      ["chrome-steel", "Steel", look("chrome", { color: "#66a3bf" })],
      ["chrome-sunset", "Sunset", look("chrome", { color: "#ff7a30" })],
    ],
  },
  {
    id: "look-sticker",
    name: "Sticker",
    category: "Text treatments",
    description:
      "A thick paper border and a soft drop shadow, as if the word were a die-cut sticker.",
    variations: [
      [
        "sticker",
        "Sticker",
        look("sticker", { color: "#ffffff", secondary: "#000000" }),
      ],
    ],
  },
  {
    id: "look-shadow-stack",
    name: "Shadow stack",
    category: "Text treatments",
    description:
      "Three hard copies step down and right in alternating palette colors.",
    variations: [
      [
        "shadow-stack",
        "Stack",
        look("stack", { color: "#ff4a86", secondary: "#22e6ff" }),
      ],
    ],
  },
  {
    id: "look-halftone",
    name: "Halftone fill",
    category: "Text treatments",
    description: "Letters printed as a halftone dot screen in the text color.",
    variations: [["halftone", "Dots", look("halftone", { distance: 0.3 })]],
  },
  {
    id: "look-accent",
    name: "Accent word",
    category: "Text treatments",
    description:
      "The longest word takes the accent color, or each line's first letter grows and takes it.",
    variations: [
      [
        "accent-word",
        "Key word",
        look("accent", { unit: "word", color: "#f5c84c" }),
      ],
      [
        "accent-initial",
        "Initial letter",
        look("accent", { unit: "character", color: "#f2765e" }),
      ],
    ],
  },
  {
    id: "look-ghosts",
    name: "Color ghosts",
    category: "Text treatments",
    description:
      "Two flat-colored copies trail a frame or two behind the text, so any motion leaves a misregistered color echo.",
    variations: [
      [
        "ghosts-amber-cyan",
        "Amber and cyan",
        look("ghost", { color: "#f5a50c", secondary: "#16f4d4" }),
      ],
      [
        "ghosts-magenta-blue",
        "Magenta and blue",
        look("ghost", { color: "#ff3b8d", secondary: "#2b5bff" }),
      ],
    ],
  },
  {
    id: "look-reflection",
    name: "Reflection",
    category: "Text treatments",
    description:
      "A fading mirrored copy of the text below it, like a glossy floor.",
    variations: [
      ["reflection", "Reflection", look("reflection", { distance: 0.1 })],
    ],
  },
  {
    id: "look-cut-shift",
    name: "Cut and shift",
    category: "Text treatments",
    description:
      "Every line is sliced through; the lower half slides sideways along an accent cut line.",
    variations: [
      [
        "cut-shift",
        "Cut",
        look("cutshift", { color: "#f2765e", seconds: 0.8 }),
      ],
    ],
  },
  {
    id: "look-word-boxes",
    name: "Word boxes",
    category: "Text treatments",
    description: "Each word pops into its own outlined box, one after another.",
    variations: [
      [
        "word-boxes",
        "Boxes",
        look("wordbox", { color: "#f5c84c", seconds: 0.9, stagger: 0.6 }),
      ],
    ],
  },
  {
    id: "look-word-plates",
    name: "Word plates",
    category: "Text treatments",
    description:
      "Each word sits on a slightly tilted solid plate with knocked-out letters, like label tape.",
    variations: [
      [
        "plates-violet",
        "Violet tape",
        look("plate", {
          color: "#8a6fd6",
          secondary: "#141414",
          seconds: 0.9,
          stagger: 0.5,
        }),
      ],
      [
        "plates-ink",
        "Ink plates",
        look("plate", {
          color: "#141414",
          secondary: "#f1eee7",
          seconds: 0.9,
          stagger: 0.5,
        }),
      ],
    ],
  },
  {
    id: "look-rules",
    name: "Rules",
    category: "Text treatments",
    description:
      "A heavy rule above and a hairline below draw in from opposite sides, editorial style.",
    variations: [
      ["rules", "Rules", look("rules", { color: "#f5c84c", seconds: 0.9 })],
    ],
  },
  {
    id: "look-ticker",
    name: "Text ticker",
    category: "Text treatments",
    description:
      "Rows of the same words, repeated small, scroll behind the text in opposite directions.",
    variations: [
      ["text-ticker", "Ticker", look("ticker", { color: "#f1eee7", speed: 1 })],
    ],
  },
  {
    id: "look-tape",
    name: "Caution tape",
    category: "Text treatments",
    description:
      "A striped warning tape strip slaps in behind the text at an angle.",
    variations: [
      [
        "caution-tape",
        "Caution",
        look("tape", { color: "#f5c84c", secondary: "#141414", seconds: 0.6 }),
      ],
    ],
  },
  {
    id: "look-burst",
    name: "Ray burst",
    category: "Text treatments",
    description: "Comic-style speed rays turn slowly behind the text.",
    variations: [
      [
        "ray-burst",
        "Rays",
        look("burst", { color: "#f1eee7", speed: 1, seconds: 0.5 }),
      ],
    ],
  },
];
export const lookEffects: Effect[] = lookCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const lookEffectFamilies: EffectFamily[] = lookCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...lookEffects.find((e) => e.id === card.id)!,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of lookCards) styleCategories.set(card.id, card.category);

/** Kinetic typographic layouts (kamikami-visual-v8): whole-phrase word arrangements. */
const layout = (kind: string, patch: Record<string, unknown> = {}) =>
  title({ kind, unit: "word", ...patch });
const layoutCards: StyleCard[] = [
  {
    id: "layout-stack",
    name: "Justified slam stack",
    category: "Kinetic layouts",
    description:
      "Every word gets its own row, scaled so all rows share one width, and slams down into the stack one after another.",
    variations: [
      [
        "stack-forward",
        "In order",
        layout("slamstack", { seconds: 1.6, stagger: 0.7 }),
      ],
      [
        "stack-center",
        "From the middle",
        layout("slamstack", {
          seconds: 1.6,
          stagger: 0.7,
          motion: { order: "center" },
        }),
      ],
    ],
  },
  {
    id: "layout-keyword",
    name: "Key word split",
    category: "Kinetic layouts",
    description:
      "The longest word fills the frame; the words before and after it sit small above and below, flush with its left edge.",
    variations: [
      ["keyword-pop", "Pop", layout("keyword", { seconds: 1, stagger: 0.4 })],
    ],
  },
  {
    id: "layout-steps",
    name: "Size steps",
    category: "Kinetic layouts",
    description:
      "Words stack left-aligned, each a step smaller than the last, rising in one by one.",
    variations: [
      [
        "steps-falling",
        "Falling",
        layout("steps", { seconds: 1.4, distance: 0.6 }),
      ],
      [
        "steps-gentle",
        "Gentle",
        layout("steps", { seconds: 1.4, distance: 0.3 }),
      ],
    ],
  },
  {
    id: "layout-giant",
    name: "Cropped giant word",
    category: "Kinetic layouts",
    description:
      "The key word grows huge behind the line, cropped to the text block, while the rest of the line stays readable in front.",
    variations: [
      [
        "giant-coral",
        "Coral",
        layout("giant", { seconds: 0.9, secondary: "#f2765e" }),
      ],
      [
        "giant-shadow",
        "Shadow",
        layout("giant", { seconds: 0.9, secondary: "#3a3f4a" }),
      ],
    ],
  },
  {
    id: "layout-swap",
    name: "Word swap",
    category: "Kinetic layouts",
    description:
      "One word at a time pops alone in the center on each beat, then every word flies into the full line.",
    variations: [
      ["swap-120", "120 BPM", layout("swap", { tempo: 120, seconds: 0.5 })],
      ["swap-90", "90 BPM", layout("swap", { tempo: 90, seconds: 0.6 })],
    ],
  },
  {
    id: "layout-typeslam",
    name: "Type then slam",
    category: "Kinetic layouts",
    description:
      "Words appear small, as if typed, then the whole line slams up to full size.",
    variations: [
      [
        "typeslam-default",
        "Slam",
        layout("typeslam", { seconds: 1.2, distance: 0.6 }),
      ],
    ],
  },
  {
    id: "layout-flowsnap",
    name: "Flow then snap",
    category: "Kinetic layouts",
    description:
      "Words drift loose and tilted around the frame, then snap into the line one by one.",
    variations: [
      [
        "flowsnap-default",
        "Loose",
        layout("flowsnap", { seconds: 1.6, stagger: 0.5, distance: 0.6 }),
      ],
      [
        "flowsnap-wide",
        "Scattered",
        layout("flowsnap", { seconds: 1.8, stagger: 0.5, distance: 1.2 }),
      ],
    ],
  },
  {
    id: "layout-seesaw",
    name: "Seesaw",
    category: "Kinetic layouts",
    description:
      "The line tips from side to side on every beat, springing into each tilt, between the entrance and exit.",
    variations: [
      ["seesaw-gentle", "Gentle", layout("seesaw", { tempo: 120, angle: 7 })],
      ["seesaw-big", "Big tilt", layout("seesaw", { tempo: 120, angle: 14 })],
    ],
  },
  {
    id: "layout-arc",
    name: "Arc ride",
    category: "Kinetic layouts",
    description:
      "Words ride in along a curved path and settle on an arch, each turned to follow the curve.",
    variations: [
      ["arc-soft", "Soft arch", layout("arc", { seconds: 1.2, distance: 0.6 })],
      ["arc-deep", "Deep arch", layout("arc", { seconds: 1.2, distance: 1.2 })],
    ],
  },
  {
    id: "layout-band",
    name: "Band reveal",
    category: "Kinetic layouts",
    description:
      "A solid band sweeps across the line, leaving each word behind it as it passes.",
    variations: [
      [
        "band-coral",
        "Coral",
        layout("bandhide", { seconds: 1, color: "#f2765e" }),
      ],
      [
        "band-light",
        "Light",
        layout("bandhide", { seconds: 1, color: "#f1eee7" }),
      ],
    ],
  },
];
export const layoutEffects: Effect[] = layoutCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const layoutEffectFamilies: EffectFamily[] = layoutCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...layoutEffects.find((e) => e.id === card.id)!,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of layoutCards) styleCategories.set(card.id, card.category);

/** Artwork treatments (kamikami-visual-v8): camera, beat, copy and framing recipes for artwork. */
const artwork = (kind: ArtKind, patch: Partial<Art> = {}) => ({
  art: makeArt(kind, patch),
});
const artCards: StyleCard[] = [
  {
    id: "art-drift",
    name: "Handheld drift",
    category: "Artwork",
    description:
      "A slow, unsteady camera float. It overscans slightly so full-frame artwork never shows its edges.",
    variations: [
      ["drift-gentle", "Gentle", artwork("drift")],
      [
        "drift-nervous",
        "Nervous",
        artwork("drift", { distance: 0.022, speed: 1.8, strength: 0.7 }),
      ],
    ],
  },
  {
    id: "art-punch",
    name: "Beat punch",
    category: "Artwork",
    description:
      "A quick zoom hit on every beat at the tempo you set; beats count from the project start so layers hit together.",
    variations: [
      ["punch-beat", "Every beat", artwork("punch")],
      ["punch-hard", "Hard", artwork("punch", { strength: 1, seconds: 0.14 })],
      ["punch-half", "Half time", artwork("punch", { tempo: 60 })],
    ],
  },
  {
    id: "art-jolt",
    name: "Beat jolt",
    category: "Artwork",
    description:
      "The artwork is knocked a short way in a new direction on every beat and settles back.",
    variations: [
      ["jolt-snap", "Snap", artwork("jolt")],
      [
        "jolt-heavy",
        "Heavy",
        artwork("jolt", { distance: 0.04, strength: 0.9, seconds: 0.26 }),
      ],
    ],
  },
  {
    id: "art-stutter",
    name: "Stop-motion",
    category: "Artwork",
    description:
      "Holds the element's motion and effects for whole steps, like animation shot on twos or threes.",
    variations: [
      ["stutter-twelve", "12 steps/s", artwork("stutter", { count: 12 })],
      ["stutter-eight", "8 steps/s", artwork("stutter")],
      ["stutter-four", "Choppy", artwork("stutter", { count: 4 })],
    ],
  },
  {
    id: "art-strobe",
    name: "Beat strobe",
    category: "Artwork",
    description:
      "Flashes the artwork to its negative for a frame or two on the downbeat.",
    variations: [
      ["strobe-bar", "Every bar", artwork("strobe")],
      [
        "strobe-beat",
        "Every beat",
        artwork("strobe", { count: 1, strength: 0.85, seconds: 0.05 }),
      ],
    ],
  },
  {
    id: "art-trail",
    name: "Color ghost trail",
    category: "Artwork",
    description:
      "Tinted copies trail a few frames behind the artwork and sit slightly offset, so every move leaves a chroma echo.",
    variations: [
      ["trail-chroma", "Magenta and cyan", artwork("trail")],
      [
        "trail-signal",
        "Red and blue",
        artwork("trail", { color: "#ff3b30", secondary: "#2f6bff" }),
      ],
      [
        "trail-echo",
        "Long echo",
        artwork("trail", {
          count: 4,
          seconds: 0.1,
          distance: 0.006,
          color: "#f5c84c",
          secondary: "#f2765e",
        }),
      ],
    ],
  },
  {
    id: "art-slices",
    name: "Slice shift",
    category: "Artwork",
    description:
      "Cuts the artwork into bands that knock sideways on the beat, slide together as it enters or apart as it leaves.",
    variations: [
      ["slices-beat", "On the beat", artwork("slices")],
      [
        "slices-in",
        "Slide in",
        artwork("slices", { timing: "in", seconds: 0.8, distance: 0.08 }),
      ],
      [
        "slices-out",
        "Slide out",
        artwork("slices", { timing: "out", seconds: 0.8, distance: 0.08 }),
      ],
      [
        "slices-drift",
        "Drifting columns",
        artwork("slices", {
          timing: "constant",
          direction: "vertical",
          count: 5,
          distance: 0.02,
          speed: 0.4,
        }),
      ],
    ],
  },
];
export const artEffects: Effect[] = artCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const artEffectFamilies: EffectFamily[] = artCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...artEffects.find((e) => e.id === card.id)!,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of artCards) styleCategories.set(card.id, card.category);

/** Overlay cards, one per kind; see overlay-cards.ts. */
const overlayCards: StyleCard[] = overlayLibrary.map((card) => ({
  ...card,
  category: "Overlay",
}));
export const overlayEffects: Effect[] = overlayCards.map((card) =>
  EffectSchema.parse({
    id: card.id,
    name: card.name,
    description: card.description,
    channels: [],
    color: "#f2765e",
    tint: 0,
    ...card.variations[0][2],
  }),
);
export const overlayEffectFamilies: EffectFamily[] = overlayCards
  .filter((card) => card.variations.length > 1)
  .map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    description: card.description,
    variations: card.variations.map(([id, name, patch]) => ({
      id,
      name,
      parameters: parameters(
        EffectSchema.parse({
          ...overlayEffects.find((e) => e.id === card.id)!,
          ...patch,
        }),
      ),
    })),
  }));
for (const card of overlayCards) styleCategories.set(card.id, card.category);

/** Gallery contains one card per family; legacy definitions remain resolvable. */
const primaryEffects: Effect[] = [
  ...legacyBuiltinEffects.flatMap((effect) => {
    if (!replacedIds.has(effect.id)) return [effect];
    const index = effectFamilies.findIndex(
      (f) => f.variations[0].id === effect.id,
    );
    return index < 0 ? [] : [familyEffects[index]];
  }),
  ...videoPlaybackEffects,
  ...remotionSceneEffects,
  ...motionEffects,
  ...styleEffects,
  ...titleEffects,
  ...packEffects,
  ...kineticEffects,
  ...lookEffects,
  ...layoutEffects,
  ...artEffects,
  ...overlayEffects,
];
/** Every reversible entrance also appears as an exit that plays it backwards. */
export const reversedEffects: Effect[] = primaryEffects
  .filter(isReversibleEntrance)
  .map((effect) => {
    const id = `${effect.id}-out`;
    styleCategories.set(id, styleCategories.get(effect.id) ?? "Typography");
    return EffectSchema.parse({
      ...effect,
      id,
      name: exitName(effect.name),
      description: `Exit: ${effect.name} played backwards over the end of the clip. Text elements only.`,
      presetFamilyId: undefined,
      text: {
        ...effect.text,
        motion: {
          depth: 3,
          spread: 2,
          rotation: 90,
          order: "forward",
          easing: "smooth",
          ...effect.text!.motion,
          direction: "out",
        },
      },
    });
  });
export const builtinEffects: Effect[] = [...primaryEffects, ...reversedEffects];
export const allBuiltinEffects: Effect[] = [
  ...builtinEffects,
  ...legacyBuiltinEffects.filter((e) => replacedIds.has(e.id)),
];

// The editor looks families up for every library card on each render, so index them once.
let familyIndex: Map<string, EffectFamily> | undefined;
export function getEffectFamily(id: string) {
  if (!familyIndex) {
    familyIndex = new Map();
    for (const f of [
      ...effectFamilies,
      ...motionEffectFamilies,
      ...styleEffectFamilies,
      ...titleEffectFamilies,
      ...packEffectFamilies,
      ...kineticEffectFamilies,
      ...lookEffectFamilies,
      ...layoutEffectFamilies,
      ...artEffectFamilies,
      ...overlayEffectFamilies,
    ]) {
      // First match wins, as with the earlier linear search.
      if (!familyIndex.has(f.id)) familyIndex.set(f.id, f);
      for (const v of f.variations)
        if (!familyIndex.has(v.id)) familyIndex.set(v.id, f);
    }
  }
  return familyIndex.get(id);
}

const parameterSchema = EffectSchema.pick({
  channels: true,
  passes: true,
  color: true,
  tint: true,
  text: true,
  depth: true,
  origin: true,
  art: true,
  overlay: true,
});
const parameterKey = (value: EffectParameters) =>
  JSON.stringify(parameterSchema.parse(value));

export function effectVariationId(effect: Effect): string {
  const f = getEffectFamily(effect.presetFamilyId ?? effect.id);
  const current = parameterKey(parameters(effect));
  return (
    f?.variations.find(
      (v) =>
        parameterKey(v.parameters) === current ||
        (legacyBuiltinEffects.some((e) => e.id === v.id) &&
          parameterKey(
            parameters(legacyBuiltinEffects.find((e) => e.id === v.id)!),
          ) === current),
    )?.id ?? "custom"
  );
}

/** Only parameters change: identity, user naming and shared references are preserved. */
export function effectVariationPatch(
  effect: Effect,
  variationId: string,
): EffectParameters | undefined {
  const variation = getEffectFamily(
    effect.presetFamilyId ?? effect.id,
  )?.variations.find((v) => v.id === variationId);
  return variation
    ? structuredClone({
        ...variation.parameters,
        ...(effect.text && !variation.parameters.text
          ? { text: undefined }
          : {}),
        ...(effect.depth && !variation.parameters.depth
          ? { depth: undefined }
          : {}),
        ...(effect.origin && !variation.parameters.origin
          ? { origin: undefined }
          : {}),
        ...(effect.art && !variation.parameters.art ? { art: undefined } : {}),
        ...(effect.overlay && !variation.parameters.overlay
          ? { overlay: undefined }
          : {}),
      })
    : undefined;
}

export function builtinEffectCategory(id: string) {
  return (
    (remotionSceneEffects.find((effect) => effect.id === id)
      ? id === "blinds-reveal"
        ? "Transitions"
        : "Typography"
      : undefined) ??
    styleCategories.get(id) ??
    getEffectFamily(id)?.category ??
    animationEffectCatalog.find((e) => e.id === id)?.category ??
    videoPlaybackEffectCatalog.find((e) => e.id === id)?.category ??
    "Basics"
  );
}

const searchTexts = new WeakMap<Effect, string>();
export function effectSearchText(effect: Effect) {
  let text = searchTexts.get(effect);
  if (text === undefined) {
    text = buildSearchText(effect);
    searchTexts.set(effect, text);
  }
  return text;
}
function buildSearchText(effect: Effect) {
  const f = getEffectFamily(effect.id);
  const aliases =
    f?.variations
      .map(
        (v) => legacyBuiltinEffects.find((e) => e.id === v.id)?.name ?? v.name,
      )
      .join(" ") ?? "";
  const extra =
    effect.id === "memory-flecks"
      ? "Floating paper flecks fireworks radial bursts"
      : effect.id === "memory-hatch"
        ? "Diagonal print screen halftone dots"
        : "";
  return `${effect.name} ${effect.description} ${aliases} ${extra}`.toLowerCase();
}
