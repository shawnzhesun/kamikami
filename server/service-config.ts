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
/**
 * Set by the installed app (electron/service.cjs), which ships prebuilt
 * output instead of sources: the editor build to serve, the Remotion bundle,
 * Remotion's headless browser, and the MCP launcher clients register.
 */
export const packaged = {
  editorDist: process.env.KAMIKAMI_EDITOR_DIST ?? "",
  renderBundle: process.env.KAMIKAMI_RENDER_BUNDLE ?? "",
  browser: process.env.KAMIKAMI_BROWSER ?? "",
  mcpCommand: process.env.KAMIKAMI_MCP_COMMAND ?? "",
};
