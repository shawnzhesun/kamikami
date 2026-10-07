const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("kamikamiAssistant", {
  saveSettings: (settings) =>
    ipcRenderer.invoke("assistant:save-settings", settings),
  clearSettings: () => ipcRenderer.invoke("assistant:clear-settings"),
});
