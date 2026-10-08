import React, { useEffect, useId, useRef } from "react";
import { GitFork, Trash2, X } from "lucide-react";

export function EffectSettingsDialog({
  name,
  busy,
  error,
  onClose,
  onSave,
  mode,
  onFork,
  onDelete,
  onNameChange,
  status,
  children,
}: {
  name: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
  mode: "library" | "personal" | "instance";
  onFork?: () => void;
  onDelete?: () => void;
  onNameChange?: (name: string) => void;
  status?: string;
  children: React.ReactNode;
}) {
  const readOnly = mode === "library";
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLElement>(
        mode === "personal"
          ? "h2"
          : readOnly
            ? ".effect-dialog-actions button"
            : "input:not(:disabled)",
      )
      ?.focus({ preventScroll: true });
  }, [mode, readOnly]);
  return (
    <dialog
      ref={dialog}
      className="duration-dialog settings-dialog effect-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        noValidate
        onClickCapture={(event) => {
          if (
            !(event.target as HTMLElement).closest("[data-effect-draft-action]")
          )
            return;
          const invalid = event.currentTarget.querySelector<HTMLElement>(
            '[aria-invalid="true"]',
          );
          if (invalid) {
            event.preventDefault();
            event.stopPropagation();
            invalid.focus();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const invalid = event.currentTarget.querySelector<HTMLElement>(
            '[aria-invalid="true"]',
          );
          if (invalid) {
            invalid.focus();
            return;
          }
          if (!busy && !readOnly) onSave();
        }}
      >
        <div className="effect-dialog-header">
          <div>
            <h2 id={titleId} tabIndex={-1}>
              {readOnly ? "Library effect" : "Effect settings"}
            </h2>
            <div className="effect-dialog-name-row">
              {mode === "personal" && onNameChange ? (
                <input
                  className="effect-dialog-name-input"
                  aria-label="Effect name"
                  value={name}
                  maxLength={80}
                  disabled={busy}
                  onChange={(event) => onNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <p title={name}>{name}</p>
              )}
              <div className="effect-dialog-header-actions">
                {mode !== "instance" && onFork && (
                  <button
                    type="button"
                    data-effect-draft-action
                    disabled={busy}
                    onClick={onFork}
                    aria-label="Fork effect"
                  >
                    <GitFork size={15} aria-hidden="true" /> Fork
                  </button>
                )}
                {mode === "personal" && onDelete && (
                  <button
                    type="button"
                    className="effect-delete-button"
                    disabled={busy}
                    onClick={onDelete}
                    aria-label="Delete from My effects"
                  >
                    <Trash2 size={15} aria-hidden="true" /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="effect-dialog-close"
            aria-label="Close effect settings"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="effect-dialog-body">
          <fieldset
            disabled={busy || readOnly}
            className="effect-dialog-fields"
          >
            {children}
          </fieldset>
        </div>
        <div className="effect-dialog-footer">
          {status && !error && (
            <p role="status" className="muted">
              {status}
            </p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="effect-dialog-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly && (
              <button type="submit" className="primary" disabled={busy}>
                Save changes
              </button>
            )}
          </div>
        </div>
      </form>
    </dialog>
  );
}
