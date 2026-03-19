import { randomUUID } from "crypto";
import { logError, logInfo, logWarn } from "../_core/logger";

export type JobStatus = "queued" | "running" | "retrying" | "completed" | "failed";

export type JobRecord = {
  id: string;
  name: string;
  status: JobStatus;
  attempt: number;
  maxRetries: number;
  timeoutMs: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  lastError?: string;
};

type ScheduleJobOptions<TPayload> = {
  name: string;
  payload: TPayload;
  run: (payload: TPayload, attempt: number, jobId: string) => Promise<void>;
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMs?: number;
  timeoutMs?: number;
  onRetry?: (payload: TPayload, error: Error, attempt: number, jobId: string) => Promise<void> | void;
  onFailure?: (payload: TPayload, error: Error, attempts: number, jobId: string) => Promise<void> | void;
  onSuccess?: (payload: TPayload, attempts: number, jobId: string) => Promise<void> | void;
};

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 0;
const DEFAULT_BACKOFF_MS = 750;
const DEFAULT_TIMEOUT_MS = 120_000;
const JOB_RETENTION_LIMIT = 300;

const jobs = new Map<string, JobRecord>();

function ensureRetentionLimit() {
  if (jobs.size <= JOB_RETENTION_LIMIT) {
    return;
  }

  const entries = Array.from(jobs.entries())
    .sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt));

  const overflow = entries.length - JOB_RETENTION_LIMIT;
  for (let i = 0; i < overflow; i += 1) {
    jobs.delete(entries[i][0]);
  }
}

function updateJob(jobId: string, updates: Partial<JobRecord>) {
  const current = jobs.get(jobId);
  if (!current) return;
  jobs.set(jobId, { ...current, ...updates });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function scheduleJob<TPayload>(options: ScheduleJobOptions<TPayload>): string {
  const {
    name,
    payload,
    run,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    backoffMs = DEFAULT_BACKOFF_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onRetry,
    onFailure,
    onSuccess,
  } = options;

  const jobId = randomUUID();
  const createdAt = new Date().toISOString();

  jobs.set(jobId, {
    id: jobId,
    name,
    status: "queued",
    attempt: 0,
    maxRetries,
    timeoutMs,
    createdAt,
  });
  ensureRetentionLimit();

  const execute = async (attempt: number): Promise<void> => {
    updateJob(jobId, {
      status: attempt === 1 ? "running" : "retrying",
      attempt,
      startedAt: new Date().toISOString(),
    });

    try {
      await withTimeout(run(payload, attempt, jobId), timeoutMs, `${name} (${jobId})`);
      updateJob(jobId, {
        status: "completed",
        endedAt: new Date().toISOString(),
      });

      logInfo("job.completed", {
        jobId,
        name,
        attempt,
      });

      if (onSuccess) {
        await onSuccess(payload, attempt, jobId);
      }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      const lastError = normalized.message;

      updateJob(jobId, {
        lastError,
      });

      const hasRetriesLeft = attempt <= maxRetries;
      if (hasRetriesLeft) {
        logWarn("job.retry", {
          jobId,
          name,
          attempt,
          maxRetries,
          error: lastError,
        });

        if (onRetry) {
          await onRetry(payload, normalized, attempt, jobId);
        }

        const delay = Math.max(0, initialDelayMs + backoffMs * attempt);
        setTimeout(() => {
          void execute(attempt + 1);
        }, delay);
        return;
      }

      updateJob(jobId, {
        status: "failed",
        endedAt: new Date().toISOString(),
      });

      logError("job.failed", {
        jobId,
        name,
        attempts: attempt,
        error: lastError,
      });

      if (onFailure) {
        await onFailure(payload, normalized, attempt, jobId);
      }
    }
  };

  setTimeout(() => {
    void execute(1);
  }, Math.max(0, initialDelayMs));

  logInfo("job.queued", {
    jobId,
    name,
    maxRetries,
    timeoutMs,
  });

  return jobId;
}

export function getRecentJobs(limit: number = 100): JobRecord[] {
  const boundedLimit = Math.min(Math.max(limit, 1), JOB_RETENTION_LIMIT);
  return Array.from(jobs.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, boundedLimit);
}

export function getJobById(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function getJobSummary() {
  const all = Array.from(jobs.values());
  const statusCounts: Record<JobStatus, number> = {
    queued: 0,
    running: 0,
    retrying: 0,
    completed: 0,
    failed: 0,
  };

  for (const job of all) {
    statusCounts[job.status] += 1;
  }

  return {
    total: all.length,
    byStatus: statusCounts,
  };
}

export function resetJobsForTests() {
  jobs.clear();
}
