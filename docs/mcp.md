# Connect an external agent to KamiKami

MCP is an optional advanced integration. The app’s **Assistant** tab now provides native chat. To use an external client, start `npm run desktop` and leave the editor open. Run the appropriate command below with the absolute Node executable and repository paths, then start a fresh client session in the KamiKami repository.

```sh
# Replace both paths for this machine. Run `which node` to find Node.
codex mcp add kamikami -- /absolute/path/to/node /absolute/path/to/kamikami/server/mcp.mjs
claude mcp add --transport stdio --scope local kamikami -- /absolute/path/to/node /absolute/path/to/kamikami/server/mcp.mjs
```

Choose the command for your client. Check `/mcp` in the client after restarting its session. Codex registers the server in its user configuration; Claude's command uses the current project's local scope. KamiKami does not change either configuration automatically.

## Editing skill

Codex discovers `.agents/skills/kamikami-editor/SKILL.md`; Claude Code discovers the same skill through `.claude/skills/kamikami-editor`. Invoke `$kamikami-editor` in Codex or `/kamikami-editor` in Claude Code. The MCP resource `kamikami://editing-skill` also exposes these conventions to clients supporting resource reads.

Try: “Inspect the project, add a title saying Hello KamiKami for the first three seconds, and move it above the other layers.” Review the result in KamiKami; each edit is undoable.

## Controls and effect authoring

The server exposes 43 tools for project/layer editing, media import and recovery, timeline operations, playback, effects, actual rendered-frame inspection, reusable effect bundles, history, saving and MP4 export. Read `get_capabilities` for exact schemas and limits. See the [full capability audit](mcp-audit.md) for the tool-to-editor mapping and verification scope.

For a new effect: read the effect schema, use `create_effect`, apply it to a visual element, inspect `render_frame` images at meaningful times, then refine the applied instance with `update_effect_instance`. Creation automatically saves the preset to **My effects**. Use `update_effect` to revise your own preset for future applications; existing instances keep their own settings. `save_user_effect` can copy an effect into My effects. `export_effect_bundle` returns shareable `.kamikami-effect.json`; another user imports it into the **Effect Library** through the Effects tab or `import_effect_bundle`. Imported bundles get independent IDs; applying them does not duplicate the gallery card. Bundles contain declarative settings and an engine version, without executable code or external dependencies.

Project mutations require `expectedRevision` from the latest read/edit response. Conflicts are rejected; read again and adapt. Agent edits are blocked while a field, dialog, or pointer gesture is active. A timeout can mean an edit completed without its reply reaching the client; inspect before retrying. Manual and agent changes share history.

Deleting used media returns affected layers and `requiresConfirmation` first. After authorization, retry with `confirmUsed:true` and the latest revision. Media moves to recoverable trash, and its clips are removed. Undo restores the clips and media; `restore_media` restores the library asset alone.

## Connection status and limits

The local `GET /api/agents` endpoint reports initialized MCP clients by name and version. Clients send heartbeats every four seconds; a lost connection expires after fifteen seconds. This indicates a connected client, not that a model is actively thinking. Clean disconnections are removed immediately and reflected by the next status poll.

The local service runs on `127.0.0.1:4318`. The stdio server and editor must run on the same computer. One workspace has one active project and one primary editor session; use one open editor window for agent work. After a service restart, clients reconnect automatically. If the editor is closed, editing tools return an actionable error.

The agent receives structured project data and media identifiers. Rendered PNG frames are returned to the external client and may be sent to its model for visual inspection. The tools do not generate source media or run arbitrary effect code. Your external client determines model access, data handling, and approvals. The external MCP integration needs no KamiKami model API key; the native Assistant has its own connection settings. Import through Media or use `import_media` with an authorized local file path.

## Verification

`npm run test:mcp` connects an official SDK client, exercises the tools and revision checks, and undoes its test changes. Avoid editing while it runs. A real Claude Code integration test uses temporary configuration to create, apply, render, save, export and restore an effect workflow; it does not modify global client settings. Codex configuration was checked against official documentation; a Codex model session has not been tested.

Official references:
- Codex MCP: https://developers.openai.com/codex/mcp
- Codex skills: https://developers.openai.com/codex/skills
- Claude Code MCP: https://code.claude.com/docs/en/mcp
- Claude Code skills: https://code.claude.com/docs/en/skills


## Layer and element separation

There are now 42 MCP tools. `project.tracks` contains named timeline layers, ordered bottom to top. The legacy `project.layers` field contains individual elements (clips, audio and text), each referencing its containing layer through `trackId`. Existing `layerId` / `layerIds` tool arguments continue to mean element IDs.

Use `create_track`, `update_track`, `delete_track`, and `reorder_tracks` for timeline layers. `add_text` and `add_media` accept `trackId`; omitting it creates a new layer for compatibility. `move_clips` optionally accepts a destination `trackId`, preserving relative layer positions for multi-element selections. Same-layer overlaps are rejected. Deleting a track removes its elements in one Undo step; native assistant requests confirm affected elements first. See [model details](timeline-layers.md).


Applied effects have independent settings in project version 2. Use `update_effect_instance` with `layerId`, `effectId` and a settings `patch` to change one element. `update_effect` edits your reusable preset for future applications (built-in and imported library originals are read-only; fork with `create_effect` and a new ID) and does not modify applied instances. Each instance stores a complete `settings` snapshot alongside `effectId`, `amount` and `enabled`. Version-1 projects are upgraded on load.
