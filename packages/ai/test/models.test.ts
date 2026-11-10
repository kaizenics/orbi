import { describe, expect, it } from "vitest";
import { listCheapModels } from "../src/models.ts";

const fakeFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("listCheapModels", () => {
  it("keeps dependable OpenRouter models: recommended first, then cheapest, then free", async () => {
    const m = (id: string, prompt: string, extra: Record<string, unknown> = {}) => ({
      id,
      name: id,
      created: 1,
      context_length: 200_000,
      supported_parameters: ["tools"],
      pricing: { prompt },
      ...extra,
    });
    const models = await listCheapModels(
      "openrouter",
      undefined,
      fakeFetch({
        data: [
          m("google/gemini-3.0-flash", "0.0000003", { created: 1 }),
          m("google/gemini-3.5-flash", "0.0000004", { created: 2 }), // newest of the family
          m("deepseek/deepseek-v9-chat", "0.0000001"),
          m("qwen/qwen9-turbo:free", "0"),
          m("openai/gpt-x", "0.000003"), // too expensive
          m("mistralai/mistral-small-2", "0.0000001", { supported_parameters: [] }), // no tools
          m("meta-llama/llama-9-8b", "0.0000001", { context_length: 8_000 }), // short context
          m("openai/gpt-9-mini (batch)", "0.0000001"),
          m("deepseek/deepseek-v9-flash-vision-exp", "0.0000001"),
          m("qwen/qwen9-thinking", "0.0000001"),
          m("someone/tiny-1b", "0.0000001"), // unknown provider
          m("meta-llama/llama-9-8b-instruct", "0.0000001"), // too small
          m("google/lyria", "0", { architecture: { output_modalities: ["text", "audio"] } }),
        ],
      }),
    );
    expect(models.map((x) => [x.id, x.price])).toEqual([
      ["google/gemini-3.5-flash", "Recommended · $0.40 / 1M input · 200K context"],
      ["deepseek/deepseek-v9-chat", "$0.10 / 1M input · 200K context"],
      ["google/gemini-3.0-flash", "$0.30 / 1M input · 200K context"],
      ["qwen/qwen9-turbo:free", "Free · often busy, may not answer"],
    ]);
  });

  it("filters other providers to their low-cost families and needs a key", async () => {
    expect(await listCheapModels("openai", undefined, fakeFetch({ data: [] }))).toEqual([]);
    const openai = await listCheapModels(
      "openai",
      "sk-test-key-123",
      fakeFetch({
        data: [{ id: "gpt-x" }, { id: "gpt-x-mini" }, { id: "gpt-x-nano" }, { id: "gpt-x-mini-tts" }],
      }),
    );
    expect(openai.map((m) => m.id)).toEqual(["gpt-x-nano", "gpt-x-mini"]);
    const google = await listCheapModels(
      "google",
      "AIza-test-key",
      fakeFetch({
        models: [
          { name: "models/gemini-x-pro", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-x-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-x-flash-embed", supportedGenerationMethods: ["embedContent"] },
        ],
      }),
    );
    expect(google.map((m) => m.id)).toEqual(["gemini-x-flash"]);
  });

  it("reports a rejected key clearly", async () => {
    await expect(listCheapModels("anthropic", "sk-ant-bad-key", fakeFetch({}, 401))).rejects.toThrow(
      /rejected/,
    );
  });
});
