export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  defaultChatModel: process.env.DEFAULT_CHAT_MODEL ?? "gemini-2.5-flash",
  fallbackChatModel: process.env.FALLBACK_CHAT_MODEL ?? "gpt-4.1-mini",
  bossAgentModel: process.env.BOSS_AGENT_MODEL ?? "deepseek-r1-distill-qwen-32b",
  documentReaderModel:
    process.env.DOCUMENT_READER_MODEL ?? "qwen2.5-14b-instruct-1m",
  subAgentModel:
    process.env.SUB_AGENT_MODEL ?? "deepseek-r1-distill-qwen-14b",
  synthesisModel: process.env.SYNTHESIS_MODEL ?? "self-rag-13b",
  cragEvaluatorModel: process.env.CRAG_EVALUATOR_MODEL ?? "t5-large",
  multimodalModel: process.env.MULTIMODAL_MODEL ?? "qwen2.5-vl-32b",
  transcriptionModel:
    process.env.TRANSCRIPTION_MODEL ?? "whisper-large-v3",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "mE5-large-instruct",
};
