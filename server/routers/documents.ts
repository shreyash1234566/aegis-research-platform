import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createPerformanceMetric,
  createDocument,
  deleteDocumentById,
  getDocumentsByUserId,
  getDocumentById,
  updateDocumentFields,
  getDocumentSummary,
} from "../db";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";
import { enqueueDocumentProcessingJob } from "../jobs/documentWorker";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function createDocumentKey(userId: number, fileName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `documents/${userId}/${timestamp}-${randomSuffix}-${safeName}`;
}

function extractDocumentText(
  data: Buffer,
  mimeType: string,
  fileName: string
): string {
  const textExtensions = /\.(txt|md|markdown|csv|json|xml|html)$/i;
  const isTextLike = mimeType.startsWith("text/") || textExtensions.test(fileName);

  if (isTextLike) {
    return data.toString("utf-8");
  }

  return [
    `Document '${fileName}' uploaded as ${mimeType || "application/octet-stream"}.`,
    "Binary content parsing is limited in this build, so extraction uses metadata and filename context.",
  ].join(" ");
}

export const documentsRouter = router({
  // Get all documents for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const docs = await getDocumentsByUserId(ctx.user.id);
      return docs;
    } catch (error) {
      console.error("Failed to list documents:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list documents",
      });
    }
  }),

  // Get a specific document by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const doc = await getDocumentById(input.id);
        if (!doc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document not found",
          });
        }
        // Verify user owns this document
        if (doc.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }
        return doc;
      } catch (error) {
        console.error("Failed to get document:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get document",
        });
      }
    }),

  // Get document summary
  getSummary: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const doc = await getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }
        const summary = await getDocumentSummary(input.documentId);
        return summary || null;
      } catch (error) {
        console.error("Failed to get document summary:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get document summary",
        });
      }
    }),

  // Create upload URL for document
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const s3Key = createDocumentKey(ctx.user.id, input.fileName);

        // Store document metadata in database
        const doc = await createDocument({
          userId: ctx.user.id,
          title: input.fileName,
          fileName: input.fileName,
          s3Key: s3Key,
          s3Url: `https://storage.example.com/${s3Key}`,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: "uploading",
        });

        return {
          documentId: (doc as any).insertId,
          s3Key: s3Key,
          uploadUrl: `https://storage.example.com/upload?key=${s3Key}`,
        };
      } catch (error) {
        console.error("Failed to get upload URL:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get upload URL",
        });
      }
    }),

  // Direct upload endpoint for end-to-end ingestion and processing.
  upload: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().positive(),
        mimeType: z.string().min(1).max(100),
        base64Content: z.string().min(1),
        title: z.string().max(255).optional(),
        description: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.fileSize > MAX_UPLOAD_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File size exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`,
          });
        }

        const normalizedBase64 = input.base64Content.replace(/^data:.*;base64,/, "");
        const fileBuffer = Buffer.from(normalizedBase64, "base64");

        if (fileBuffer.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uploaded file is empty",
          });
        }

        const s3Key = createDocumentKey(ctx.user.id, input.fileName);
        const uploadResult = await storagePut(s3Key, fileBuffer, input.mimeType);

        const createResult = await createDocument({
          userId: ctx.user.id,
          title: input.title || input.fileName,
          description: input.description || null,
          fileName: input.fileName,
          s3Key,
          s3Url: uploadResult.url,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: "processing",
        });

        const documentId = Number((createResult as { insertId?: number }).insertId);
        if (!Number.isFinite(documentId)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to persist document metadata",
          });
        }

        const documentText = extractDocumentText(fileBuffer, input.mimeType, input.fileName);
        enqueueDocumentProcessingJob({
          documentId,
          userId: ctx.user.id,
          documentText,
        });

        await createPerformanceMetric({
          metricType: "user_document_upload_count",
          value: 1 as any,
          queryId: null,
          reportId: null,
        });

        return {
          documentId,
          s3Key,
          s3Url: uploadResult.url,
          status: "processing" as const,
        };
      } catch (error) {
        console.error("Failed to upload document:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload document",
        });
      }
    }),

  // Mark document as processed
  markProcessed: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        s3Url: z.string(),
        tokenCount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const doc = await getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }

        await updateDocumentFields(input.documentId, {
          status: "processing",
          s3Url: input.s3Url,
          tokenCount: input.tokenCount,
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to mark document as processed:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark document as processed",
        });
      }
    }),

  // Update document metadata
  update: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const doc = await getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }

        await updateDocumentFields(input.documentId, {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to update document:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update document",
        });
      }
    }),

  // Delete document
  delete: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const doc = await getDocumentById(input.documentId);
        if (!doc || doc.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this document",
          });
        }

        // Storage delete endpoint is not currently exposed; metadata is removed first.
        await deleteDocumentById(input.documentId);

        return { success: true };
      } catch (error) {
        console.error("Failed to delete document:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete document",
        });
      }
    }),
});
