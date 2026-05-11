const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let mainWindow = null;
let backendProcess = null;
let tray = null;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// --- 解析 --page=xxx 命令行参数 ---
const PAGE_KEY_ARG_PREFIX = "--page=";
const validPageKeys = ["clean", "penetration", "profile", "report"];

function parsePageFromArgs(argv) {
  for (const arg of argv) {
    if (arg.startsWith(PAGE_KEY_ARG_PREFIX)) {
      const key = arg.slice(PAGE_KEY_ARG_PREFIX.length);
      if (validPageKeys.includes(key)) return key;
    }
  }
  return null;
}

const initialPageKey = parsePageFromArgs(process.argv);

function getAssetPath(fileName) {
  if (isDev) {
    return path.join(process.cwd(), "frontend", "public", "assets", fileName);
  }
  return path.join(__dirname, "..", "dist", "assets", fileName);
}

function waitForBackend(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) {
            resolve();
            return;
          }
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error("backend health check timeout"));
            return;
          }
          setTimeout(tick, 350);
        })
        .on("error", () => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error("backend health check timeout"));
            return;
          }
          setTimeout(tick, 350);
        });
    };
    tick();
  });
}

function startBackend() {
  if (backendProcess) return;
  if (isDev) {
    backendProcess = spawn("go", ["run", "./cmd/server"], {
      cwd: path.join(process.cwd(), "backend"),
      shell: true,
      stdio: "inherit",
    });
  } else {
    const exePath = path.join(process.resourcesPath, "backend", "bin", "server.exe");
    backendProcess = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      stdio: "inherit",
    });
  }

  backendProcess.on("exit", () => {
    backendProcess = null;
  });
}

async function createWindow() {
  const iconPath = getAssetPath("app-icon.png");
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  startBackend();
  await waitForBackend("http://127.0.0.1:18080/health");

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // 页面加载完成后，发送 --page 参数指定的初始页面
  mainWindow.webContents.on("did-finish-load", () => {
    if (initialPageKey) {
      mainWindow.webContents.send("navigate-to-page", initialPageKey);
    }
  });

  // macOS 关闭窗口后对象被销毁，需置空以便 tray 点击时重建
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  if (tray) return;

  const trayIconPath = getAssetPath("tray-icon.png");
  const trayImage = nativeImage.createFromPath(trayIconPath).resize({
    width: 16,
    height: 16,
    quality: "best",
  });
  if (trayImage.isEmpty()) return;

  tray = new Tray(trayImage);
  tray.setToolTip("经侦研判桌面系统");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: async () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          await createWindow();
        }
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "退出",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      await createWindow();
    }
    mainWindow.show();
    mainWindow.focus();
  });
}

ipcMain.handle("dialog:openFiles", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Data Files", extensions: ["xlsx", "xls", "csv"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle("dialog:saveReport", async (_, defaultPath) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || "anti_fraud_report.docx",
    filters: [{ name: "Word", extensions: ["docx"] }],
  });
  if (res.canceled) return "";
  return res.filePath || "";
});

ipcMain.handle("shell:openPath", async (_, targetPath) => {
  if (!targetPath) return;
  return shell.openPath(targetPath);
});

// 供渲染器查询通过 --page 传入的初始页面
ipcMain.handle("get-initial-page", () => {
  return initialPageKey;
});

// --- 单实例锁：防止多个 Tools 实例同时运行 ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 第二个实例，直接退出
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    // 已有实例收到第二个实例的启动参数
    const pageKey = parsePageFromArgs(commandLine);
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      if (pageKey) {
        mainWindow.webContents.send("navigate-to-page", pageKey);
      }
    }
  });

  app.whenReady().then(async () => {
    await createWindow();
    createTray();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
