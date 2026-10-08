import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getEffectFamily, effectVariationPatch } from "../builtin-effects";
import type { Effect } from "../model";
import { DropdownPanel } from "./Dropdown";
import {
  EffectSample,
  effectPosterTime,
  isTextEffectPreview,
} from "./EffectSample";

/** Presets are actions that replace parameters, not a mode bound to the draft. */
export function EffectPresetPicker({
  effect,
  onChange,
}: {
  effect: Effect;
  onChange: (patch: Partial<Effect>) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const family = getEffectFamily(effect.presetFamilyId ?? effect.id);
  useEffect(() => {
    if (open)
      content.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);
  if (!family) return null;
  return (
    <div className="effect-preset-picker">
      <span>Preset</span>
      <button
        ref={anchor}
        type="button"
        className="dropdown-trigger"
        aria-label={`${family.name} presets`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Choose a preset… <ChevronDown size={15} aria-hidden="true" />
      </button>
      <small className="muted">
        Replaces the current parameters. Continue adjusting them below.
      </small>
      {open && (
        <DropdownPanel
          anchor={anchor}
          onClose={() => setOpen(false)}
          width={420}
          role="dialog"
          label={`${family.name} presets`}
        >
          <div ref={content} className="effect-preset-grid">
            {family.variations.map((preset) => {
              const patch = effectVariationPatch(effect, preset.id)!;
              const sample = { ...effect, ...patch };
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="effect-preset-option"
                  onClick={() => {
                    onChange(patch);
                    setOpen(false);
                    anchor.current?.focus();
                  }}
                >
                  <span
                    className={`effect-sample ${isTextEffectPreview(sample) ? "is-text" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="effect-sample-art">
                      <EffectSample
                        effect={sample}
                        time={effectPosterTime(sample)}
                      />
                    </span>
                  </span>
                  <strong>{preset.name}</strong>
                </button>
              );
            })}
          </div>
        </DropdownPanel>
      )}
    </div>
  );
}
