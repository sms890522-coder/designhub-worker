import type { DesktopDevice, DesktopJobLease, JobLease, WorkerPlatform } from "./types.js";

export class DesignHubClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    headers.set("Accept", "application/json");
    const response = await fetch(new URL(path, this.baseUrl), { ...init, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || `서버 요청 실패 (${response.status})`);
    }
    return response;
  }

  async heartbeat(appVersion: string, codexStatus: "unknown" | "connected" | "expired" | "error") {
    const response = await this.request("/api/desktop/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appVersion, codexStatus }) });
    return response.json() as Promise<{ device: DesktopDevice }>;
  }

  async lease(): Promise<JobLease | null> {
    const response = await this.request("/api/desktop/jobs/lease", { method: "POST" });
    const payload = await response.json() as { job?: DesktopJobLease | null };
    return payload.job ?? null;
  }

  async progress(jobId: string, leaseToken: string, stage: string) {
    await this.request(`/api/desktop/jobs/${encodeURIComponent(jobId)}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaseToken, stage }) });
  }

  async upload(job: JobLease, bytes: Buffer, metadata: { title?: string; keywords?: string[]; fileName: string; outputIndex: number; outputCount: number; final: boolean }) {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)], { type: job.output.format === "JPG" ? "image/jpeg" : "image/png" }), metadata.fileName);
    form.set("leaseToken", job.leaseToken);
    form.set("title", metadata.title ?? "");
    form.set("keywords", JSON.stringify(metadata.keywords ?? []));
    form.set("fileName", metadata.fileName);
    form.set("outputIndex", String(metadata.outputIndex));
    form.set("outputCount", String(metadata.outputCount));
    form.set("final", String(metadata.final));
    const response = await this.request(`/api/desktop/jobs/${encodeURIComponent(job.jobId)}/result`, { method: "POST", body: form });
    return response.json() as Promise<{ jobStatus: string; usage?: unknown }>;
  }

  async fail(job: JobLease, message: string, retryable: boolean, errorCode = "WORKER_ERROR") {
    await this.request(`/api/desktop/jobs/${encodeURIComponent(job.jobId)}/fail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaseToken: job.leaseToken, message, retryable, errorCode }) });
  }
}

export async function pair(baseUrl: string, code: string, name: string, platform: WorkerPlatform, appVersion: string): Promise<{ token: string; device: DesktopDevice }> {
  const response = await fetch(new URL("/api/desktop/pair", baseUrl), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ code, name, platform, architecture: process.arch, appVersion }) });
  const payload = await response.json() as { token?: string; device?: DesktopDevice; error?: string };
  if (!response.ok || !payload.token || !payload.device) throw new Error(payload.error || "기기 연결에 실패했습니다.");
  const token = payload.token;
  const device = payload.device;
  return { token, device };
}
