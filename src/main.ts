import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import { join } from "node:path";
import { dirname } from "node:path";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { loadDevice, saveDevice, clearDevice } from "./vault.js";
import { pair } from "./api-client.js";
import { LocalWorker, APP_VERSION } from "./worker.js";
import type { WorkerPlatform, WorkerStatus } from "./types.js";

const baseUrl = (process.env.DESIGNHUB_URL || "https://designhub-factory.sms890522.workers.dev").replace(/\/$/u, "");
const currentDirectory = dirname(fileURLToPath(import.meta.url));
let windowRef: BrowserWindow | null = null;
let worker: LocalWorker | null = null;
let latestStatus: WorkerStatus = { connected: false, running: false, deviceName: null, lastError: null, codexStatus: "unknown" };

function platform(): WorkerPlatform {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "unknown";
}

function publish(status: WorkerStatus) {
  latestStatus = status;
  windowRef?.webContents.send("worker:status", status);
}

async function startSavedWorker() {
  const device = await loadDevice();
  if (!device) return;
  worker = new LocalWorker(baseUrl, device.token, publish);
  await worker.start();
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 760,
    height: 660,
    minWidth: 560,
    minHeight: 540,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#201515" : "#f8f6f0",
    webPreferences: { preload: join(currentDirectory, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void windowRef.loadFile(join(currentDirectory, "renderer/index.html"));
  windowRef.on("closed", () => { windowRef = null; });
}

ipcMain.handle("worker:status", () => latestStatus);
ipcMain.handle("worker:pair", async (_event, input: { code: string; name?: string }) => {
  const result = await pair(baseUrl, input.code, input.name?.trim() || hostname(), platform(), APP_VERSION);
  await saveDevice({ token: result.token, deviceId: result.device.id, name: result.device.name });
  worker?.stop();
  worker = new LocalWorker(baseUrl, result.token, publish);
  await worker.start();
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  return result.device;
});
ipcMain.handle("worker:start", async () => { if (!worker) await startSavedWorker(); else await worker.start(); return latestStatus; });
ipcMain.handle("worker:stop", () => { worker?.stop(); return latestStatus; });
ipcMain.handle("worker:disconnect", async () => { worker?.stop(); worker = null; await clearDevice(); latestStatus = { connected: false, running: false, deviceName: null, lastError: null, codexStatus: "unknown" }; publish(latestStatus); return latestStatus; });

app.whenReady().then(async () => {
  createWindow();
  await startSavedWorker();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
