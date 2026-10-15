const { app } = require("electron");
const path = require("node:path");

/**
 * Where the editor and service live. Development runs the service from source
 * and the editor on Vite (`npm run desktop`). The installed app, or
 * `KAMIKAMI_BUNDLED=1` against a local `npm run build:desktop`, runs the built
 * service, which also serves the built editor.
 */
const bundled = app.isPackaged || process.env.KAMIKAMI_BUNDLED === "1";
const servicePort = Number(process.env.KAMIKAMI_PORT) || 4318;
const serviceOrigin = `http://127.0.0.1:${servicePort}`;
const editorOrigin = bundled
  ? serviceOrigin
  : `http://127.0.0.1:${Number(process.env.KAMIKAMI_EDITOR_PORT) || 5173}`;
const appRoot = path.join(__dirname, "..");

module.exports = { bundled, servicePort, serviceOrigin, editorOrigin, appRoot };
