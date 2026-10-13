---
name: kamikami-editor
description: Edit the open KamiKami video project through MCP, including media, clips, text, shapes, backdrops, effects and overlays, keyframes, media analysis, rendered frame review, exports, and portable user effects. Use for live composition work and effect authoring, not application source-code changes.
---

# KamiKami editing

Work through the KamiKami MCP tools while the app is open. The server is the source of truth:

- **Rules and conventions:** the MCP server instructions, also in `get_capabilities.conventions`. Follow them; this skill doesn't repeat them.
- **Values:** tool input schemas, and `get_capabilities` for JSON schemas, `limits`, and the `effectLibrary` overview (roles, feels, counts). Don't rely on numbers or kind lists from memory or docs.
- **Effects:** `find_effects` and `describe_effect`.

## Workflow

1. **Read.** `get_project` gives the live project, revision, selection, playhead and whether the editor is busy. Project files on disk can lag behind it. For media, read each asset's analysis (`get_asset_analysis`, `search_assets`) before viewing ranges.
2. **Plan small.** Use the focused tool for each change (timing tools for trims and moves, `update_effect_instance` for an applied effect), and pass `expectedRevision` from your latest result. On a conflict, re-read and adapt to the user's changes.
3. **Choose effects.** `find_effects` filtered by `role` and the target's `elementType`; `describe_effect` on the best candidates; `apply_effect`, with `variationId` for a named variation. Build a shot from about one card per role, and give every beat setting the song's tempo.
4. **Check.** `render_frame` at representative frames, or `view_timeline_range` after cuts. Still frames can't prove smooth motion or audio; say so, or use `set_playback`.
5. **Ask when it matters.** Destructive tools need the user's go-ahead. `delete_media` and `analyze_assets` return `requiresConfirmation` / `needsConfirmation`: show the user what's affected or the estimate, and retry with the flag only after they agree.
6. **Report honestly.** Describe only changes and checks that a tool confirmed. Exports are started until `get_export` says done.

## Authoring effects

1. Read the effect schema in `get_capabilities`, and `describe_effect` a card that uses the kind you want, to learn its settings.
2. `create_effect` with a new ID (it's saved to My effects), apply it, render the start, middle and end, then refine with `update_effect`. Library originals are read-only; fork by creating a new ID and keeping `presetFamilyId`.
3. `save_user_effect` sets author and sharing terms, only as the user gave them. `export_effect_bundle` returns a `.kamikami-effect.json` when the user asks; `import_effect_bundle` remaps IDs, so apply the returned ID.
