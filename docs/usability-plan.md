# Usability and retro theme plan

## Scope

Fix the issues identified in the hands-on review and closely related editing problems. Apply the supplied palette: cream `#F5EBDD`, coral `#F2765E`, blue `#315B8C`, brown `#413333`. Remove left-edge highlights from cards and buttons. Preserve existing project artwork and data.

## Implementation

- [x] Confirm affected clips before shortening the composition; support cancel and a single Undo.
- [x] Group continuous text edits into one undo transaction.
- [x] Keep invalid numeric drafts visible with accessible errors and an Escape reset.
- [x] Bring effect controls into view and explain shared effect edits.
- [x] Make selection consistent in the library and timeline.
- [x] Remove decorative dropdown affordances; make project-name navigation useful.
- [x] Show live clip position while dragging; keep drag changes in one Undo step.
- [x] Hide visual controls for audio, guard disconnected agent submission, label icon controls, and disable unavailable actions.
- [x] Apply the retro palette with readable typography and selection states without left-edge bars.
- [x] Run automated regression/build checks and verify the Electron UI.
- [x] Publish a proposed feature backlog for discussion, without implementing it yet.

## Original usability verification — October 6, 2026 (before MCP replacement)

- `npm test`: 15 tests passed, including grouped history, redo branching, history capacity, duration proposals, numeric validation and frame-aligned clip movement.
- `npm run build`: TypeScript and Vite passed. Existing dependency annotation and bundle-size warnings remain.
- `npm run test:service`: request validation, disconnected-agent behavior, image/audio imports, and MP4 rendering/download passed.
- Electron checks: cream/coral/blue/brown theme; no selected-card left stripe; grouped name Undo; invalid numeric entries and Escape; shortening dialog via Enter and blur; cancel and confirm; one Undo restores all clip timings; effect settings scroll/focus; header project shortcut; consistent selection; frame-by-frame keyboard scrubbing; audio controls and disabled visual effects; disconnected composer; clip dragging; rounded fields do not cause extra edits.
- Layout reviewed at approximately 1440×980 and 1120×780. Panels scroll independently and the preview retains its full aspect ratio.
- Test edits were undone. The saved project was compared against the pre-change backup and matched exactly.
- Live model requests were not tested because no API key is configured.

Feature proposals: [feature-proposals.md](feature-proposals.md).

## Approved editing milestone — October 6, 2026

- [x] Canvas selection, movement, proportional resize, rotation, center alignment/snapping, keyboard nudges, and double-click text editing.
- [x] Timeline trimming, split, zoom/fit, snapping, and multiple clip selection/movement.
- [x] Persistent media library, thumbnails, source details, waveforms, playback, mute/solo, and missing-source recovery.
- [x] Actual effect previews on a sample graphic, with hover/focus playback, explicit play/stop, and reduced-motion support.

Validation: 24 regression tests and TypeScript/Vite build passed. Service checks passed media catalog/metadata operations, import, and MP4 render/download. Electron checks covered direct canvas editing and Undo, timeline trim/split/group movement/zoom, effect sample playback, image/audio import and reuse, waveform and playback controls, mute/solo, missing-image placeholders, and audio/image relinking. The pointer-release issue discovered during resize testing was fixed and retested. Build retains dependency annotation and bundle-size warnings.

The original project was restored through Open project, saved, and compared to the pre-feature backup after schema normalization. Test-only catalog entries, media copies, and the new smoke export were archived outside the workspace. Existing media files were preserved.

## Workspace and MCP enhancements — October 6, 2026

- [x] Remove the duplicate left Layers tab and consolidate project/import controls in Media.
- [x] Resize the library by dragging or keyboard; persist width and adapt media cards to two columns.
- [x] Remove timeline hotkey instructions; add mouse/keyboard layer reordering with Undo.
- [x] Replace chat and the server-side model dependency with stdio MCP tools, setup instructions, and actual connection status.
- [x] Include a validated editing skill discoverable by Codex and Claude Code.
- [x] Test tool discovery, live project/media reads, title edits, effects, ordering, selection, seek, save, revision conflict rejection, Undo/Redo, and restoration.

Validation: 27 regression tests, TypeScript/Vite build, skill validator, MCP integration, and media/import/MP4 service checks passed. An actual Claude Code session called the two read-only MCP tools successfully. Desktop checks verified resizing, width persistence after reload, mouse reordering and Undo, active-field protection, and live client/disconnection display. Layout was checked at approximately 1440×980 and 1130×790, including maximum width, reset, and responsive effect samples. The original composition was restored after tests. The earlier built-in-chat verification above is historical; that implementation has been removed.

## Compact effects, deletion and agent authoring — October 6, 2026

- [x] Inspector first; timeline owns Add text.
- [x] Compact effect cards without action buttons; pointer drag to clip, keyboard apply and double-click inspection.
- [x] Media deletion with affected-clip confirmation, Cancel, recoverable trash and Undo restoration.
- [x] Persistent user effects with validated version/engine metadata and portable import/export.
- [x] MCP parity for composition/media/effect editing, source analysis/recovery, playback, PNG frame inspection and MP4 export.
- [x] A real Claude Code session creates, applies, visually inspects, saves and exports an effect, then restores the original composition.

See [mcp-audit.md](mcp-audit.md) for the full feature/tool mapping and repeatable checks. The demo effect is available in My effects and `examples/effects/retro-title-sway.kamikami-effect.json`.

## Native assistant — October 6, 2026

- [x] Replace the MCP instructions with a native Assistant panel and in-app model setup.
- [x] Share the existing editor tool catalog and revision-protected bridge.
- [x] Preserve conversations across tab changes and reloads.
- [x] Include selected clip/playhead context, starter prompts and media attachments.
- [x] Stream replies, show tool progress and rendered previews, and allow cancellation.
- [x] Group consecutive assistant project edits for Undo; preserve intervening manual edits.
- [x] Confirm destructive changes and show actionable model/service errors.
- [x] Keep advanced MCP integration functional outside the primary panel.

Validation uses automated model/provider fixtures and native Electron interaction because no live API credential is configured. See `docs/native-assistant.md` for test coverage and remaining limitations.
