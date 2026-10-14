# Media analysis

Analysis runs only on request: from **Analyze** in the media panel, an asset's status badge, **Details**, or an agent's `analyze_assets`. The `probe` tier is local and free; optional AI stages add captions, descriptions, summaries and transcripts, and agents use the results to edit. The code is in `server/analysis/` (pipeline), `src/asset-analysis.ts` (schema) and `src/editor/AnalysisDialogs.tsx` (UI).

## Tiers and stages

| Tier                 | Runs                                                                  | Cost               |
| -------------------- | --------------------------------------------------------------------- | ------------------ |
| `probe`              | Stream details, loudness, silences, shots                             | Free, local ffmpeg |
| `transcribe`         | Probe + transcription (shown only if transcription is enabled)        | Provider           |
| `balanced` (default) | Probe + one frame per shot, plus extra frames in long shots + summary | Provider           |
| `full`               | Probe + frames at a fixed interval + summary                          | Provider           |

- **Probe** records (sampling parameters are in `server/analysis/stages.ts` and `probe.ts`):
  - sha256 and stream details (codec, size, fps, rotation, alpha, audio tracks);
  - EBU R128 loudness and true peak;
  - silences and the active ratio;
  - shot cuts, black spans and frozen spans.

  Audio measurements use track 0.

- **Look** batches video frames into labelled contact sheets, one vision call per sheet, giving a caption and on-screen text per frame. An image gets one call returning a caption, details, OCR, colors, subject box, safe text region and tags.
- **Transcribe** is opt-in (Assistant settings).
  - It calls `/audio/transcriptions` with word timestamps.
  - Audio goes as track 0, mono, in chunks cut at silences.
- **Lyric alignment:**
  - Paste lyrics or a script when analyzing a single asset. The text also prompts the transcriber.
  - The text is aligned to the recognized words by Needleman–Wunsch with fuzzy matching, so each line becomes a segment. CJK text is aligned per character.
  - Low-confidence words are highlighted in Details.
- **Summarize** writes a one-line summary, tags, scenes (video) and sections (when there's a transcript), in the UI language.

AI stages use the assistant's connection. Without a key or provider consent they are skipped, and the asset is marked `partial`.

## Consent

- **Estimate first:** `/api/analysis/estimate` dry-runs a request and returns the number of frames, sheets, transcription minutes, model calls and the upload host.
- **Approval:** model tiers need `confirmed: true`. Approving also records consent for that provider host.
  - **UI:** the dialog shows an "Allow {host}" checkbox.
  - **Native assistant:** one approval covers both.
  - **MCP:** `analyze_assets` returns `needsConfirmation` until the client retries with `confirmed: true`.
- **Revoking:** Settings → Privacy.

## Storage

| Path in `.kamikami/analysis/` | Holds                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| `<sha256>.json`               | Per-file analysis, keyed by content, so renamed or relinked files keep it |
| `index.json`                  | Map from src to `{sha256, status, tier, updatedAt, error, summary}`       |
| `queue.json`, `settings.json` | Pending jobs (resumed after restart) and settings                         |

The analysis file has these fields: `probe`, `audio`, `visual{shots, samples, black, freeze}`, `transcript{source asr|lyrics|manual, segments, words[{t,s,e,p?}]}`, `image`, `scenes`, `sections`, `description`, `summary{text, tags}`, and `provenance` per section. Changing a stage's parameters only recomputes the sections that are now stale.

## Manual metadata

`set_asset_metadata` saves what a user or agent knows without running analysis: summary, tags, description, scenes, sections, transcript (with segment and word times) and image fields.

- It takes a batch of assets per call. Times are clamped to the asset's duration, and unprobed files are probed first.
- Written fields are marked manual. Automatic analysis keeps them and skips the stages they replace (summary, transcription, image description). `clear` removes them.

## Agent tools

`get_asset_analysis`, `search_assets`, `view_asset_range`, `view_timeline_range`, `set_asset_metadata` and `analyze_assets` read and write analysis; `apply_edit_list`, `cut_source_ranges`, the ripple tools, `crossfade` and `detach_audio` edit from it. Each tool's description and schema say what it takes. The assistant also gets a one-line digest per asset with every request.

## Licensing

`ffmpeg-static` and `ffprobe-static` are GPL with nonfree parts. That's fine for development but can't be redistributed. Point `KAMIKAMI_FFMPEG` / `KAMIKAMI_FFPROBE` at other builds.
