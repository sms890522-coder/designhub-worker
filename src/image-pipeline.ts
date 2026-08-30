import sharp from "sharp";
import { readFile, rm } from "node:fs/promises";
import type { JobLease } from "./types.js";

export async function normalizeOutput(job: JobLease, inputPath: string, outputPath: string): Promise<void> {
  const image = sharp(inputPath, { failOn: "none" }).rotate();
  if (job.contentType === "background") {
    await image.resize(job.output.width, job.output.height, { fit: "cover", position: "centre" }).flatten({ background: "#fffefb" }).jpeg({ quality: 92, progressive: true }).withMetadata({ density: job.output.dpi }).toFile(outputPath);
    return;
  }
  await image.ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize(job.output.width, job.output.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).withMetadata({ density: job.output.dpi }).toFile(outputPath);
}

export async function assertImageBytes(path: string, maxBytes = 50 * 1024 * 1024): Promise<Buffer> {
  const bytes = await readFile(path);
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) throw new Error("생성 결과의 용량이 허용 범위를 초과했습니다.");
  return bytes;
}

export async function cleanupDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
