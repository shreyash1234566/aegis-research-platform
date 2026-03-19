import { z } from "zod";
import { getDb } from "../db";
import { getJobSummary, getRecentJobs } from "../jobs/jobRunner";
import { listConfiguredModels } from "./modelRegistry";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z
        .object({
          timestamp: z.number().min(0, "timestamp cannot be negative").optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const now = Date.now();

      return {
        ok: true,
        serverTime: now,
        requestTimestamp: input?.timestamp ?? null,
        driftMs:
          typeof input?.timestamp === "number" ? now - input.timestamp : null,
        uptimeSec: Math.round(process.uptime()),
        nodeVersion: process.version,
        dbAvailable: Boolean(db),
        jobs: getJobSummary(),
      };
    }),

  runtime: adminProcedure
    .input(
      z
        .object({
          jobLimit: z.number().int().min(1).max(200).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const jobLimit = input?.jobLimit ?? 30;

      return {
        memory: process.memoryUsage(),
        uptimeSec: Math.round(process.uptime()),
        models: listConfiguredModels(),
        jobs: getRecentJobs(jobLimit),
        summary: getJobSummary(),
      };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
