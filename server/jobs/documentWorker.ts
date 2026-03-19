import {
  createEntity,
  createEntityRelationship,
  createPerformanceMetric,
  getDocumentSummary,
  getEntityByName,
  updateDocumentFields,
} from "../db";
import {
  type ExtractedEntity,
  processDocumentWithQwen,
} from "../document-reader";
import { logError, logInfo, logWarn } from "../_core/logger";
import { scheduleJob } from "./jobRunner";

type DocumentProcessingJobPayload = {
  documentId: number;
  userId: number;
  documentText: string;
};

const DOCUMENT_JOB_TIMEOUT_MS = 120_000;

export function enqueueDocumentProcessingJob(payload: DocumentProcessingJobPayload) {
  scheduleJob({
    name: "document-processing",
    payload,
    timeoutMs: DOCUMENT_JOB_TIMEOUT_MS,
    maxRetries: 2,
    backoffMs: 1000,
    run: runDocumentProcessingJob,
    onRetry: async (jobPayload, error, attempt, jobId) => {
      await updateDocumentFields(jobPayload.documentId, {
        status: "processing",
        processingError: `Retry ${attempt}: ${error.message}`,
      });

      logWarn("document.retry", {
        jobId,
        documentId: jobPayload.documentId,
        userId: jobPayload.userId,
        attempt,
        error: error.message,
      });
    },
    onFailure: async (jobPayload, error, attempts, jobId) => {
      await updateDocumentFields(jobPayload.documentId, {
        status: "failed",
        processedAt: new Date(),
        processingError: error.message,
      });

      logError("document.failed", {
        jobId,
        documentId: jobPayload.documentId,
        userId: jobPayload.userId,
        attempts,
        error: error.message,
      });
    },
  });
}

async function runDocumentProcessingJob({
  documentId,
  userId,
  documentText,
}: DocumentProcessingJobPayload): Promise<void> {
  const startTime = Date.now();

  const existingSummary = await getDocumentSummary(documentId);
  if (existingSummary) {
    await updateDocumentFields(documentId, {
      status: "completed",
      processedAt: new Date(),
      processingError: null as any,
    });

    logInfo("document.skipped_existing_summary", {
      documentId,
      userId,
    });
    return;
  }

  await updateDocumentFields(documentId, {
    status: "processing",
    processingError: null as any,
  });

  const result = await processDocumentWithQwen(documentId, documentText);
  await persistEntitiesToGraph(result.entities);

  await updateDocumentFields(documentId, {
    status: "completed",
    tokenCount: result.tokenCount,
    processedAt: new Date(),
    processingError: null as any,
  });

  await createPerformanceMetric({
    metricType: "document_processing_ms",
    value: Number((Date.now() - startTime).toFixed(2)) as any,
    queryId: null,
    reportId: null,
  });

  logInfo("document.completed", {
    documentId,
    userId,
    processingMs: result.processingTime,
    tokenCount: result.tokenCount,
  });
}

async function persistEntitiesToGraph(entities: ExtractedEntity[]) {
  if (entities.length === 0) {
    return;
  }

  const uniqueEntities = new Map<string, ExtractedEntity>();
  for (const entity of entities) {
    const key = entity.name.trim().toLowerCase();
    if (!key) continue;
    if (!uniqueEntities.has(key)) {
      uniqueEntities.set(key, entity);
    }
  }

  const entityIds: number[] = [];

  for (const entity of Array.from(uniqueEntities.values())) {
    const existing = await getEntityByName(entity.name);
    if (existing) {
      entityIds.push(existing.id);
      continue;
    }

    const created = await createEntity({
      name: entity.name,
      type: entity.type,
      description: entity.context.slice(0, 2).join("; ") || null,
      mentionCount: entity.mentions,
    });

    const entityId = Number((created as { insertId?: number }).insertId);
    if (Number.isFinite(entityId)) {
      entityIds.push(entityId);
    }
  }

  if (entityIds.length < 2) {
    return;
  }

  for (let i = 0; i < entityIds.length - 1; i += 1) {
    const left = entityIds[i];
    const right = entityIds[i + 1];
    if (left === right) continue;

    await createEntityRelationship({
      entity1Id: left,
      entity2Id: right,
      relationshipType: "co_occurs",
      strength: 0.5 as any,
    });
  }
}
