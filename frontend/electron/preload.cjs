const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("srghDesktop", Object.freeze({
  platform: process.platform,
  isDesktop: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  openChat: (roomId) => ipcRenderer.send("chat:open-window", roomId),
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
  notify: (title, body, sound, roomId) => ipcRenderer.send("notification:show", { title, body, sound, roomId }),
  logout: () => ipcRenderer.send("auth:logout"),
  saveCredentials: (employeeNumber, password) => ipcRenderer.invoke("auth:save-credentials", { employeeNumber, password }),
  getCredentials: () => ipcRenderer.invoke("auth:get-credentials"),
  clearCredentials: () => ipcRenderer.invoke("auth:clear-credentials"),
}));
