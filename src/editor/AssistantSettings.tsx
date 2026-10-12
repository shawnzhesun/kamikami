import React, { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Plug,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "../media";
import { OPENAI_BASE_URL } from "../assistant-connection";
import type { AssistantState } from "../assistant";
import type { AnalysisSettings, AnalysisTier } from "../asset-analysis";
import { Dropdown } from "./Dropdown";

type Tab = "connection" | "analysis" | "privacy";
const tabs: { id: Tab; label: string; hint: string; icon: typeof Plug }[] = [
  {
    id: "connection",
    label: "Connection",
    hint: "Provider, key and model",
    icon: Plug,
  },
  {
    id: "analysis",
    label: "Media analysis",
    hint: "Transcripts and descriptions",
    icon: ScanSearch,
  },
  {
    id: "privacy",
    label: "Privacy",
    hint: "Keys and media uploads",
    icon: ShieldCheck,
  },
];
const keyStorageLabels: Record<AssistantState["keyStorage"], string> = {
  secure: "Stored in the system keychain",
  session: "Kept for this session only",
  environment: "Read from the environment",
  none: "No key saved",
};
const tierOptions: { value: AnalysisTier; label: string; hint: string }[] = [
  {
    value: "probe",
    label: "Probe",
    hint: "Local only: shots, loudness and silences. Free.",
  },
  {
    value: "balanced",
    label: "Balanced",
    hint: "Adds a frame every 10 s, image descriptions and a summary.",
  },
  {
    value: "full",
    label: "Full",
    hint: "A frame every 4 s for detailed shot captions. Costs more.",
  },
];
const trimURL = (url: string) => url.trim().replace(/\/+$/, "");

/** One settings row: label and description on the left, control on the right. */
function Row({
  label,
  hint,
  htmlFor,
  stacked,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`prefs-row${stacked ? " stacked" : ""}`}>
      <div className="prefs-row-text">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <p>{hint}</p>}
      </div>
      <div className="prefs-row-control">{children}</div>
    </div>
  );
}

function Switch({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="prefs-switch"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="prefs-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AssistantSettingsDialog({
  state,
  busy,
  onState,
  onClose,
}: {
  state: AssistantState | null;
  busy: boolean;
  onState: (next: AssistantState) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [tab, setTab] = useState<Tab>("connection");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    connection: null,
    analysis: null,
    privacy: null,
  });
  // Connection form, seeded from the saved connection.
  const [name, setName] = useState(state?.name || "OpenAI");
  const [baseURL, setBaseURL] = useState(state?.baseURL || OPENAI_BASE_URL);
  const [apiMode, setApiMode] = useState<"chat" | "responses">(
    state?.apiMode || "responses",
  );
  const [model, setModel] = useState(state?.model || "");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [reuseKey, setReuseKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Analysis settings save as they change.
  const [analysis, setAnalysis] = useState<AnalysisSettings | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => {
    ref.current?.showModal();
    // Start on the section list rather than the close button.
    tabRefs.current.connection?.focus();
    api("/api/analysis/settings")
      .then((s: AnalysisSettings) => {
        setAnalysis(s);
        setTranscriptionModel(s.transcriptionModel);
        setVisionModel(s.visionModel);
      })
      .catch((e) => setAnalysisError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(0), 1800);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const configured = !!state?.configured;
  const sameURL = configured && trimURL(baseURL) === state!.baseURL;
  const locked = busy || saving;
  const needsKey = (!configured || (!sameURL && !reuseKey)) && !key.trim();
  const dirty =
    !configured ||
    !!key.trim() ||
    name.trim() !== state!.name ||
    trimURL(baseURL) !== state!.baseURL ||
    apiMode !== state!.apiMode ||
    model.trim() !== state!.model;
  const canSave =
    !locked &&
    dirty &&
    !!model.trim() &&
    !!name.trim() &&
    !!baseURL.trim() &&
    !needsKey;

  async function saveAnalysis(patch: Partial<AnalysisSettings>) {
    try {
      // Captions and summaries follow the UI language.
      setAnalysis(
        await api("/api/analysis/settings", "PUT", {
          ...patch,
          language: navigator.language || "en",
        }),
      );
      setAnalysisError("");
      setSavedAt(Date.now());
    } catch (e) {
      setAnalysisError((e as Error).message);
    }
  }
  // Text fields save on blur; closing the dialog flushes any pending edit.
  function pendingAnalysis() {
    if (!analysis) return null;
    const patch: Partial<AnalysisSettings> = {};
    if (
      transcriptionModel.trim() &&
      transcriptionModel.trim() !== analysis.transcriptionModel
    )
      patch.transcriptionModel = transcriptionModel.trim();
    if (visionModel.trim() !== analysis.visionModel)
      patch.visionModel = visionModel.trim();
    return Object.keys(patch).length ? patch : null;
  }
  function close() {
    const patch = pendingAnalysis();
    if (patch) void saveAnalysis(patch);
    onClose();
  }
  async function saveConnection() {
    setSaving(true);
    setError("");
    try {
      const input = {
        model: model.trim(),
        name: name.trim(),
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
      onState(await api("/api/assistant"));
      close();
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
      onState(await api("/api/assistant"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function loadModels() {
    setLoadingModels(true);
    setError("");
    try {
      setModels((await api("/api/assistant/models")).models);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingModels(false);
    }
  }
  function onTabKey(e: React.KeyboardEvent) {
    const order = tabs.map((t) => t.id);
    const index = order.indexOf(tab);
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? order[(index + 1) % order.length]
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? order[(index - 1 + order.length) % order.length]
          : e.key === "Home"
            ? order[0]
            : e.key === "End"
              ? order.at(-1)!
              : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const field = (suffix: string) => `${id}-${suffix}`;
  const allowedHosts = analysis
    ? Object.entries(analysis.consent).filter(([, allowed]) => allowed)
    : [];
  const language = (() => {
    try {
      return (
        new Intl.DisplayNames([navigator.language], { type: "language" }).of(
          navigator.language,
        ) ?? navigator.language
      );
    } catch {
      return navigator.language;
    }
  })();

  return (
    <dialog
      ref={ref}
      className="prefs-dialog"
      aria-labelledby={field("title")}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onMouseDown={(e) => {
        // Clicking the backdrop (the dialog box itself, outside its content) closes.
        if (e.target === ref.current) close();
      }}
    >
      <form
        className="prefs-shell"
        onSubmit={(e) => {
          e.preventDefault();
          if (tab === "connection" && canSave) void saveConnection();
        }}
      >
        <div className="prefs-header">
          <div>
            <h2 id={field("title")}>Assistant settings</h2>
            <p>Connect a model and choose how your media is analyzed.</p>
          </div>
          <button
            type="button"
            className="prefs-icon-button"
            aria-label="Close assistant settings"
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>
        <div className="prefs-body">
          <nav
            className="prefs-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Settings sections"
            onKeyDown={onTabKey}
          >
            {tabs.map(({ id: tabId, label, hint, icon: Icon }) => (
              <button
                key={tabId}
                ref={(node) => {
                  tabRefs.current[tabId] = node;
                }}
                type="button"
                role="tab"
                id={field(`tab-${tabId}`)}
                aria-selected={tab === tabId}
                aria-controls={field(`panel-${tabId}`)}
                tabIndex={tab === tabId ? 0 : -1}
                onClick={() => setTab(tabId)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </button>
            ))}
          </nav>
          <div
            className="prefs-panel"
            role="tabpanel"
            id={field(`panel-${tab}`)}
            aria-labelledby={field(`tab-${tab}`)}
            tabIndex={0}
          >
            {tab === "connection" && (
              <>
                <div className={`prefs-status${configured ? " on" : ""}`}>
                  <span className="status-dot" aria-hidden="true" />
                  <div>
                    <strong>
                      {configured
                        ? `Connected to ${state!.name}`
                        : "Not connected"}
                    </strong>
                    <p>
                      {configured
                        ? `${state!.model} · ${keyStorageLabels[state!.keyStorage]}`
                        : "Add a provider and API key to start editing with the assistant."}
                    </p>
                  </div>
                  {configured && (
                    <button
                      type="button"
                      className="prefs-danger"
                      disabled={locked}
                      onClick={() => void disconnect()}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                <section className="prefs-group" aria-label="Provider">
                  <h3>Provider</h3>
                  <Row label="Connection name" htmlFor={field("name")}>
                    <input
                      id={field("name")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Azure OpenAI"
                      disabled={locked}
                    />
                  </Row>
                  <Row
                    label="Base URL"
                    htmlFor={field("url")}
                    hint="Any OpenAI-compatible endpoint or proxy."
                    stacked
                  >
                    <input
                      id={field("url")}
                      type="url"
                      className="mono"
                      value={baseURL}
                      onChange={(e) => {
                        setBaseURL(e.target.value);
                        setModels([]);
                        setReuseKey(false);
                      }}
                      placeholder="https://your-proxy.example/v1"
                      spellCheck={false}
                      disabled={locked}
                    />
                  </Row>
                  <Row
                    label="API format"
                    hint={
                      apiMode === "responses"
                        ? "OpenAI and compatible proxies."
                        : "LiteLLM and other compatible proxies."
                    }
                  >
                    <Segmented
                      label="API format"
                      value={apiMode}
                      disabled={locked}
                      onChange={setApiMode}
                      options={[
                        { value: "responses", label: "Responses" },
                        { value: "chat", label: "Chat Completions" },
                      ]}
                    />
                  </Row>
                </section>
                <section className="prefs-group" aria-label="Authentication">
                  <h3>Authentication</h3>
                  <Row
                    label="API key"
                    htmlFor={field("key")}
                    hint={
                      sameURL
                        ? "A key is connected. Enter a new one to replace it."
                        : "Never leaves this computer except to call your provider."
                    }
                    stacked
                  >
                    <div className="prefs-input-affix">
                      <input
                        id={field("key")}
                        type={showKey ? "text" : "password"}
                        className="mono"
                        autoComplete="off"
                        spellCheck={false}
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder={sameURL ? "••••••••••••" : "sk-…"}
                        disabled={locked}
                      />
                      <button
                        type="button"
                        className="prefs-icon-button"
                        aria-label={showKey ? "Hide API key" : "Show API key"}
                        aria-pressed={showKey}
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Row>
                  {configured && !sameURL && (
                    <Row
                      label="Use saved key"
                      htmlFor={field("reuse")}
                      hint="Send the existing key to this new URL."
                    >
                      <Switch
                        id={field("reuse")}
                        checked={reuseKey}
                        disabled={locked}
                        onChange={setReuseKey}
                      />
                    </Row>
                  )}
                </section>
                <section className="prefs-group" aria-label="Model">
                  <h3>Model</h3>
                  <Row
                    label="Model or deployment"
                    hint={
                      models.length
                        ? `${models.length} models available from this provider.`
                        : "The model alias configured on your provider."
                    }
                    stacked
                  >
                    <div className="prefs-input-affix">
                      <Dropdown
                        label="Model or deployment"
                        editable
                        value={model}
                        onChange={setModel}
                        placeholder="gpt-5"
                        options={models.map((m) => ({ value: m, label: m }))}
                        disabled={locked}
                      />
                      <button
                        type="button"
                        className="prefs-secondary"
                        title={
                          sameURL
                            ? "Fetch the models this provider offers"
                            : "Save the connection first to load its models"
                        }
                        disabled={loadingModels || !sameURL}
                        onClick={() => void loadModels()}
                      >
                        <RefreshCw
                          size={14}
                          className={loadingModels ? "spin" : undefined}
                        />
                        {loadingModels ? "Loading…" : "Load models"}
                      </button>
                    </div>
                  </Row>
                </section>
                {error && (
                  <p className="prefs-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
            {tab === "analysis" &&
              (!analysis ? (
                analysisError ? (
                  <p className="prefs-error" role="alert">
                    {analysisError}
                  </p>
                ) : (
                  <p className="prefs-loading">
                    <LoaderCircle size={16} className="spin" /> Loading…
                  </p>
                )
              ) : (
                <>
                  <section className="prefs-group" aria-label="Local probe">
                    <h3>Local probe</h3>
                    <Row
                      label="Probe on import"
                      hint="Shots, loudness, silences and black or frozen frames, measured on this computer."
                    >
                      <span className="prefs-pill">
                        <Check size={12} /> Always on · free
                      </span>
                    </Row>
                  </section>
                  <section className="prefs-group" aria-label="Transcription">
                    <h3>Transcription</h3>
                    <Row
                      label="Transcription analysis"
                      htmlFor={field("asr")}
                      hint="Uploads audio to your provider for word-timed transcripts."
                    >
                      <Switch
                        id={field("asr")}
                        checked={analysis.transcriptionEnabled}
                        onChange={(v) =>
                          void saveAnalysis({ transcriptionEnabled: v })
                        }
                      />
                    </Row>
                    <Row
                      label="Transcribe new imports"
                      htmlFor={field("auto")}
                      hint="Start transcription automatically for each new audio or video file."
                    >
                      <Switch
                        id={field("auto")}
                        checked={analysis.autoTranscribe}
                        disabled={!analysis.transcriptionEnabled}
                        onChange={(v) =>
                          void saveAnalysis({ autoTranscribe: v })
                        }
                      />
                    </Row>
                    <Row
                      label="Transcription model"
                      htmlFor={field("asr-model")}
                    >
                      <input
                        id={field("asr-model")}
                        className="mono"
                        value={transcriptionModel}
                        disabled={!analysis.transcriptionEnabled}
                        placeholder="whisper-1"
                        onChange={(e) => setTranscriptionModel(e.target.value)}
                        onBlur={() => {
                          const patch = pendingAnalysis();
                          if (patch) void saveAnalysis(patch);
                        }}
                      />
                    </Row>
                  </section>
                  <section
                    className="prefs-group"
                    aria-label="Descriptions and summaries"
                  >
                    <h3>Descriptions and summaries</h3>
                    <Row
                      label="Default level"
                      hint={
                        tierOptions.find(
                          (t) => t.value === analysis.defaultTier,
                        )?.hint
                      }
                      stacked
                    >
                      <Segmented
                        label="Default analysis level"
                        value={
                          analysis.defaultTier === "transcribe"
                            ? "balanced"
                            : analysis.defaultTier
                        }
                        options={tierOptions}
                        onChange={(v) => void saveAnalysis({ defaultTier: v })}
                      />
                    </Row>
                    <Row
                      label="Vision model"
                      htmlFor={field("vision")}
                      hint="Leave empty to use the assistant model."
                    >
                      <input
                        id={field("vision")}
                        className="mono"
                        value={visionModel}
                        placeholder={state?.model || "Assistant model"}
                        onChange={(e) => setVisionModel(e.target.value)}
                        onBlur={() => {
                          const patch = pendingAnalysis();
                          if (patch) void saveAnalysis(patch);
                        }}
                      />
                    </Row>
                    <Row
                      label="Language"
                      hint="Captions and summaries follow the app language."
                    >
                      <span className="prefs-value">{language}</span>
                    </Row>
                  </section>
                  <p className="prefs-footnote">
                    Model analysis only runs after you approve its estimate.
                  </p>
                  {analysisError && (
                    <p className="prefs-error" role="alert">
                      {analysisError}
                    </p>
                  )}
                </>
              ))}
            {tab === "privacy" && (
              <>
                <section className="prefs-group" aria-label="API key">
                  <h3>API key</h3>
                  <Row
                    label="Storage"
                    hint="Where the assistant's key is kept on this computer."
                  >
                    <span className="prefs-value">
                      {keyStorageLabels[state?.keyStorage ?? "none"]}
                    </span>
                  </Row>
                </section>
                <section className="prefs-group" aria-label="Media uploads">
                  <h3>Providers allowed to receive media</h3>
                  {!analysis ? (
                    analysisError ? (
                      <p className="prefs-error" role="alert">
                        {analysisError}
                      </p>
                    ) : (
                      <p className="prefs-loading">
                        <LoaderCircle size={16} className="spin" /> Loading…
                      </p>
                    )
                  ) : allowedHosts.length ? (
                    allowedHosts.map(([host]) => (
                      <Row
                        key={host}
                        label={host}
                        hint="Can receive frames and audio you approve for analysis."
                      >
                        <button
                          type="button"
                          className="prefs-danger"
                          onClick={() =>
                            void saveAnalysis({
                              consent: { ...analysis.consent, [host]: false },
                            })
                          }
                        >
                          Revoke
                        </button>
                      </Row>
                    ))
                  ) : (
                    <div className="prefs-empty">
                      <ShieldCheck size={20} aria-hidden="true" />
                      <p>
                        No provider has received media yet. You'll be asked
                        before the first upload to each one.
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
        <div className="prefs-footer">
          <span className="prefs-footer-status" role="status">
            {tab === "connection"
              ? configured && !dirty
                ? "No unsaved changes"
                : ""
              : savedAt
                ? "Saved"
                : "Changes save automatically"}
          </span>
          {tab === "connection" ? (
            <>
              <button type="button" className="prefs-secondary" onClick={close}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={!canSave}>
                {saving
                  ? "Connecting…"
                  : configured
                    ? "Save changes"
                    : "Connect assistant"}
              </button>
            </>
          ) : (
            <button type="button" className="primary" onClick={close}>
              Done
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
