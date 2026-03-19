import { bench, describe } from "vitest";
import { multiSourceRetrieval, type CorpusChunk } from "../retrieval";

function buildCorpus(size: number): CorpusChunk[] {
  return Array.from({ length: size }).map((_, index) => ({
    chunkId: `chunk-${index + 1}`,
    documentId: index + 1,
    text: `Document ${index + 1} discusses climate policy impacts, industrial emissions trends, and regional adaptation strategies.`,
    entities: ["climate", "policy", "emissions", `region-${index % 12}`],
  }));
}

describe("retrieval benchmark", () => {
  const corpus = buildCorpus(300);

  bench("multi-source retrieval topK=12 over 300 chunks", async () => {
    await multiSourceRetrieval(
      "Summarize evidence on climate policy and industrial emissions",
      12,
      corpus
    );
  });
});
