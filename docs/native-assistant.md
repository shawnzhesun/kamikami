# Native assistant

The Assistant tab replaces the MCP instruction screen. This is a working native chat and tool runtime, rather than an embedded developer-agent terminal.

## Use

1. Open Assistant → Connect assistant.
2. Supply a connection name, base URL, API key, API format and model/deployment. Use Responses for models requiring it, or Chat Completions for compatible proxies. Load models reads available aliases from the saved endpoint. The connection is used on the next request; provider access and billing errors appear in the conversation.
3. Select clips and describe an edit. The selected clips and current playhead are attached to the request. The paperclip imports files into the media library and attaches their identifiers to the message.
4. Review live edits, expand the action log, inspect returned frame previews, and download exported effects or video.
5. Stop prevents further tool calls and aborts model work. An editor operation already delivered is allowed to acknowledge completion before the task ends. Completed edits remain available for Undo.

The conversation stays mounted while Inspector is open. Selecting timeline or canvas layers keeps the assistant visible and updates the context chip. Conversation messages persist in `.kamikami/assistant.json`. Starting a new conversation clears the chat without changing the composition.

## Integration

- Responses and OpenAI-compatible Chat Completions streaming (including LiteLLM), explicit serial tool execution, validated tool arguments and bounded runs (30 model rounds, 60 tools, ten minutes).
- 40 native model tools from the same catalog as the 41 MCP tools. The remaining MCP tool, absolute-path `import_media`, is replaced by the native file attachment chooser. The native model has no arbitrary filesystem or shell access.
- All live editor commands pass through `EditorBridge` and the same validated editor handler used by external agents. Content mutations require the current revision. No silent project-file replacement.
- Native requests carry a private history group and a native-origin flag. Chat/composer focus does not block native edits; active canvas gestures, dialogs and Inspector fields still do. External MCP requests do not receive that focus exception.
- Consecutive project mutations in a request share an Undo entry. A manual content edit breaks that group; the panel's Undo button is available only when the assistant owns the latest entry. Project Undo does not remove exported files, imported assets, or saved user-effect library entries.
- Destructive layer removal, deletion of used media, and duration shortening show a concrete affected-clip confirmation. Revision checks still run after approval.
- Frame rendering uses the existing actual Remotion PNG job. PNGs are returned to the model and displayed in chat. Saved history contains local image URLs, not base64 image payloads. Effect bundles are downloadable declarative JSON recipes.
- Model failures, validation failures, provider limits, disconnection, cancellation and interrupted app restarts have explicit states. Retry is user-directed to avoid duplicating edits.

## Credentials and data

Electron stores credentials encrypted through `safeStorage` when OS-backed encryption is available; Linux `basic_text` is not used for persistence. A narrow preload bridge accepts connection changes without exposing filesystem access. Saved credentials are not returned to the renderer. If secure storage is unavailable, the key remains in service memory for that session. Browser mode also uses service memory only. Environment-provided credentials remain supported.

Only local loopback services accept editor requests. The model key is never included in assistant state or conversation files. Responses requests use `store: false`. Chat Completions uses the proxy’s chat endpoint without Responses-specific fields. Custom Responses endpoints omit OpenAI-only encrypted-reasoning request fields. Project content, messages, tool results/library metadata and requested rendered frames are sent to the configured model provider. Raw source video/audio files are not uploaded by the model adapter.

## Verification — October 6, 2026

Automated tests cover native/MCP tool catalog parity, multi-step edits and grouped Undo, live revisions and manual-edit conflicts, approval/decline, stopping generation and confirmations, cancellation before/after command delivery, invalid tools and parameters, credential redaction, history persistence and interruption recovery, rendered image delivery, and the real OpenAI SDK's streamed protocol handling with fixture responses.

Electron QA uses an explicitly preloaded deterministic provider fixture (`tests/fixtures/assistant-provider.mjs`). It does not contact a model provider. A native message added and styled a temporary title in the real editor; one panel Undo restored both changes. Tab switching preserved the conversation, clip selection updated the context without closing the panel, deletion was declined without changing the project, and Stop cancelled an in-progress request. Test conversation and provider configuration are removed before returning to normal operation.

Subsequent LiteLLM verification authenticated successfully with the saved user key and fetched the model list. A live user request using Responses mode completed effect creation, application, and two rendered-frame reviews successfully. The existing external MCP/model verification is documented separately in `mcp-audit.md`.

## Remaining product work

Managed KamiKami sign-in and billing, additional model providers, multi-project chat sessions, and richer side-by-side comparisons are not implemented. The assistant cannot generate source media, transcribe audio, or execute arbitrary effect code; it uses the editor's existing capabilities.

## Proxy configuration and UI cleanup

Connection name, base URL, API format and model alias persist with the existing encrypted credential storage. Model aliases can contain provider prefixes and spaces. URL validation requires HTTPS except for loopback development servers, rejects URL credentials/query strings/fragments, and normalizes trailing slashes. Changing endpoints requires a new key or explicitly choosing Use saved key for this URL. Older encrypted OpenAI connections migrate with their original endpoint.

Persistent instructional copy was removed from the library footer, effects gallery, Inspector, canvas toolbar, media browser, assistant welcome and idle footer. Tooltips, accessibility labels, confirmations, empty states and active progress remain.

### Effect collections

Assistant-created effects automatically save to **My effects**. Refinements update the same saved entry, including edits made in the Inspector. Existing custom project definitions migrate there without changing their IDs or clip instances. Applying an effect keeps its rendering definition in the project without adding a duplicate gallery card. Saved effects remain available after project Undo or removal from clips.

Export a My effects entry from its Inspector as a `.kamikami-effect.json` bundle. Importing a bundle adds an independent copy to the **Local effect library**, preserving author and sharing terms and assigning a new effect ID. The bundle format remains version 1; collection membership belongs to this workspace, not to the portable file.

Independent timeline layers use `create_track`, `update_track`, `delete_track` and `reorder_tracks`. Element tools retain their legacy names. See [layer and element conventions](timeline-layers.md).
