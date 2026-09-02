const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("designhubWorker", {
  getStatus: () => ipcRenderer.invoke("worker:status"),
  pair: (input) => ipcRenderer.invoke("worker:pair", input),
  start: () => ipcRenderer.invoke("worker:start"),
  stop: () => ipcRenderer.invoke("worker:stop"),
  disconnect: () => ipcRenderer.invoke("worker:disconnect"),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("worker:status", listener);
    return () => ipcRenderer.removeListener("worker:status", listener);
  },
});
