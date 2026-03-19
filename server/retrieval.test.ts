import { describe, expect, it } from "vitest";
import {
  megaRagPipeline,
  multiSourceRetrieval,
  type CorpusChunk,
} from "./retrieval";

describe("retrieval pipeline", () => {
  const corpus: CorpusChunk[] = [
    {
      chunkId: "doc-1-a",
      documentId: 1,
      text: "Climate policy reduced industrial emissions by twelve percent in 2023.",
      entities: ["climate", "policy", "emissions"],
    },
    {
      chunkId: "doc-2-a",
      documentId: 2,
      text: "Battery costs continued to fall as manufacturing scale increased.",
      entities: ["battery", "manufacturing"],
    },
    {
      chunkId: "doc-3-a",
      documentId: 3,
      text: "A separate healthcare report discusses staffing ratios in hospitals.",
      entities: ["healthcare", "staffing"],
    },
  ];

  it("retrieves grounded evidence from corpus", async () => {
    const results = await multiSourceRetrieval(
      "How did climate policy affect emissions?",
      5,
      corpus
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.documentId === 1)).toBe(true);
    expect(results[0].aggregatedScore).toBeGreaterThanOrEqual(0);
  });

  it("produces a complete MEGA-RAG response", async () => {
    const output = await megaRagPipeline(
      "Summarize policy impact on emissions",
      5,
      corpus
    );

    expect(output.evidence.length).toBeGreaterThan(0);
    expect(output.answer.length).toBeGreaterThan(20);
    expect(output.alignmentScore).toBeGreaterThanOrEqual(0);
    expect(output.alignmentScore).toBeLessThanOrEqual(1);
  });
});
