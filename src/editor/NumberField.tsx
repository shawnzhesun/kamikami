import React, { useId, useState, useRef, useEffect } from "react";
import { validateNumericDraft } from "../editor-utils";

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void | boolean;
}) {
  const errorId = useId();
  const format = (n: number) => String(Number(n.toFixed(3)));
  const [draft, setDraft] = useState(format(value));
  const [error, setError] = useState("");
  const dirty = useRef(false);
  useEffect(() => {
    setDraft(format(value));
    setError("");
    dirty.current = false;
  }, [value]);
  const apply = () => {
    // Display rounding must never change an untouched, frame-aligned value.
    if (!dirty.current) return;
    const result = validateNumericDraft(draft, min, max);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    dirty.current = false;
    const n = result.value!;
    if (n !== value && onChange(n) === false) setDraft(format(value));
    else setDraft(format(n));
  };
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
          setError("");
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const result = validateNumericDraft(draft, min, max);
            if (result.error) setError(result.error);
            else e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            dirty.current = false;
            setDraft(format(value));
            setError("");
          }
        }}
      />
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error} Escape restores {format(value)}.
        </span>
      )}
    </label>
  );
}
