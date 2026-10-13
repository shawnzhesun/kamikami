import React from "react";
import {
  lineOverlays,
  overlayControls,
  overlaySpecs,
  overlayVariants,
  type Overlay,
} from "../overlays";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

const numbers = [
  ["pad", 0, 10, 0.05],
  ["size", 0.1, 5, 0.05],
  ["weight", 0.1, 5, 0.05],
  ["angle", -360, 360, 1],
  ["count", 1, 24, 1],
  ["seconds", 0.02, 30, 0.01],
  ["speed", 0, 60, 0.1],
  ["tempo", 30, 240, 1],
  ["wobble", 0, 1, 0.05],
  ["boil", 0, 24, 1],
  ["strength", 0, 1, 0.05],
] as const;

const strokeNames: Record<Overlay["stroke"], string> = {
  plain: "Plain",
  marker: "Marker",
  pencil: "Pencil",
  sketch: "Sketch (rough pen)",
  brush: "Brush (tapered)",
  chalk: "Chalk",
  dashed: "Dashed",
  dotted: "Dotted",
  double: "Double line",
  neon: "Neon glow",
};
const fillNames: Record<Overlay["fill"], string> = {
  auto: "As designed",
  none: "Outline only",
  solid: "Solid",
  hatch: "Hatching",
  crosshatch: "Cross-hatching",
  zigzag: "Zigzag",
  dots: "Dots",
  halftone: "Halftone",
};
const entranceNames: Record<Overlay["enter"], string> = {
  draw: "Draw on",
  fade: "Fade",
  pop: "Pop",
  zoom: "Zoom",
  drop: "Drop",
  slide: "Slide",
  wipe: "Wipe",
  flicker: "Flicker",
};
const loopNames: Record<Overlay["loop"], string> = {
  none: "None",
  pulse: "Pulse on the beat",
  spin: "Spin",
  sway: "Sway",
  bob: "Bob",
  breathe: "Breathe",
  flicker: "Flicker",
  jitter: "Jitter",
};
const fontNames: Record<Overlay["font"], string> = {
  auto: "As designed",
  mono: "Monospace",
  sans: "Sans",
  serif: "Serif",
  hand: "Handwritten",
  element: "The element's font",
};
const options = <K extends string>(names: Record<K, string>) =>
  (Object.keys(names) as K[]).map((value) => ({ value, label: names[value] }));

/** Settings for overlays: the kind's own shape settings, then shared styles. */
export function OverlayControls({
  overlay,
  onChange,
}: {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
}) {
  const c = overlayControls[overlay.kind];
  const spec = overlaySpecs[overlay.kind];
  const variants = overlayVariants[overlay.kind];
  const select = <K extends keyof Overlay>(
    field: K,
    label: string,
    names: Record<string, string>,
  ) => (
    <label key={field}>
      {label}
      <Dropdown
        label={`Overlay ${label.toLowerCase()}`}
        value={String(overlay[field])}
        options={options(names)}
        onChange={(value) => onChange({ [field]: value } as Partial<Overlay>)}
      />
    </label>
  );
  const number = (
    field: keyof Overlay,
    label: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <NumberField
      key={field}
      label={label}
      value={overlay[field] as number}
      min={min}
      max={max}
      step={step}
      onChange={(value) => onChange({ [field]: value })}
    />
  );
  return (
    <>
      {variants.length > 1 && (
        <label>
          {c.variant ?? "Shape"}
          <Dropdown
            label="Overlay shape"
            value={String(overlay.variant)}
            options={variants.map((name, i) => ({
              value: String(i),
              label: name,
            }))}
            onChange={(value) => onChange({ variant: Number(value) })}
          />
        </label>
      )}
      {c.timing && (
        <label>
          {c.timing}
          <Dropdown
            label="Overlay timing"
            value={overlay.timing}
            options={[
              { value: "envelope", label: "On at the start, off at the end" },
              { value: "in", label: "On at the start" },
              { value: "out", label: "On at the end" },
              { value: "constant", label: "Always shown" },
            ]}
            onChange={(timing) =>
              onChange({ timing: timing as Overlay["timing"] })
            }
          />
        </label>
      )}
      {c.anchor && (
        <label>
          {c.anchor}
          <Dropdown
            label="Overlay anchor"
            value={overlay.anchor}
            options={[
              { value: "block", label: "The whole element" },
              { value: "keyword", label: "The key word (text)" },
              {
                value: "lines",
                label: lineOverlays.includes(overlay.kind)
                  ? "Each line (text)"
                  : "Each line, in turn (text)",
              },
              { value: "words", label: "Each word, in turn (text)" },
              { value: "initial", label: "The first letter (text)" },
            ]}
            onChange={(anchor) =>
              onChange({ anchor: anchor as Overlay["anchor"] })
            }
          />
        </label>
      )}
      {c.placement && (
        <label>
          {c.placement}
          <Dropdown
            label="Overlay side"
            value={overlay.placement}
            options={[
              { value: "auto", label: "Most free space" },
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            onChange={(placement) =>
              onChange({ placement: placement as Overlay["placement"] })
            }
          />
        </label>
      )}
      {numbers.map(([field, min, max, step]) =>
        c[field] ? (
          <NumberField
            key={field}
            label={c[field]!}
            value={overlay[field]}
            min={min}
            max={max}
            step={step}
            onChange={(value) =>
              onChange({
                [field]: field === "count" ? Math.round(value) : value,
              })
            }
          />
        ) : null,
      )}
      {c.label && (
        <label>
          {c.label}
          <input
            value={overlay.label ?? ""}
            maxLength={60}
            placeholder="Empty uses the default; {time}, {w}, {word}… fill in"
            onChange={(event) =>
              onChange({ label: event.target.value || undefined })
            }
          />
        </label>
      )}
      {c.font && select("font", c.font, fontNames)}
      {c.color && (
        <label>
          {c.color}
          <input
            type="color"
            value={overlay.color}
            onChange={(event) => onChange({ color: event.target.value })}
          />
        </label>
      )}
      {c.secondary && (
        <label>
          {c.secondary}
          <input
            type="color"
            value={overlay.secondary}
            onChange={(event) => onChange({ secondary: event.target.value })}
          />
        </label>
      )}
      <h4 className="overlay-group">Style</h4>
      {select("stroke", "Line style", strokeNames)}
      {(overlay.stroke === "pencil" || overlay.stroke === "sketch") &&
        number("roughness", "Roughness", 0, 3, 0.1)}
      {spec.fills && select("fill", "Fill", fillNames)}
      {spec.fills && overlay.fill !== "auto" && overlay.fill !== "none" && (
        <>
          <label>
            Fill color
            <input
              type="color"
              value={overlay.fillColor ?? overlay.color}
              onChange={(event) => onChange({ fillColor: event.target.value })}
            />
          </label>
          {number("fillOpacity", "Fill opacity", 0, 1, 0.05)}
          {overlay.fill !== "solid" &&
            number("density", "Pattern density", 0.2, 4, 0.1)}
        </>
      )}
      {number("shadow", "Shadow", 0, 1, 0.05)}
      {select("blend", "Blend", {
        auto: "As designed",
        normal: "Normal",
        multiply: "Multiply",
        screen: "Screen",
        overlay: "Overlay",
        difference: "Difference",
      })}
      {!c.font && select("font", "Label font", fontNames)}
      <label className="check">
        <input
          type="checkbox"
          checked={overlay.caps}
          onChange={(event) => onChange({ caps: event.target.checked })}
        />
        Capitals in labels
      </label>
      <h4 className="overlay-group">Motion</h4>
      {select("enter", "Entrance", entranceNames)}
      {select("exit", "Exit", {
        match: "Entrance, reversed",
        ...entranceNames,
      })}
      {select("loop", "Loop", loopNames)}
      {overlay.loop !== "none" && (
        <>
          {!c.tempo && number("tempo", "Tempo (BPM)", 30, 240, 1)}
          {number("loopDepth", "Loop depth", 0, 1, 0.05)}
        </>
      )}
      {(overlay.anchor === "words" || overlay.anchor === "lines") &&
        number("stagger", "Stagger", 0, 1, 0.05)}
      <h4 className="overlay-group">Placement</h4>
      {select("layer", "Layer", {
        auto: "As designed",
        behind: "Behind the element",
        front: "In front",
      })}
      {number("offsetX", "Nudge X", -40, 40, 0.1)}
      {number("offsetY", "Nudge Y", -40, 40, 0.1)}
      {number("rotate", "Rotate (degrees)", -180, 180, 1)}
      <label className="check">
        <input
          type="checkbox"
          checked={overlay.mirror}
          onChange={(event) => onChange({ mirror: event.target.checked })}
        />
        Mirror
      </label>
    </>
  );
}
