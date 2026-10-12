import React, { useEffect, useRef, useState } from "react";
import { api, type MediaAsset } from "../media";
import type { AnalysisSettings, AnalysisTier } from "../asset-analysis";
import { SettingsDialog } from "./SettingsDialogs";
import { Dropdown } from "./Dropdown";

/** Readable analysis status for media cards and the details view. */
export const badgeLabel: Record<string, string> = {
  none: "Not analyzed",
  queued: "Queued",
  running: "Analyzing…",
  ready: "Analyzed",
  partial: "Partly analyzed",
  stale: "Stale",
  error: "Analysis failed",
};

type Estimate = {
  assets: number;
  images: number;
  videos: number;
  frames: number;
  sheets: number;
  transcriptionMinutes: number;
  modelCalls: number;
  uploadsTo: string | null;
};
const tierLabels: Record<AnalysisTier, string> = {
  probe: "Probe only · free, local (shots, loudness, silences)",
  transcribe: "Transcribe · words with timings",
  balanced: "Balanced · descriptions, summary (+ transcript if enabled)",
  full: "Full · denser frame sampling",
};

/** Estimate → consent → run. Model tiers never start without this confirmation. */
export function AnalyzeDialog({
  srcs,
  title,
  onClose,
  onStarted,
}: {
  srcs?: string[];
  title: string;
  onClose: () => void;
  onStarted: (count: number) => void;
}) {
  const [settings, setSettings] = useState<AnalysisSettings | null>(null);
  const [tier, setTier] = useState<AnalysisTier | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [consent, setConsent] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/analysis/settings")
      .then((s: AnalysisSettings) => {
        setSettings(s);
        setTier(s.defaultTier);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!tier) return;
    setEstimate(null);
    api("/api/analysis/estimate", "POST", { srcs, tier })
      .then((r: { estimate: Estimate }) => setEstimate(r.estimate))
      .catch((e) => setError((e as Error).message));
  }, [tier, srcs?.join("|")]);
  const host = estimate?.uploadsTo;
  const consented = !host || !!settings?.consent[host];
  const needsModel = tier !== "probe";
  const tiers = (
    ["probe", "transcribe", "balanced", "full"] as AnalysisTier[]
  ).filter((t) => t !== "transcribe" || settings?.transcriptionEnabled);
  return (
    <SettingsDialog title={title} onClose={onClose}>
      <form
        className="analysis-dialog"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!tier) return;
          setBusy(true);
          setError("");
          try {
            const r = (await api("/api/analysis/run", "POST", {
              srcs,
              tier,
              confirmed: true,
              allowUpload: needsModel && (consented || consent),
              ...(lyrics.trim() ? { prompt: lyrics.trim() } : {}),
            })) as { jobs: unknown[] };
            onStarted(r.jobs.length);
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Analysis level
          <Dropdown
            label="Analysis level"
            value={tier ?? "balanced"}
            options={tiers.map((t) => ({ value: t, label: tierLabels[t] }))}
            onChange={(v) => setTier(v as AnalysisTier)}
          />
        </label>
        {estimate ? (
          <ul className="analysis-estimate">
            <li>
              {estimate.assets} asset{estimate.assets === 1 ? "" : "s"}
            </li>
            {needsModel && estimate.frames > 0 && (
              <li>
                {estimate.frames} video frames in {estimate.sheets} contact
                sheet
                {estimate.sheets === 1 ? "" : "s"}
              </li>
            )}
            {needsModel && estimate.images > 0 && (
              <li>
                {estimate.images} image{estimate.images === 1 ? "" : "s"}
              </li>
            )}
            {needsModel &&
              (settings?.transcriptionEnabled ? (
                <li>
                  {estimate.transcriptionMinutes} min of audio to transcribe
                </li>
              ) : (
                <li className="muted">
                  Transcription is off (enable it in Assistant settings)
                </li>
              ))}
            {needsModel && <li>About {estimate.modelCalls} model calls</li>}
          </ul>
        ) : (
          <p className="muted">Estimating…</p>
        )}
        {needsModel && settings?.transcriptionEnabled && srcs?.length === 1 && (
          <label>
            Lyrics or script (optional)
            <textarea
              rows={4}
              value={lyrics}
              maxLength={4000}
              placeholder="Paste lyrics to guide transcription and align them to the audio."
              onChange={(e) => setLyrics(e.target.value)}
            />
          </label>
        )}
        {needsModel && host && (
          <p className="muted">
            Frames{settings?.transcriptionEnabled ? " and audio" : ""} will be
            sent to <strong>{host}</strong>, your assistant connection. Probe
            results stay local.
          </p>
        )}
        {needsModel && !host && (
          <p className="field-error">
            Connect the assistant to run model analysis.
          </p>
        )}
        {needsModel && host && !consented && (
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Allow {host} to receive media for analysis
          </label>
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
          <button
            className="primary"
            disabled={
              busy ||
              !estimate ||
              (needsModel && (!host || (!consented && !consent)))
            }
          >
            {needsModel ? "Analyze" : "Run probe"}
          </button>
        </div>
      </form>
    </SettingsDialog>
  );
}

type Detail = {
  status: string;
  note?: string;
  summary: string;
  description?: string;
  manual?: string[];
  tags: string[];
  probe: {
    duration: number | null;
    video: { width: number; height: number; fps: number | null } | null;
    audioTracks: unknown[];
  };
  loudness: {
    lufs: number | null;
    truePeak: number | null;
    silent: boolean;
  } | null;
  scenes: { start: number; end: number; title: string }[];
  sections: { start: number; end: number; label: string }[];
  language?: string;
  image: {
    caption: string;
    details: string;
    ocr: string[];
    colors: string[];
    safeTextRegion: string;
  } | null;
  transcript: { start: number; end: number; text: string }[];
  words: { t: string; s: number; e: number; p?: number }[];
  shots: { i: number; start: number; end: number; caption?: string }[];
  frames: { t: number; caption: string; text: string }[];
  audio: { silences: [number, number][]; activeRatio: number } | null;
  black: [number, number][];
  freeze: [number, number][];
};
const clock = (t: number) =>
  `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** Asset analysis drawer: words and shots seek the preview so results are verifiable. */
export function AssetDetails({
  asset,
  onClose,
  onAnalyze,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onAnalyze: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    api(`/api/analysis/asset?src=${encodeURIComponent(asset.src)}&section=all`)
      .then(setDetail)
      .catch((e) => setError((e as Error).message));
  }, [asset.src, asset.analysis?.updatedAt]);
  const seek = (t: number) => {
    if (!media.current) return;
    media.current.currentTime = t;
    void media.current.play().catch(() => {});
  };
  const tabs = [
    ["overview", "Overview"],
    ...(asset.type !== "image" ? [["transcript", "Transcript"]] : []),
    ...(asset.type === "video" ? [["shots", "Shots"]] : []),
    ...(asset.type === "image" ? [["description", "Description"]] : []),
    ...(asset.type !== "image" ? [["audio", "Audio"]] : []),
  ];
  return (
    <SettingsDialog title={asset.name} onClose={onClose}>
      <div className="asset-details">
        <div className="asset-preview">
          {asset.type === "image" ? (
            <img src={asset.src} alt={asset.name} />
          ) : asset.type === "video" ? (
            <video ref={media} src={asset.src} controls />
          ) : (
            <audio ref={media} src={asset.src} controls />
          )}
        </div>
        <div className="asset-status">
          <span
            className={`analysis-badge ${asset.analysis?.status ?? "none"}`}
          >
            {badgeLabel[asset.analysis?.status ?? "none"]}
          </span>
          {detail?.note && <small className="muted">{detail.note}</small>}
          <button type="button" onClick={onAnalyze}>
            Analyze…
          </button>
        </div>
        {error && !detail ? (
          <p className="muted">{error}</p>
        ) : !detail ? (
          <p className="muted">Loading analysis…</p>
        ) : (
          <>
            <div className="asset-tabs" role="tablist">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="asset-tab" role="tabpanel">
              {tab === "overview" && (
                <>
                  <p>{detail.summary}</p>
                  {detail.description && (
                    <p className="asset-description">{detail.description}</p>
                  )}
                  {!!detail.manual?.length && (
                    <p className="muted">
                      Written by you or the assistant:{" "}
                      {detail.manual.join(", ")}. Analysis keeps these.
                    </p>
                  )}
                  {!!detail.tags.length && (
                    <p className="asset-tags">
                      {detail.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </p>
                  )}
                  <dl>
                    {detail.probe.duration !== null && (
                      <>
                        <dt>Duration</dt>
                        <dd>{detail.probe.duration.toFixed(2)} s</dd>
                      </>
                    )}
                    {detail.probe.video && (
                      <>
                        <dt>Video</dt>
                        <dd>
                          {detail.probe.video.width} ×{" "}
                          {detail.probe.video.height}
                          {detail.probe.video.fps
                            ? ` @ ${Math.round(detail.probe.video.fps * 100) / 100} fps`
                            : ""}
                        </dd>
                      </>
                    )}
                    {detail.loudness && (
                      <>
                        <dt>Loudness</dt>
                        <dd>
                          {detail.loudness.silent
                            ? "Silent"
                            : `${detail.loudness.lufs} LUFS · peak ${detail.loudness.truePeak} dBTP`}
                        </dd>
                      </>
                    )}
                    {detail.probe.audioTracks.length > 1 && (
                      <>
                        <dt>Audio tracks</dt>
                        <dd>{detail.probe.audioTracks.length}</dd>
                      </>
                    )}
                  </dl>
                  {[
                    ...detail.scenes,
                    ...detail.sections.map((s) => ({ ...s, title: s.label })),
                  ].map((s, i) => (
                    <button
                      type="button"
                      className="asset-row"
                      key={i}
                      onClick={() => seek(s.start)}
                    >
                      <time>{clock(s.start)}</time> {s.title}
                    </button>
                  ))}
                </>
              )}
              {tab === "transcript" &&
                (detail.words.length ? (
                  <p className="asset-words">
                    {detail.words.map((w, i) => (
                      <button
                        type="button"
                        key={i}
                        title={`${w.s.toFixed(2)}–${w.e.toFixed(2)} s${w.p !== undefined ? ` · confidence ${Math.round(w.p * 100)}%` : ""}`}
                        className={w.p !== undefined && w.p < 0.6 ? "low" : ""}
                        onClick={() => seek(w.s)}
                      >
                        {w.t}
                      </button>
                    ))}
                  </p>
                ) : (
                  <p className="muted">
                    No transcript yet. Enable transcription in Assistant
                    settings, then Analyze.
                  </p>
                ))}
              {tab === "shots" &&
                (detail.frames.length || detail.shots.length ? (
                  (detail.frames.length
                    ? detail.frames
                    : detail.shots.map((s) => ({
                        t: s.start,
                        caption: s.caption ?? `Shot ${s.i + 1}`,
                        text: "",
                      }))
                  ).map((f, i) => (
                    <button
                      type="button"
                      className="asset-row"
                      key={i}
                      onClick={() => seek(f.t)}
                    >
                      <time>{clock(f.t)}</time> {f.caption}
                      {f.text && <em> “{f.text}”</em>}
                    </button>
                  ))
                ) : (
                  <p className="muted">No shots detected yet.</p>
                ))}
              {tab === "description" &&
                (detail.image ? (
                  <>
                    <p>
                      <strong>{detail.image.caption}</strong>
                    </p>
                    <p>{detail.image.details}</p>
                    {!!detail.image.ocr.length && (
                      <p>Text: {detail.image.ocr.join(" · ")}</p>
                    )}
                    <p className="asset-colors">
                      {detail.image.colors.map((c) => (
                        <span key={c} style={{ background: c }} title={c} />
                      ))}
                    </p>
                    <p className="muted">
                      Calm area for text: {detail.image.safeTextRegion}
                    </p>
                  </>
                ) : (
                  <p className="muted">
                    No description yet. Analyze at Balanced to describe this
                    image.
                  </p>
                ))}
              {tab === "audio" &&
                (detail.audio ? (
                  <>
                    <p>
                      {Math.round(detail.audio.activeRatio * 100)}% of the time
                      has sound.
                    </p>
                    {detail.audio.silences.map(([a, b], i) => (
                      <button
                        type="button"
                        className="asset-row"
                        key={i}
                        onClick={() => seek(a)}
                      >
                        <time>{clock(a)}</time> Silence · {(b - a).toFixed(2)} s
                      </button>
                    ))}
                    {[
                      ...detail.black.map((r) => ["Black", r] as const),
                      ...detail.freeze.map((r) => ["Frozen", r] as const),
                    ].map(([label, [a, b]], i) => (
                      <button
                        type="button"
                        className="asset-row"
                        key={`v${i}`}
                        onClick={() => seek(a)}
                      >
                        <time>{clock(a)}</time> {label} picture ·{" "}
                        {(b - a).toFixed(2)} s
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="muted">No audio stream.</p>
                ))}
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </SettingsDialog>
  );
}

/** Analysis preferences, shown in the assistant settings modal. Saved on change. */
