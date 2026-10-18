import React, { useMemo, useState } from "react";
import { z } from "zod";
import { FileDown, Trash2 } from "lucide-react";
import {
  makeEffectPack,
  packFileName,
  parseEffectFile,
  type EffectPack,
  type PackInfo,
  type UserEffect,
} from "../effect-bundle";
import { LIMITS } from "../model";
import { SettingsDialog } from "./SettingsDialogs";

/** Saves a pack through the browser's download (a save dialog in the app). */
export function downloadPack(pack: EffectPack) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = packFileName(pack);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const readable = (e: unknown) =>
  e instanceof z.ZodError
    ? e.issues
        .slice(0, 3)
        .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
        .join("; ")
    : e instanceof SyntaxError
      ? "it isn't valid JSON"
      : (e as Error).message;

/**
 * Reads effect files picked by the user, checking each before upload so a
 * bad file gets a sentence naming it instead of a schema dump.
 */
export async function readEffectFiles(files: File[]) {
  const ok: unknown[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("it's larger than 2 MB");
      const data = JSON.parse(await file.text());
      parseEffectFile(data);
      ok.push(data);
    } catch (e) {
      errors.push(`${file.name}: ${readable(e)}`);
    }
  }
  return { ok, errors };
}

type Group = { key: string; title: string; entries: UserEffect[] };
/** My effects first, then each imported pack, then single imports. */
export function effectGroups(entries: UserEffect[]): Group[] {
  const groups: Group[] = [
    {
      key: "mine",
      title: "My effects",
      entries: entries.filter((e) => e.collection !== "library"),
    },
  ];
  const imported = entries.filter((e) => e.collection === "library");
  for (const entry of imported.filter((e) => e.pack)) {
    const key = "pack:" + entry.pack!.id;
    const group = groups.find((g) => g.key === key);
    if (group) group.entries.push(entry);
    else groups.push({ key, title: entry.pack!.name, entries: [entry] });
  }
  groups.push({
    key: "imported",
    title: "Imported effects",
    entries: imported.filter((e) => !e.pack),
  });
  return groups.filter((g) => g.entries.length);
}

/**
 * Picks effects from My effects and imported packs and saves them as one
 * pack file. `preset` starts from an installed pack, keeping its ID so the
 * exported file updates that pack wherever it is installed.
 */
export function ExportEffectsDialog({
  entries,
  preset,
  onClose,
  onExported,
}: {
  entries: UserEffect[];
  preset?: PackInfo;
  onClose: () => void;
  onExported: (pack: EffectPack) => void;
}) {
  const groups = useMemo(() => effectGroups(entries), [entries]);
  const [chosen, setChosen] = useState<Set<string>>(
    () =>
      new Set(
        entries
          .filter((e) =>
            preset ? e.pack?.id === preset.id : e.collection !== "library",
          )
          .map((e) => e.id),
      ),
  );
  const first = entries.find((e) => chosen.has(e.id));
  const [name, setName] = useState(preset?.name ?? "");
  const [author, setAuthor] = useState(
    preset?.author ?? first?.bundle.author ?? "",
  );
  const [description, setDescription] = useState(preset?.description ?? "");
  const [error, setError] = useState("");
  const toggle = (ids: string[], on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  const count = chosen.size;
  return (
    <SettingsDialog title="Export effects" onClose={onClose}>
      <form
        className="export-effects"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const picked = entries.filter((entry) => chosen.has(entry.id));
            if (picked.length > LIMITS.packEffects)
              throw new Error(
                `A pack holds up to ${LIMITS.packEffects} effects.`,
              );
            const pack = makeEffectPack(
              {
                // Keep the ID only while the name does, so a renamed pack
                // doesn't replace the original where both are installed.
                id: preset && name.trim() === preset.name ? preset.id : "",
                name,
                author,
                description,
              },
              picked.map((p) => p.bundle),
            );
            downloadPack(pack);
            onExported(pack);
          } catch (err) {
            setError(readable(err));
          }
        }}
      >
        <p className="muted">
          Saves the chosen effects as one <code>.kamikami-effects.json</code>{" "}
          file. Shared effects are free for anyone to use and share: they import
          it from the Effects tab, or ask their agent to.
        </p>
        <fieldset className="export-effects-list">
          <legend>Effects</legend>
          {!groups.length && (
            <p className="muted">
              Nothing to export yet. Fork a library effect or save one to My
              effects first.
            </p>
          )}
          {groups.map((group) => {
            const ids = group.entries.map((e) => e.id);
            const all = ids.every((id) => chosen.has(id));
            return (
              <div key={group.key} className="export-effects-group">
                <label className="settings-checkbox export-effects-head">
                  <input
                    type="checkbox"
                    checked={all}
                    ref={(input) => {
                      if (input)
                        input.indeterminate =
                          !all && ids.some((id) => chosen.has(id));
                    }}
                    onChange={(e) => toggle(ids, e.target.checked)}
                  />
                  {group.title}
                  <span className="muted">{ids.length}</span>
                </label>
                {group.entries.map((entry) => (
                  <label key={entry.id} className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={chosen.has(entry.id)}
                      onChange={(e) => toggle([entry.id], e.target.checked)}
                    />
                    {entry.bundle.effect.name}
                  </label>
                ))}
              </div>
            );
          })}
        </fieldset>
        <label>
          Pack name
          <input
            required
            maxLength={80}
            placeholder="Neon nights"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Author
          <input
            maxLength={100}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={1000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!count}>
            Export {count} effect{count === 1 ? "" : "s"}
          </button>
        </div>
      </form>
    </SettingsDialog>
  );
}

/** What an installed pack is, shown above its effects in the library. */
export function PackHeader({
  pack,
  count,
  onExport,
  onRemove,
}: {
  pack: PackInfo;
  count: number;
  onExport: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="pack-header" aria-label={`${pack.name} pack`}>
      <h4>{pack.name}</h4>
      <p className="muted">
        {count} effect{count === 1 ? "" : "s"}
        {pack.author && <> · by {pack.author}</>}
      </p>
      {pack.description && <p>{pack.description}</p>}
      <div className="pack-header-actions">
        <button onClick={onExport}>
          <FileDown size={12} aria-hidden="true" /> Export
        </button>
        <button onClick={onRemove}>
          <Trash2 size={12} aria-hidden="true" /> Remove pack
        </button>
      </div>
    </section>
  );
}

export function RemovePackDialog({
  pack,
  onClose,
  onRemove,
}: {
  pack: PackInfo;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <SettingsDialog title={`Remove ${pack.name}?`} onClose={onClose}>
      <p>
        Its effects leave the library. Elements that already use them keep them,
        and importing the pack file again brings it back.
      </p>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={onRemove}>
          Remove pack
        </button>
      </div>
    </SettingsDialog>
  );
}
