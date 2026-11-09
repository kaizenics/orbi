import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { AiProvider } from "@orbi/core";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  /** The user's own API key for that provider (bring your own key). */
  apiKey: string;
}

export interface AiModel {
  model: LanguageModel;
  provider: AiProvider;
  modelId: string;
}

/** The one place that knows provider SDKs; pipelines only see an AI SDK LanguageModel. */
export function createAiModel({ provider, model, apiKey }: AiConfig): AiModel {
  const factories: Record<AiProvider, () => LanguageModel> = {
    openrouter: () => createOpenRouter({ apiKey })(model),
    openai: () => createOpenAI({ apiKey })(model),
    anthropic: () => createAnthropic({ apiKey })(model),
    google: () => createGoogleGenerativeAI({ apiKey })(model),
  };
  return { model: factories[provider](), provider, modelId: model };
}
