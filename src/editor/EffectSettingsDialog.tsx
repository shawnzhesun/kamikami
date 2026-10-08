import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function EffectSettingsDialog({
  name,
  busy,
  error,
  onClose,
  onSave,
  children,
}: {
  name: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      dialog.current?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
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
          if (!busy) onSave();
        }}
      >
        <div className="effect-dialog-header">
          <div>
            <h2 id={titleId}>Effect settings</h2>
            <p title={name}>{name}</p>
          </div>
          <button
            type="button"
            aria-label="Close effect settings"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="effect-dialog-body">
          <fieldset disabled={busy} className="effect-dialog-fields">
            {children}
          </fieldset>
        </div>
        <div className="effect-dialog-footer">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="effect-dialog-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy}>
              Save changes
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
