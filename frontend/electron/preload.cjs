const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("srghDesktop", Object.freeze({
  platform: process.platform,
  isDesktop: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  openChat: (roomId) => ipcRenderer.send("chat:open-window", roomId),
  openImageViewer: (roomId, fileId) => ipcRenderer.send("image:open-viewer", { roomId, fileId }),
  openExternal: (url) => ipcRenderer.send("external:open", url),
  openOrganization: () => ipcRenderer.send("organization:open-window"),
  openNotice: (noticeId) => ipcRenderer.send("notice:open-window", noticeId),
  composeNotice: () => ipcRenderer.send("notice:compose-window"),
  applySettings: (settings) => ipcRenderer.send("settings:apply", settings),
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
  onAutoAway: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("presence:auto-away", listener);
    return () => ipcRenderer.removeListener("presence:auto-away", listener);
  },
  onAutoActive: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("presence:auto-active", listener);
    return () => ipcRenderer.removeListener("presence:auto-active", listener);
  },
  notify: (title, body, sound, roomId) => ipcRenderer.send("notification:show", { title, body, sound, roomId }),
  logout: () => ipcRenderer.send("auth:logout"),
  saveCredentials: (employeeNumber, password) => ipcRenderer.invoke("auth:save-credentials", { employeeNumber, password }),
  getCredentials: () => ipcRenderer.invoke("auth:get-credentials"),
  clearCredentials: () => ipcRenderer.invoke("auth:clear-credentials"),
  setOpacity: (value) => ipcRenderer.send("window:set-opacity", value),
  listDisplays: () => ipcRenderer.invoke("capture:list-displays"),
  captureScreen: (displayId) => ipcRenderer.invoke("capture:screen", displayId),
  startRegionCapture: () => ipcRenderer.send("capture:start-region"),
  completeRegionCapture: (dataUrl) => ipcRenderer.send("capture:region-complete", dataUrl),
  cancelRegionCapture: () => ipcRenderer.send("capture:region-cancel"),
  onRegionCapture: (callback) => {
    const listener = (_event, dataUrl) => callback(dataUrl);
    ipcRenderer.on("capture:region-result", listener);
    return () => ipcRenderer.removeListener("capture:region-result", listener);
  },
}));
