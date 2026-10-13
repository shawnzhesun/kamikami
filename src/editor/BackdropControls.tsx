import React from "react";
import type { Layer } from "../model";
import {
  backdropKinds,
  backdropNames,
  blendModes,
  type Backdrop,
  type BackdropKind,
} from "../backdrops";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

const blendNames: Record<Backdrop["blend"], string> = {
  normal: "Normal",
  screen: "Screen (lighten)",
  multiply: "Multiply (darken)",
  overlay: "Overlay",
  "soft-light": "Soft light",
};
/** Inspector fields for a backdrop element. */
export function BackdropControls({
  layer,
  onChange,
}: {
  layer: Layer;
  onChange: (patch: Partial<Backdrop>, group?: string) => void;
}) {
  const b = layer.backdrop!;
  const color = (key: "color" | "secondary" | "accent", label: string) => (
    <label>
      {label}
      <input
        type="color"
        aria-label={label}
        value={b[key]}
        onChange={(e) =>
          onChange({ [key]: e.target.value }, `backdrop:${layer.id}:${key}`)
        }
      />
    </label>
  );
  return (
    <>
      <div className="section-line">
        <span>BACKDROP</span>
      </div>
      <label>
        Pattern
        <Dropdown
          label="Backdrop pattern"
          value={b.kind}
          onChange={(kind) => onChange({ kind: kind as BackdropKind })}
          options={backdropKinds.map((kind) => ({
            value: kind,
            label: backdropNames[kind],
          }))}
        />
      </label>
      <div className="field-row shape-paint">
        {color("color", "Base")}
        {color("secondary", "Pattern")}
        {color("accent", "Accent")}
      </div>
      <div className="field-row">
        <NumberField
          label="Amount"
          value={b.density}
          min={0}
          max={1}
          step={0.05}
          onChange={(density) => onChange({ density })}
        />
        <NumberField
          label="Speed"
          value={b.speed}
          min={0}
          max={10}
          step={0.1}
          onChange={(speed) => onChange({ speed })}
        />
      </div>
      <NumberField
        label="Angle (degrees)"
        value={b.angle}
        min={-180}
        max={180}
        onChange={(angle) => onChange({ angle })}
      />
      <label>
        Blend with layers below
        <Dropdown
          label="Backdrop blend"
          value={b.blend}
          onChange={(blend) => onChange({ blend: blend as Backdrop["blend"] })}
          options={blendModes.map((mode) => ({
            value: mode,
            label: blendNames[mode],
          }))}
        />
      </label>
      {b.kind === "ticker" && (
        <label>
          Wall text
          <input
            value={b.text ?? ""}
            maxLength={200}
            onChange={(e) =>
              onChange({ text: e.target.value }, `backdrop:${layer.id}:text`)
            }
          />
        </label>
      )}
    </>
  );
}
