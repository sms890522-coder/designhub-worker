import { app } from "electron";
import { join } from "node:path";
import { hostname } from "node:os";
import { mkdir } from "node:fs/promises";
import { DesignHubClient } from "./api-client.js";
import { cleanupDirectory, normalizeOutput, assertImageBytes } from "./image-pipeline.js";
import { getCodexLoginStatus, runCodexJob } from "./codex-runner.js";
import type { JobLease, WorkerStatus } from "./types.js";

const APP_VERSION = "0.1.1";
const POLL_MS = 15_000;
const HEARTBEAT_MS = 45_000;

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|시간|5\d\d|ECONN|ETIMEDOUT|서버 요청 실패 \(5/iu.test(message);
}

function safeFileStem(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/gu, "-").replace(/^[-_.]+|[-_.]+$/gu, "").slice(0, 100) || "designhub-asset";
}

export class LocalWorker {
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private activeJob = false;
  private status: WorkerStatus = { connected: false, running: false, deviceName: null, lastError: null, codexStatus: "unknown" };
  private readonly client: DesignHubClient;

  constructor(baseUrl: string, token: string, private readonly onStatus: (status: WorkerStatus) => void) {
    this.client = new DesignHubClient(baseUrl, token);
    this.status.deviceName = hostname();
  }

  private publish(patch: Partial<WorkerStatus>) {
    this.status = { ...this.status, ...patch };
    this.onStatus(this.status);
  }

  async start(): Promise<void> {
    if (this.status.running) return;
    this.publish({ running: true, lastError: null });
    this.publish({ codexStatus: await getCodexLoginStatus() });
    await this.sendHeartbeat();
    this.pollTimer = setInterval(() => void this.poll(), POLL_MS);
    this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_MS);
    await this.poll();
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.publish({ running: false });
  }

  async sendHeartbeat(): Promise<void> {
    try {
      await this.client.heartbeat(APP_VERSION, this.status.codexStatus);
      this.publish({ connected: true });
    } catch (error) {
      this.publish({ connected: false, lastError: error instanceof Error ? error.message : "서버 연결 실패" });
    }
  }

  private async poll(): Promise<void> {
    if (!this.status.running || this.activeJob) return;
    try {
      if (this.status.codexStatus !== "connected") {
        const codexStatus = await getCodexLoginStatus();
        this.publish({ codexStatus });
        if (codexStatus !== "connected") return;
      }
      const job = await this.client.lease();
      if (job) await this.process(job);
    } catch (error) {
      this.publish({ connected: true, lastError: error instanceof Error ? error.message : "작업을 확인하지 못했습니다" });
    }
  }

  private async process(job: JobLease): Promise<void> {
    this.activeJob = true;
    const directory = join(app.getPath("temp"), `designhub-worker-${job.jobId}`);
    try {
      await mkdir(directory, { recursive: true });
      await this.client.progress(job.jobId, job.leaseToken, "generating");
      this.publish({ connected: true, codexStatus: "connected", lastError: null });
      const outputs = await runCodexJob(job, directory, () => undefined);
      await this.client.progress(job.jobId, job.leaseToken, "postprocessing");
      const manifestBase = safeFileStem(outputs[0]?.title || job.topic);
      for (const output of outputs) {
        const normalizedPath = join(directory, `normalized-${String(output.index + 1).padStart(2, "0")}.${job.output.format === "JPG" ? "jpg" : "png"}`);
        await normalizeOutput(job, output.path, normalizedPath);
        await this.client.progress(job.jobId, job.leaseToken, "uploading");
        const bytes = await assertImageBytes(normalizedPath);
        await this.client.upload(job, bytes, {
          title: output.title,
          keywords: output.keywords,
          fileName: `${manifestBase}-${String(output.index + 1).padStart(2, "0")}`,
          outputIndex: output.index,
          outputCount: outputs.length,
          final: output.index === outputs.length - 1,
        });
      }
      this.publish({ lastError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "로컬 생성에 실패했습니다";
      const authError = /로그인|인증|quota|limit|정책|codex cli/iu.test(message);
      try { await this.client.fail(job, message.slice(0, 500), !authError && isRetryable(error), authError ? "CODEX_AUTH" : "WORKER_ERROR"); } catch { /* the lease may already have expired */ }
      this.publish({ lastError: message, codexStatus: authError ? "expired" : this.status.codexStatus });
    } finally {
      await cleanupDirectory(directory);
      this.activeJob = false;
    }
  }
}

export { APP_VERSION };
