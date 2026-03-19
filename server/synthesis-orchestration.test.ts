import { describe, expect, it } from "vitest";
import {
  completeSynthesisPipeline,
  strategicDocumentOrdering,
  type DocumentWithScore,
} from "./synthesis-orchestration";
import type { AggregatedResult } from "./retrieval";

describe("synthesis orchestration", () => {
  const retrievedResults: AggregatedResult[] = [
    {
      chunkId: "doc-10-c1",
      documentId: 10,
      text: "Study A reports a measurable reduction in emissions after carbon pricing.",
      sources: [],
      aggregatedScore: 0.92,
      trustScore: 0.8,
    },
    {
      chunkId: "doc-11-c1",
      documentId: 11,
      text: "Study B confirms reduced emissions in heavy industry with similar policy levers.",
      sources: [],
      aggregatedScore: 0.83,
      trustScore: 0.78,
    },
    {
      chunkId: "doc-12-c1",
      documentId: 12,
      text: "Study C notes uncertainty in short-term adoption rates for smaller firms.",
      sources: [],
      aggregatedScore: 0.64,
      trustScore: 0.7,
    },
  ];

  it("orders documents and keeps limit", () => {
    const ordered = strategicDocumentOrdering(retrievedResults, 5);

    expect(ordered.length).toBeLessThanOrEqual(5);
    expect(ordered[0].documentId).toBe(10);
  });

  it("runs complete synthesis with verification", async () => {
    const result = await completeSynthesisPipeline(
      "What does the evidence say about carbon pricing and emissions?",
      retrievedResults,
      [
        { id: 10, title: "Study A", status: "completed", processedAt: new Date() },
        { id: 11, title: "Study B", status: "completed", processedAt: new Date() },
      ]
    );

    expect(result.finalSynthesis.length).toBeGreaterThan(50);
    expect(result.halluccinationScore).toBeGreaterThanOrEqual(0);
    expect(result.halluccinationScore).toBeLessThanOrEqual(1);
    expect(result.processingMetrics.totalTime).toBeGreaterThanOrEqual(0);
  });
});
