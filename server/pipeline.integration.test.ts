import { describe, expect, it } from "vitest";
import { megaRagPipeline, type CorpusChunk } from "./retrieval";
import { completeHallucinationDefense } from "./hallucination-defense";

describe("pipeline integration", () => {
  it("builds grounded synthesis and verification signals", async () => {
    const corpus: CorpusChunk[] = [
      {
        chunkId: "doc-1",
        documentId: 1,
        text: "Carbon pricing reduced industrial emissions by 12 percent according to Study A.",
        entities: ["carbon", "pricing", "emissions"],
      },
      {
        chunkId: "doc-2",
        documentId: 2,
        text: "Study B confirms reduced emissions in heavy industry after policy adoption.",
        entities: ["policy", "industry", "emissions"],
      },
      {
        chunkId: "doc-3",
        documentId: 3,
        text: "A separate report states adoption pace differs by region and sector.",
        entities: ["adoption", "region", "sector"],
      },
    ];

    const retrieval = await megaRagPipeline(
      "What is the evidence on carbon pricing and industrial emissions?",
      8,
      corpus
    );

    const defense = await completeHallucinationDefense(
      "What is the evidence on carbon pricing and industrial emissions?",
      retrieval.answer,
      retrieval.evidence,
      [
        { id: 1, status: "completed", processedAt: new Date() },
        { id: 2, status: "completed", processedAt: new Date() },
      ]
    );

    expect(retrieval.evidence.length).toBeGreaterThan(0);
    expect(retrieval.answer.length).toBeGreaterThan(30);
    expect(defense.verifiedSynthesis.length).toBeGreaterThan(20);
    expect(defense.halluccinationScore).toBeGreaterThanOrEqual(0);
    expect(defense.halluccinationScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(defense.claims)).toBe(true);
  });
});
