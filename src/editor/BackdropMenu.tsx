import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { DropdownPanel } from "./Dropdown";
import {
  backdropPresets,
  isFinishKind,
  type BackdropPreset,
} from "../backdrops";
import { BackdropArt } from "../BackdropArt";

/** A live thumbnail of a backdrop at a fixed moment. */
function BackdropThumb({ preset }: { preset: BackdropPreset }) {
  const finish = isFinishKind(preset.backdrop.kind);
  return (
    <span
      className="backdrop-thumb"
      style={finish ? { background: "#6b7a8f" } : undefined}
      aria-hidden="true"
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 480,
          height: 270,
          transform: "scale(0.225)",
          transformOrigin: "0 0",
          mixBlendMode: finish ? (preset.backdrop.blend as never) : undefined,
        }}
      >
        <BackdropArt
          backdrop={preset.backdrop}
          t={1.5}
          width={480}
          height={270}
          id={`thumb-${preset.id}`}
        />
      </span>
    </span>
  );
}

export function BackdropMenu({
  onAdd,
}: {
  onAdd: (preset: BackdropPreset) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const group = (finish: boolean) =>
    backdropPresets.filter((p) => isFinishKind(p.backdrop.kind) === finish);
  const grid = (presets: BackdropPreset[]) => (
    <div className="backdrop-grid">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          title={preset.label}
          aria-label={`Add ${preset.label.toLowerCase()}`}
          onClick={() => {
            onAdd(preset);
            setOpen(false);
          }}
        >
          <BackdropThumb preset={preset} />
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <button
        ref={anchor}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Add a full-frame background or finishing overlay"
        onClick={() => setOpen(!open)}
      >
        <Plus size={13} />
        Backdrop
      </button>
      {open && (
        <DropdownPanel
          anchor={anchor}
          onClose={() => setOpen(false)}
          width={360}
          className="shape-menu backdrop-menu"
          role="dialog"
          label="Add backdrop"
        >
          <div className="shape-menu-title">Backgrounds · under everything</div>
          {grid(group(false))}
          <div className="shape-menu-title">Finishes · over everything</div>
          {grid(group(true))}
        </DropdownPanel>
      )}
    </>
  );
}
