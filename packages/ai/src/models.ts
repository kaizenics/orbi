import { OrbiError, type AiProvider } from "@orbi/core";

export interface ModelOption {
  id: string;
  label: string;
  /** "Free", "$0.15 / 1M input tokens", or a family hint where the provider publishes no prices. */
  price: string;
}

/** OpenRouter models above this input price (USD per token) are left out: $0.50 per million. */
const MAX_PROMPT_PRICE = 0.5 / 1_000_000;
const MAX_OPTIONS = 40;

/** Not general chat models (speech, images, embeddings, coding specialists…). */
const NOT_CHAT =
  /audio|realtime|transcribe|tts|speech|image|embed|search|moderation|live|vision-preview|computer-use|code/i;

type Fetch = typeof fetch;

async function getJson<T>(fetchFn: Fetch, url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetchFn(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (res.status === 401 || res.status === 403) {
    throw new OrbiError(
      "provider_unavailable",
      "Your AI provider rejected the API key. Check it and try again.",
    );
  }
  if (!res.ok) throw new OrbiError("provider_unavailable", `Could not load models (HTTP ${res.status})`);
  return (await res.json()) as T;
}

const byNewestId = (a: ModelOption, b: ModelOption) => b.id.localeCompare(a.id);

/**
 * Cheap chat models the provider offers right now. Lists are fetched live so new models appear
 * without an ORBI update. OpenRouter publishes prices (no key needed); the others are filtered by
 * their low-cost families because their model lists carry no prices.
 */
export async function listCheapModels(
  provider: AiProvider,
  apiKey: string | undefined,
  fetchFn: Fetch = fetch,
): Promise<ModelOption[]> {
  if (provider === "openrouter") {
    const { data } = await getJson<{
      data: {
        id: string;
        name: string;
        pricing?: { prompt?: string; completion?: string };
        architecture?: { output_modalities?: string[] };
      }[];
    }>(fetchFn, "https://openrouter.ai/api/v1/models", {});
    return (
      data
        .map((m) => ({ ...m, prompt: Number(m.pricing?.prompt ?? NaN) }))
        .filter((m) => Number.isFinite(m.prompt) && m.prompt >= 0 && m.prompt <= MAX_PROMPT_PRICE)
        // Text-only output: drops music/image generators, which OpenRouter also lists as free.
        .filter(
          (m) =>
            (m.architecture?.output_modalities ?? ["text"]).every((o) => o === "text") &&
            !NOT_CHAT.test(m.id),
        )
        .sort((a, b) => a.prompt - b.prompt || a.name.localeCompare(b.name))
        .slice(0, MAX_OPTIONS)
        .map((m) => ({
          id: m.id,
          label: m.name,
          price: m.prompt === 0 ? "Free" : `$${(m.prompt * 1_000_000).toFixed(2)} / 1M input tokens`,
        }))
    );
  }

  if (!apiKey) return [];

  if (provider === "openai") {
    const { data } = await getJson<{ data: { id: string }[] }>(fetchFn, "https://api.openai.com/v1/models", {
      Authorization: `Bearer ${apiKey}`,
    });
    return data
      .filter((m) => /^(gpt|o\d)/.test(m.id) && /(mini|nano)/.test(m.id) && !NOT_CHAT.test(m.id))
      .map((m) => ({ id: m.id, label: m.id, price: "Low-cost (mini/nano)" }))
      .sort(byNewestId)
      .slice(0, MAX_OPTIONS);
  }

  if (provider === "anthropic") {
    const { data } = await getJson<{ data: { id: string; display_name?: string }[] }>(
      fetchFn,
      "https://api.anthropic.com/v1/models?limit=100",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    );
    return data
      .filter((m) => /haiku/i.test(m.id))
      .map((m) => ({ id: m.id, label: m.display_name ?? m.id, price: "Low-cost (Haiku)" }))
      .sort(byNewestId)
      .slice(0, MAX_OPTIONS);
  }

  const { models } = await getJson<{
    models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  }>(fetchFn, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    "x-goog-api-key": apiKey,
  });
  return models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => ({ ...m, id: m.name.replace(/^models\//, "") }))
    .filter((m) => /flash/i.test(m.id) && !NOT_CHAT.test(m.id))
    .map((m) => ({ id: m.id, label: m.displayName ?? m.id, price: "Low-cost (Flash)" }))
    .sort(byNewestId)
    .slice(0, MAX_OPTIONS);
}
