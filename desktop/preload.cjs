const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  openMap: () => ipcRenderer.invoke("map:open"),
  saveMap: request => ipcRenderer.invoke("map:save", request)
});
