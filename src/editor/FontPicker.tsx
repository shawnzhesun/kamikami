import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, Star, Upload, X } from "lucide-react";
import { Dropdown, DropdownPanel } from "./Dropdown";
import {
  builtinFonts,
  fontCategories,
  fontChoice,
  fontCSS,
  fontWeights,
  resolveFont,
  weightNames,
  type AvailableFont,
  type FontAsset,
  type FontStyle,
} from "../font-assets";
import {
  DEFAULT_FONT,
  fontFamilies,
  fontStack,
  type FontFamily,
} from "../fonts";
import {
  FONT_IMPORT_EVENT,
  loadFontAsset,
  validateFontFile,
} from "../font-loading";
import { api } from "../media";
import type { Layer, Project } from "../model";

type Choice = {
  id: string;
  name: string;
  category: string;
  font?: AvailableFont;
  system?: FontFamily;
};
function readPreference(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string").slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
function FontOption({
  choice,
  text,
  selected,
  favorite,
  onFavorite,
  onSelect,
  disabled,
}: {
  choice: Choice;
  text: string;
  selected: boolean;
  favorite: boolean;
  onFavorite: () => void;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [status, setStatus] = useState(choice.font ? "loading" : "ready");
  const defaults = choice.font ? fontChoice(choice.font) : null;
  useEffect(() => {
    let active = true;
    if (choice.font && defaults) {
      loadFontAsset(choice.font, defaults.fontWeight, defaults.fontStyle).then(
        () => {
          if (active) setStatus("ready");
        },
        () => {
          if (active) setStatus("error");
        },
      );
    }
    return () => {
      active = false;
    };
  }, [choice.font]);
  return (
    <div className={`font-option ${selected ? "is-selected" : ""}`}>
      <button
        type="button"
        className="font-option-select"
        aria-label={`Use ${choice.name}`}
        aria-pressed={selected}
        disabled={disabled || status !== "ready"}
        onClick={onSelect}
      >
        <span className="font-option-meta">
          <strong>{choice.name}</strong>
          <small>{choice.category}</small>
          {selected && <Check size={14} />}
        </span>
        <span
          className="font-option-preview"
          style={{
            fontFamily:
              choice.font && defaults
                ? fontCSS(choice.font, defaults.fontWeight, defaults.fontStyle)
                : fontStack(choice.system),
            fontWeight: defaults?.fontWeight ?? 400,
            fontStyle: defaults?.fontStyle,
          }}
        >
          {status === "error"
            ? "Unavailable · reimport this font"
            : status === "loading"
              ? "Loading preview…"
              : text.replace(/\s+/g, " ").slice(0, 100) ||
                "Your story starts here"}
        </span>
      </button>
      <button
        type="button"
        className="font-favorite"
        aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${choice.name}`}
        aria-pressed={favorite}
        onClick={onFavorite}
      >
        <Star size={15} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function FontPicker({
  layer,
  project,
  onChange,
}: {
  layer: Layer;
  project: Project;
  onChange: (patch: Partial<Layer>, font?: FontAsset) => boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const mounted = useRef(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All fonts");
  const [imported, setImported] = useState<AvailableFont[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fontError, setFontError] = useState("");
  const [favorites, setFavorites] = useState(() =>
    readPreference("kamikami-favorite-fonts"),
  );
  const [recent, setRecent] = useState(() =>
    readPreference("kamikami-recent-fonts"),
  );
  const selected = resolveFont(layer.fontId, project.fonts);
  const selectedId =
    layer.fontId ?? `system-${layer.fontFamily ?? DEFAULT_FONT}`;
  const name = selected?.family ?? layer.fontFamily ?? DEFAULT_FONT;
  const weight = layer.fontWeight ?? 800,
    style = layer.fontStyle ?? "normal";
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    let active = true;
    api("/api/fonts")
      .then((fonts) => {
        if (!Array.isArray(fonts))
          throw new Error("Could not read the font library");
        if (active) setImported(fonts);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [open]);
  useEffect(() => {
    let active = true;
    setFontError("");
    if (selected)
      loadFontAsset(selected, weight, style).catch((e) => {
        if (active) setFontError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected, weight, style]);
  const custom = new Map(
    (project.fonts ?? []).map((f) => [f.id, f as AvailableFont]),
  );
  imported.forEach((f) => custom.set(f.id, f));
  const choices: Choice[] = [
    ...builtinFonts.map((f) => ({
      id: f.id,
      name: f.family,
      category: f.category,
      font: f,
    })),
    ...[...custom.values()].map((f) => ({
      id: f.id,
      name: f.family,
      category: "Imported",
      font: f,
    })),
    ...fontFamilies.map((f) => ({
      id: `system-${f}`,
      name: f,
      category: "System",
      system: f,
    })),
  ];
  const visible = choices
    .filter(
      (c) =>
        (!query || c.name.toLowerCase().includes(query.toLowerCase())) &&
        (category === "All fonts" ||
          category === c.category ||
          category === c.font?.category ||
          (category === "Favorites" && favorites.includes(c.id)) ||
          (category === "Recent" && recent.includes(c.id))),
    )
    .sort((a, b) =>
      category === "Recent"
        ? recent.indexOf(a.id) - recent.indexOf(b.id)
        : a.name.localeCompare(b.name),
    );
  function preference(
    key: string,
    values: string[],
    set: (v: string[]) => void,
  ) {
    set(values);
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch {
      setError("Your font preferences could not be saved on this device.");
    }
  }
  function choose(choice: Choice) {
    const success = choice.font
      ? onChange(fontChoice(choice.font, weight, style), choice.font)
      : onChange({
          fontId: undefined,
          fontFamily: choice.system,
          fontWeight: weight,
          fontStyle: style,
        });
    if (!success) {
      setError("Could not apply the font. The element may have changed.");
      return;
    }
    preference(
      "kamikami-recent-fonts",
      [choice.id, ...recent.filter((id) => id !== choice.id)].slice(0, 12),
      setRecent,
    );
    setOpen(false);
    trigger.current?.focus();
  }
  async function importFiles(files: File[]) {
    setBusy(true);
    setError("");
    try {
      let last: FontAsset | undefined;
      for (const item of files) {
        await validateFontFile(item);
        const form = new FormData();
        form.append("file", item);
        last = await api("/api/fonts/import", "POST", form);
        if (!mounted.current) return;
        const saved = last!;
        setImported((prev) => [
          ...prev.filter((f) => f.id !== saved.id),
          saved,
        ]);
      }
      if (last && mounted.current) {
        const defaults = fontChoice(last, weight, style);
        await loadFontAsset(last, defaults.fontWeight, defaults.fontStyle);
        if (mounted.current) {
          setFontError("");
          window.dispatchEvent(
            new CustomEvent(FONT_IMPORT_EVENT, { detail: last.id }),
          );
          choose({
            id: last.id,
            name: last.family,
            category: "Imported",
            font: last,
          });
        }
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const weights = selected
    ? fontWeights(selected, style)
    : [100, 200, 300, 400, 500, 600, 700, 800, 900];
  if (!weights.includes(weight)) weights.push(weight);
  const styles = selected
    ? [...new Set(selected.variants.map((v) => v.style))]
    : (["normal", "italic"] as FontStyle[]);
  return (
    <div className="font-inspector">
      <span className="font-field-label">Font</span>
      <button
        ref={trigger}
        type="button"
        className="dropdown-trigger font-trigger"
        aria-label="Font family"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          style={{
            fontFamily: selected
              ? fontCSS(selected, weight, style)
              : fontStack(layer.fontFamily),
            fontWeight: weight,
            fontStyle: style,
          }}
        >
          {name}
        </span>
        <ChevronDown size={15} />
      </button>
      {fontError && (
        <p role="alert" className="field-error">
          {fontError}
        </p>
      )}
      <div className="field-row font-face-controls">
        <label>
          Weight
          <Dropdown
            label="Font weight"
            value={String(weight)}
            options={weights
              .sort((a, b) => a - b)
              .map((w) => ({
                value: String(w),
                label: weightNames[w] ?? String(w),
              }))}
            onChange={(v) => onChange({ fontWeight: Number(v) })}
          />
        </label>
        <label>
          Style
          <Dropdown
            label="Font style"
            value={style}
            options={styles.map((s) => ({
              value: s,
              label: s === "normal" ? "Normal" : "Italic",
            }))}
            onChange={(s) =>
              onChange(
                selected
                  ? fontChoice(selected, weight, s as FontStyle)
                  : { fontStyle: s as FontStyle },
              )
            }
          />
        </label>
      </div>
      {open && (
        <DropdownPanel
          anchor={trigger}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          width={420}
          className="font-picker"
          role="dialog"
          label="Choose font"
          id={panelId}
        >
          <div className="font-picker-heading">
            <strong>Choose font</strong>
            <button
              type="button"
              aria-label="Close font picker"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="font-search">
            <Search size={16} />
            <input
              ref={search}
              aria-label="Search fonts"
              placeholder="Search fonts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="font-picker-filters">
            <Dropdown
              label="Font category"
              value={category}
              onChange={setCategory}
              options={[
                "All fonts",
                "Favorites",
                "Recent",
                ...fontCategories,
                "Imported",
                "System",
              ].map((c) => ({ value: c, label: c }))}
            />
            <span>{visible.length} fonts</span>
          </div>
          <div
            className="font-options"
            aria-label="Font previews"
            onKeyDown={(e) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const buttons = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  ".font-option-select:not(:disabled)",
                ),
              ];
              const i = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? buttons.length - 1
                    : (i + (e.key === "ArrowUp" ? -1 : 1) + buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            }}
          >
            {visible.map((c) => (
              <FontOption
                key={c.id + JSON.stringify(c.font?.variants)}
                choice={c}
                text={layer.text}
                selected={selectedId === c.id}
                favorite={favorites.includes(c.id)}
                disabled={busy}
                onSelect={() => choose(c)}
                onFavorite={() =>
                  preference(
                    "kamikami-favorite-fonts",
                    favorites.includes(c.id)
                      ? favorites.filter((id) => id !== c.id)
                      : [...favorites, c.id],
                    setFavorites,
                  )
                }
              />
            ))}
            {!visible.length && (
              <p className="dropdown-empty">
                {category === "Favorites"
                  ? "Star a font to find it here."
                  : category === "Handwriting"
                    ? "Import a handwriting font to add your own style."
                    : "No matching fonts. Try another search or category."}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="font-picker-footer">
            <input
              ref={file}
              hidden
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              multiple
              aria-label="Import font files"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (files.length) void importFiles(files);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <Upload size={15} />
              {busy ? "Importing…" : "Import font…"}
            </button>
            <small>TTF, OTF, WOFF, WOFF2 · 20 MB per file</small>
          </div>
        </DropdownPanel>
      )}
    </div>
  );
}
