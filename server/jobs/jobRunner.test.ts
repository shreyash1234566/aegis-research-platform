import { beforeEach, describe, expect, it } from "vitest";
import {
  getJobById,
  resetJobsForTests,
  scheduleJob,
} from "./jobRunner";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number = 1500,
  stepMs: number = 20
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await sleep(stepMs);
  }

  throw new Error("Condition not met before timeout");
}

describe("jobRunner", () => {
  beforeEach(() => {
    resetJobsForTests();
  });

  it("retries and eventually completes", async () => {
    let attempts = 0;

    const jobId = scheduleJob({
      name: "retry-success",
      payload: { value: 1 },
      timeoutMs: 500,
      maxRetries: 2,
      backoffMs: 10,
      run: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("transient failure");
        }
      },
    });

    await waitFor(() => getJobById(jobId)?.status === "completed");

    const record = getJobById(jobId);
    expect(record?.status).toBe("completed");
    expect(record?.attempt).toBe(2);
  });

  it("fails after timeout retries are exhausted", async () => {
    const jobId = scheduleJob({
      name: "timeout-failure",
      payload: { value: 1 },
      timeoutMs: 10,
      maxRetries: 1,
      backoffMs: 10,
      run: async () => {
        await sleep(30);
      },
    });

    await waitFor(() => getJobById(jobId)?.status === "failed");

    const record = getJobById(jobId);
    expect(record?.status).toBe("failed");
    expect(record?.attempt).toBe(2);
    expect(record?.lastError).toContain("timed out");
  });
});
