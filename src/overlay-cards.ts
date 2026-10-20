import type { Channel } from "./model";
import { makeOverlay, type Overlay, type OverlayKind } from "./overlays";

/**
 * The Overlay cards of the effects library: one card per kind, each with
 * named variations that mix the kind's own shapes with the shared line,
 * fill, entrance and loop styles. The framing marks keep the IDs they had as
 * artwork treatments.
 */
export type OverlayCard = {
  id: string;
  name: string;
  description: string;
  variations: [string, string, { overlay: Overlay; channels?: Channel[] }][];
};
const mark = (kind: OverlayKind, patch: Partial<Overlay> = {}) => ({
  overlay: makeOverlay(kind, patch),
});
/** A card whose variations are `[slug, name, patch]`. */
const card = (
  kind: OverlayKind,
  name: string,
  description: string,
  variations: [string, string, Partial<Overlay>][],
  id = `overlay-${kind}`,
): OverlayCard => ({
  id,
  name,
  description,
  variations: variations.map(([slug, label, patch]) => [
    `ov-${kind}-${slug}`,
    label,
    mark(kind, patch),
  ]),
});
const fadeOut = (seconds: number): Channel => ({
  property: "opacity",
  from: 1,
  to: 0,
  curve: "ease",
  frequency: 1,
  phase: 0,
  seconds,
  align: "end",
});

const INK = "#141414",
  PAPER = "#f6f2ea",
  CORAL = "#f2765e",
  MINT = "#16f4d4",
  SUN = "#ffe14d",
  HUD = "#7cf7d4",
  BLUEPRINT = "#9fd8ff",
  PINK = "#ff7ab6";

export const overlayCards: OverlayCard[] = [
  // ------------------------------------------------------------- Frame
  {
    id: "art-print",
    name: "Print border",
    description:
      "A paper border and soft shadow around the element, like a print pinned to the frame.",
    variations: [
      ["print-white", "White", mark("print")],
      [
        "print-cream",
        "Wide cream",
        mark("print", { color: "#efe4cc", pad: 2.4 }),
      ],
      ["ov-print-rounded", "Rounded", mark("print", { variant: 1, pad: 1 })],
      [
        "ov-print-deckled",
        "Deckled edge",
        mark("print", { variant: 2, color: "#efe4cc", pad: 1.8 }),
      ],
      [
        "ov-print-halftone",
        "Halftone card",
        mark("print", { color: CORAL, fill: "halftone", density: 1.4 }),
      ],
    ],
  },
  {
    id: "art-block-shadow",
    name: "Block shadow",
    description:
      "A hard, solid offset shadow behind the element, pop-poster style.",
    variations: [
      [
        "block-coral",
        "Coral",
        mark("shadowblock", { color: CORAL, angle: 135 }),
      ],
      ["block-ink", "Ink", mark("shadowblock")],
      [
        "ov-shadowblock-extrude",
        "Extruded",
        mark("shadowblock", { variant: 1, color: MINT, angle: 45, pad: 1.6 }),
      ],
      [
        "ov-shadowblock-steps",
        "Stepped",
        mark("shadowblock", { variant: 2, color: PINK, angle: 30 }),
      ],
      [
        "ov-shadowblock-hatch",
        "Hatched",
        mark("shadowblock", {
          color: PAPER,
          fill: "hatch",
          angle: 135,
          density: 1.6,
        }),
      ],
    ],
  },
  {
    id: "art-offset-frame",
    name: "Offset frame",
    description:
      "An outline rectangle that slides out from behind the element.",
    variations: [
      ["frame-coral", "Coral", mark("offsetframe")],
      ["frame-mint", "Mint", mark("offsetframe", { color: MINT, angle: -45 })],
      [
        "ov-offsetframe-echo",
        "Echo",
        mark("offsetframe", { count: 3, pad: 0.7, color: PAPER }),
      ],
      [
        "ov-offsetframe-dashed",
        "Dashed",
        mark("offsetframe", { stroke: "dashed", color: SUN }),
      ],
      [
        "ov-offsetframe-sketch",
        "Sketched",
        mark("offsetframe", { stroke: "sketch", color: PAPER, roughness: 1.4 }),
      ],
    ],
  },
  {
    id: "art-brackets",
    name: "Corner brackets",
    description: "Viewfinder corners close in around the element.",
    variations: [
      ["brackets-light", "Light", mark("brackets")],
      ["brackets-ink", "Ink", mark("brackets", { color: INK })],
      ["brackets-coral", "Coral", mark("brackets", { color: CORAL })],
      [
        "ov-brackets-round",
        "Rounded",
        mark("brackets", { variant: 1, weight: 1.4 }),
      ],
      [
        "ov-brackets-ticks",
        "Ticks, breathing",
        mark("brackets", { variant: 2, loop: "breathe", tempo: 90 }),
      ],
      [
        "ov-brackets-neon",
        "Neon",
        mark("brackets", { stroke: "neon", color: MINT }),
      ],
    ],
  },
  {
    id: "art-crop-marks",
    name: "Crop marks",
    description:
      "Printer's crop marks and registration targets around the element.",
    variations: [
      ["crop-light", "Light", mark("cropmarks")],
      ["crop-ink", "Ink", mark("cropmarks", { color: INK })],
      [
        "ov-cropmarks-pencil",
        "Pencil",
        mark("cropmarks", { stroke: "pencil", weight: 1.6 }),
      ],
    ],
  },
  {
    id: "art-label",
    name: "Index label",
    description:
      "A small monospaced caption types in beside the element: an index and the clip's start time, or your own words.",
    variations: [
      ["label-index", "Index", mark("label")],
      [
        "ov-label-clock",
        "Running clock",
        mark("label", { label: "REC  {clock}" }),
      ],
      [
        "ov-label-size",
        "Size readout",
        mark("label", { label: "{w} × {h} PX", color: BLUEPRINT }),
      ],
      [
        "ov-label-serif",
        "Serif caption",
        mark("label", { label: "Plate {index}", font: "serif" }),
      ],
    ],
  },
  {
    id: "art-tape",
    name: "Tape corners",
    description: "Strips of tape hold the element's corners, scrapbook style.",
    variations: [
      ["tape-masking", "Masking", mark("tape")],
      ["tape-pink", "Pink", mark("tape", { color: "#ff9ec7" })],
      [
        "ov-tape-four",
        "All four corners",
        mark("tape", { count: 4, color: "#cde8f6" }),
      ],
      [
        "ov-tape-center",
        "Top center",
        mark("tape", { count: 5, color: "#f5e6b8" }),
      ],
      [
        "ov-tape-striped",
        "Washi",
        mark("tape", { color: "#ffd0a8", fill: "hatch", density: 2 }),
      ],
    ],
  },
  // ---------------------------------------------------------- Annotate
  {
    id: "overlay-circle",
    name: "Circle it",
    description:
      "A quick marker loop draws around the element or its key word, overshooting where it closes.",
    variations: [
      ["circle-red", "Red marker", mark("circle")],
      [
        "circle-key",
        "Key word",
        mark("circle", { anchor: "keyword", pad: 0.6 }),
      ],
      [
        "circle-pencil",
        "Boiling pencil",
        mark("circle", { color: PAPER, weight: 0.7, boil: 8, wobble: 0.7 }),
      ],
      [
        "ov-circle-loops",
        "Scribbled loops",
        mark("circle", { count: 3, weight: 0.8, wobble: 0.8 }),
      ],
      [
        "ov-circle-brush",
        "Brush ring",
        mark("circle", { stroke: "brush", color: SUN, weight: 1.6 }),
      ],
      [
        "ov-circle-words",
        "Every word",
        mark("circle", { anchor: "words", pad: 0.3, weight: 0.9, color: MINT }),
      ],
    ],
  },
  {
    id: "overlay-underline",
    name: "Hand underline",
    description:
      "A hand-drawn stroke underlines the text, its key word or every line.",
    variations: [
      ["underline-single", "Single", mark("underline")],
      ["underline-double", "Double", mark("underline", { count: 2 })],
      ["underline-key", "Key word", mark("underline", { anchor: "keyword" })],
      [
        "underline-lines",
        "Every line",
        mark("underline", { anchor: "lines", color: SUN }),
      ],
      [
        "ov-underline-marker",
        "Fat marker",
        mark("underline", { stroke: "marker", weight: 1.8, color: CORAL }),
      ],
      [
        "ov-underline-chalk",
        "Chalk",
        mark("underline", { stroke: "chalk", weight: 1.6, color: PAPER }),
      ],
    ],
  },
  {
    id: "overlay-highlight",
    name: "Highlighter",
    description:
      "A translucent marker swipe behind the words, one line after another.",
    variations: [
      ["highlight-yellow", "Yellow", mark("highlight", { anchor: "lines" })],
      [
        "highlight-pink",
        "Pink key word",
        mark("highlight", { anchor: "keyword", color: PINK }),
      ],
      [
        "highlight-mint",
        "Mint",
        mark("highlight", { anchor: "lines", color: "#7cf2c8" }),
      ],
      [
        "ov-highlight-clear",
        "See-through",
        mark("highlight", {
          anchor: "lines",
          blend: "normal",
          strength: 0.45,
          color: SUN,
        }),
      ],
      [
        "ov-highlight-words",
        "Word by word",
        mark("highlight", { anchor: "words", stagger: 0.5, color: SUN }),
      ],
    ],
  },
  {
    id: "overlay-strike",
    name: "Strike through",
    description: "A pen line strikes through the text or a single word.",
    variations: [
      ["strike-single", "Single", mark("strike", { anchor: "lines" })],
      ["strike-key", "Key word", mark("strike", { anchor: "keyword" })],
      ["strike-double", "Double", mark("strike", { count: 2, color: PAPER })],
      [
        "ov-strike-brush",
        "Brush",
        mark("strike", { anchor: "lines", stroke: "brush", weight: 1.4 }),
      ],
    ],
  },
  {
    id: "overlay-arrow",
    name: "Pointer arrow",
    description:
      "A marker arrow swoops in from the roomiest side and points at the element.",
    variations: [
      ["arrow-red", "Red", mark("arrow")],
      [
        "arrow-key",
        "At the key word",
        mark("arrow", { anchor: "keyword", color: SUN }),
      ],
      [
        "ov-arrow-straight",
        "Straight, ruled",
        mark("arrow", { variant: 1, wobble: 0, color: PAPER }),
      ],
      [
        "ov-arrow-loop",
        "Loop-the-loop",
        mark("arrow", { variant: 2, size: 1.4, seconds: 0.9 }),
      ],
      [
        "ov-arrow-chalk",
        "Chalk",
        mark("arrow", { stroke: "chalk", color: PAPER, weight: 1.4 }),
      ],
    ],
  },
  {
    id: "overlay-tick",
    name: "Tick",
    description: "A hand-drawn check mark beside the element.",
    variations: [
      ["tick-green", "Green", mark("tick")],
      [
        "ov-tick-brush",
        "Brush",
        mark("tick", { stroke: "brush", weight: 1.3 }),
      ],
      [
        "ov-tick-pop",
        "Pop, on the beat",
        mark("tick", { enter: "pop", loop: "pulse", tempo: 110 }),
      ],
      [
        "ov-tick-words",
        "Every word",
        mark("tick", { anchor: "words", placement: "top", size: 0.6 }),
      ],
    ],
  },
  {
    id: "overlay-cross",
    name: "Cross",
    description: "Two quick strokes cross beside the element.",
    variations: [
      ["cross-red", "Red", mark("cross")],
      [
        "ov-cross-marker",
        "Marker",
        mark("cross", { stroke: "marker", weight: 1.4 }),
      ],
      [
        "ov-cross-jitter",
        "Shaky",
        mark("cross", { loop: "jitter", loopDepth: 0.8, color: PAPER }),
      ],
    ],
  },
  {
    id: "overlay-star",
    name: "Margin star",
    description:
      "A doodled star in the margin, filled once it's drawn, rocking gently.",
    variations: [
      ["star-yellow", "Yellow", mark("star")],
      ["star-top", "Above", mark("star", { placement: "top", color: PAPER })],
      [
        "ov-star-hatched",
        "Hatched",
        mark("star", {
          stroke: "sketch",
          fill: "hatch",
          color: SUN,
          size: 1.3,
        }),
      ],
      [
        "ov-star-burst",
        "Eight points, spinning",
        mark("star", { count: 8, loop: "spin", loopDepth: 0.2, color: CORAL }),
      ],
    ],
  },
  card(
    "box",
    "Box it",
    "A hand-drawn box around the element or key word, corners overshooting like a quick pen.",
    [
      ["loose", "Loose pen", {}],
      ["double", "Two passes", { variant: 1, color: PAPER }],
      [
        "rounded",
        "Rounded marker",
        { variant: 2, stroke: "marker", color: SUN },
      ],
      ["cloud", "Cloud", { variant: 3, color: MINT, wobble: 0.6 }],
      [
        "key",
        "Key word, hatched",
        {
          anchor: "keyword",
          stroke: "sketch",
          fill: "hatch",
          fillColor: CORAL,
          pad: 0.5,
        },
      ],
    ],
  ),
  card(
    "braces",
    "Side braces",
    "Braces, brackets or bars on both sides, or on one side like a margin note.",
    [
      ["curly", "Curly", {}],
      ["square", "Square brackets", { variant: 1, color: CORAL }],
      ["round", "Parentheses", { variant: 2, weight: 1.4 }],
      [
        "bar",
        "Margin bar",
        { variant: 3, placement: "left", stroke: "brush", color: SUN },
      ],
      ["top", "Brace above", { placement: "top", color: MINT }],
    ],
  ),
  card(
    "scribble",
    "Scribble out",
    "Scribbled over, like crossing a word out by hand.",
    [
      ["zigzag", "Zigzag", {}],
      ["loops", "Loops", { variant: 1, color: CORAL, count: 8 }],
      ["hatch", "Hatched out", { variant: 2, color: PAPER, weight: 0.8 }],
      [
        "key",
        "Key word, boiling",
        { anchor: "keyword", boil: 10, color: CORAL },
      ],
    ],
  ),
  card(
    "squiggle",
    "Wavy underline",
    "A wavy, zigzag or looped line under each line of text.",
    [
      ["wave", "Wave", {}],
      ["zigzag", "Zigzag", { variant: 1, color: SUN }],
      ["loops", "Loops", { variant: 2, color: MINT }],
      ["double", "Double wave", { variant: 3, color: PAPER }],
      [
        "flow",
        "Flowing, every line",
        { anchor: "lines", speed: 0.6, stroke: "neon", color: PINK },
      ],
    ],
  ),
  card(
    "swoosh",
    "Brush swoosh",
    "A tapered paint stroke: a swash under the words, a swatch behind them, an arc over or an ensō ring.",
    [
      ["under", "Swash under", {}],
      ["swatch", "Swatch behind", { variant: 1, color: SUN, strength: 0.9 }],
      ["arc", "Arc over", { variant: 2, color: MINT }],
      ["enso", "Ensō ring", { variant: 3, color: PAPER, weight: 1.6 }],
      [
        "key",
        "Key word swatch",
        { variant: 1, anchor: "keyword", color: PINK },
      ],
    ],
  ),
  card(
    "margin",
    "Margin marks",
    "An editor's marks in the margin: !!, a question mark, an asterisk, NB or a margin bar.",
    [
      ["bang", "!!", {}],
      ["query", "Question", { variant: 1, color: SUN }],
      [
        "asterisk",
        "Asterisk",
        { variant: 2, color: PAPER, loop: "spin", loopDepth: 0.15 },
      ],
      ["nb", "NB", { variant: 3, color: CORAL }],
      ["bar", "Margin bar", { variant: 4, stroke: "marker", color: SUN }],
    ],
  ),
  // ------------------------------------------------------------ Emotion
  card(
    "sweat",
    "Sweat drop",
    "Manga sweat drops on the corner — nervous, awkward, caught out.",
    [
      ["single", "Single drop", {}],
      ["pair", "Pair", { variant: 1 }],
      [
        "flying",
        "Flying",
        { variant: 2, loop: "jitter", loopDepth: 0.3, tempo: 140 },
      ],
      ["left", "Left corner", { placement: "left", size: 1.3 }],
    ],
  ),
  card(
    "vein",
    "Anger mark",
    "The popping cross-vein of manga anger, throbbing on the corner — or steam puffs, or a scribble.",
    [
      ["vein", "Vein", {}],
      ["steam", "Steam puffs", { variant: 1, color: PAPER, placement: "left" }],
      ["scribble", "Scribble cloud", { variant: 2, color: PAPER, boil: 12 }],
      ["neon", "Neon vein", { stroke: "neon", color: "#ff4d6d" }],
    ],
  ),
  card(
    "blush",
    "Blush",
    "Blush hatching, soft cheeks or little hearts under the words.",
    [
      ["hatch", "Hatching", {}],
      ["cheeks", "Soft cheeks", { variant: 1 }],
      ["hearts", "Floating hearts", { variant: 2, count: 8 }],
      ["pencil", "Pencil", { stroke: "pencil", color: "#ff9db4", count: 7 }],
    ],
  ),
  card(
    "gloom",
    "Gloom lines",
    "Manga gloom: lines hang over the words, a rain cloud drips, or dizzy spirals circle.",
    [
      ["lines", "Hanging lines", {}],
      ["wavy", "Wavy", { variant: 1, count: 12 }],
      ["cloud", "Rain cloud", { variant: 2, color: "#a9b8d6" }],
      ["dizzy", "Dizzy spirals", { variant: 3, color: PAPER, count: 9 }],
    ],
  ),
  // -------------------------------------------------------------- Comic
  card(
    "focuslines",
    "Focus lines",
    "Manga focus lines rush in from the frame edge and converge on the element.",
    [
      ["wedges", "Wedges", {}],
      ["hair", "Hairlines", { variant: 1, count: 24 }],
      ["ring", "Short ring", { variant: 2, color: SUN, boil: 12 }],
      ["ink", "Ink", { color: INK, count: 20 }],
    ],
  ),
  card(
    "shake",
    "Shake marks",
    "Vibration marks either side — arcs, ticks or zigzags that jump between frames.",
    [
      ["arcs", "Arcs", {}],
      ["ticks", "Ticks", { variant: 1, color: SUN }],
      ["zigzag", "Zigzag", { variant: 2, color: CORAL, count: 1 }],
      [
        "frantic",
        "Frantic",
        { count: 3, speed: 14, stroke: "marker", color: PAPER },
      ],
    ],
  ),
  card(
    "balloon",
    "Speech balloon",
    "A comic balloon pops up beside the element with your words: speech, thought, shout or whisper.",
    [
      ["speech", "Speech", {}],
      ["thought", "Thought", { variant: 1, label: "Hmm…" }],
      [
        "shout",
        "Shout",
        { variant: 2, label: "WHAT?!", secondary: SUN, caps: true },
      ],
      ["whisper", "Whisper", { variant: 3, label: "psst", placement: "right" }],
      ["dark", "Dark", { color: PAPER, secondary: INK, label: "Hey!" }],
    ],
  ),
  card(
    "badge",
    "Spiky badge",
    "A starburst, seal, ribbon or roundel badge on the corner with a short word.",
    [
      ["burst", "Starburst", {}],
      [
        "seal",
        "Seal",
        { variant: 1, color: CORAL, secondary: PAPER, label: "HOT" },
      ],
      [
        "ribbon",
        "Ribbon",
        { variant: 2, color: MINT, label: "LIVE", angle: -8 },
      ],
      [
        "roundel",
        "Roundel",
        { variant: 3, color: INK, secondary: SUN, label: "№1" },
      ],
      [
        "beat",
        "Starburst on the beat",
        { loop: "pulse", tempo: 120, color: PINK, label: "WOW" },
      ],
    ],
  ),
  // ----------------------------------------------------------- Drafting
  {
    id: "overlay-dimension",
    name: "Dimension line",
    description:
      "A drafting dimension measures the element's width, with extension lines and a live readout.",
    variations: [
      ["dimension-blue", "Blueprint", mark("dimension")],
      ["dimension-ink", "Ink", mark("dimension", { color: INK })],
      [
        "ov-dimension-below",
        "Below, in em",
        mark("dimension", { placement: "bottom", label: "{w} PX · {h} PX" }),
      ],
      [
        "ov-dimension-words",
        "Every word",
        mark("dimension", { anchor: "words", size: 0.8 }),
      ],
    ],
  },
  {
    id: "overlay-crosshair",
    name: "Crosshair",
    description:
      "Hairlines cross behind the element's center with a ring and its position on the frame.",
    variations: [
      ["crosshair-blue", "Blueprint", mark("crosshair")],
      [
        "crosshair-key",
        "On the key word",
        mark("crosshair", { anchor: "keyword", color: PAPER }),
      ],
      [
        "ov-crosshair-dashed",
        "Dashed",
        mark("crosshair", { stroke: "dashed", color: SUN }),
      ],
    ],
  },
  {
    id: "overlay-ruler",
    name: "Ruler",
    description:
      "A ruler with numbered ticks unrolls along the element's edge.",
    variations: [
      ["ruler-light", "Light", mark("ruler")],
      [
        "ov-ruler-top",
        "Fine, above",
        mark("ruler", { placement: "top", count: 16, color: BLUEPRINT }),
      ],
      ["ov-ruler-ink", "Ink", mark("ruler", { color: INK, count: 6 })],
    ],
  },
  {
    id: "overlay-callout",
    name: "Callout",
    description: "A leader line runs from the element to a typed figure label.",
    variations: [
      ["callout-fig", "Figure", mark("callout")],
      [
        "callout-key",
        "Key word",
        mark("callout", { anchor: "keyword", label: "THIS ONE" }),
      ],
      [
        "ov-callout-word",
        "Names the word",
        mark("callout", {
          anchor: "keyword",
          label: "“{word}”",
          font: "serif",
        }),
      ],
      [
        "ov-callout-hand",
        "Handwritten",
        mark("callout", {
          label: "look!",
          font: "hand",
          stroke: "pencil",
          color: SUN,
        }),
      ],
    ],
  },
  card(
    "typeguides",
    "Type guides",
    "Baseline, x-height and cap-height guides across each line of text, like a type specimen. Pictures get a thirds grid.",
    [
      ["labelled", "Labelled", {}],
      ["lines", "Lines only", { variant: 1, color: BLUEPRINT }],
      ["bearings", "With side bearings", { variant: 2, color: SUN }],
      ["dashed", "Dashed, ink", { stroke: "dashed", color: INK }],
    ],
  ),
  card(
    "selection",
    "Selection box",
    "A design-tool selection: a thin box, square handles and a size readout.",
    [
      ["eight", "Eight handles", {}],
      ["corners", "Corners only", { variant: 1, color: PINK }],
      ["rotate", "Rotate handle", { variant: 2, color: "#a259ff" }],
      ["words", "Every word", { anchor: "words", pad: 0.2, color: MINT }],
    ],
  ),
  card(
    "anglearc",
    "Angle arc",
    "A protractor reading from a corner of the element: two rays, an arc and the angle in degrees.",
    [
      ["arc", "Arc", {}],
      ["protractor", "Protractor", { variant: 1, angle: 60, color: BLUEPRINT }],
      ["steep", "Steep, ink", { angle: 75, color: INK }],
    ],
  ),
  card(
    "dotgrid",
    "Dot grid",
    "Graph paper behind the element — dots, lines, crosses or an isometric grid — fading out at the edges.",
    [
      ["dots", "Dots", {}],
      [
        "lines",
        "Graph lines",
        { variant: 1, color: BLUEPRINT, strength: 0.35 },
      ],
      ["crosses", "Crosses", { variant: 2, color: PAPER, strength: 0.45 }],
      ["iso", "Isometric", { variant: 3, color: MINT, strength: 0.5 }],
    ],
  ),
  // ---------------------------------------------------------- Interface
  card(
    "reticle",
    "Lock-on reticle",
    "A targeting reticle spins in, closes on the element and locks with a blinking tag.",
    [
      ["brackets", "Brackets", {}],
      ["ring", "Ring sight", { variant: 1, color: "#ff4d6d", label: "TARGET" }],
      ["diamond", "Diamond", { variant: 2, color: SUN }],
      ["key", "Key word", { anchor: "keyword", label: "{word}", caps: true }],
    ],
  ),
  card(
    "scan",
    "Scan sweep",
    "A glowing scan line sweeps over the element with a readout, or a radar arm sweeps round.",
    [
      ["sweep", "Line sweep", {}],
      ["radar", "Radar", { variant: 1, label: "SWEEP {pct}" }],
      ["framed", "Framed sweep", { variant: 2, color: SUN, speed: 0.8 }],
      ["slow", "Slow, pink", { color: PINK, speed: 0.25, label: "ANALYZING" }],
    ],
  ),
  card(
    "datacolumn",
    "Data column",
    "A column of monospaced data scrolls beside the element: hex, live telemetry or binary.",
    [
      ["hex", "Hex dump", {}],
      ["telemetry", "Telemetry", { variant: 1, label: "TRACK" }],
      ["binary", "Binary", { variant: 2, color: "#5cff7a", count: 8 }],
      ["left", "Left, fast", { placement: "left", speed: 4, color: SUN }],
    ],
  ),
  card(
    "progressring",
    "Progress ring",
    "A gauge fills over the clip: a small dial, a ring around the element, segments or a bar.",
    [
      ["dial", "Dial", {}],
      ["around", "Around", { variant: 1, color: PINK }],
      ["segments", "Segments", { variant: 2, count: 16 }],
      ["bar", "Bar", { variant: 3, color: SUN, label: "{time}" }],
    ],
  ),
  card(
    "bearing",
    "Bearing tape",
    "A cockpit tape scrolls past a fixed caret: a compass heading, an altitude ladder or a timecode strip.",
    [
      ["compass", "Compass", {}],
      ["altitude", "Altitude ladder", { variant: 1, speed: 40 }],
      ["timecode", "Timecode strip", { variant: 2, color: SUN }],
    ],
  ),
  // -------------------------------------------------------------- Paper
  card(
    "torn",
    "Torn paper",
    "A torn strip of paper behind the element, its ragged edges different every seed.",
    [
      ["strip", "Red strip", {}],
      [
        "patch",
        "Kraft patch",
        { variant: 1, angle: 3, color: "#a87b4f", wobble: 0.8 },
      ],
      ["layers", "Two layers", { variant: 2, color: INK, secondary: CORAL }],
      ["ink", "Black strip", { color: INK, angle: -4 }],
      ["cream", "Cream, for dark text", { color: "#f3ead8" }],
    ],
  ),
  card(
    "photocorners",
    "Photo corners",
    "Album photo corners hold each corner: paper mounts, clear sleeves or lace.",
    [
      ["mounts", "Paper mounts", {}],
      ["clear", "Clear sleeves", { variant: 1 }],
      ["lace", "Lace", { variant: 2, color: PAPER }],
      ["gold", "Gold", { color: "#d4a945" }],
    ],
  ),
  card(
    "pin",
    "Push pin",
    "A push pin, thumbtack or paper clip drops in and holds the element up.",
    [
      ["round", "Round pin", {}],
      ["tack", "Thumbtack", { variant: 1, color: "#2a5bd7" }],
      ["clip", "Paper clip", { variant: 2, placement: "left" }],
      ["yellow", "Yellow pin", { color: "#ffcf33" }],
    ],
  ),
  card(
    "sticker",
    "Peel sticker",
    "A die-cut sticker on the corner with a peeling edge and your word on it.",
    [
      ["circle", "Circle", {}],
      ["label", "Rounded label", { variant: 1, color: MINT, label: "NEW" }],
      ["star", "Star", { variant: 2, color: PINK, label: "★" }],
      [
        "heart",
        "Heart",
        { variant: 3, color: "#ff4d6d", secondary: PAPER, label: "<3" },
      ],
    ],
  ),
  card(
    "ticket",
    "Ticket edge",
    "Frames the element as a ticket with a perforated stub, a postage stamp or a cut-out coupon.",
    [
      ["ticket", "Ticket", {}],
      ["postage", "Postage stamp", { variant: 1 }],
      ["coupon", "Coupon", { variant: 2, color: SUN }],
      [
        "filled",
        "Filled ticket",
        { fill: "solid", fillColor: CORAL, fillOpacity: 0.85 },
      ],
    ],
  ),
  card(
    "cautiontape",
    "Caution tape",
    "Hazard tape with striped edges and repeating text slaps across the frame one band after another, or stacks above and below the words.",
    [
      ["crossed", "Crossed", {}],
      [
        "stacked",
        "Above and below",
        { variant: 1, count: 2, label: "DO NOT CROSS" },
      ],
      ["through", "Through", { variant: 2, count: 3, angle: 18 }],
      [
        "police",
        "Police line",
        {
          color: "#f6f2ea",
          secondary: "#1f3fbf",
          label: "POLICE LINE",
          count: 3,
        },
      ],
    ],
  ),
  // ----------------------------------------------------------- Ornament
  card(
    "quotes",
    "Big quotes",
    "Oversized quotation marks open and close the words — curly, guillemets, corner brackets or single.",
    [
      ["curly", "Curly", {}],
      ["guillemets", "Guillemets", { variant: 1, color: SUN }],
      ["corner", "Corner brackets", { variant: 2, color: PAPER, font: "sans" }],
      [
        "single",
        "Single, faint",
        { variant: 3, strength: 0.4, size: 1.6, layer: "behind" },
      ],
    ],
  ),
  card(
    "flourish",
    "Flourish rules",
    "Decorative rules draw out from the center above and below: a diamond, curls, dots or a double rule.",
    [
      ["diamond", "Diamond", {}],
      ["curls", "Curls", { variant: 1 }],
      ["dots", "Dots", { variant: 2, color: PAPER }],
      ["double", "Double rule", { variant: 3, color: CORAL }],
      ["under", "Under only", { placement: "bottom", variant: 1, color: SUN }],
    ],
  ),
  card(
    "footnote",
    "Footnote",
    "A superscript mark on the key word and a matching note set small at the foot of the frame.",
    [
      ["asterisk", "Asterisk", {}],
      ["dagger", "Dagger", { variant: 1, label: "Not a real word" }],
      [
        "number",
        "Numbered",
        { variant: 2, count: 1, font: "sans", color: SUN },
      ],
    ],
  ),
  card(
    "initial",
    "Initial ornament",
    "Decorates the first letter like an illuminated initial: a box, rings, vines or a solid block behind it.",
    [
      ["boxed", "Boxed", {}],
      ["rings", "Rings", { variant: 1, color: SUN }],
      ["vines", "Vines", { variant: 2, color: "#9ad1a0" }],
      ["block", "Block", { variant: 3 }],
    ],
  ),
  // ---------------------------------------------------------- Broadcast
  card(
    "viewfinder",
    "REC viewfinder",
    "A camcorder viewfinder around the element: corners, a blinking REC dot, running timecode and battery.",
    [
      ["camcorder", "Camcorder", {}],
      ["minimal", "Minimal", { variant: 1 }],
      ["cinema", "Cinema", { variant: 2, label: "A CAM" }],
      ["green", "Night vision", { color: "#7dff9a", secondary: "#7dff9a" }],
    ],
  ),
  card(
    "safearea",
    "Safe area",
    "Broadcast safe-area guides: action-safe and title-safe frames with a center cross.",
    [
      ["both", "Action and title", {}],
      ["title", "Title safe", { variant: 1, color: MINT }],
      ["cross", "Center cross", { variant: 2, color: PAPER }],
    ],
  ),
  card(
    "sprockets",
    "Film sprockets",
    "Film-strip bands with sprocket holes run above and below the element, rolling past.",
    [
      ["35", "35 mm", {}],
      ["s8", "Super 8", { variant: 1 }],
      ["contact", "Contact sheet", { variant: 2 }],
      ["light", "Light film", { color: "#d9cdb4" }],
    ],
  ),
  card(
    "slate",
    "Slate tag",
    "A clapperboard slate claps shut beside the element — or a hanging tag or a strip of camera tape — with scene and take.",
    [
      ["clapper", "Clapper", {}],
      ["tag", "Hanging tag", { variant: 1, color: "#efe4cc" }],
      ["tape", "Camera tape", { variant: 2, placement: "top" }],
    ],
  ),
  card(
    "lowerthird",
    "Lower third",
    "A news-style lower third: an accent bar with a kicker, an underline with a tag, or a box.",
    [
      ["bar", "Bar and kicker", {}],
      [
        "tag",
        "Underline and tag",
        { variant: 1, color: MINT, secondary: INK, label: "NOW PLAYING" },
      ],
      [
        "box",
        "Box",
        { variant: 2, color: INK, secondary: SUN, label: "BREAKING" },
      ],
      [
        "slide",
        "Slides in",
        { enter: "slide", color: "#2a5bd7", label: "EXCLUSIVE" },
      ],
    ],
  ),
  card(
    "edgebar",
    "Edge bar",
    "A solid bar behind the words runs off the edge of the frame, so the text rides in on it: to the nearer edge, across the frame, or as a thin rule.",
    [
      ["edge", "To the edge", {}],
      ["across", "Across the frame", { variant: 1, color: SUN }],
      ["rule", "Rule", { variant: 2, color: CORAL }],
      [
        "halftone",
        "Halftone bar",
        { fill: "halftone", fillColor: INK, color: SUN, density: 1.4 },
      ],
    ],
  ),
  // -------------------------------------------------------------- Print
  {
    id: "overlay-registration",
    name: "Registration marks",
    description:
      "Cyan, magenta and yellow targets slide from misregistration into one sharp mark on each side.",
    variations: [
      ["registration-light", "Light", mark("registration", { color: PAPER })],
      ["registration-ink", "Ink", mark("registration")],
    ],
  },
  {
    id: "overlay-colorbars",
    name: "Color bars",
    description: "A printer's color control strip lays down patch by patch.",
    variations: [
      ["colorbars-process", "Process", mark("colorbars")],
      ["colorbars-long", "Process and greys", mark("colorbars", { count: 14 })],
      [
        "ov-colorbars-greys",
        "Grey ramp",
        mark("colorbars", { variant: 1, count: 10 }),
      ],
      [
        "ov-colorbars-tv",
        "Broadcast bars",
        mark("colorbars", { variant: 2, size: 1.4 }),
      ],
    ],
  },
  {
    id: "overlay-stamp",
    name: "Rubber stamp",
    description:
      "A tilted ink stamp slams onto the corner. Write your own stamp text.",
    variations: [
      ["stamp-approved", "Approved", mark("stamp")],
      [
        "stamp-sold",
        "Sold out",
        mark("stamp", { label: "SOLD OUT", color: "#2a5bd7", angle: 8 }),
      ],
      [
        "stamp-new",
        "New",
        mark("stamp", { label: "NEW!", color: INK, angle: -18 }),
      ],
      [
        "ov-stamp-seal",
        "Round seal",
        mark("stamp", { variant: 1, label: "ORIGINAL", color: "#c0392b" }),
      ],
      [
        "ov-stamp-dated",
        "Dated",
        mark("stamp", { variant: 2, label: "RECEIVED", color: "#2a5bd7" }),
      ],
    ],
  },
  // ----------------------------------------------------------- Geometry
  card(
    "orbit",
    "Orbit rings",
    "Tilted rings orbit the element with satellites passing behind and in front of it.",
    [
      ["rings", "Ring", {}],
      ["atom", "Atom", { variant: 1, color: MINT, secondary: PAPER }],
      ["saturn", "Saturn", { variant: 2, color: "#e9d8a6", secondary: CORAL }],
      [
        "pair",
        "Two rings, dashed",
        { count: 2, stroke: "dashed", color: PAPER },
      ],
    ],
  ),
  card(
    "wireframe",
    "Wire solid",
    "A rotating wireframe solid beside the element: cube, octahedron, pyramid or icosahedron.",
    [
      ["cube", "Cube", {}],
      ["octa", "Octahedron", { variant: 1, color: PINK }],
      ["pyramid", "Pyramid", { variant: 2, color: SUN }],
      ["ico", "Icosahedron", { variant: 3, color: MINT, stroke: "neon" }],
    ],
  ),
  card(
    "polygons",
    "Nested polygons",
    "Concentric polygons turn slowly behind the element, each ring the other way.",
    [
      ["triangles", "Triangles", {}],
      ["squares", "Squares", { variant: 1, color: CORAL }],
      ["hex", "Hexagons", { variant: 2, color: MINT }],
      ["mixed", "Mixed", { variant: 3, count: 5, color: SUN }],
    ],
  ),
  card(
    "confetti",
    "Memphis confetti",
    "Squiggles, zigzags, triangles, rings and dots scattered round the element, bobbing and turning.",
    [
      ["memphis", "Memphis", {}],
      ["mono", "Mono", { variant: 1 }],
      ["pastel", "Pastel", { variant: 2, count: 18 }],
      ["beat", "On the beat", { loop: "pulse", tempo: 120, count: 16 }],
    ],
  ),
  card(
    "bauhaus",
    "Bauhaus shapes",
    "Big primary shapes — a disc, a half-moon, a triangle and a bar — slide in behind the element.",
    [
      ["primary", "Primary", {}],
      ["mono", "Mono", { variant: 1 }],
      ["warm", "Warm", { variant: 2 }],
      ["halftone", "Halftone", { fill: "halftone", density: 1.2 }],
    ],
  ),
  // ------------------------------------------------------------- Energy
  {
    id: "overlay-speedlines",
    name: "Speed lines",
    description:
      "Comic speed lines stream behind the element. The angle sets its direction of travel.",
    variations: [
      ["speed-right", "Rushing right", mark("speedlines")],
      ["speed-up", "Rising", mark("speedlines", { angle: -90 })],
      ["speed-dark", "Ink", mark("speedlines", { angle: 180, color: INK })],
      [
        "ov-speedlines-brush",
        "Brushed",
        mark("speedlines", { stroke: "brush", count: 7, weight: 1.5 }),
      ],
    ],
  },
  {
    id: "overlay-impact",
    name: "Impact burst",
    description:
      "Comic impact rays burst out behind the element and keep throbbing.",
    variations: [
      ["impact-yellow", "Yellow", mark("impact")],
      [
        "impact-red",
        "Red, many rays",
        mark("impact", { color: "#e8392f", count: 22 }),
      ],
      [
        "ov-impact-cloud",
        "Cloud",
        mark("impact", { variant: 1, color: PAPER }),
      ],
      [
        "ov-impact-double",
        "Double",
        mark("impact", { variant: 2, color: SUN, secondary: "#e8392f" }),
      ],
      [
        "ov-impact-halftone",
        "Halftone",
        mark("impact", { fill: "halftone", color: PINK, density: 1.3 }),
      ],
    ],
  },
  {
    id: "overlay-sparkle",
    name: "Sparkles",
    description: "Glints twinkle around the element.",
    variations: [
      ["sparkle-warm", "Warm", mark("sparkle")],
      [
        "sparkle-many",
        "Many, cool",
        mark("sparkle", { count: 12, color: "#c8f4ff", speed: 1.6 }),
      ],
      [
        "ov-sparkle-six",
        "Six-point",
        mark("sparkle", { variant: 1, count: 8, color: PINK }),
      ],
      [
        "ov-sparkle-plus",
        "Plus signs",
        mark("sparkle", { variant: 2, count: 10, color: PAPER }),
      ],
      [
        "ov-sparkle-neon",
        "Neon rings",
        mark("sparkle", { variant: 3, stroke: "neon", color: MINT }),
      ],
    ],
  },
  card(
    "shockwave",
    "Shockwave",
    "Rings ripple out from the element on every beat.",
    [
      ["rings", "Rings", {}],
      ["dashed", "Dashed", { variant: 1, color: MINT }],
      ["squares", "Squares", { variant: 2, color: SUN, tempo: 90 }],
      ["pulse", "Filled pulse", { variant: 3, color: CORAL, count: 1 }],
      ["neon", "Neon", { stroke: "neon", color: PINK, count: 2 }],
    ],
  ),
  card(
    "zap",
    "Lightning",
    "Jagged lightning crackles off the element, re-striking every few frames.",
    [
      ["bolts", "Bolts", {}],
      ["crackle", "Crackle", { variant: 1, count: 8 }],
      ["strike", "Single strike", { variant: 2, color: SUN }],
      ["ink", "Ink bolts", { stroke: "plain", color: INK, weight: 1.3 }],
    ],
  ),
  // --------------------------------------------------------- Atmosphere
  card(
    "glyphrain",
    "Letter rain",
    "The element's own letters fall in columns behind it, bright at the head and fading behind.",
    [
      ["columns", "Columns", {}],
      ["drift", "Drift", { variant: 1, color: PINK }],
      ["trail", "Single trail", { variant: 2, color: SUN }],
      [
        "serif",
        "Serif snow",
        { color: PAPER, font: "serif", speed: 0.4, strength: 0.5 },
      ],
    ],
  ),
  card(
    "letterburst",
    "Letter burst",
    "On every beat the element's letters fly out from it and fade.",
    [
      ["radial", "Radial", {}],
      ["fountain", "Fountain", { variant: 1, color: MINT }],
      ["sideways", "Sideways", { variant: 2, color: PINK, tempo: 80 }],
      ["hearts", "Hearts", { label: "♥♡", color: "#ff4d6d", font: "sans" }],
    ],
  ),
  card(
    "fireflies",
    "Fireflies",
    "Glowing specks drift around the element: fireflies, dust in a light beam, rising bubbles or snow.",
    [
      ["fireflies", "Fireflies", {}],
      ["dust", "Dust motes", { variant: 1, color: PAPER, count: 20 }],
      ["bubbles", "Bubbles", { variant: 2, color: "#bfe8ff" }],
      ["snow", "Snow", { variant: 3, color: PAPER, count: 18 }],
    ],
  ),
  // ------------------------------------------------------------ Connect
  card(
    "route",
    "Route line",
    "A dashed travel route curves in to the element with a marker riding along it.",
    [
      ["dot", "Dot", {}],
      ["plane", "Plane", { variant: 1, angle: 160 }],
      [
        "pulse",
        "Pulse at the end",
        { variant: 2, secondary: MINT, angle: -30 },
      ],
      ["dotted", "Dotted, sketched", { stroke: "pencil", color: SUN }],
    ],
  ),
  card(
    "mappin",
    "Map pin",
    "A map pin drops onto the element with a ripple where it lands, and an optional place name.",
    [
      ["pin", "Pin", {}],
      ["flag", "Flag", { variant: 1, color: SUN, label: "HERE" }],
      ["dot", "Pulsing dot", { variant: 2, color: "#2f8cff" }],
      ["named", "Named place", { label: "Tokyo", font: "serif" }],
    ],
  ),
  card(
    "thread",
    "Thread link",
    "A line links the element to the nearest other element on screen — a sagging thread, a dotted line or a leader with an arrow.",
    [
      ["thread", "Thread", {}],
      ["dotted", "Dotted", { variant: 1, color: SUN }],
      ["leader", "Leader", { variant: 2, color: BLUEPRINT }],
      [
        "red",
        "Red string",
        { color: "#e8392f", weight: 1.2, stroke: "pencil" },
      ],
    ],
  ),
  // ---------------------------------------------------- Exits that mark
  {
    id: "exit-crossout",
    name: "Cross out",
    description:
      "Exit: a pen line strikes through every line of the element, then it fades away.",
    variations: [
      [
        "crossout-red",
        "Red pen",
        {
          ...mark("strike", { anchor: "lines", timing: "out", seconds: 1 }),
          channels: [fadeOut(0.35)],
        },
      ],
      [
        "crossout-double",
        "Double",
        {
          ...mark("strike", {
            anchor: "lines",
            timing: "out",
            seconds: 1,
            count: 2,
            color: PAPER,
          }),
          channels: [fadeOut(0.35)],
        },
      ],
      [
        "ov-crossout-scribble",
        "Scribbled out",
        {
          ...mark("scribble", { timing: "out", seconds: 1, color: CORAL }),
          channels: [fadeOut(0.35)],
        },
      ],
    ],
  },
];
