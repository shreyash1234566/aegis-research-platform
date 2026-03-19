import {
  createClaim,
  createContradiction,
  createPerformanceMetric,
  createSynthesisReport,
  getDocumentSummariesByDocumentIds,
  getDocumentsByUserId,
  getSynthesisReportByQueryId,
  getSynthesisQuery,
  updateSynthesisQueryStatus,
} from "../db";
import { completeSynthesisPipeline } from "../synthesis-orchestration";
import { multiSourceRetrieval, type CorpusChunk } from "../retrieval";
import { logError, logInfo, logWarn } from "../_core/logger";
import { scheduleJob } from "./jobRunner";

type SynthesisJobPayload = {
  queryId: number;
  userId: number;
  documentIds?: number[];
};

type ClaimDraft = {
  text: string;
  sourceChunkIds: string[];
  confidenceTier: "high" | "medium" | "low";
  supportingDocuments: number[];
  contradictingDocuments: number[];
};

type ContradictionDraft = {
  claim1: string;
  claim2: string;
  source1DocumentId: number;
  source2DocumentId: number;
  severity: "high" | "medium" | "low";
};

const SYNTHESIS_JOB_TIMEOUT_MS = 180_000;

export function enqueueSynthesisJob(payload: SynthesisJobPayload) {
  scheduleJob({
    name: "synthesis-processing",
    payload,
    timeoutMs: SYNTHESIS_JOB_TIMEOUT_MS,
    maxRetries: 2,
    backoffMs: 1500,
    run: runSynthesisJob,
    onRetry: async (jobPayload, error, attempt, jobId) => {
      await updateSynthesisQueryStatus(jobPayload.queryId, "processing");
      logWarn("synthesis.retry", {
        jobId,
        queryId: jobPayload.queryId,
        userId: jobPayload.userId,
        attempt,
        error: error.message,
      });
    },
    onFailure: async (jobPayload, error, attempts, jobId) => {
      await updateSynthesisQueryStatus(jobPayload.queryId, "failed");
      logError("synthesis.failed", {
        jobId,
        queryId: jobPayload.queryId,
        userId: jobPayload.userId,
        attempts,
        error: error.message,
      });
    },
  });
}

async function runSynthesisJob({
  queryId,
  userId,
  documentIds,
}: SynthesisJobPayload): Promise<void> {
  const startTime = Date.now();

  await updateSynthesisQueryStatus(queryId, "processing");

  const existingReport = await getSynthesisReportByQueryId(queryId);
  if (existingReport) {
    await updateSynthesisQueryStatus(queryId, "completed");
    logInfo("synthesis.skipped_existing_report", {
      queryId,
      userId,
      reportId: existingReport.id,
    });
    return;
  }

  const queryRecord = await getSynthesisQuery(queryId);
  if (!queryRecord || queryRecord.userId !== userId) {
    throw new Error(`Synthesis query ${queryId} is not accessible to user ${userId}`);
  }

  const userDocuments = await getDocumentsByUserId(userId);
  const selectedDocuments = selectDocuments(userDocuments, documentIds);

  const selectedDocumentIds = selectedDocuments.map((doc) => doc.id);
  const summaries = await getDocumentSummariesByDocumentIds(selectedDocumentIds);
  const corpus = buildCorpusFromSummaries(summaries);

  const retrievalResults = await multiSourceRetrieval(queryRecord.query, 12, corpus);
  const synthesisResult = await completeSynthesisPipeline(
    queryRecord.query,
    retrievalResults,
    selectedDocuments
  );

  const claims = buildClaimsFromVerification(synthesisResult.claims);
  const contradictions = buildContradictionsFromClaims(claims);
  const reportContent = buildReportContent(
    queryRecord.query,
    selectedDocuments.map((doc) => doc.title),
    synthesisResult.finalSynthesis,
    synthesisResult.processingMetrics,
    synthesisResult.halluccinationScore
  );

  const reportResult = await createSynthesisReport({
    queryId,
    reportContent,
    claims,
    contradictions,
    halluccinationScore: synthesisResult.halluccinationScore as any,
  });

  const reportId = Number((reportResult as { insertId?: number }).insertId);
  if (!Number.isFinite(reportId)) {
    throw new Error("Failed to resolve created synthesis report id");
  }

  for (const claim of claims) {
    await createClaim({
      reportId,
      claimText: claim.text,
      sourceChunkIds: claim.sourceChunkIds,
      confidenceTier: claim.confidenceTier,
      supportingDocuments: claim.supportingDocuments,
      contradictingDocuments: claim.contradictingDocuments,
    });
  }

  for (const contradiction of contradictions) {
    await createContradiction({
      reportId,
      claim1: contradiction.claim1,
      claim2: contradiction.claim2,
      source1DocumentId: contradiction.source1DocumentId,
      source2DocumentId: contradiction.source2DocumentId,
      severity: contradiction.severity,
    });
  }

  await recordPipelineMetrics(
    queryId,
    reportId,
    synthesisResult.processingMetrics,
    synthesisResult.halluccinationScore,
    Date.now() - startTime
  );

  await updateSynthesisQueryStatus(queryId, "completed");
  logInfo("synthesis.completed", {
    queryId,
    userId,
    reportId,
    claims: claims.length,
    contradictions: contradictions.length,
    totalMs: Date.now() - startTime,
  });
}

function selectDocuments(
  userDocuments: Array<{ id: number; title: string }>,
  requestedIds?: number[]
): Array<{ id: number; title: string }> {
  if (!requestedIds || requestedIds.length === 0) {
    return userDocuments.slice(0, 5);
  }

  const requested = new Set(requestedIds);
  return userDocuments.filter((doc) => requested.has(doc.id)).slice(0, 5);
}

function buildReportContent(
  query: string,
  selectedTitles: string[],
  synthesis: string,
  metrics: {
    retrievalTime: number;
    synthesisTime: number;
    verificationTime: number;
    totalTime: number;
  },
  halluccinationScore: number
): string {
  const scope =
    selectedTitles.length > 0
      ? selectedTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")
      : "No documents were selected. The synthesis is based on query context only.";

  return [
    "# Synthesis Report",
    "",
    "## Query",
    query,
    "",
    "## Scope",
    scope,
    "",
    "## Findings",
    synthesis,
    "",
    "## Quality Metrics",
    `- Hallucination score: ${halluccinationScore.toFixed(4)}`,
    `- Retrieval time: ${metrics.retrievalTime}ms`,
    `- Synthesis time: ${metrics.synthesisTime}ms`,
    `- Verification time: ${metrics.verificationTime}ms`,
    `- Total time: ${metrics.totalTime}ms`,
  ].join("\n");
}

function buildClaimsFromVerification(
  verificationClaims: Array<{
    claim: string;
    grounding: string[];
    confidenceTier: "high" | "medium" | "low";
    supportingDocuments: number[];
    contradictingDocuments: number[];
  }>
): ClaimDraft[] {
  if (verificationClaims.length === 0) {
    return [
      {
        text: "No high-confidence grounded claims could be produced for the current corpus.",
        sourceChunkIds: ["no-evidence"],
        confidenceTier: "low",
        supportingDocuments: [],
        contradictingDocuments: [],
      },
    ];
  }

  return verificationClaims.map((claim) => ({
    text: claim.claim,
    sourceChunkIds: claim.grounding,
    confidenceTier: claim.confidenceTier,
    supportingDocuments: Array.from(new Set(claim.supportingDocuments)),
    contradictingDocuments: Array.from(new Set(claim.contradictingDocuments)),
  }));
}

function buildContradictionsFromClaims(claims: ClaimDraft[]): ContradictionDraft[] {
  const contradictions: ContradictionDraft[] = [];

  for (const claim of claims) {
    if (claim.contradictingDocuments.length === 0) {
      continue;
    }

    const source1DocumentId = claim.supportingDocuments[0] ?? claim.contradictingDocuments[0];
    const source2DocumentId = claim.contradictingDocuments[0];
    if (!source1DocumentId || !source2DocumentId) {
      continue;
    }

    contradictions.push({
      claim1: claim.text,
      claim2: "Conflicting evidence detected for this claim in another source.",
      source1DocumentId,
      source2DocumentId,
      severity: claim.confidenceTier === "low" ? "high" : "medium",
    });
  }

  return contradictions;
}

function buildCorpusFromSummaries(
  summaries: Array<{
    documentId: number;
    summary: string | null;
    keyClaims: unknown;
    entities: unknown;
  }>
): CorpusChunk[] {
  return summaries.map((summary, index) => {
    const keyClaims = Array.isArray(summary.keyClaims)
      ? summary.keyClaims
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "text" in item) {
              return String((item as { text: unknown }).text);
            }
            return "";
          })
          .filter(Boolean)
      : [];

    const entities = Array.isArray(summary.entities)
      ? summary.entities
          .map((entity) => {
            if (typeof entity === "string") return entity;
            if (entity && typeof entity === "object" && "name" in entity) {
              return String((entity as { name: unknown }).name);
            }
            return "";
          })
          .filter(Boolean)
      : [];

    const text = [summary.summary ?? "", ...keyClaims].join("\n").trim();

    return {
      chunkId: `doc-${summary.documentId}-summary-${index + 1}`,
      documentId: summary.documentId,
      text,
      entities,
    };
  }).filter((chunk) => chunk.text.length > 0);
}

async function recordPipelineMetrics(
  queryId: number,
  reportId: number,
  metrics: {
    retrievalTime: number;
    synthesisTime: number;
    verificationTime: number;
    totalTime: number;
  },
  halluccinationScore: number,
  elapsedMs: number
) {
  const values = [
    { metricType: "retrieval_time_ms", value: metrics.retrievalTime },
    { metricType: "synthesis_time_ms", value: metrics.synthesisTime },
    { metricType: "verification_time_ms", value: metrics.verificationTime },
    { metricType: "pipeline_total_time_ms", value: metrics.totalTime },
    { metricType: "worker_elapsed_ms", value: elapsedMs },
    { metricType: "hallucination_score", value: halluccinationScore },
  ];

  for (const metric of values) {
    await createPerformanceMetric({
      metricType: metric.metricType,
      value: Number(metric.value.toFixed(4)) as any,
      queryId,
      reportId,
    });
  }
}
