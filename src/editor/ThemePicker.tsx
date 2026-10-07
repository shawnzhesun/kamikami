import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Palette } from "lucide-react";
import { SettingsDialog } from "./SettingsDialogs";
import {
  applyTheme,
  readTheme,
  resolveTheme,
  themes,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "../themes";

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(readTheme);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const id = resolveTheme(event.newValue);
      applyTheme(id);
      setSelected(id);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function choose(id: ThemeId) {
    applyTheme(id);
    setSelected(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  return (
    <>
      <button
        title="Choose app theme"
        aria-label="Choose app theme"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Palette size={17} />
      </button>
      {open &&
        createPortal(
          <SettingsDialog title="App theme" onClose={() => setOpen(false)}>
            <fieldset className="theme-options">
              <legend className="theme-intro">Choose your colors</legend>
              {themes.map((theme) => (
                <label
                  key={theme.id}
                  className={`theme-option ${selected === theme.id ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="app-theme"
                    value={theme.id}
                    checked={selected === theme.id}
                    onChange={() => choose(theme.id)}
                    autoFocus={selected === theme.id}
                    aria-label={`Theme ${theme.number} — ${theme.name}`}
                  />
                  <span className="theme-swatches" aria-hidden="true">
                    {theme.colors.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="theme-option-title">
                    <strong>{theme.name}</strong>
                    <span aria-hidden="true">
                      {selected === theme.id ? (
                        <Check size={15} />
                      ) : (
                        `0${theme.number}`
                      )}
                    </span>
                  </span>
                  <span className="theme-description">{theme.description}</span>
                </label>
              ))}
            </fieldset>
            {storageError && (
              <p role="status">
                Theme applied for this session. Your browser could not save the
                preference.
              </p>
            )}
            <div className="dialog-actions">
              <button className="primary" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </SettingsDialog>,
          document.body,
        )}
    </>
  );
}
