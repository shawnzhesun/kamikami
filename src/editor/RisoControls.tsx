import React from "react";
import type { VisualPass } from "../visual-effects";
import { risoInks } from "../PrintGraphicEffects";
import { Dropdown } from "./Dropdown";
import { NumberField } from "./NumberField";

/** Riso inks are typical spot colors: fluorescent pink, blue, yellow… */
const nextInk = ["#ff48b0", "#0078bf", "#ffe800"];

/** Settings the riso print pass adds: its inks, paper and press faults. */
export function RisoControls({
  pass,
  onChange,
}: {
  pass: VisualPass;
  onChange: (patch: Partial<VisualPass>) => void;
}) {
  const inks = risoInks(pass);
  return (
    <>
      <div className="field-row shape-paint">
        {inks.map((ink, i) => (
          <label key={i}>
            Ink {i + 1}
            <input
              type="color"
              aria-label={`Ink ${i + 1}`}
              value={ink}
              onChange={(e) =>
                onChange({
                  risoInks: inks.map((v, k) => (k === i ? e.target.value : v)),
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="field-row">
        {inks.length < 3 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                risoInks: [
                  ...inks,
                  nextInk.find((c) => !inks.includes(c)) ?? "#00a95c",
                ],
              })
            }
          >
            Add ink
          </button>
        )}
        {inks.length > 1 && (
          <button
            type="button"
            onClick={() => onChange({ risoInks: inks.slice(0, -1) })}
          >
            Remove ink {inks.length}
          </button>
        )}
      </div>
      <label>
        Paper
        <Dropdown
          label="Riso paper"
          value={pass.risoPaper ?? "paper"}
          onChange={(value) =>
            onChange({ risoPaper: value as VisualPass["risoPaper"] })
          }
          options={[
            { value: "paper", label: "Printed on paper" },
            { value: "clear", label: "Inks only (for text)" },
          ]}
        />
      </label>
      <NumberField
        label="Misregistration"
        value={pass.registration ?? 0.35}
        min={0}
        max={1}
        step={0.01}
        onChange={(registration) => onChange({ registration })}
      />
      <NumberField
        label="Ink grain"
        value={pass.inkGrain ?? 0.3}
        min={0}
        max={1}
        step={0.01}
        onChange={(inkGrain) => onChange({ inkGrain })}
      />
    </>
  );
}
