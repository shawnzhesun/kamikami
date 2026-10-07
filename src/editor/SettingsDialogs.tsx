import React, { useEffect, useRef, useState } from "react";
import { durationChange } from "../editor-utils";
import { elementTrackId, type Project, type TimelineLayer } from "../model";

export function SettingsDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="duration-dialog settings-dialog"
      aria-label={title}
      onCancel={onClose}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
export function ProjectSettings({
  project,
  onSave,
  onClose,
}: {
  project: Project;
  onSave: (next: Project, base: Project) => boolean;
  onClose: () => void;
}) {
  const [base] = useState(project);
  const [name, setName] = useState(project.name);
  const [duration, setDuration] = useState(String(project.duration));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const seconds = Number(duration);
  const valid =
    duration.trim() !== "" &&
    Number.isFinite(seconds) &&
    seconds >= 1 &&
    seconds <= 600;
  const change = valid ? durationChange(base, seconds) : null;
  return (
    <SettingsDialog title="Project settings" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !change) {
            setError(
              "Enter a project name and a duration from 1 to 600 seconds.",
            );
            return;
          }
          if (change.affected.length && !confirmed) {
            setError("Review and confirm the affected elements below.");
            return;
          }
          if (onSave({ ...change.next, name: name.trim() }, base)) onClose();
          else
            setError(
              "The project changed or could not be saved. Close settings and try again.",
            );
        }}
      >
        <label>
          Project name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Duration (seconds)
          <input
            required
            type="number"
            min={1}
            max={600}
            step="any"
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <p className="muted">1920 × 1080 · 24 fps</p>
        {!!change?.affected.length && (
          <div className="settings-affected">
            <p>
              Shortening affects these elements. Undo restores their original
              timing.
            </p>
            <ul>
              {change.affected.map((e) => {
                const next = change.next.layers.find((n) => n.id === e.id);
                return (
                  <li key={e.id}>
                    {e.name}: {e.start.toFixed(2)}–
                    {(e.start + e.duration).toFixed(2)}s →{" "}
                    {next
                      ? `${next.start.toFixed(2)}–${(next.start + next.duration).toFixed(2)}s`
                      : "removed"}
                  </li>
                );
              })}
            </ul>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Trim or remove these elements
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save changes
          </button>
        </div>
      </form>
    </SettingsDialog>
  );
}
export function LayerSettings({
  project,
  track,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project;
  track: TimelineLayer;
  isNew: boolean;
  onSave: (track: TimelineLayer, base: Project) => boolean;
  onDelete: (id: string, base: Project) => boolean;
  onClose: () => void;
}) {
  const [base] = useState(project);
  const [name, setName] = useState(track.name);
  const [error, setError] = useState("");
  const elements = base.layers.filter((e) => elementTrackId(e) === track.id);
  return (
    <SettingsDialog
      title={isNew ? "New layer" : "Layer settings"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (onSave({ ...track, name: name.trim() }, base)) onClose();
          else
            setError(
              "The project changed or the layer could not be saved. Close settings and try again.",
            );
        }}
      >
        <label>
          Layer name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {!isNew && (
          <p className="muted">
            {elements.length} element{elements.length === 1 ? "" : "s"}
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {!isNew && (
            <button
              type="button"
              className="delete-layer-action"
              onClick={() => {
                if (onDelete(track.id, base)) onClose();
                else
                  setError(
                    "The project changed. Close settings and review the layer again.",
                  );
              }}
            >
              Delete layer
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {isNew ? "Create layer" : "Save changes"}
          </button>
        </div>
      </form>
    </SettingsDialog>
  );
}
