const { app, BrowserWindow, ipcMain, safeStorage, screen, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}
if (process.platform === "win32") {
  app.setAppUserModelId("kr.saranghospital.srghtalk");
}

let mainWindow;
let organizationWindow;
const chatWindows = new Map();
const noticeWindows = new Map();
const notificationWindows = [];

function closeAuxiliaryWindows() {
  for (const chatWindow of chatWindows.values()) {
    if (!chatWindow.isDestroyed()) chatWindow.destroy();
  }
  chatWindows.clear();
  for (const noticeWindow of noticeWindows.values()) {
    if (!noticeWindow.isDestroyed()) noticeWindow.destroy();
  }
  noticeWindows.clear();
  if (organizationWindow && !organizationWindow.isDestroyed()) organizationWindow.destroy();
  organizationWindow = undefined;
  for (const notificationWindow of notificationWindows) {
    if (!notificationWindow.isDestroyed()) notificationWindow.destroy();
  }
  notificationWindows.length = 0;
}

function credentialPath() {
  return path.join(app.getPath("userData"), "login-credentials.bin");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function layoutNotificationWindows() {
  const workArea = screen.getPrimaryDisplay().workArea;
  notificationWindows
    .filter(window => !window.isDestroyed())
    .forEach((window, index) => {
      window.setPosition(workArea.x + workArea.width - 354, workArea.y + workArea.height - 112 - index * 106, false);
    });
}

function createNotificationToast(options = {}) {
  const title = escapeHtml(options.title || "사랑톡");
  const body = escapeHtml(options.body || "새 메시지가 도착했습니다.");
  const roomId = Number(options.roomId);
  const actionableRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const toast = new BrowserWindow({
    width: 340,
    height: 94,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  notificationWindows.unshift(toast);
  layoutNotificationWindows();
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:"Malgun Gothic","Noto Sans KR",sans-serif}
    body{padding:6px;background:transparent}
    .toast{position:relative;height:82px;display:flex;align-items:center;gap:12px;padding:13px 16px;color:#26363b;background:linear-gradient(145deg,#fff,#f6fbfc);border:1px solid #cfe3e7;border-radius:16px;box-shadow:0 14px 34px #183a4550;overflow:hidden;animation:enter .24s cubic-bezier(.2,.8,.2,1);cursor:pointer;user-select:none;touch-action:none;transition:transform .18s ease,opacity .18s ease}
    .toast.dragging{transition:none;cursor:grabbing}
    .toast:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:linear-gradient(#16b8d1,#078fa9)}
    .logo{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;color:#fff;background:linear-gradient(145deg,#17b7d0,#078fa9);border-radius:13px;font-size:19px;font-weight:900;box-shadow:0 6px 15px #078fa938}
    .copy{min-width:0;display:grid;gap:5px}.top{display:flex;align-items:center;gap:7px}.top strong{font-size:12px;line-height:1.2}.top span{padding:2px 6px;color:#078fa9;background:#e4f7fa;border-radius:8px;font-size:8px;font-weight:700}
    p{margin:0;overflow:hidden;color:#66777d;font-size:10px;line-height:1.45;text-overflow:ellipsis;white-space:nowrap}
    .dot{position:absolute;right:13px;top:13px;width:7px;height:7px;background:#16b8d1;border-radius:50%;box-shadow:0 0 0 4px #e5f7fa}
    @keyframes enter{from{opacity:0;transform:translateX(24px) scale(.97)}}
  </style></head><body><div class="toast"><div class="logo">S</div><div class="copy"><div class="top"><strong>${title}</strong><span>새 메시지</span></div><p>${body}</p></div><i class="dot"></i></div><script>
    const toast = document.querySelector(".toast");
    let startX = 0;
    let offsetX = 0;
    let dragging = false;
    toast.addEventListener("pointerdown", event => {
      startX = event.clientX;
      offsetX = 0;
      dragging = true;
      toast.classList.add("dragging");
      toast.setPointerCapture(event.pointerId);
    });
    toast.addEventListener("pointermove", event => {
      if (!dragging) return;
      offsetX = event.clientX - startX;
      toast.style.transform = "translateX(" + offsetX + "px)";
      toast.style.opacity = String(Math.max(.25, 1 - Math.abs(offsetX) / 230));
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      toast.classList.remove("dragging");
      if (Math.abs(offsetX) >= 64) {
        location.href = "srghtalk-toast://dismiss";
      } else if (Math.abs(offsetX) <= 8) {
        location.href = "srghtalk-toast://open";
      } else {
        toast.style.transform = "";
        toast.style.opacity = "";
      }
    };
    toast.addEventListener("pointerup", release);
    toast.addEventListener("pointercancel", release);
  </script></body></html>`;
  toast.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("srghtalk-toast://")) return;
    event.preventDefault();
    if (url.startsWith("srghtalk-toast://open") && actionableRoomId) {
      createChatWindow(actionableRoomId);
    }
    if (!toast.isDestroyed()) toast.destroy();
  });
  toast.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  toast.once("ready-to-show", () => toast.showInactive());
  toast.on("closed", () => {
    const index = notificationWindows.indexOf(toast);
    if (index >= 0) notificationWindows.splice(index, 1);
    layoutNotificationWindows();
  });
  if (options.sound !== false) shell.beep();
  setTimeout(() => {
    if (!toast.isDestroyed()) toast.destroy();
  }, 5200);
}

function serverConfig() {
  let configuredServer = "";
  const configPaths = [
    path.join(path.dirname(process.execPath), "srghtalk-server.json"),
    path.join(app.getPath("userData"), "srghtalk-server.json"),
  ];
  for (const configPath of configPaths) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (typeof config.serverUrl === "string" && config.serverUrl.trim()) {
        configuredServer = config.serverUrl.trim();
        break;
      }
    } catch {
      // Optional configuration file: use the next source when it is absent or invalid.
    }
  }
  const server = (
    process.env.SRGHTALK_SERVER_URL ||
    configuredServer ||
    "http://192.168.205.119:3021"
  ).replace(/\/+$/, "");
  return {
    apiBase: `${server}/api`,
    wsUrl: `${server}/ws`,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "사랑톡",
    width: 430,
    height: 760,
    minWidth: 380,
    minHeight: 620,
    maximizable: false,
    center: true,
    frame: false,
    titleBarStyle: "hidden",
    thickFrame: false,
    roundedCorners: false,
    show: false,
    backgroundColor: "#f5f8f7",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
    query: serverConfig(),
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    closeAuxiliaryWindows();
    mainWindow = undefined;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    }
  });
}

function createChatWindow(roomId) {
  const existingWindow = chatWindows.get(roomId);
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
    return;
  }

  const anchorBounds = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getBounds()
    : screen.getPrimaryDisplay().workArea;
  const display = screen.getDisplayMatching(anchorBounds);
  const chatWidth = anchorBounds.width;
  const chatHeight = anchorBounds.height;
  const gap = 10;
  const cascadeOffset = chatWindows.size * 22;
  let chatX = anchorBounds.x + anchorBounds.width + gap + cascadeOffset;
  let chatY = anchorBounds.y + cascadeOffset;
  if (chatX + chatWidth > display.workArea.x + display.workArea.width) {
    chatX = anchorBounds.x - chatWidth - gap - cascadeOffset;
  }
  chatX = Math.max(display.workArea.x, Math.min(chatX, display.workArea.x + display.workArea.width - chatWidth));
  chatY = Math.max(display.workArea.y, Math.min(chatY, display.workArea.y + display.workArea.height - chatHeight));

  const chatWindow = new BrowserWindow({
    title: "사랑톡 채팅",
    skipTaskbar: false,
    x: chatX,
    y: chatY,
    width: chatWidth,
    height: chatHeight,
    minWidth: 380,
    minHeight: 620,
    maximizable: false,
    frame: false,
    titleBarStyle: "hidden",
    thickFrame: false,
    roundedCorners: false,
    show: false,
    backgroundColor: "#eef3f6",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  chatWindows.set(roomId, chatWindow);
  chatWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
    query: { ...serverConfig(), chatRoomId: String(roomId) },
  });
  chatWindow.once("ready-to-show", () => chatWindow.show());
  chatWindow.on("closed", () => chatWindows.delete(roomId));
}

function createOrganizationWindow() {
  if (organizationWindow && !organizationWindow.isDestroyed()) {
    organizationWindow.close();
    return;
  }
  const anchor = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : screen.getPrimaryDisplay().workArea;
  const display = screen.getDisplayMatching(anchor);
  const width = anchor.width;
  const height = anchor.height;
  let x = anchor.x + anchor.width + 10;
  if (x + width > display.workArea.x + display.workArea.width) x = Math.max(display.workArea.x, anchor.x - width - 10);
  const y = Math.max(display.workArea.y, Math.min(anchor.y, display.workArea.y + display.workArea.height - height));
  organizationWindow = new BrowserWindow({
    title: "사랑톡 조직도",
    skipTaskbar: false,
    x, y, width, height,
    minWidth: 380,
    minHeight: 620,
    maximizable: false,
    frame: false,
    titleBarStyle: "hidden",
    thickFrame: false,
    roundedCorners: false,
    show: false,
    backgroundColor: "#f5f8fa",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  organizationWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
    query: { ...serverConfig(), organization: "1" },
  });
  organizationWindow.once("ready-to-show", () => organizationWindow.show());
  organizationWindow.on("closed", () => { organizationWindow = undefined; });
}

function createNoticeWindow(key, query, title) {
  const existingWindow = noticeWindows.get(key);
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
    return;
  }
  const anchor = mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : screen.getPrimaryDisplay().workArea;
  const display = screen.getDisplayMatching(anchor);
  const width = anchor.width;
  const height = anchor.height;
  let x = anchor.x + anchor.width + 10;
  if (x + width > display.workArea.x + display.workArea.width) x = Math.max(display.workArea.x, anchor.x - width - 10);
  const y = Math.max(display.workArea.y, Math.min(anchor.y, display.workArea.y + display.workArea.height - height));
  const noticeWindow = new BrowserWindow({
    title, skipTaskbar: false, x, y, width, height, minWidth: 380, minHeight: 620,
    maximizable: false, frame: false, titleBarStyle: "hidden", thickFrame: false,
    roundedCorners: false, show: false, backgroundColor: "#f5f8fa", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"), contextIsolation: true,
      nodeIntegration: false, sandbox: true, devTools: !app.isPackaged,
    },
  });
  noticeWindows.set(key, noticeWindow);
  noticeWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), { query: { ...serverConfig(), ...query } });
  noticeWindow.once("ready-to-show", () => noticeWindow.show());
  noticeWindow.on("closed", () => noticeWindows.delete(key));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission !== "notifications");
  });
  createWindow();
});

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on("chat:open-window", (_event, roomId) => {
  const numericRoomId = Number(roomId);
  if (Number.isInteger(numericRoomId) && numericRoomId > 0) {
    createChatWindow(numericRoomId);
  }
});

ipcMain.on("organization:open-window", () => createOrganizationWindow());
ipcMain.on("notice:open-window", (_event, noticeId) => {
  const id = Number(noticeId);
  if (Number.isInteger(id) && id > 0) createNoticeWindow(`detail-${id}`, { noticeId: String(id) }, "사랑톡 쪽지");
});
ipcMain.on("notice:compose-window", () => createNoticeWindow("compose", { noticeCompose: "1" }, "사랑톡 쪽지 작성"));

ipcMain.on("settings:apply", (event, settings = {}) => {
  if (typeof settings.alwaysOnTop === "boolean") {
    for (const applicationWindow of BrowserWindow.getAllWindows()) {
      applicationWindow.setAlwaysOnTop(settings.alwaysOnTop);
    }
  }
  if (typeof settings.startAtLogin === "boolean" && app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: settings.startAtLogin,
      path: process.execPath,
    });
  }
  for (const applicationWindow of BrowserWindow.getAllWindows()) {
    if (!applicationWindow.isDestroyed() && applicationWindow.webContents.id !== event.sender.id) {
      applicationWindow.webContents.send("settings:changed", settings);
    }
  }
});

ipcMain.on("notification:show", (_event, options = {}) => {
  createNotificationToast(options);
});

ipcMain.on("auth:logout", () => closeAuxiliaryWindows());

ipcMain.handle("auth:save-credentials", (_event, credentials) => {
  if (!safeStorage.isEncryptionAvailable() || !credentials?.employeeNumber || !credentials?.password) return false;
  fs.writeFileSync(credentialPath(), safeStorage.encryptString(JSON.stringify(credentials)));
  return true;
});

ipcMain.handle("auth:get-credentials", () => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(credentialPath())));
  } catch {
    return null;
  }
});

ipcMain.handle("auth:clear-credentials", () => {
  try {
    fs.rmSync(credentialPath(), { force: true });
  } catch {
    // The optional credential file may already be absent.
  }
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
