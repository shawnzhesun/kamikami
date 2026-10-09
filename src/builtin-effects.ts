import {
  EffectSchema,
  initialProject,
  type Channel,
  type Effect,
} from "./model";
import { builtinTextSettings, TextEffectSchema } from "./text-effects";
import { DepthSchema, FieldSchema, ParticleSchema } from "./motion";
import { type VisualPass } from "./visual-effects";

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
  "channels" | "passes" | "color" | "tint" | "text" | "depth" | "origin"
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

/** Gallery contains one card per family; legacy definitions remain resolvable. */
export const builtinEffects: Effect[] = [
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
];
export const allBuiltinEffects: Effect[] = [
  ...builtinEffects,
  ...legacyBuiltinEffects.filter((e) => replacedIds.has(e.id)),
];

export function getEffectFamily(id: string) {
  return [
    ...effectFamilies,
    ...motionEffectFamilies,
    ...styleEffectFamilies,
    ...titleEffectFamilies,
    ...packEffectFamilies,
  ].find((f) => f.id === id || f.variations.some((v) => v.id === id));
}

const parameterSchema = EffectSchema.pick({
  channels: true,
  passes: true,
  color: true,
  tint: true,
  text: true,
  depth: true,
  origin: true,
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

export function effectSearchText(effect: Effect) {
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
