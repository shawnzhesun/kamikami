const { app, BrowserWindow, session, nativeImage } = require("electron");
const path = require("node:path");
const { existsSync } = require("node:fs");
// Keep existing installations' encrypted credentials and local preferences.
const legacyProfile = path.join(app.getPath("appData"), "frameforge");
const currentProfile = path.join(app.getPath("appData"), "KamiKami");
const useLegacyProfile =
  existsSync(legacyProfile) && !existsSync(currentProfile);
// Electron selects the OS encryption service before ready. Preserve that identity
// for legacy profiles, then apply the new display name after initialization.
app.setName(useLegacyProfile ? "frameforge" : "KamiKami");
app.setPath("userData", useLegacyProfile ? legacyProfile : currentProfile);
app.whenReady().then(async () => {
  app.setName("KamiKami");
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../public/kamikami-icon-macos.png"),
  );
  if (process.platform === "darwin") app.dock.setIcon(icon);
  require("./project-files.cjs").installProjectFiles();
  await require("./assistant-credentials.cjs")();
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  const win = new BrowserWindow({
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
    if (new URL(url).origin !== "http://127.0.0.1:5173") event.preventDefault();
  });
  win.loadURL("http://127.0.0.1:5173");
});
app.on("window-all-closed", () => app.quit());
