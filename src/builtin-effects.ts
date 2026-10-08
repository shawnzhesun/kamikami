import {
  EffectSchema,
  initialProject,
  type Channel,
  type Effect,
} from "./model";
import { builtinTextSettings } from "./text-effects";
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
  "channels" | "passes" | "color" | "tint" | "text"
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
];
export const allBuiltinEffects: Effect[] = [
  ...builtinEffects,
  ...legacyBuiltinEffects.filter((e) => replacedIds.has(e.id)),
];

export function getEffectFamily(id: string) {
  return effectFamilies.find(
    (f) => f.id === id || f.variations.some((v) => v.id === id),
  );
}

const parameterSchema = EffectSchema.pick({
  channels: true,
  passes: true,
  color: true,
  tint: true,
  text: true,
});
const parameterKey = (value: EffectParameters) =>
  JSON.stringify(parameterSchema.parse(value));

export function effectVariationId(effect: Effect): string {
  const f = getEffectFamily(effect.id);
  const current = parameterKey(parameters(effect));
  return (
    f?.variations.find(
      (v) =>
        parameterKey(v.parameters) === current ||
        parameterKey(
          parameters(legacyBuiltinEffects.find((e) => e.id === v.id)!),
        ) === current,
    )?.id ?? "custom"
  );
}

/** Only parameters change: identity, user naming and shared references are preserved. */
export function effectVariationPatch(
  effect: Effect,
  variationId: string,
): EffectParameters | undefined {
  const variation = getEffectFamily(effect.id)?.variations.find(
    (v) => v.id === variationId,
  );
  return variation ? structuredClone(variation.parameters) : undefined;
}

export function builtinEffectCategory(id: string) {
  return (
    (remotionSceneEffects.find((effect) => effect.id === id)
      ? id === "blinds-reveal"
        ? "Transitions"
        : "Typography"
      : undefined) ??
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
      .map((v) => legacyBuiltinEffects.find((e) => e.id === v.id)!.name)
      .join(" ") ?? "";
  const extra =
    effect.id === "memory-flecks"
      ? "Floating paper flecks fireworks radial bursts"
      : effect.id === "memory-hatch"
        ? "Diagonal print screen halftone dots"
        : "";
  return `${effect.name} ${effect.description} ${aliases} ${extra}`.toLowerCase();
}
