import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDocumentsByUserId,
  getRecentPerformanceMetrics,
  getSynthesisQueriesByUserId,
  getSynthesisReportByQueryId,
} from "../db";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export const analyticsRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    try {
      const [documents, queries] = await Promise.all([
        getDocumentsByUserId(ctx.user.id),
        getSynthesisQueriesByUserId(ctx.user.id),
      ]);

      const reportCandidates = await Promise.all(
        queries.map((query) => getSynthesisReportByQueryId(query.id))
      );
      const reports = reportCandidates.filter(Boolean);

      const hallucinationScores = reports
        .map((report) => toNumber(report?.halluccinationScore))
        .filter((value) => Number.isFinite(value));

      const averageHallucinationScore =
        hallucinationScores.length > 0
          ? hallucinationScores.reduce((sum, score) => sum + score, 0) /
            hallucinationScores.length
          : 0;

      return {
        documents: {
          total: documents.length,
          completed: documents.filter((document) => document.status === "completed").length,
          processing: documents.filter((document) => document.status === "processing").length,
          failed: documents.filter((document) => document.status === "failed").length,
        },
        queries: {
          total: queries.length,
          pending: queries.filter((query) => query.status === "pending").length,
          processing: queries.filter((query) => query.status === "processing").length,
          completed: queries.filter((query) => query.status === "completed").length,
          failed: queries.filter((query) => query.status === "failed").length,
        },
        reports: {
          total: reports.length,
          averageHallucinationScore: Number(averageHallucinationScore.toFixed(4)),
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to generate analytics overview:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate analytics overview",
      });
    }
  }),

  metrics: protectedProcedure
    .input(
      z.object({
        metricType: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const limit = input.limit ?? 200;
        const recentMetrics = await getRecentPerformanceMetrics(limit);

        const filtered = input.metricType
          ? recentMetrics.filter((metric) => metric.metricType === input.metricType)
          : recentMetrics;

        return filtered.map((metric) => ({
          id: metric.id,
          metricType: metric.metricType,
          queryId: metric.queryId,
          reportId: metric.reportId,
          value: toNumber(metric.value),
          createdAt: metric.createdAt,
        }));
      } catch (error) {
        console.error("Failed to list analytics metrics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list analytics metrics",
        });
      }
    }),

  alerts: protectedProcedure
    .input(
      z
        .object({
          failureRateThreshold: z.number().min(0).max(1).optional(),
          hallucinationThreshold: z.number().min(0).max(1).optional(),
          staleProcessingMinutes: z.number().int().min(1).max(24 * 60).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const failureRateThreshold = input?.failureRateThreshold ?? 0.2;
        const hallucinationThreshold = input?.hallucinationThreshold ?? 0.45;
        const staleProcessingMinutes = input?.staleProcessingMinutes ?? 20;

        const [documents, queries] = await Promise.all([
          getDocumentsByUserId(ctx.user.id),
          getSynthesisQueriesByUserId(ctx.user.id),
        ]);

        const reportCandidates = await Promise.all(
          queries.map((query) => getSynthesisReportByQueryId(query.id))
        );
        const reports = reportCandidates.filter(Boolean);

        const now = Date.now();
        const staleCutoff = now - staleProcessingMinutes * 60 * 1000;

        const documentFailureRate =
          documents.length > 0
            ? documents.filter((doc) => doc.status === "failed").length / documents.length
            : 0;
        const queryFailureRate =
          queries.length > 0
            ? queries.filter((query) => query.status === "failed").length / queries.length
            : 0;

        const hallucinationScores = reports
          .map((report) => toNumber(report?.halluccinationScore))
          .filter((value) => Number.isFinite(value));
        const averageHallucinationScore =
          hallucinationScores.length > 0
            ? hallucinationScores.reduce((sum, score) => sum + score, 0) /
              hallucinationScores.length
            : 0;

        const staleDocuments = documents.filter(
          (doc) =>
            doc.status === "processing" &&
            new Date(doc.updatedAt).getTime() < staleCutoff
        );
        const staleQueries = queries.filter(
          (query) =>
            query.status === "processing" &&
            new Date(query.createdAt).getTime() < staleCutoff
        );

        const alerts: Array<{
          severity: "high" | "medium" | "low";
          code: string;
          message: string;
          value: number;
          threshold: number;
        }> = [];

        if (documentFailureRate >= failureRateThreshold) {
          alerts.push({
            severity: "high",
            code: "DOCUMENT_FAILURE_RATE",
            message: "Document processing failure rate exceeded threshold",
            value: Number(documentFailureRate.toFixed(4)),
            threshold: failureRateThreshold,
          });
        }

        if (queryFailureRate >= failureRateThreshold) {
          alerts.push({
            severity: "high",
            code: "QUERY_FAILURE_RATE",
            message: "Synthesis query failure rate exceeded threshold",
            value: Number(queryFailureRate.toFixed(4)),
            threshold: failureRateThreshold,
          });
        }

        if (averageHallucinationScore >= hallucinationThreshold) {
          alerts.push({
            severity: "medium",
            code: "HALLUCINATION_SCORE",
            message: "Average hallucination score exceeded threshold",
            value: Number(averageHallucinationScore.toFixed(4)),
            threshold: hallucinationThreshold,
          });
        }

        if (staleDocuments.length > 0) {
          alerts.push({
            severity: "medium",
            code: "STALE_DOCUMENTS",
            message: "Some documents have been processing for too long",
            value: staleDocuments.length,
            threshold: staleProcessingMinutes,
          });
        }

        if (staleQueries.length > 0) {
          alerts.push({
            severity: "medium",
            code: "STALE_QUERIES",
            message: "Some synthesis jobs appear stalled",
            value: staleQueries.length,
            threshold: staleProcessingMinutes,
          });
        }

        return {
          alerts,
          telemetry: {
            documentFailureRate: Number(documentFailureRate.toFixed(4)),
            queryFailureRate: Number(queryFailureRate.toFixed(4)),
            averageHallucinationScore: Number(averageHallucinationScore.toFixed(4)),
            staleDocuments: staleDocuments.length,
            staleQueries: staleQueries.length,
          },
        };
      } catch (error) {
        console.error("Failed to compute analytics alerts:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute analytics alerts",
        });
      }
    }),

  activity: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(300).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      try {
        const limit = input?.limit ?? 150;
        const metrics = await getRecentPerformanceMetrics(limit);
        const activityMetrics = metrics.filter((metric) =>
          metric.metricType.startsWith("user_")
        );

        return activityMetrics.map((metric) => ({
          id: metric.id,
          metricType: metric.metricType,
          value: toNumber(metric.value),
          queryId: metric.queryId,
          reportId: metric.reportId,
          createdAt: metric.createdAt,
        }));
      } catch (error) {
        console.error("Failed to load activity metrics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load activity metrics",
        });
      }
    }),
});
