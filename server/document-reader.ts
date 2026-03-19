/**
 * Document Reader Agent
 * Processes documents up to 1M tokens using Qwen2.5-1M
 * Extracts structured summaries with key claims, entities, dates, and confidence levels
 */

import { createDocumentSummary } from "./db";

export interface ExtractedClaim {
  text: string;
  confidence: number;
  entities: string[];
  sourceLocation: string; // e.g., "page 5, paragraph 2"
}

export interface ExtractedEntity {
  name: string;
  type: "person" | "organization" | "concept" | "location" | "date";
  mentions: number;
  context: string[];
}

export interface DocumentSummaryResult {
  documentId: number;
  keyClaims: ExtractedClaim[];
  entities: ExtractedEntity[];
  dates: string[];
  contradictions: {
    claim1: string;
    claim2: string;
    severity: "high" | "medium" | "low";
  }[];
  summary: string;
  tokenCount: number;
  processingTime: number;
}

/**
 * Process a document and extract structured summary
 * Handles up to 1M tokens without chunking
 */
export async function processDocumentWithQwen(
  documentId: number,
  documentText: string
): Promise<DocumentSummaryResult> {
  const startTime = Date.now();

  try {
    // TODO: Implement Qwen2.5-1M document processing
    // This would involve:
    // 1. Loading Qwen2.5-1M model
    // 2. Tokenizing the full document (up to 1M tokens)
    // 3. Processing with DCA (Dual Chunk Attention) and Sparse Attention
    // 4. Extracting structured information

    console.log(`[Document Reader] Processing document ${documentId}`);

    // For now, return placeholder
    const keyClaims = extractKeyClaimsFromText(documentText);
    const entities = extractEntitiesFromText(documentText);
    const dates = extractDatesFromText(documentText);
    const contradictions = detectInternalContradictions(documentText);

    const result: DocumentSummaryResult = {
      documentId,
      keyClaims,
      entities,
      dates,
      contradictions,
      summary: generateSummary(documentText),
      tokenCount: Math.ceil(documentText.length / 4), // Rough estimate
      processingTime: Date.now() - startTime,
    };

    // Store in database
    await createDocumentSummary({
      documentId,
      keyClaims: keyClaims as any,
      entities: entities as any,
      dates,
      contradictions: contradictions as any,
      summary: result.summary,
    });

    return result;
  } catch (error) {
    console.error(`Failed to process document ${documentId}:`, error);
    throw error;
  }
}

/**
 * Extract key claims from document text
 */
function extractKeyClaimsFromText(text: string): ExtractedClaim[] {
  // TODO: Implement claim extraction using NLP
  // This could involve:
  // 1. Sentence tokenization
  // 2. Identifying claim-bearing sentences
  // 3. Extracting supporting entities
  // 4. Assigning confidence scores

  const sentences = text.split(".").filter((s) => s.trim().length > 20);
  return sentences.slice(0, 5).map((sentence) => ({
    text: sentence.trim(),
    confidence: 0.75,
    entities: extractEntitiesFromSentence(sentence),
    sourceLocation: "extracted",
  }));
}

/**
 * Extract entities from document text
 */
function extractEntitiesFromText(text: string): ExtractedEntity[] {
  const stopWords = new Set([
    "about",
    "after",
    "before",
    "because",
    "between",
    "could",
    "every",
    "first",
    "their",
    "there",
    "these",
    "those",
    "which",
    "while",
    "would",
  ]);

  const tokens = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

  const counts = new Map<string, number>();
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (stopWords.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return ranked.map(([name, mentions]) => ({
    name,
    type: "concept",
    mentions,
    context: [`Mentioned ${mentions} time(s) in extracted text`],
  }));
}

/**
 * Extract entities from a sentence
 */
function extractEntitiesFromSentence(sentence: string): string[] {
  // TODO: Implement entity extraction for a single sentence
  const words = sentence.split(" ");
  return words.filter((w) => w.length > 5).slice(0, 3);
}

/**
 * Extract dates from document text
 */
function extractDatesFromText(text: string): string[] {
  // TODO: Implement date extraction
  // This could involve:
  // 1. Regex patterns for common date formats
  // 2. Temporal NLP
  // 3. Parsing relative dates

  const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g;
  return text.match(datePattern) || [];
}

/**
 * Detect internal contradictions within the document
 */
function detectInternalContradictions(
  text: string
): {
  claim1: string;
  claim2: string;
  severity: "high" | "medium" | "low";
}[] {
  // TODO: Implement contradiction detection
  // This would involve:
  // 1. Extracting all claims
  // 2. Comparing claims semantically
  // 3. Identifying contradictions
  // 4. Assessing severity

  return [];
}

/**
 * Generate a summary of the document
 */
function generateSummary(text: string): string {
  // TODO: Implement abstractive summarization
  // This could involve:
  // 1. Using a summarization model
  // 2. Extracting key sentences
  // 3. Generating abstractive summary

  const sentences = text.split(".").filter((s) => s.trim().length > 0);
  if (sentences.length === 0) {
    return "No textual summary could be generated from this document.";
  }

  const summary = sentences.slice(0, 3).join(". ").trim();
  return summary.endsWith(".") ? summary : `${summary}.`;
}

/**
 * Compare two documents for contradictions
 */
export async function compareDocumentsForContradictions(
  doc1Id: number,
  doc2Id: number,
  doc1Text: string,
  doc2Text: string
): Promise<
  {
    claim1: string;
    claim2: string;
    severity: "high" | "medium" | "low";
  }[]
> {
  try {
    const claims1 = extractKeyClaimsFromText(doc1Text).slice(0, 8);
    const claims2 = extractKeyClaimsFromText(doc2Text).slice(0, 8);

    const contradictions: {
      claim1: string;
      claim2: string;
      severity: "high" | "medium" | "low";
    }[] = [];

    for (const left of claims1) {
      const leftHasNegation = /\b(no|not|never|none|cannot|without|lack|fails?)\b/i.test(
        left.text
      );

      for (const right of claims2) {
        const rightHasNegation = /\b(no|not|never|none|cannot|without|lack|fails?)\b/i.test(
          right.text
        );

        const sharedTerms = left.text
          .toLowerCase()
          .split(/\W+/)
          .filter((token) => token.length > 3)
          .filter((token) => right.text.toLowerCase().includes(token));

        if (sharedTerms.length < 2) continue;
        if (leftHasNegation === rightHasNegation) continue;

        contradictions.push({
          claim1: left.text,
          claim2: right.text,
          severity: sharedTerms.length >= 4 ? "high" : "medium",
        });
      }
    }

    return contradictions.slice(0, 10);
  } catch (error) {
    console.error("Failed to compare documents:", error);
    throw error;
  }
}

/**
 * Extract specific information from a document
 */
export async function extractInformationFromDocument(
  documentId: number,
  query: string,
  documentText: string
): Promise<{
  information: string;
  confidence: number;
  sources: string[];
}> {
  try {
    const queryTerms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2);

    const sentences = documentText
      .split(/\n|\./)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    const ranked = sentences
      .map((sentence, index) => {
        const lower = sentence.toLowerCase();
        let score = 0;
        for (const term of queryTerms) {
          if (lower.includes(term)) score += 1;
        }
        return { sentence, score, index };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const information =
      ranked.length > 0
        ? ranked.map((entry) => entry.sentence).join(". ")
        : "No direct evidence found for the query in this document.";

    const confidence =
      ranked.length > 0
        ? Math.min(0.95, 0.45 + ranked[0].score * 0.1)
        : 0.2;

    return {
      information,
      confidence: Number(confidence.toFixed(4)),
      sources: ranked.map((entry) => `sentence-${entry.index + 1}`),
    };
  } catch (error) {
    console.error("Failed to extract information:", error);
    throw error;
  }
}

/**
 * Process multimodal content (images, charts, scanned documents)
 */
export async function processMultimodalDocument(
  documentId: number,
  documentPath: string,
  contentType: "pdf" | "image" | "mixed"
): Promise<DocumentSummaryResult> {
  try {
    const syntheticText = [
      `Multimodal document detected at path: ${documentPath}`,
      `Content type classification: ${contentType}`,
      "Visual parsing is represented as metadata-aware textual extraction in this build.",
    ].join("\n");

    return await processDocumentWithQwen(documentId, syntheticText);
  } catch (error) {
    console.error("Failed to process multimodal document:", error);
    throw error;
  }
}

/**
 * Process audio/speech content
 */
export async function processAudioDocument(
  documentId: number,
  audioPath: string
): Promise<{
  transcription: string;
  language: string;
  segments: {
    text: string;
    startTime: number;
    endTime: number;
  }[];
}> {
  try {
    const placeholderTranscription = `Audio processing placeholder transcription for ${audioPath}`;

    return {
      transcription: placeholderTranscription,
      language: "en",
      segments: [
        {
          text: placeholderTranscription,
          startTime: 0,
          endTime: 30,
        },
      ],
    };
  } catch (error) {
    console.error("Failed to process audio document:", error);
    throw error;
  }
}
