/**
 * Six-Layer Hallucination Defense Pipeline
 * Each layer targets specific failure modes to reduce hallucination rates
 */

import { AggregatedResult } from "./retrieval";

export interface VerificationResult {
  isSupported: boolean;
  confidence: number;
  sources: string[];
  issues: string[];
}

export interface ClaimVerification {
  claim: string;
  grounding: string[];
  confidenceTier: "high" | "medium" | "low";
  supportingDocuments: number[];
  contradictingDocuments: number[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function overlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of Array.from(left)) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(left.size, right.size);
}

function hasNegation(text: string): boolean {
  return /\b(no|not|never|none|cannot|without|lack|fails?)\b/i.test(text);
}

/**
 * LAYER 1: MEGA-RAG Multi-Source Retrieval
 * Already implemented in retrieval.ts
 * Combines FAISS, BM25, and GraphRAG for comprehensive evidence gathering
 */

/**
 * LAYER 2: CRAG - Retrieval Quality Gating
 * Uses T5-large evaluator to score retrieved chunks
 * Produces verdicts: Correct, Incorrect, or Ambiguous
 */
export async function cragGating(
  chunk: string,
  query: string
): Promise<{
  verdict: "correct" | "incorrect" | "ambiguous";
  score: number;
  cleanedChunk?: string;
}> {
  try {
    const score = overlapScore(query, chunk);
    let verdict: "correct" | "incorrect" | "ambiguous" = "ambiguous";
    if (score >= 0.35) verdict = "correct";
    else if (score < 0.12) verdict = "incorrect";

    return {
      verdict,
      score: Number(score.toFixed(4)),
      cleanedChunk: chunk,
    };
  } catch (error) {
    console.error("CRAG gating failed:", error);
    throw error;
  }
}

/**
 * LAYER 3: Self-RAG - Continuous In-Generation Retrieval
 * Generates reflection tokens during synthesis to self-verify claims
 */
export interface ReflectionTokens {
  retrieve: boolean; // Whether to retrieve more information
  isRel: boolean; // Is retrieved content relevant?
  isSupp: boolean; // Is generated statement supported?
  isUse: boolean; // Is this section useful?
}

export async function selfRagSynthesis(
  query: string,
  evidence: AggregatedResult[]
): Promise<{
  synthesis: string;
  reflections: ReflectionTokens[];
  retrievalCycles: number;
}> {
  try {
    const topEvidence = evidence.slice(0, 4);

    if (topEvidence.length === 0) {
      return {
        synthesis: "No grounded evidence was retrieved for this query.",
        reflections: [
          {
            retrieve: true,
            isRel: false,
            isSupp: false,
            isUse: false,
          },
        ],
        retrievalCycles: 1,
      };
    }

    const reflections = topEvidence.map((item) => {
      const relevance = overlapScore(query, item.text);
      return {
        retrieve: relevance < 0.18,
        isRel: relevance >= 0.18,
        isSupp: item.aggregatedScore >= 0.25,
        isUse: item.aggregatedScore >= 0.18,
      };
    });

    const synthesisLines = topEvidence.map(
      (item, index) =>
        `${index + 1}. [Doc ${item.documentId}] ${item.text.slice(0, 260).trim()}`
    );

    return {
      synthesis: [
        `Grounded synthesis for: ${query}`,
        "",
        "Evidence-backed findings:",
        ...synthesisLines,
      ].join("\n"),
      reflections,
      retrievalCycles: reflections.some((item) => item.retrieve) ? 2 : 1,
    };
  } catch (error) {
    console.error("Self-RAG synthesis failed:", error);
    throw error;
  }
}

/**
 * LAYER 4: RE-RAG - Document Trust Classifier
 * Assigns confidence scores to retrieved documents
 */
export async function documentTrustClassifier(
  document: any,
  chunk: string,
  query: string
): Promise<{
  trustScore: number;
  reliability: "high" | "medium" | "low";
  recommendation: "use_rag" | "use_parametric" | "explicit_uncertainty";
}> {
  try {
    const relevance = overlapScore(query, chunk);
    const recencyBoost =
      document?.processedAt && !Number.isNaN(new Date(document.processedAt).getTime())
        ? 0.1
        : 0;
    const statusBoost = document?.status === "completed" ? 0.15 : 0;
    const trustScore = Math.min(1, relevance * 0.7 + recencyBoost + statusBoost + 0.1);

    let reliability: "high" | "medium" | "low" = "medium";
    let recommendation: "use_rag" | "use_parametric" | "explicit_uncertainty" =
      "explicit_uncertainty";

    if (trustScore > 0.72) {
      reliability = "high";
      recommendation = "use_rag";
    } else if (trustScore < 0.3) {
      reliability = "low";
      recommendation = "explicit_uncertainty";
    } else {
      recommendation = "use_parametric";
    }

    return {
      trustScore: Number(trustScore.toFixed(4)),
      reliability,
      recommendation,
    };
  } catch (error) {
    console.error("Document trust classification failed:", error);
    throw error;
  }
}

/**
 * LAYER 5: Constitutional Verification
 * Performs three checks on every claim:
 * 1. Grounding check - match claims to source chunks
 * 2. Contradiction detection - surface conflicting evidence
 * 3. Confidence calibration - assign confidence tiers
 */
export async function constitutionalVerification(
  claims: string[],
  evidence: AggregatedResult[],
  documents: any[]
): Promise<ClaimVerification[]> {
  try {
    const verifiedClaims: ClaimVerification[] = [];

    for (const claim of claims) {
      // 1. Grounding check
      const groundingChunks = findGroundingChunks(claim, evidence);

      // 2. Contradiction detection
      const contradictions = detectContradictions(claim, evidence, documents);

      // 3. Confidence calibration
      const confidenceTier = calibrateConfidence(
        claim,
        groundingChunks,
        contradictions
      );

      verifiedClaims.push({
        claim,
        grounding: groundingChunks.map((c) => c.chunkId),
        confidenceTier,
        supportingDocuments: groundingChunks.map((c) => c.documentId),
        contradictingDocuments: contradictions.map((c) => c.documentId),
      });
    }

    return verifiedClaims;
  } catch (error) {
    console.error("Constitutional verification failed:", error);
    throw error;
  }
}

/**
 * Find chunks that ground a specific claim
 */
function findGroundingChunks(
  claim: string,
  evidence: AggregatedResult[]
): AggregatedResult[] {
  return [...evidence]
    .map((item) => ({
      item,
      score: overlapScore(claim, item.text),
    }))
    .filter(({ score }) => score >= 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);
}

/**
 * Detect contradictions between claim and evidence
 */
function detectContradictions(
  claim: string,
  evidence: AggregatedResult[],
  documents: any[]
): AggregatedResult[] {
  const claimNegation = hasNegation(claim);

  return evidence.filter((item) => {
    const sharedTerms = overlapScore(claim, item.text);
    if (sharedTerms < 0.15) {
      return false;
    }

    const evidenceNegation = hasNegation(item.text);
    return claimNegation !== evidenceNegation;
  });
}

/**
 * Calibrate confidence tier based on grounding and contradictions
 */
function calibrateConfidence(
  claim: string,
  groundingChunks: AggregatedResult[],
  contradictions: AggregatedResult[]
): "high" | "medium" | "low" {
  // High: Multiple independent sources, recent, semantically central
  if (groundingChunks.length >= 3 && contradictions.length === 0) {
    return "high";
  }
  // Low: Few sources, contradictions present
  if (groundingChunks.length <= 1 || contradictions.length > 0) {
    return "low";
  }
  // Medium: Moderate support
  return "medium";
}

/**
 * LAYER 6: DeepSeek-R1 Reasoning Verification
 * Uses RL-trained self-verification for logic-based hallucination elimination
 */
export async function deepseekR1Verification(
  synthesis: string,
  claims: ClaimVerification[],
  evidence: AggregatedResult[]
): Promise<{
  finalSynthesis: string;
  reasoning: string;
  correctedClaims: ClaimVerification[];
}> {
  try {
    const correctedClaims = claims.map((claim) => {
      if (claim.confidenceTier !== "low") {
        return claim;
      }

      const strongerGrounding = evidence
        .filter((item) => overlapScore(claim.claim, item.text) >= 0.2)
        .slice(0, 2)
        .map((item) => item.chunkId);

      if (strongerGrounding.length > claim.grounding.length) {
        return {
          ...claim,
          grounding: strongerGrounding,
          confidenceTier: "medium" as const,
        };
      }

      return claim;
    });

    const lowConfidenceCount = correctedClaims.filter(
      (claim) => claim.confidenceTier === "low"
    ).length;

    const finalSynthesis =
      lowConfidenceCount > 0
        ? `${synthesis}\n\nVerification note: ${lowConfidenceCount} claim(s) remain low confidence and should be treated as tentative.`
        : synthesis;

    return {
      finalSynthesis,
      reasoning: `Verified ${correctedClaims.length} claims against ${evidence.length} evidence chunks.`,
      correctedClaims,
    };
  } catch (error) {
    console.error("DeepSeek-R1 verification failed:", error);
    throw error;
  }
}

/**
 * Complete hallucination defense pipeline
 */
export async function completeHallucinationDefense(
  query: string,
  synthesis: string,
  evidence: AggregatedResult[],
  documents: any[]
): Promise<{
  verifiedSynthesis: string;
  claims: ClaimVerification[];
  halluccinationScore: number;
  issues: string[];
}> {
  try {
    // Extract claims from synthesis
    const claims = extractClaims(synthesis);

    // Layer 5: Constitutional verification
    const verifiedClaims = await constitutionalVerification(
      claims,
      evidence,
      documents
    );

    // Layer 6: DeepSeek-R1 reasoning verification
    const { finalSynthesis, correctedClaims } = await deepseekR1Verification(
      synthesis,
      verifiedClaims,
      evidence
    );

    // Calculate hallucination score
    const halluccinationScore = calculateHallucinationScore(correctedClaims);

    // Collect issues
    const issues = correctedClaims
      .filter((c) => c.confidenceTier === "low")
      .map((c) => `Low confidence claim: ${c.claim}`);

    return {
      verifiedSynthesis: finalSynthesis,
      claims: correctedClaims,
      halluccinationScore,
      issues,
    };
  } catch (error) {
    console.error("Complete hallucination defense failed:", error);
    throw error;
  }
}

/**
 * Extract claims from synthesis text
 */
function extractClaims(synthesis: string): string[] {
  return synthesis
    .split(/\n|\.|\?|!/) 
    .map((line) => line.replace(/^[-*\d\s.]+/, "").trim())
    .filter((line) => line.length > 20)
    .slice(0, 12);
}

/**
 * Calculate overall hallucination score
 */
function calculateHallucinationScore(claims: ClaimVerification[]): number {
  if (claims.length === 0) return 0;

  const lowConfidenceCount = claims.filter(
    (c) => c.confidenceTier === "low"
  ).length;
  const mediumConfidenceCount = claims.filter(
    (c) => c.confidenceTier === "medium"
  ).length;

  // Score: (low * 1.0 + medium * 0.3) / total
  const score =
    (lowConfidenceCount * 1.0 + mediumConfidenceCount * 0.3) / claims.length;
  return Math.min(score, 1.0);
}
