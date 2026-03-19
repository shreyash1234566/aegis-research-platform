import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createDocument,
  getDocumentsByUserId,
  getDocumentById,
  updateDocumentStatus,
  getDocumentSummary,
} from "../db";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";

export const documentsRouter = router({
  // Get all documents for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const docs = await getDocumentsByUserId(ctx.user.id);
      return docs;
    } catch (error) {
      console.error("Failed to list documents:", error);
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
        // Generate a unique key for the document
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const s3Key = `documents/${ctx.user.id}/${timestamp}-${randomSuffix}-${input.fileName}`;

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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get upload URL",
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

        // Update document status to processing
        await updateDocumentStatus(input.documentId, "processing");

        return { success: true };
      } catch (error) {
        console.error("Failed to mark document as processed:", error);
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

        // Update document in database
        // TODO: Implement update logic

        return { success: true };
      } catch (error) {
        console.error("Failed to update document:", error);
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

        // Delete from S3 and database
        // TODO: Implement delete logic

        return { success: true };
      } catch (error) {
        console.error("Failed to delete document:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete document",
        });
      }
    }),
});
