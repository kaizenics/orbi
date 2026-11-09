import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { createOllama } from "ai-sdk-ollama";

export interface AiConfig {
  provider: "openrouter" | "ollama";
  model: string;
  /** OpenRouter API key (server-side only). */
  apiKey?: string;
  /** Ollama base URL, e.g. http://127.0.0.1:11434 */
  baseUrl?: string;
}

export interface AiModel {
  model: LanguageModel;
  provider: AiConfig["provider"];
  modelId: string;
}

/** The one place that knows provider SDKs; pipelines only see an AI SDK LanguageModel. */
export function createAiModel(config: AiConfig): AiModel {
  const model =
    config.provider === "openrouter"
      ? createOpenRouter({ apiKey: config.apiKey })(config.model)
      : createOllama({ baseURL: config.baseUrl })(config.model);
  return { model, provider: config.provider, modelId: config.model };
}
