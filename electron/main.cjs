const {
  app,
  BrowserWindow,
  dialog,
  session,
  nativeImage,
} = require("electron");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { bundled, editorOrigin } = require("./runtime.cjs");
// Keep existing installations' encrypted credentials and local preferences.
const legacyProfile = path.join(app.getPath("appData"), "frameforge");
const currentProfile = path.join(app.getPath("appData"), "KamiKami");
const useLegacyProfile =
  existsSync(legacyProfile) && !existsSync(currentProfile);
// Electron selects the OS encryption service before ready. Preserve that identity
// for legacy profiles, then apply the new display name after initialization.
app.setName(useLegacyProfile ? "frameforge" : "KamiKami");
app.setPath(
  "userData",
  // Isolated runs (like KAMIKAMI_PORT and KAMIKAMI_DATA) keep their own profile.
  process.env.KAMIKAMI_USER_DATA ||
    (useLegacyProfile ? legacyProfile : currentProfile),
);
// One app owns the service port and the workspace. A second launch (including
// one an MCP client starts) focuses the open window instead.
if (!app.requestSingleInstanceLock()) app.exit(0);
let win = null;
app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(async () => {
  app.setName("KamiKami");
  if (bundled)
    try {
      await require("./service.cjs")();
    } catch (error) {
      dialog.showErrorBox("KamiKami could not start", error.message);
      return app.exit(1);
    }
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../public/kamikami-icon-macos.png"),
  );
  if (process.platform === "darwin") app.dock.setIcon(icon);
  require("./project-files.cjs").installProjectFiles();
  await require("./assistant-credentials.cjs")();
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  win = new BrowserWindow({
    width: 1510,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#F5EBDD",
    title: "KamiKami",
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: require("node:path").join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== editorOrigin) event.preventDefault();
  });
  win.loadURL(editorOrigin);
});
app.on("window-all-closed", () => app.quit());
