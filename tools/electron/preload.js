const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  saveReport: (defaultPath) => ipcRenderer.invoke("dialog:saveReport", defaultPath),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),

  // 查询通过 --page 传入的初始页面
  getInitialPage: () => ipcRenderer.invoke("get-initial-page"),

  // 监听运行时页面导航事件（单实例场景下第二个实例传入 --page 时触发）
  onNavigateToPage: (callback) => {
    const listener = (_event, pageKey) => callback(pageKey);
    ipcRenderer.on("navigate-to-page", listener);
    return () => ipcRenderer.removeListener("navigate-to-page", listener);
  },
});
