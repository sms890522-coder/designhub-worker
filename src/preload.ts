import { contextBridge, ipcRenderer } from "electron";
import type { DesktopDevice } from "./types.js";

contextBridge.exposeInMainWorld("designhubWorker", {
  getStatus: () => ipcRenderer.invoke("worker:status"),
  pair: (input: { code: string; name?: string }) => ipcRenderer.invoke("worker:pair", input) as Promise<DesktopDevice>,
  start: () => ipcRenderer.invoke("worker:start"),
  stop: () => ipcRenderer.invoke("worker:stop"),
  disconnect: () => ipcRenderer.invoke("worker:disconnect"),
  onStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on("worker:status", listener);
    return () => ipcRenderer.removeListener("worker:status", listener);
  },
});
