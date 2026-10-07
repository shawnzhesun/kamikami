import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  LoaderCircle,
  Paperclip,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Undo2,
  X,
} from "lucide-react";
import { api, inspectMedia, type MediaAsset } from "../media";
import type { Layer } from "../model";
import { OPENAI_BASE_URL } from "../assistant-connection";
import type { AssistantState, AssistantArtifact } from "../assistant";

type Props = {
  visible: boolean;
  selectedLayers: Layer[];
  frame: number;
  fps: number;
  undoGroup?: string;
  onUndo: (id: string) => void;
  onMediaImported: () => void;
};
export function AgentsPanel({
  visible,
  selectedLayers,
  frame,
  fps,
  undoGroup,
  onUndo,
  onMediaImported,
}: Props) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [settings, setSettings] = useState(false);
  const [model, setModel] = useState("");
  const [connectionName, setConnectionName] = useState("OpenAI");
  const [baseURL, setBaseURL] = useState(OPENAI_BASE_URL);
  const [apiMode, setApiMode] = useState<"chat" | "responses">("responses");
  const [key, setKey] = useState("");
  const [reuseKey, setReuseKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<MediaAsset[]>([]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const initialized = useRef(false);
  const busy = !!state?.active || submitting;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next: AssistantState = await api("/api/assistant");
        if (alive) {
          setState(next);
          setConnectionError("");
          if (!initialized.current) {
            setModel(next.model);
            setConnectionName(next.name);
            setBaseURL(next.baseURL);
            setApiMode(next.apiMode);
            initialized.current = true;
          }
        }
      } catch (e) {
        if (alive) setConnectionError((e as Error).message);
      } finally {
        if (alive) timer = setTimeout(poll, 650);
      }
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (follow.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [state, visible]);
  async function action(route: string, method = "POST", body?: unknown) {
    try {
      setError("");
      const next = await api(route, method, body);
      setState(next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function send() {
    if (!draft.trim() || busy || uploading || !state?.configured) return;
    setSubmitting(true);
    follow.current = true;
    const text = draft.trim();
    if (
      await action("/api/assistant/messages", "POST", {
        text,
        selectedLayerIds: selectedLayers.map((l) => l.id),
        frame,
        attachments: attachments.map((a) => a.src),
      })
    ) {
      setDraft("");
      setAttachments([]);
    }
    setSubmitting(false);
    composer.current?.focus();
  }
  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const input = {
        model: model.trim(),
        name: connectionName.trim(),
        baseURL: baseURL.trim(),
        apiMode,
        reuseKey,
        ...(key.trim() ? { apiKey: key.trim() } : {}),
      };
      if (window.kamikamiAssistant)
        await window.kamikamiAssistant.saveSettings(input);
      else await api("/api/assistant/settings", "POST", input);
      setKey("");
      setReuseKey(false);
      setState(await api("/api/assistant"));
      setSettings(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function disconnect() {
    setSaving(true);
    setError("");
    try {
      if (window.kamikamiAssistant)
        await window.kamikamiAssistant.clearSettings();
      else await api("/api/assistant/settings", "DELETE");
      setKey("");
      setReuseKey(false);
      setState(await api("/api/assistant"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      if (attachments.length + files.length > 10)
        throw new Error("Attach up to 10 files per message.");
      for (const item of Array.from(files)) {
        const form = new FormData();
        form.append("file", item);
        const asset: MediaAsset = await api("/api/import", "POST", form);
        setAttachments((a) => [...a, asset]);
        onMediaImported();
        try {
          const metadata = await inspectMedia(item, asset.src);
          await api(
            "/api/media/" + asset.src.split("/").pop(),
            "PUT",
            metadata,
          );
        } catch {
          setError(
            `${asset.name} was imported, but its preview metadata could not be read.`,
          );
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      onMediaImported();
      if (file.current) file.current.value = "";
    }
  }
  function download(artifact: AssistantArtifact) {
    const a = document.createElement("a");
    const url = artifact.bundle
      ? URL.createObjectURL(
          new Blob([JSON.stringify(artifact.bundle, null, 2)], {
            type: "application/json",
          }),
        )
      : artifact.url!;
    a.href = url;
    a.download =
      artifact.kind === "effect"
        ? "my-effect.kamikami-effect.json"
        : "kamikami.mp4";
    a.click();
    if (artifact.bundle) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const runningStep = state?.messages
    .at(-1)
    ?.steps.slice()
    .reverse()
    .find((s) => s.status === "running");
  return (
    <section
      className="assistant-panel"
      style={!visible ? { display: "none" } : undefined}
      aria-label="Editing assistant"
    >
      <div className="assistant-toolbar">
        <div className="assistant-presence">
          <span
            className={`status-dot ${state?.configured && !connectionError ? "" : "offline"}`}
          />
          <span>
            {connectionError
              ? "Reconnecting…"
              : state?.confirmation
                ? "Review a change"
                : busy
                  ? state?.stopping
                    ? "Stopping…"
                    : "Working on your edit"
                  : state?.configured
                    ? "Ready to edit"
                    : "Connect to get started"}
          </span>
        </div>
        <button
          title="New conversation"
          aria-label="New conversation"
          disabled={busy || !state?.messages.length}
          onClick={() => setClearConfirm(!clearConfirm)}
        >
          <Plus size={16} />
        </button>
        <button
          title="Assistant settings"
          aria-label="Assistant settings"
          aria-expanded={settings}
          onClick={() => {
            setSettings(!settings);
            setModel(state?.model || model);
            setConnectionName(state?.name || connectionName);
            setBaseURL(state?.baseURL || baseURL);
            setApiMode(state?.apiMode || apiMode);
          }}
        >
          <Settings2 size={16} />
        </button>
      </div>
      {clearConfirm && (
        <div className="assistant-notice">
          Start a new conversation? Your edits stay in the project.
          <div className="assistant-actions">
            <button onClick={() => setClearConfirm(false)}>
              Keep conversation
            </button>
            <button
              onClick={async () => {
                if (await action("/api/assistant/messages", "DELETE"))
                  setClearConfirm(false);
              }}
            >
              New conversation
            </button>
          </div>
        </div>
      )}
      {settings && (
        <form
          className="assistant-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void saveSettings();
          }}
        >
          <div className="assistant-section-title">
            <strong>Model connection</strong>
            <button
              type="button"
              aria-label="Close assistant settings"
              onClick={() => setSettings(false)}
            >
              <X size={15} />
            </button>
          </div>
          <label>
            Connection name
            <input
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder="Azure OpenAI"
              disabled={busy || saving}
            />
          </label>
          <label>
            Base URL
            <input
              type="url"
              value={baseURL}
              onChange={(e) => {
                setBaseURL(e.target.value);
                setAvailableModels([]);
                setReuseKey(false);
              }}
              placeholder="https://your-proxy.example/v1"
              spellCheck={false}
              disabled={busy || saving}
            />
          </label>
          <label>
            API format
            <select
              value={apiMode}
              onChange={(e) =>
                setApiMode(e.target.value as "chat" | "responses")
              }
              disabled={busy || saving}
            >
              <option value="chat">
                Chat Completions · LiteLLM / compatible proxies
              </option>
              <option value="responses">
                Responses · OpenAI / compatible proxies
              </option>
            </select>
          </label>
          <label>
            API key
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                state?.configured &&
                baseURL.replace(/\/+$/, "") === state.baseURL
                  ? "Key connected · enter to replace"
                  : "Paste your API key"
              }
              disabled={busy || saving}
            />
          </label>
          {state?.configured &&
            baseURL.replace(/\/+$/, "") !== state.baseURL && (
              <label className="assistant-reuse-key">
                <input
                  type="checkbox"
                  checked={reuseKey}
                  onChange={(e) => setReuseKey(e.target.checked)}
                  disabled={busy || saving}
                />
                Use saved key for this URL
              </label>
            )}
          <label>
            Model / deployment
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model alias configured on your proxy"
              list="assistant-models"
              spellCheck={false}
              disabled={busy || saving}
            />
          </label>
          <datalist id="assistant-models">
            {availableModels.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <button
            type="button"
            disabled={
              loadingModels ||
              !state?.configured ||
              baseURL.replace(/\/+$/, "") !== state.baseURL
            }
            onClick={async () => {
              setLoadingModels(true);
              setError("");
              try {
                const result = await api("/api/assistant/models");
                setAvailableModels(result.models);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setLoadingModels(false);
              }
            }}
          >
            {loadingModels ? "Loading models…" : "Load models"}
          </button>
          {!!availableModels.length && (
            <span className="assistant-model-count">
              {availableModels.length} available
            </span>
          )}
          <div className="assistant-actions">
            <button
              className="primary"
              type="submit"
              disabled={
                busy ||
                saving ||
                !model.trim() ||
                !connectionName.trim() ||
                !baseURL.trim() ||
                ((!state?.configured ||
                  (baseURL.replace(/\/+$/, "") !== state.baseURL &&
                    !reuseKey)) &&
                  !key.trim())
              }
            >
              {saving
                ? "Connecting…"
                : state?.configured
                  ? "Save connection"
                  : "Connect assistant"}
            </button>
            {state?.configured && (
              <button
                type="button"
                disabled={busy || saving}
                onClick={() => void disconnect()}
              >
                Disconnect
              </button>
            )}
          </div>
        </form>
      )}
      <div
        className="assistant-log"
        ref={log}
        role="log"
        aria-label="Assistant conversation"
        aria-live="off"
        onScroll={() => {
          const el = log.current;
          if (el)
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {!state?.messages.length && (
          <div className="assistant-welcome">
            <div className="assistant-emblem">
              <Sparkles size={24} strokeWidth={1.5} />
            </div>
            <h2>What shall we create?</h2>
            <div className="assistant-starters">
              {[
                [
                  "Animate a title",
                  "Give the selected title a gentle retro entrance animation.",
                ],
                [
                  "Refine this edit",
                  "Review my composition and suggest three specific improvements before making changes.",
                ],
                [
                  "Create an effect",
                  "Create a subtle film-style sway for the selected clip, preview it, and save it to My effects.",
                ],
              ].map(([label, prompt]) => (
                <button
                  key={label}
                  onClick={() => {
                    setDraft(prompt);
                    composer.current?.focus();
                  }}
                >
                  <Sparkles size={13} />
                  <span>{label}</span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            {!state?.configured && !settings && (
              <button
                className="assistant-connect primary"
                onClick={() => setSettings(true)}
              >
                Connect assistant
              </button>
            )}
          </div>
        )}
        {state?.messages.map((message) => (
          <article
            className={`assistant-message ${message.role}`}
            key={message.id}
          >
            <div className="assistant-message-heading">
              {message.role === "assistant" ? (
                <>
                  <Sparkles size={13} /> KamiKami
                </>
              ) : (
                "You"
              )}
            </div>
            {message.context && (
              <small className="assistant-message-context">
                {message.context}
              </small>
            )}
            {!!message.steps.length && (
              <details className="assistant-steps">
                <summary>
                  {message.status === "running"
                    ? runningStep?.label || "Working…"
                    : `${message.steps.filter((s) => s.status === "done").length} actions completed`}
                  <ChevronDown size={12} />
                </summary>
                <ol>
                  {message.steps.map((step) => (
                    <li key={step.id}>
                      {step.status === "running" ? (
                        <LoaderCircle className="assistant-spin" size={12} />
                      ) : step.status === "done" ? (
                        <Check size={12} />
                      ) : (
                        <X size={12} />
                      )}
                      <span>
                        {step.label}
                        {step.detail && <small>{step.detail}</small>}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {message.text && (
              <div className="assistant-message-text">{message.text}</div>
            )}
            {!message.text && message.status === "running" && (
              <p className="assistant-thinking">
                <LoaderCircle className="assistant-spin" size={14} />
                {runningStep?.label || "Thinking about your edit…"}
              </p>
            )}
            {!!message.artifacts.length && (
              <div className="assistant-artifacts">
                {message.artifacts.map((artifact, i) =>
                  artifact.kind === "image" ? (
                    <figure key={i}>
                      <img
                        src={artifact.url}
                        alt={`Composition preview, ${artifact.label.toLowerCase()}`}
                        loading="lazy"
                      />
                      <figcaption>{artifact.label}</figcaption>
                    </figure>
                  ) : (
                    <button key={i} onClick={() => download(artifact)}>
                      <Download size={13} />
                      {artifact.label}
                    </button>
                  ),
                )}
              </div>
            )}
            {message.error && (
              <p className="assistant-message-error" role="status">
                {message.error}
              </p>
            )}
            {message.role === "assistant" &&
              !busy &&
              undoGroup === `assistant:${message.id}` && (
                <button
                  className="assistant-undo"
                  onClick={() => onUndo(message.id)}
                >
                  <Undo2 size={13} />
                  Undo edits
                </button>
              )}
          </article>
        ))}
      </div>
      {state?.confirmation && (
        <div className="assistant-confirmation" role="alert">
          <strong>Review this change</strong>
          <p>{state.confirmation.description}</p>
          <div className="assistant-actions">
            <button
              onClick={() =>
                void action("/api/assistant/confirm", "POST", {
                  id: state.confirmation!.id,
                  accepted: false,
                })
              }
            >
              Keep clips
            </button>
            <button
              className="primary"
              onClick={() =>
                void action("/api/assistant/confirm", "POST", {
                  id: state.confirmation!.id,
                  accepted: true,
                })
              }
            >
              Confirm change
            </button>
          </div>
        </div>
      )}
      {(error || connectionError) && (
        <div className="assistant-error" role="alert">
          {error || connectionError}
          <button
            aria-label="Dismiss assistant error"
            onClick={() => setError("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      <form
        className="assistant-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div
          className="assistant-context"
          title={selectedLayers.map((l) => l.name).join(", ")}
        >
          <span>
            {selectedLayers.length === 1
              ? selectedLayers[0].name
              : selectedLayers.length
                ? `${selectedLayers.length} clips selected`
                : "Whole composition"}
          </span>
          <span>{(frame / fps).toFixed(2)}s</span>
        </div>
        {!!attachments.length && (
          <div className="assistant-attachments">
            {attachments.map((a) => (
              <span key={a.src}>
                {a.name}
                <button
                  type="button"
                  aria-label={`Remove ${a.name} from message`}
                  onClick={() =>
                    setAttachments((all) =>
                      all.filter((item) => item.src !== a.src),
                    )
                  }
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={composer}
          aria-label="Message the editing assistant"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={8000}
          rows={3}
          placeholder={busy ? "Draft your next idea…" : "Describe your edit…"}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void send();
            }
            e.stopPropagation();
          }}
        />
        <div className="assistant-composer-actions">
          <input
            type="file"
            ref={file}
            hidden
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*"
            onChange={(e) => void attach(e.target.files)}
          />
          <button
            type="button"
            title="Attach media"
            aria-label="Attach media"
            disabled={busy || uploading}
            onClick={() => file.current?.click()}
          >
            {uploading ? (
              <LoaderCircle size={16} className="assistant-spin" />
            ) : (
              <Paperclip size={16} />
            )}
          </button>
          <span>{uploading ? "Importing media…" : ""}</span>
          {busy ? (
            <button
              type="button"
              className="assistant-stop"
              aria-label="Stop assistant"
              disabled={state?.stopping}
              onClick={() => void action("/api/assistant/stop")}
            >
              <Square size={13} fill="currentColor" />
              {state?.stopping ? "Stopping" : "Stop"}
            </button>
          ) : (
            <button
              className="assistant-send"
              type="submit"
              title="Send message"
              aria-label="Send message"
              disabled={
                !draft.trim() ||
                !state?.configured ||
                !state.editorConnected ||
                uploading ||
                !!connectionError
              }
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </form>
      {busy && (
        <p className="assistant-footer" role="status" aria-live="polite">
          {state?.confirmation
            ? "Waiting for your confirmation"
            : busy
              ? runningStep?.label ||
                (state?.stopping
                  ? "Finishing the current action…"
                  : "Working in your editor…")
              : ""}
        </p>
      )}
    </section>
  );
}
