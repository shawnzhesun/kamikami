// The command MCP clients register (`node server/mcp.mjs`). It loads the
// TypeScript server so tool definitions share the app's source schemas.
import { register } from "tsx/esm/api";
register();
await import("./mcp-server.ts");
