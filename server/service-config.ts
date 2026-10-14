/**
 * Where the local service listens. Defaults are what the desktop app uses;
 * the environment overrides exist so isolated runs (tests/mcp-e2e.ts) never
 * touch a running app or the user's workspace.
 */
export const servicePort = Number(process.env.KAMIKAMI_PORT) || 4318;
export const editorPort = Number(process.env.KAMIKAMI_EDITOR_PORT) || 5173;
export const serviceOrigin = `http://127.0.0.1:${servicePort}`;
/** Workspace folder; empty means the repo's .kamikami. */
export const dataOverride = process.env.KAMIKAMI_DATA ?? "";
