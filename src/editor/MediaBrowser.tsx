import { MEDIA_DRAG_TYPE } from "../media";
import React, { useState } from "react";
import {
  Film,
  Trash2,
  Music2,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  ListTree,
  Sparkles,
} from "lucide-react";
import type { MediaAsset } from "../media";
import { Waveform } from "./Waveform";
import { badgeLabel } from "./AnalysisDialogs";

type Props = {
  assets: MediaAsset[];
  busy: boolean;
  onImport: () => void;
  onRefresh: () => void;
  onRelink: (a: MediaAsset) => void;
  onDelete: (a: MediaAsset) => void;
  trash: MediaAsset[];
  onRestore: (a: MediaAsset) => void;
  onAnalyze: () => void;
  onDetails: (a: MediaAsset) => void;
};

export function MediaBrowser({
  assets,
  busy,
  onImport,
  onRefresh,
  onRelink,
  onDelete,
  trash,
  onRestore,
  onAnalyze,
  onDetails,
}: Props) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [preview, setPreview] = useState<string | null>(null);
  const filtered = assets.filter(
    (a) =>
      (filter === "all" || a.type === filter) &&
      a.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="media-browser">
      <div className="media-actions">
        <button onClick={onImport} disabled={busy}>
          <Plus size={14} />
          {busy ? "Adding…" : "Add media"}
        </button>
        <button
          title="Analyze media for the assistant (shows an estimate first)"
          onClick={onAnalyze}
          disabled={!assets.length}
        >
          <Sparkles size={14} />
          Analyze
        </button>
        <button
          aria-label="Refresh media library"
          title="Check for missing files"
          onClick={onRefresh}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <label className="media-search">
        Find media
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search filenames"
        />
      </label>
      <div className="media-filters" aria-label="Media type">
        {["all", "image", "video", "audio"].map((type) => (
          <button
            key={type}
            aria-pressed={filter === type}
            onClick={() => {
              setFilter(type);
              setPreview(null);
            }}
          >
            {type === "all"
              ? "All"
              : type === "image"
                ? "Images"
                : type === "video"
                  ? "Video"
                  : "Audio"}
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="media-empty">
          {assets.length
            ? "No files match your search."
            : "No media in this library."}
        </p>
      )}
      {trash.length > 0 && (
        <details className="media-trash">
          <summary>Media trash ({trash.length})</summary>
          <p>
            Restoring media does not recreate deleted clips. Use Undo to restore
            a deletion's clips.
          </p>
          {trash.map((a) => (
            <div key={a.src}>
              <span>{a.name}</span>
              <button onClick={() => onRestore(a)}>Restore</button>
            </div>
          ))}
        </details>
      )}
      {filtered.map((a) => (
        <article
          key={a.src}
          draggable={!a.missing && !busy}
          onDragStart={(e) => {
            e.dataTransfer.setData(MEDIA_DRAG_TYPE, a.src);
            e.dataTransfer.effectAllowed = "copy";
          }}
          title={
            a.missing
              ? "Relink this file before using it"
              : "Drag onto a timeline layer"
          }
          className={`media-card ${a.missing ? "missing" : ""}`}
        >
          <button
            className="media-thumbnail"
            disabled={a.missing}
            aria-label={`Preview ${a.name}`}
            aria-expanded={preview === a.src}
            onClick={() => setPreview(preview === a.src ? null : a.src)}
          >
            {a.missing ? (
              <span>Missing file</span>
            ) : a.type === "image" ? (
              <img src={a.src} alt="" draggable={false} />
            ) : a.type === "video" ? (
              <>
                <video src={a.src + "#t=0.1"} muted preload="metadata" />
                <Film size={22} />
              </>
            ) : a.peaks.length ? (
              <Waveform peaks={a.peaks} />
            ) : (
              <Music2 size={32} />
            )}
          </button>
          <strong title={a.name}>{a.name}</strong>
          {!a.missing && (
            <span
              className={`analysis-badge ${a.analysis?.status ?? "none"}`}
              title={a.analysis?.error ?? a.analysis?.summary ?? ""}
            >
              {badgeLabel[a.analysis?.status ?? "none"]}
            </span>
          )}
          <small>
            {a.type} · {a.duration ? `${a.duration.toFixed(2)}s · ` : ""}
            {a.width && a.height ? `${a.width} × ${a.height} · ` : ""}
            {(a.size / 1024 / 1024).toFixed(1)} MB
          </small>
          {preview === a.src && !a.missing && (
            <div className="media-player">
              {a.type === "audio" ? (
                <audio key={a.src} src={a.src} controls />
              ) : a.type === "video" ? (
                <video key={a.src} src={a.src} controls />
              ) : (
                <img src={a.src} alt={a.name} />
              )}
            </div>
          )}
          <div className="media-card-actions">
            <button
              className="media-delete"
              aria-label={`Delete ${a.name}`}
              title="Delete media"
              disabled={busy}
              onClick={() => onDelete(a)}
            >
              <Trash2 size={13} />
            </button>
            {a.missing ? (
              <button onClick={() => onRelink(a)} disabled={busy}>
                Relink file…
              </button>
            ) : (
              <button
                className="media-details"
                aria-label={`Analysis details for ${a.name}`}
                title="Transcript, shots, description and audio"
                onClick={() => onDetails(a)}
              >
                <ListTree size={13} />
                Details
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
