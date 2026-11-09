import { describe, expect, it } from "vitest";
import { listCheapModels } from "../src/models.ts";

const fakeFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("listCheapModels", () => {
  it("keeps free and cheap OpenRouter chat models, cheapest first", async () => {
    const models = await listCheapModels(
      "openrouter",
      undefined,
      fakeFetch({
        data: [
          { id: "big/expensive", name: "Expensive", pricing: { prompt: "0.000003" } },
          { id: "small/cheap", name: "Cheap", pricing: { prompt: "0.0000001" } },
          { id: "meta/llama:free", name: "Llama (free)", pricing: { prompt: "0" } },
          { id: "x/image-gen", name: "Image", pricing: { prompt: "0" } },
          { id: "c/north-mini-code:free", name: "Coder", pricing: { prompt: "0" } },
          {
            id: "g/lyria",
            name: "Music",
            pricing: { prompt: "0" },
            architecture: { output_modalities: ["text", "audio"] },
          },
          { id: "odd/variable", name: "Router", pricing: { prompt: "-1" } },
        ],
      }),
    );
    expect(models.map((m) => [m.id, m.price])).toEqual([
      ["meta/llama:free", "Free"],
      ["small/cheap", "$0.10 / 1M input tokens"],
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
