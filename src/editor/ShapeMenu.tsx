import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { DropdownPanel } from "./Dropdown";
import {
  shapeColors,
  shapePath,
  shapePresets,
  type ShapePreset,
} from "../shapes";

/** A small preview of a preset, drawn with the same path as the composition. */
export function ShapeIcon({
  preset,
  color,
  size = 30,
}: {
  preset: ShapePreset;
  color: string;
  size?: number;
}) {
  const { shape } = preset;
  const outline = shape.stroke ? (shape.strokeWidth ?? 0) : 0;
  const pad = outline / 2;
  // Thin shapes (lines) keep a visible thickness in the icon.
  const height = Math.max(shape.height, shape.width * 0.06);
  const box = Math.max(shape.width, height) + outline;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-pad - (box - outline - shape.width) / 2} ${-pad - (box - outline - height) / 2} ${box} ${box}`}
      aria-hidden="true"
    >
      <path
        d={shapePath({ ...shape, height })}
        fill={shape.filled === false ? "none" : color}
        stroke={outline ? color : "none"}
        strokeWidth={outline}
      />
    </svg>
  );
}

export function ShapeMenu({
  onAdd,
}: {
  onAdd: (preset: ShapePreset, color: string) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(
    () => localStorage.getItem("kamikami-shape-color") ?? shapeColors[2],
  );
  const pick = (value: string) => {
    setColor(value);
    localStorage.setItem("kamikami-shape-color", value);
  };
  return (
    <>
      <button
        ref={anchor}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Add a shape to the selected layer"
        onClick={() => setOpen(!open)}
      >
        <Plus size={13} />
        Shape
      </button>
      {open && (
        <DropdownPanel
          anchor={anchor}
          onClose={() => setOpen(false)}
          width={292}
          className="shape-menu"
          role="dialog"
          label="Add shape"
        >
          <div className="shape-menu-title">Shapes</div>
          <div className="shape-grid">
            {shapePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={`Add ${preset.label.toLowerCase()}`}
                onClick={() => {
                  onAdd(preset, color);
                  setOpen(false);
                }}
              >
                <ShapeIcon preset={preset} color={color} />
              </button>
            ))}
          </div>
          <div className="shape-menu-title">Color</div>
          <div className="shape-swatches" role="radiogroup" aria-label="Color">
            {shapeColors.map((swatch) => (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={swatch === color}
                aria-label={swatch}
                style={{ background: swatch }}
                onClick={() => pick(swatch)}
              />
            ))}
            <label className="shape-custom-color" title="Custom color">
              <input
                type="color"
                value={color}
                aria-label="Custom color"
                onChange={(e) => pick(e.target.value)}
              />
            </label>
          </div>
        </DropdownPanel>
      )}
    </>
  );
}
