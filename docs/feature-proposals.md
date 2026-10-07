# Editing milestone and next feature proposals

## Completed — October 6, 2026

Shawn approved these four additions, now implemented:

| Feature | Included |
| --- | --- |
| Canvas editing | Click selection, Shift multi-selection, drag movement, proportional corner resize, rotation, center alignment, snapping guides, keyboard nudges, double-click text editing. Each gesture commits once; Escape cancels. |
| Timeline tools | Edge trimming, split selected clips at the playhead, group movement, zoom/fit, snap to clip edges and playhead, keyboard trim and movement. Split/trim preserve source offsets and existing effect timing. |
| Media and audio browser | Persistent asset library, search/type filters, thumbnails, metadata, playback, source waveforms, add at playhead, mute/solo, missing-source detection and relinking. |
| Effect hover previews | Each effect animates its real settings on a sample graphic on hover or keyboard focus, with explicit play/stop and reduced-motion support. |

## Workspace and external agents — completed

- Removed the duplicate Layers tab; the timeline owns layer selection/order.
- Resizable Media/Effects library, persistent width, responsive media/effects grids, and consolidated import/project controls.
- Removed the timeline shortcut bar; mouse grip dragging and keyboard arrows reorder the stack in one Undo step.
- Replaced built-in chat with Codex/Claude Code MCP setup, repository skills, and real session status.
- MCP now exposes 37 tools for editing, media lifecycle, rendered frame review, reusable effect authoring, export, and history with revision checks.

## Compact libraries and effect authoring — completed

- Inspector precedes Agents; Add text is only in the timeline toolbar.
- Compact effect cards drag directly onto visual timeline clips. Pointer cancellation and Undo are supported; Enter applies to selected layers and double-click opens Inspector.
- Media deletion confirms affected clips, removes them, and retains source files in recoverable Media trash. Undo restores clips and media.
- Agents can create, test using actual rendered PNGs, save and share versioned effect bundles. Persistent My effects is independent of the project.
- A Claude Code session created the included Retro title sway example. See [the audit](mcp-audit.md) for coverage and limits.

## Remaining proposals — discuss before implementation

| Feature | Proposed scope |
| --- | --- |
| Project management | New/open/recent projects, Save As, named versions, portable bundles with media. |
| Keyframes and motion presets | Transform/opacity keyframes, easing controls, reusable presets. |
| Agent motion review | Multi-frame contact sheets, motion comparisons, audio review and stronger automated visual evaluations. Single-frame rendering and independent effect snapshots are implemented. |
| Export controls | Size/frame-rate presets, destinations, cancellation, queue/history, reveal in folder. |

These remain proposals. No implementation is scheduled until we agree on the next scope.

## Native assistant — implemented October 6, 2026

The Assistant panel replaces the MCP setup screen. It supports conversation history, selected-clip and playhead context, streamed replies, tool progress, cancellation, media attachments, deletion confirmation, grouped project Undo, actual rendered frame previews, and portable effect downloads. OpenAI API configuration is available in the panel, with encrypted credential storage in Electron where supported. External MCP remains an optional integration.

Future product decisions: managed sign-in and usage billing, additional model providers, and richer comparison previews. These are not prerequisites for using the native assistant with an API account.
