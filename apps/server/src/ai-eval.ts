/**
 * Model evaluation (roadmap Phase 5). Uses the AI and geocoder settings from apps/server/.env:
 *   pnpm --filter @orbi/server ai:eval
 * Sends a few sample requests, then reports schema validity, geocoder hit rate and latency.
 * Each prompt costs one or two AI requests (free OpenRouter models: ~50 requests/day) and about
 * 10–20 geocoder lookups at 1 per second, so a full run takes a few minutes.
 */
import { createAiModel, generateDraft } from "@orbi/ai";
import { OrbiError, type TripAggregate } from "@orbi/core";
import { createGeoProviders } from "@orbi/geo";
import { parseEnv } from "./env.ts";

const env = parseEnv(process.env);
if (!env.AI_PROVIDER || !env.AI_MODEL)
  throw new Error("Set AI_PROVIDER and AI_MODEL in apps/server/.env first");
const ai = createAiModel({
  provider: env.AI_PROVIDER,
  model: env.AI_MODEL,
  apiKey: env.OPENROUTER_API_KEY,
  baseUrl: env.OLLAMA_BASE_URL,
});
const geo = createGeoProviders({
  userAgent: env.GEO_USER_AGENT ?? "ORBI ai-eval (self-hosted; https://github.com/kaizenics/orbi)",
  contactEmail: env.GEO_CONTACT_EMAIL,
  geocoder: { provider: env.GEOCODER_PROVIDER, baseUrl: env.GEOCODER_BASE_URL },
  routing: {},
  minIntervalMs: env.GEO_MIN_INTERVAL_MS,
});

const PROMPTS: { region: string; days: number; prompt: string }[] = [
  {
    region: "Cebu, Philippines",
    days: 3,
    prompt:
      "Plan a 3-day Cebu trip with a ₱10,000 budget. I want historical attractions, local food, and beaches.",
  },
  {
    region: "Bohol, Philippines",
    days: 2,
    prompt: "Two relaxed days in Bohol with nature and a river cruise.",
  },
  {
    region: "Manila, Philippines",
    days: 1,
    prompt: "One day of museums and old churches in Manila, mostly walking.",
  },
  {
    region: "Iloilo City, Philippines",
    days: 2,
    prompt: "Food trip in Iloilo: batchoy, seafood, heritage houses.",
  },
  {
    region: "Baguio, Philippines",
    days: 2,
    prompt: "Cool-weather Baguio weekend with parks, markets and viewpoints.",
  },
];

const id = (n: number) => `0190d8a2-4b7e-7c3f-9a1b-${String(n).padStart(12, "0")}`;
function emptyTrip(region: string, days: number): TripAggregate {
  return {
    trip: {
      id: id(1),
      name: "Eval",
      description: null,
      originDestinationId: null,
      regionName: region,
      regionBbox: null,
      startDate: null,
      endDate: null,
      timezone: "Asia/Manila",
      currency: "PHP",
      budgetMinor: null,
      defaultTravelMode: "driving",
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    preferences: {
      pace: "moderate",
      interests: [],
      dayStartTime: "09:00",
      dayEndTime: "20:00",
      maxDailyTravelMin: null,
      notes: null,
    },
    days: Array.from({ length: days }, (_, i) => ({
      id: id(10 + i),
      tripId: id(1),
      dayIndex: i,
      date: null,
      title: null,
      notes: null,
      startTime: null,
      travelMode: null,
      items: [],
    })),
    destinations: [],
  };
}

console.log(`Evaluating ${ai.provider} / ${ai.modelId} on ${PROMPTS.length} prompts\n`);
const rows = [];
for (const p of PROMPTS) {
  const started = Date.now();
  try {
    const draft = await generateDraft(
      { model: ai.model, geocode: (q, near) => geo.geocoder.search(q, { near, limit: 5 }) },
      emptyTrip(p.region, p.days),
      p.prompt,
    );
    if (draft.kind !== "draft") throw new Error("unexpected proposal kind");
    const stops = draft.days.flatMap((d) => d.stops);
    const found = stops.filter((s) => s.location).length;
    rows.push({
      prompt: p.prompt.slice(0, 40),
      valid: "yes",
      days: `${draft.days.length}/${p.days}`,
      located: `${found}/${stops.length}`,
      seconds: Math.round((Date.now() - started) / 1000),
    });
  } catch (error) {
    rows.push({
      prompt: p.prompt.slice(0, 40),
      valid: error instanceof OrbiError ? error.code : "error",
      days: "-",
      located: "-",
      seconds: Math.round((Date.now() - started) / 1000),
    });
  }
}
console.table(rows);
const valid = rows.filter((r) => r.valid === "yes").length;
console.log(
  `\nValid answers: ${valid}/${rows.length} (${Math.round((valid / rows.length) * 100)}%). Record the results in docs/ai-evals.md.`,
);
