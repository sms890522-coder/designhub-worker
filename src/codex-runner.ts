import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { GeneratedOutput, JobLease } from "./types.js";

const MAX_RUNTIME_MS = 15 * 60 * 1000;

type RunnerManifest = { title?: string; keywords?: string[]; outputs?: Array<{ file: string; title?: string; keywords?: string[] }> };

function codexCommand() {
  const configured = process.env.CODEX_BIN?.trim();
  if (configured) return configured;
  if (process.platform === "darwin") {
    // Finder-launched Electron apps do not always inherit the shell PATH.
    // ChatGPT for macOS ships the official Codex executable in its app bundle.
    const candidates = [
      "/Applications/ChatGPT.app/Contents/Resources/codex",
      join(homedir(), "Applications/ChatGPT.app/Contents/Resources/codex"),
      join(homedir(), ".local/bin/codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
    ];
    return candidates.find((candidate) => existsSync(candidate)) || "codex";
  }
  return process.platform === "win32" ? "codex.exe" : "codex";
}

/** Return the local Codex CLI authentication state without exposing credentials. */
export async function getCodexLoginStatus(): Promise<"connected" | "expired" | "error"> {
  return new Promise((resolve) => {
    const child = spawn(codexCommand(), ["login", "status"], { stdio: ["ignore", "ignore", "ignore"] });
    const timeout = setTimeout(() => { child.kill(); resolve("error"); }, 10_000);
    child.once("error", () => { clearTimeout(timeout); resolve("error"); });
    child.once("exit", (code) => { clearTimeout(timeout); resolve(code === 0 ? "connected" : "expired"); });
  });
}

function cleanKeywords(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keywords = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 8);
  return keywords.length === 8 ? keywords : undefined;
}

async function readManifest(directory: string): Promise<RunnerManifest> {
  try {
    const raw = await readFile(join(directory, "manifest.json"), "utf8");
    const parsed = JSON.parse(raw) as RunnerManifest;
    return { title: typeof parsed.title === "string" ? parsed.title.slice(0, 180) : undefined, keywords: cleanKeywords(parsed.keywords), outputs: Array.isArray(parsed.outputs) ? parsed.outputs : undefined };
  } catch {
    return {};
  }
}

export async function runCodexJob(job: JobLease, directory: string, onOutput: (message: string) => void): Promise<GeneratedOutput[]> {
  await mkdir(directory, { recursive: true });
  const outputName = job.contentType === "background" ? "output.jpg" : "output.png";
  const prompt = [
    "Use the built-in $imagegen capability to create the requested DesignHub asset.",
    `Request: ${job.prompt}`,
    `Work only inside the current job directory. Save the final ${job.contentType === "background" ? "JPG" : "PNG"} as ${outputName}.`,
    "For png-element requests, you may save multiple separated objects as output-01.png, output-02.png and so on. Keep each object complete and isolated.",
    "Write manifest.json containing a title and exactly 8 Korean keywords. If there are multiple files, write outputs with file, title and keywords for each file.",
    "Do not create text, logos, watermarks, copyrighted characters, or brand marks. Do not modify files outside this directory.",
  ].join("\n");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(codexCommand(), ["exec", "--ephemeral", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt], { cwd: directory, env: { ...process.env, NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => onOutput(chunk.toString().slice(-400)));
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString()}`.slice(-2_000); });
    const timeout = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Codex 작업 시간이 초과되었습니다.")); }, MAX_RUNTIME_MS);
    child.once("error", (error) => { clearTimeout(timeout); reject(new Error(`Codex CLI를 실행하지 못했습니다: ${error.message}`)); });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(stderr.trim() || `Codex 작업이 종료되었습니다 (${code ?? "unknown"})`));
      else resolve();
    });
  });
  const manifest = await readManifest(directory);
  const files = (await readdir(directory)).filter((file) => /^(?:output(?:-\d+)?|output-\d+)\.(?:png|jpe?g)$/iu.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length === 0) throw new Error("Codex가 결과 이미지 파일을 만들지 않았습니다.");
  const manifestOutputs = manifest.outputs ?? [];
  return files.slice(0, 8).map((file, index) => ({ path: join(directory, basename(file)), index, count: Math.min(files.length, 8), title: manifestOutputs[index]?.title || manifest.title, keywords: cleanKeywords(manifestOutputs[index]?.keywords) || manifest.keywords }));
}
