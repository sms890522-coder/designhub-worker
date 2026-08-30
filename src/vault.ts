import { app, safeStorage } from "electron";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

type SavedDevice = { token: string; deviceId: string; name: string };

function vaultPath() {
  return join(app.getPath("userData"), "device-token.enc");
}

export async function saveDevice(device: SavedDevice): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("운영체제 보안 저장소를 사용할 수 없습니다.");
  const encrypted = safeStorage.encryptString(JSON.stringify(device)).toString("base64");
  await writeFile(vaultPath(), encrypted, "utf8");
}

export async function loadDevice(): Promise<SavedDevice | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const encoded = await readFile(vaultPath(), "utf8");
    return JSON.parse(safeStorage.decryptString(Buffer.from(encoded, "base64"))) as SavedDevice;
  } catch {
    return null;
  }
}

export async function clearDevice(): Promise<void> {
  try { await unlink(vaultPath()); } catch { /* already clear */ }
}
