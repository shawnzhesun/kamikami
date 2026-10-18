# Assistant and MCP

Agents edit the open project through one tool list and two transports:

- the **native assistant** in the app's Assistant tab;
- **MCP**, for Claude Code, Codex or any MCP client.

Both see the same tools and run them through the same dispatcher:

| Piece | File |
| --- | --- |
| Tool definitions (names, descriptions, inputs, access level) | `server/editor-tools.ts` |
| Dispatcher: routing, confirmations, images | `server/tool-runner.ts` (`runTool`) |
| Conventions every agent gets | `server/agent-conventions.ts` |
| Native transport | `server/assistant.ts` (calls `runTool` in-process) |
| MCP transport | `server/mcp.mjs` → `server/mcp-server.ts`, a stdio proxy to `POST /api/agents/tool` |
| Editor commands | `server/editor-bridge.ts` → `src/agent-protocol.ts` (validation) → `src/App.tsx` |

Tool inputs use the source enums and schemas (shape and backdrop kinds, roles, keyframe easings), so the tool list never restates values that can change. Counts, limits and the effect library come from the tools themselves: `tools/list`, `get_capabilities` (`limits`, `effectLibrary`, `tools`, `conventions`), `find_effects` and `describe_effect`.

The conventions reach agents three ways: `get_capabilities.conventions`, the MCP server instructions, and the native system prompt. The editing skill, `.agents/skills/kamikami-editor/SKILL.md`, reaches MCP clients three ways (`server/editor-skill.ts`):

- the resource `kamikami://editing-skill`;
- the prompt `editing-skill`, which Claude Code lists as `/mcp__kamikami__editing-skill`;
- **Install skill** in **Agent apps**, which copies it into `~/.claude/skills/kamikami-editor/` (Claude Code) or `~/.agents/skills/kamikami-editor/` (Codex and other Agent Skills apps), so agents load it when a task calls for it. The panel shows whether each copy matches this version.

## Transport differences

The tools are the same; only confirmation differs, because MCP has no in-app dialog.

| | Native assistant | MCP |
| --- | --- | --- |
| Deleting or ripple-removing elements, `apply_project` removing elements, shortening the project | The app lists the affected elements and asks | The client's own permission prompt; these tools carry `destructiveHint` |
| `delete_media` on used media | The app asks | Returns `requiresConfirmation`; retry with `confirmUsed: true` |
| `analyze_assets` model tiers | The app shows the estimate and asks | Returns `needsConfirmation` with the estimate; retry with `confirmed: true` |
| `import_media`, `import_font` | The app asks for each file (the paperclip also attaches files) | Imports directly |
| Images (`render_frame`, `get_render`, `view_asset_range`, `view_timeline_range`) | Attached to the conversation and shown as artifacts | Returned as image content |

MCP annotations come from each tool's `access`: `read` sets `readOnlyHint`, `edit` sets `destructiveHint`.

## Native assistant

1. Open **Assistant → Connect assistant**.
2. Set a name, base URL, API key, model, and API format: Responses (default) or Chat Completions, for LiteLLM and other OpenAI-compatible proxies. **Load models** lists the endpoint's models.
3. Select clips and describe the edit. The selection and playhead go with each message; the paperclip imports and attaches files.

- **Connection:** the base URL must be HTTPS, or HTTP on localhost. Environment variables override saved values: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_CONNECTION_NAME`, `OPENAI_API_MODE` (`responses` or `chat`). The same connection runs media analysis, including analysis MCP clients request.
- **Credentials:** Electron encrypts them with `safeStorage` (`userData/assistant-connection.enc`); Linux `basic_text` is refused. Browser mode keeps the key in service memory only. The key never reaches the renderer or conversation files.
- **History:** conversations are saved in `.kamikami/assistant.json`.
- **Runs** are bounded in rounds, steps and time (`server/assistant.ts`). Tools run one at a time. **Stop** aborts model work and new tool calls. Edits in one request share one undo step; a manual edit breaks the group.
- **Data sent** to the provider: messages, project data, tool results, library metadata and requested PNG frames. Analysis tiers also send frames, images and audio, only after you approve the estimate. Responses requests use `store: false`.

## MCP (Claude Code, Codex)

**Installed app:** **Assistant settings → Agent apps** shows the commands for this install. They register `kamikami-mcp`, a launcher in the app's resources that runs the MCP server on the app's own runtime, so users need no Node. The first tool call opens KamiKami if it isn't running. See [distribution.md](distribution.md).

**From source:** keep the editor open (`npm run desktop`), then register the stdio server with absolute paths:

```sh
claude mcp add --transport stdio --scope local kamikami -- $(which node) /abs/path/kamikami/server/mcp.mjs
codex mcp add kamikami -- $(which node) /abs/path/kamikami/server/mcp.mjs
```

- **Skill:** Claude Code finds `/kamikami-editor` through `.claude/skills/` (a symlink); Codex finds `$kamikami-editor` in `.agents/skills/`.
- **Connection:** the server talks to the service on `127.0.0.1` (port 4318 unless `KAMIKAMI_PORT` is set), with a heartbeat; `GET /api/agents` lists connected clients. Restart the MCP server after changing tool definitions.
- **Timeouts:** editor commands time out after 30 s. A timeout can mean the edit happened, so read the project before retrying.
- **Files:** `save_project` writes the user's project file once they've chosen one with Save (`get_project.projectFile`); agents never open file dialogs. A finished `get_export` returns the MP4's absolute `file` path.
- **Isolated runs:** `KAMIKAMI_PORT`, `KAMIKAMI_EDITOR_PORT` and `KAMIKAMI_DATA` move the service, editor and workspace (`server/service-config.ts`); `KAMIKAMI_USER_DATA` moves the desktop app's profile. `npm run test:e2e` uses them to drive a whole music video through MCP without touching the running app or `.kamikami/`.
- **Analysis:** MCP needs no model key of its own; model tiers use the native assistant's connection.

## Adding a tool

See [AGENTS.md](../AGENTS.md#adding-things). `tests/agent-tools.test.ts` checks that every editor tool's inputs match its command schema and that access levels are deliberate.
