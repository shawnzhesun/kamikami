const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("kamikamiProjectFiles", {
  info: () => ipcRenderer.invoke("project-file:info"),
  open: () => ipcRenderer.invoke("project-file:open"),
  accept: (token) => ipcRenderer.invoke("project-file:accept", token),
  save: (text, name) => ipcRenderer.invoke("project-file:save", text, name),
  forget: () => ipcRenderer.invoke("project-file:forget"),
});
contextBridge.exposeInMainWorld("kamikamiAssistant", {
  saveSettings: (settings) =>
    ipcRenderer.invoke("assistant:save-settings", settings),
  clearSettings: () => ipcRenderer.invoke("assistant:clear-settings"),
});
