const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("srghDesktop", Object.freeze({
  platform: process.platform,
  isDesktop: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:maximize-toggle"),
  close: () => ipcRenderer.send("window:close"),
}));
