import React from "react";
import { elementBlends, type ElementBlend } from "../model";
import { Dropdown } from "./Dropdown";

const blendNames: Record<ElementBlend, string> = {
  normal: "Normal",
  multiply: "Multiply (darken, like ink)",
  screen: "Screen (lighten, like light)",
  overlay: "Overlay (contrast)",
  "soft-light": "Soft light",
  "hard-light": "Hard light",
  darken: "Darken (keep the darker)",
  lighten: "Lighten (keep the lighter)",
  "color-dodge": "Color dodge (burn out light)",
  "color-burn": "Color burn (deepen darks)",
  difference: "Difference (inverse ink)",
  exclusion: "Exclusion (soft inverse)",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color (tint below)",
  luminosity: "Luminosity",
};
/** How an element mixes with the tracks below it. */
export function BlendField({
  value,
  onChange,
}: {
  value: ElementBlend | undefined;
  onChange: (blend: ElementBlend | undefined) => void;
}) {
  return (
    <label>
      Blend with layers below
      <Dropdown
        label="Blend"
        value={value ?? "normal"}
        onChange={(blend) =>
          onChange(blend === "normal" ? undefined : (blend as ElementBlend))
        }
        options={elementBlends.map((mode) => ({
          value: mode,
          label: blendNames[mode],
        }))}
      />
    </label>
  );
}
