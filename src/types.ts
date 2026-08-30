export type WorkerPlatform = "windows" | "macos" | "unknown";

export type WorkerStatus = {
  connected: boolean;
  running: boolean;
  deviceName: string | null;
  lastError: string | null;
  codexStatus: "unknown" | "connected" | "expired" | "error";
};

export type JobLease = {
  jobId: string;
  leaseToken: string;
  contentType: "background" | "png-element";
  topic: string;
  prompt: string;
  scheduledAt: string | null;
  output: { format: "JPG" | "PNG"; width: number; height: number; dpi: number; splitElements: boolean };
  batchId: string;
  expiresAt: string;
};

export type DesktopDevice = {
  id: string;
  name: string;
  platform: WorkerPlatform;
  architecture?: string;
  appVersion: string;
  status: "online" | "offline" | "revoked";
  codexStatus: "unknown" | "connected" | "expired" | "error";
  lastSeenAt: string | null;
  pairedAt: string;
  revokedAt?: string | null;
};

export type DesktopJobLease = JobLease;

export type GeneratedOutput = {
  path: string;
  title?: string;
  keywords?: string[];
  index: number;
  count: number;
};
