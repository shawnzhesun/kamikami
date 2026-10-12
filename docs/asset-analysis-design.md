# Design draft: assistant-driven asset analysis

Status: **implemented October 11, 2026** (all six phases).

- Code: `server/analysis/` (ffmpeg, probe, store, queue, provider, stages, query, view, align), `src/asset-analysis.ts`, and `src/editor/AnalysisDialogs.tsx`.
- Tests: `tests/asset-analysis.test.ts`, `analysis-stages`, `analysis-agent`, `editing-core` and `lyrics-align`.
- **Before distributing the app, replace the bundled `ffmpeg-static` binary.** It is a GPL + *nonfree* build, which cannot be redistributed. Use an LGPL or GPL build without nonfree components; `KAMIKAMI_FFMPEG` and `KAMIKAMI_FFPROBE` override the binary paths.

## Goal

When the assistant is on, KamiKami can analyze every asset in the media library and store **agent-friendly metadata**: transcripts and lyrics with word timings, shot lists with captions, image descriptions, loudness and silences. That metadata is the groundwork for agent-driven editing, audio clipping and subtitle generation.

## Lessons from video-use and similar tools

[browser-use/video-use](https://github.com/browser-use/video-use) is a Claude Code skill whose stated principle is "the LLM never watches the video, it reads it":

- **A compact text timeline is the main surface.** Word-level ASR (ElevenLabs Scribe, with diarization and audio events) is packed into a phrase list such as `[002.52-005.36] S0 text…`, split on silences of 0.5 s or more. This costs about a tenth of the raw JSON and is always in context.
- **Visuals are pulled on demand.** `timeline_view` renders one PNG for a time range: about 10 frames, a waveform, word labels and silence gaps. It is used only at decision points and to self-check rendered cuts. There is no pre-computed captioning or scene index.
- **Editing is an EDL** (`{source, start, end, reason}`) whose cuts snap to word boundaries with 30–200 ms padding. Subtitles come from the same word timings.
- **Caching is per source**, but keyed by file name only, with no content hash. We should do better.
- It explicitly warns against heavy pre-computed tag hierarchies: keep stored data factual and let the agent judge at edit time.

Similar tools fill the gaps video-use leaves (no images, music or shot index):

- [claude-video `/watch`](https://github.com/bradautomates/claude-video) uses detail tiers and scene-threshold frames with dedup.
- [video-analyzer-skill](https://github.com/bsisduck/video-analyzer-skill) uses contact-sheet montages and parallel sub-agents.
- [VideoDB Director](https://github.com/video-db/Director) indexes scenes as `{start, end, frames, description}`.
- Twelve Labs offers segment embeddings and chapters.
- Remotion uses whisper.cpp and a `Caption {text, startMs, endMs}` schema.
- [OpenAI speech-to-text](https://developers.openai.com/docs/guides/speech-to-text) gives word timestamps only with `whisper-1` + `verbose_json`.

## Proposed architecture

### Storage

- Sidecars live at `.kamikami/analysis/<sha256>.json`. Keying by content hash means renames and relinks keep their analysis, and replaced files get a fresh one.
- `library.json` entries gain `sha256` and `analysis: { status, updatedAt, summary }`. Status is `none | queued | running | ready | partial | stale | error`.
- Each section records its provenance: `{ analyzer, version, model, endpoint, paramsHash, createdAt }`. A section is re-run only when its own inputs change.
- Times are seconds (3 decimals, asset-relative, half-open ranges). Assets also store `fps` for frame conversion.

### Pipeline (a job queue in the local service; resumable, cancellable, 2–4 workers)

| Stage | What | Needs | Cost |
| --- | --- | --- | --- |
| 1. Probe | Streams, rotation, audio tracks; loudness (EBU R128); silences; black or frozen frames; shot cuts (`select=gt(scene,…)`); sha256 | ffmpeg/ffprobe (local) | Free; runs on import |
| 2. Transcribe | Speech or lyrics with **word timings**, segments and speakers; language; silence-gated; chunked at silences with time re-offsets | Provider `/audio/transcriptions` (`whisper-1` word timestamps) **or** local whisper.cpp | Per audio minute |
| 3. Look | Video: a mid-shot keyframe per shot, tiled into labelled contact sheets of ≤12, one vision call per sheet returning JSON per shot (caption, subjects, motion, on-screen text). Images: caption, OCR, dominant colors, subject box, safe text region | Vision-capable chat model (the configured connection) | Per sheet or image |
| 4. Summarize | One text call per asset: a ≤150-token summary, tags, scene grouping; for music, sections (verse/chorus) and an optional BPM | Any text model | Small |

Tiers: **Probe only** · **Transcribe** · **Balanced** (≤100 frames per asset) · **Full**. Before a run the app shows an estimate (audio minutes, images, sheets), and the user confirms it.

### Agent surface

- **Library digest in context.** The one-line summary of each analyzed asset is injected the way the project already is, so the agent knows what footage exists without spending tokens on it.
- **New tools:**
  - `get_asset_analysis(src, section, start?, end?)` returns transcript, words, shots, silences or loudness, sliced by time.
  - `search_assets(query)` searches transcripts, captions and tags (text match in v1; embeddings later).
  - `view_asset_range(src, start, end)` returns one PNG with frames, waveform and word labels, our version of `timeline_view`.
  - `analyze_assets(srcs?, tier)` queues analysis, with the same estimate and confirmation the UI shows.
- **Editing rules for the prompt** (adapted from video-use): snap cuts to word or silence boundaries with padding; keep raw word timings untouched; verify with rendered frames.

### UI

- Media cards get a status badge (Analyzed, Analyzing…, Stale). An **Analyze library** button shows the estimate before running.
- An asset detail drawer has Transcript, Shots, Description and Audio tabs. Clicking a word or shot seeks a preview.
- The assistant settings modal gets an **Analysis** section:
  - transcription source (provider or local);
  - vision model (defaults to the chat model);
  - default tier;
  - whether to auto-probe on import;
  - a per-provider consent toggle for uploading media.

### What this enables next

- **Subtitles:** words → caption pages → title elements, styled with the existing Karaoke, Typewriter and Blur rise effects.
- **Audio clipping:** ranges snapped to words and silences, plus "remove ums and long pauses".
- **Transcript-first editing:** delete words to cut, Descript-style.
- **B-roll matching:** transcript phrases matched to shot captions.
- **Music sync:** beats and sections become timeline markers that cuts and effects snap to.
- **Lyric videos:** aligned lyrics → Karaoke titles, which covers the case-study gap.

## Decisions (October 11, 2026)

1. **Transcription source: the connected provider only.**
   - Uses `POST {baseURL}/audio/transcriptions` with `whisper-1`, `response_format=verbose_json`, `timestamp_granularities[]=word,segment`.
   - The model is configurable for compatible servers such as Groq or faster-whisper-server.
   - A capability check runs at connect time and on the first run, and validates that `words[]` comes back. Without word timings, transcription is reported as unavailable instead of silently degrading.
   - Audio is extracted to mono 16 kHz, chunked under 25 MB at silences with overlap, and re-offset.
2. **ffmpeg: bundled static binaries** (`ffmpeg-static` and `ffprobe-static`) with the desktop app. The commonly distributed builds are GPL, so this needs a licensing review before any distribution. Development uses the bundled binary too.
3. **Trigger: the probe runs automatically on import (free, local). Transcription is opt-in.**
   - **Transcription is off by default.** A setting turns on "Transcription analysis", and a second, also-off setting adds "Transcribe new imports automatically". Until it is enabled, Analyze runs only the probe and visual stages, and transcription tools report "Transcription is turned off in Assistant settings".
   - The probe is free and local.
   - Transcription and vision run only from **Analyze** (UI) or `analyze_assets` (agent).
   - Both show the same estimate and require confirmation, plus one-time consent per provider before media is uploaded.
4. **v1 scope:**
   - the full pipeline (transcription opt-in);
   - agent tools and the library digest;
   - the media UI;
   - **paste-lyrics alignment**.
   - Auto subtitles are **removed** from v1.
5. **Language:** captions, descriptions, summaries and tags are written in the **UI language**. Transcripts stay in the spoken language, with the detected language recorded.

## v1 plan (for review)

### Phase 1: foundation
- Bundled ffmpeg/ffprobe resolver plus a probe worker in `server/analysis/`. It computes hash, streams, loudness, silences, black/freeze and shots.
- A sidecar store keyed by sha256, with `library.json` status and summary fields and migration of existing assets.
- A job queue: concurrency 2, persisted queue state, progress events over the existing editor bridge, cancel and resume.

### Phase 2: model stages
- **Transcribe** via the provider, with chunking and capability detection.
- **Look**: keyframes, then contact sheets (≤12 labelled frames at 768 px), then one vision call per sheet with a strict JSON schema; one call per image.
- **Summarize**: one text call for the summary, tags, scenes and music sections.
- Tiers and the estimate run as a dry run that computes counts without calling models.

### Phase 3: agent surface
- The library digest is added to the assistant's context, capped and sorted by recency.
- Tools: `get_asset_analysis`, `search_assets` (transcripts, captions and tags), `view_asset_range` (frames + waveform + words PNG, built with ffmpeg) and `analyze_assets`.
- Prompt rules: snap to words and silences with padding; read before watching.

### Phase 4: media UI
- Card badges, "Analyze library" and per-asset Analyze with an estimate dialog.
- An asset drawer with tabs:
  - Transcript: clickable words that seek and preview.
  - Shots: thumbnails with captions.
  - Description.
  - Audio: loudness and silences.
- Media analysis and Privacy tabs in the assistant settings modal: transcription model, vision model, default tier and per-provider consent.

### Phase 5: lyrics
- **Paste-lyrics alignment** (requires transcription to be enabled).
  1. Transcribe, using the pasted lyrics as the transcription `prompt` to bias recognition.
  2. Align the lyric tokens to the recognized words with a global sequence alignment (normalized text with fuzzy matching), so matched words take ASR timings as anchors.
  3. Interpolate unmatched words between anchors and give them a confidence score.
  4. Keep the user's line breaks so each lyric line becomes one timed line.
  - Low-confidence spans are flagged in the drawer for manual nudging.

## Final decisions (continued)

6. **Default tier for "Analyze library" is Balanced**: probe, shots, ≤100 keyframes per asset, captions and summary, plus transcription *only if it is enabled*.
7. **The assistant may start analysis itself** with `analyze_assets`. The same estimate/confirmation dialog the UI uses blocks the run until the user approves it. Probe-only runs, which are free, don't ask.

## Phase order (final)

1. **Foundation**: bundled ffmpeg, probe, sidecar store, job queue.
2. **Model stages**: Look, Summarize and opt-in Transcribe; tiers; estimate.
3. **Agent surface**: digest, `get_asset_analysis`, `search_assets`, `view_asset_range`, `analyze_assets` with confirmation.
4. **Editing core**: element-limit increase and `apply_edit_list`; ripple delete/insert; edge fades and crossfades; project fps and resolution; export loudness normalization; audio track selection and detach audio; `view_timeline_range`.
5. **Media UI**: badges, Analyze with the estimate dialog, asset drawer, Analysis settings and consent.
6. **Lyrics**: paste-lyrics alignment.

## Gap analysis: what video-use can do that KamiKami cannot yet

video-use edits footage by assembling ranges from raw takes (an EDL), cutting on word boundaries, smoothing audio at cuts, normalizing loudness and checking its own render. Checked against KamiKami's code and tools:

| video-use capability | KamiKami today | Gap | Severity |
| --- | --- | --- | --- |
| Assemble many source ranges into one sequence (EDL) | Possible one clip at a time (`add_media` + trim/offset) | **Element limit of 40.** A 5-minute talking-head cut often has 60–150 segments. There is no batch "apply cut list" operation either | **Blocker** |
| Remove a range and close the gap (silences, ums, bad takes) | Split, delete, then move the following clips by hand | **Ripple delete/insert** across all layers, and "cut these source ranges" in one undoable step | **Blocker** for transcript-driven editing |
| Long raw takes and multi-take sessions | 10-minute composition, 500 MB per import | Raise or tier the limits; ideally reference large files in place instead of copying them | High |
| Output at the source's frame rate, resolution and aspect (29.97/60 fps, 9:16 vertical) | Fixed 1920×1080 at 24 fps | **Project frame rate and resolution settings**, including vertical presets | High |
| 30 ms audio fades at every cut to avoid clicks; crossfades | None (volume keyframes can do it manually) | **Automatic edge fades** on audio/video clips plus crossfades on adjacent clips | High |
| Two-pass loudness normalization (−14 LUFS social, −23 broadcast) at export | None | **Loudnorm on export** (ffmpeg on the rendered mix, which the bundled ffmpeg enables) plus an export loudness target | Medium |
| Choose the audio track of multi-track recordings (OBS mic vs desktop) | First track only | **Audio track selection** per element (the probe already counts tracks) | Medium |
| J/L cuts: audio leads or trails video | A video's audio is locked to its picture | **Detach audio** into its own element, with an offset | Medium |
| Self-review of rendered cuts (frames around each cut ±1.5 s plus a waveform) | `render_frame` returns one composition frame | **`view_timeline_range`** (rendered frames plus a mixed-audio waveform for a range), the output-side twin of `view_asset_range` | Medium |
| Project memory of editorial decisions across sessions (`project.md`) | Conversation history only | **Editorial notes** saved with the project and given to the assistant | Low–medium |
| Speed changes and freeze frames | None | **Clip speed / time remap** (Remotion `playbackRate`) and freeze frame | Low for talking heads, high for montage |
| Fast cut-only renders (ffmpeg concat) | Every export renders through Chromium | Optional **fast path** for edits without effects | Low (performance) |
| Auto grade from measured levels (`signalstats`) | Manual Color grade effects | The probe can record levels; an "auto-correct exposure" recipe can use them | Low |

Recommendation: plan an **"Editing core"** phase between Phases 3 and 4. It would cover:

1. Raising the element limit (or adding nested sequences) and a batch `apply_edit_list` tool, since cut lists are applied in one step.
2. Ripple delete/insert.
3. Edge fades and crossfades.
4. Project fps and resolution settings.
5. Loudness normalization on export.
6. Audio track selection and detach audio.
7. `view_timeline_range` for self-review.

Speed ramps, the fast render path and editorial notes can follow. Without items 1 and 2, the analysis can tell the agent *where* to cut but not let it make dozens of cuts reliably.

## Risks

- Many OpenAI-compatible proxies lack `/audio/transcriptions` or ignore word timestamps. Detect capability up front and validate the response.
- Requests have a 25 MB limit, so audio must be chunked.
- Word timings drift by about 50–100 ms; padding rules apply.
- ASR on sung lyrics is unreliable without vocal separation.
- Uploading private media needs explicit consent.
- The schema must stay factual to avoid over-engineering.
