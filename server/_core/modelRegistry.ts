import { ENV } from "./env";

export type ModelRole =
  | "default"
  | "boss"
  | "documentReader"
  | "subAgent"
  | "synthesis"
  | "crag"
  | "multimodal"
  | "transcription"
  | "embedding";

const MODEL_BY_ROLE: Record<ModelRole, string> = {
  default: ENV.defaultChatModel,
  boss: ENV.bossAgentModel,
  documentReader: ENV.documentReaderModel,
  subAgent: ENV.subAgentModel,
  synthesis: ENV.synthesisModel,
  crag: ENV.cragEvaluatorModel,
  multimodal: ENV.multimodalModel,
  transcription: ENV.transcriptionModel,
  embedding: ENV.embeddingModel,
};

export function resolveModelForRole(
  role?: ModelRole,
  explicitModel?: string
): string {
  if (explicitModel && explicitModel.trim().length > 0) {
    return explicitModel.trim();
  }

  if (role && MODEL_BY_ROLE[role]) {
    return MODEL_BY_ROLE[role];
  }

  return MODEL_BY_ROLE.default;
}

export function listConfiguredModels() {
  return { ...MODEL_BY_ROLE };
}
