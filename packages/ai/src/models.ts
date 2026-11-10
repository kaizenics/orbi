import { OrbiError, type AiProvider } from "@orbi/core";

export interface ModelOption {
  id: string;
  label: string;
  /** "Free", "$0.15 / 1M input tokens", or a family hint where the provider publishes no prices. */
  price: string;
}

/** OpenRouter: models above this input price (USD per token) are left out: $1 per million. */
const MAX_PROMPT_PRICE = 1 / 1_000_000;
/** Room for long pasted itineraries and conversation history. */
const MIN_CONTEXT = 64_000;
const MAX_OPTIONS = 40;

/** Not general chat models (speech, images, embeddings, coding specialists…). */
const NOT_CHAT =
  /audio|realtime|transcribe|tts|speech|image|embed|search|moderation|live|vision-preview|computer-use|code/i;

/**
 * Variants that tend to be slow, rate-limited or unfinished: batch-only, previews and experiments,
 * reasoning ("thinking") models that take long to answer, and vision or omni variants.
 */
const UNSTABLE =
  /(^|[-_.:/ (])(batch|preview|alpha|beta|exp|experimental|stealth|thinking|r1|vision|omni|vl|safeguard|legal)([-_.:/ )]|$)/i;

/** Small models (under ~15B parameters): too weak to build a whole itinerary reliably. */
const TINY = /(^|[-_/])(\d|1[0-4])b([-_]|$)|nemo/i;

/** Well-known providers whose models are widely used and served reliably on OpenRouter. */
const POPULAR = /^(openai|google|anthropic|deepseek|qwen|meta-llama|mistralai|x-ai|z-ai|moonshotai)\//;

/**
 * Fast, dependable families, best first. The newest model of each family in the live list is
 * recommended, so new releases show up without an ORBI update.
 */
const RECOMMENDED = [
  /^google\/gemini-[\d.]+-flash$/,
  /^openai\/gpt-[\d.]+-mini$/,
  /^anthropic\/claude-haiku-[\d.]+$/,
  /^deepseek\/deepseek-v[\d.]+-flash$/,
  /^google\/gemini-[\d.]+-flash-lite$/,
  /^qwen\/qwen[\d.]+-flash$/,
  /^openai\/gpt-[\d.]+-nano$/,
];

const perMillion = (p: number) => `$${(p * 1_000_000).toFixed(2)}`;
const contextSize = (n: number) =>
  n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}K`;

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
        created?: number;
        context_length?: number;
        supported_parameters?: string[];
        pricing?: { prompt?: string; completion?: string };
        architecture?: { output_modalities?: string[] };
      }[];
    }>(fetchFn, "https://openrouter.ai/api/v1/models", {});
    const usable = data
      .map((m) => ({ ...m, prompt: Number(m.pricing?.prompt ?? NaN), ctx: m.context_length ?? 0 }))
      .filter(
        (m) =>
          Number.isFinite(m.prompt) &&
          m.prompt >= 0 &&
          m.prompt <= MAX_PROMPT_PRICE &&
          // ORBI's chat creates and edits trips through tool calls; models without tools fail there.
          (m.supported_parameters ?? []).includes("tools") &&
          m.ctx >= MIN_CONTEXT &&
          // Text-only output: drops music/image generators, which OpenRouter also lists as free.
          (m.architecture?.output_modalities ?? ["text"]).every((o) => o === "text") &&
          POPULAR.test(m.id) &&
          !NOT_CHAT.test(m.id) &&
          !TINY.test(m.id) &&
          !UNSTABLE.test(m.id) &&
          !UNSTABLE.test(m.name),
      );

    const picked = new Set<string>();
    const recommended = RECOMMENDED.flatMap((family) => {
      const newest = usable
        .filter((m) => m.prompt > 0 && family.test(m.id))
        .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];
      if (!newest || picked.has(newest.id)) return [];
      picked.add(newest.id);
      return [newest];
    });
    const others = usable
      .filter((m) => !picked.has(m.id) && m.prompt > 0)
      .sort((a, b) => a.prompt - b.prompt);
    // Free models work, but share busy capacity, so they come last and say so.
    const free = usable.filter((m) => m.prompt === 0);

    return [
      ...recommended.map((m) => ({
        id: m.id,
        label: m.name,
        price: `Recommended · ${perMillion(m.prompt)} / 1M input · ${contextSize(m.ctx)} context`,
      })),
      // Room is kept for the free models at the end.
      ...others.slice(0, Math.max(0, MAX_OPTIONS - recommended.length - free.length)).map((m) => ({
        id: m.id,
        label: m.name,
        price: `${perMillion(m.prompt)} / 1M input · ${contextSize(m.ctx)} context`,
      })),
      ...free.map((m) => ({ id: m.id, label: m.name, price: "Free · often busy, may not answer" })),
    ].slice(0, MAX_OPTIONS);
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
