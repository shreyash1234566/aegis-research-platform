import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createSynthesisQuery,
  getSynthesisQuery,
  updateSynthesisQueryStatus,
  createSynthesisReport,
  getSynthesisReport,
  getClaimsByReportId,
  getContradictionsByReportId,
  createClaim,
  createContradiction,
  getDocumentsByUserId,
  getDocumentSummary,
} from "../db";
import { TRPCError } from "@trpc/server";

export const synthesisRouter = router({
  // Submit a new research query
  submitQuery: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        documentIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns all specified documents
        if (input.documentIds && input.documentIds.length > 0) {
          const userDocs = await getDocumentsByUserId(ctx.user.id);
          const userDocIds = new Set(userDocs.map((d) => d.id));
          for (const docId of input.documentIds) {
            if (!userDocIds.has(docId)) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have access to one or more documents",
              });
            }
          }
        }

        // Create synthesis query record
        const result = await createSynthesisQuery({
          userId: ctx.user.id,
          query: input.query,
          status: "pending",
        });

        return {
          queryId: (result as any).insertId,
          status: "pending",
        };
      } catch (error) {
        console.error("Failed to submit query:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit query",
        });
      }
    }),

  // Get query status and results
  getQuery: protectedProcedure
    .input(z.object({ queryId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const query = await getSynthesisQuery(input.queryId);
        if (!query || query.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this query",
          });
        }
        return query;
      } catch (error) {
        console.error("Failed to get query:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get query",
        });
      }
    }),

  // Get all queries for the current user
  listQueries: protectedProcedure.query(async ({ ctx }) => {
    try {
      // TODO: Implement query listing
      return [];
    } catch (error) {
      console.error("Failed to list queries:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list queries",
      });
    }
  }),

  // Get synthesis report
  getReport: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const report = await getSynthesisReport(input.reportId);
        if (!report) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found",
          });
        }

        // Verify user owns the query associated with this report
        const query = await getSynthesisQuery(report.queryId);
        if (!query || query.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this report",
          });
        }

        // Get claims and contradictions
        const claims = await getClaimsByReportId(input.reportId);
        const contradictions = await getContradictionsByReportId(input.reportId);

        return {
          ...report,
          claims,
          contradictions,
        };
      } catch (error) {
        console.error("Failed to get report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get report",
        });
      }
    }),

  // Create synthesis report (called by backend processing)
  createReport: protectedProcedure
    .input(
      z.object({
        queryId: z.number(),
        reportContent: z.string(),
        claims: z.array(
          z.object({
            text: z.string(),
            sourceChunkIds: z.array(z.string()),
            confidenceTier: z.enum(["high", "medium", "low"]),
            supportingDocuments: z.array(z.number()).optional(),
            contradictingDocuments: z.array(z.number()).optional(),
          })
        ),
        contradictions: z.array(
          z.object({
            claim1: z.string(),
            claim2: z.string(),
            source1DocumentId: z.number(),
            source2DocumentId: z.number(),
            severity: z.enum(["high", "medium", "low"]),
          })
        ),
        halluccinationScore: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the query
        const query = await getSynthesisQuery(input.queryId);
        if (!query || query.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this query",
          });
        }

        // Create report
        const reportResult = await createSynthesisReport({
          queryId: input.queryId,
          reportContent: input.reportContent,
          claims: input.claims,
          contradictions: input.contradictions,
          halluccinationScore: input.halluccinationScore
            ? (input.halluccinationScore as any)
            : undefined,
        });

        const reportId = (reportResult as any).insertId;

        // Create individual claims
        for (const claim of input.claims) {
          await createClaim({
            reportId,
            claimText: claim.text,
            sourceChunkIds: claim.sourceChunkIds,
            confidenceTier: claim.confidenceTier,
            supportingDocuments: claim.supportingDocuments || [],
            contradictingDocuments: claim.contradictingDocuments || [],
          });
        }

        // Create contradictions
        for (const contradiction of input.contradictions) {
          await createContradiction({
            reportId,
            claim1: contradiction.claim1,
            claim2: contradiction.claim2,
            source1DocumentId: contradiction.source1DocumentId,
            source2DocumentId: contradiction.source2DocumentId,
            severity: contradiction.severity,
          });
        }

        // Update query status to completed
        await updateSynthesisQueryStatus(input.queryId, "completed");

        return {
          reportId,
          success: true,
        };
      } catch (error) {
        console.error("Failed to create report:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create report",
        });
      }
    }),

  // Get document summaries for synthesis context
  getDocumentSummaries: protectedProcedure
    .input(z.object({ documentIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user owns all documents
        const userDocs = await getDocumentsByUserId(ctx.user.id);
        const userDocIds = new Set(userDocs.map((d) => d.id));
        for (const docId of input.documentIds) {
          if (!userDocIds.has(docId)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not have access to one or more documents",
            });
          }
        }

        // Get summaries
        const summaries = [];
        for (const docId of input.documentIds) {
          const summary = await getDocumentSummary(docId);
          if (summary) {
            summaries.push(summary);
          }
        }

        return summaries;
      } catch (error) {
        console.error("Failed to get document summaries:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get document summaries",
        });
      }
    }),
});
