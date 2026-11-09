import { serve } from "@hono/node-server";
import { createAiModel } from "@orbi/ai";
import { createApp } from "@orbi/api";
import { openDb, purgeExpiredCache } from "@orbi/db";
import { createGeoProviders } from "@orbi/geo";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "./env.ts";

const env = parseEnv(process.env);
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const dbPath = resolve(env.ORBI_DATABASE_PATH);
const { db, close, backupPath } = openDb(dbPath);
if (backupPath) console.log(`Backed up database before migrating: ${backupPath}`);
console.log(`Database: ${dbPath} (purged ${purgeExpiredCache(db)} expired cache rows)`);

const userAgent =
  env.GEO_USER_AGENT ??
  `ORBI/${version} (self-hosted open-source travel planner; https://github.com/kaizenics/orbi)`;
const geo = createGeoProviders({
  userAgent,
  contactEmail: env.GEO_CONTACT_EMAIL,
  geocoder: { provider: env.GEOCODER_PROVIDER, baseUrl: env.GEOCODER_BASE_URL },
  typeahead: env.PHOTON_BASE_URL ? { baseUrl: env.PHOTON_BASE_URL } : undefined,
  routing: {
    driving: { baseUrl: env.ROUTER_DRIVING_URL, profile: env.ROUTER_PROFILE },
    walking: { baseUrl: env.ROUTER_WALKING_URL, profile: env.ROUTER_PROFILE },
  },
  minIntervalMs: env.GEO_MIN_INTERVAL_MS,
});

const ai =
  env.AI_PROVIDER && env.AI_MODEL
    ? createAiModel({
        provider: env.AI_PROVIDER,
        model: env.AI_MODEL,
        apiKey: env.OPENROUTER_API_KEY,
        baseUrl: env.OLLAMA_BASE_URL,
      })
    : null;
console.log(ai ? `AI: ${ai.provider} / ${ai.modelId}` : "AI: off (set AI_PROVIDER and AI_MODEL to enable)");

const app = createApp({
  version,
  db,
  geo,
  ai,
  clientConfig: {
    map: { styleUrl: env.MAP_STYLE_URL, attribution: env.MAP_ATTRIBUTION },
    travelModes: [...geo.router.modes],
    routingProvider: geo.router.name,
    geocoder: { provider: geo.geocoder.name, typeahead: geo.typeahead !== null },
    ai: { available: ai !== null, provider: ai?.provider ?? null, model: ai?.modelId ?? null },
  },
  cacheTtlMs: env.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
  apiToken: env.ORBI_API_TOKEN,
  corsOrigins: env.ORBI_CORS_ORIGINS,
  log: (message) => console.log(message),
});

const server = serve({ fetch: app.fetch, hostname: env.ORBI_HOST, port: env.ORBI_PORT }, (info) => {
  console.log(
    `ORBI server listening on http://${info.address}:${info.port}${env.ORBI_API_TOKEN ? " (token required)" : ""}`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(() => {
      close();
      process.exit(0);
    }),
  );
}
