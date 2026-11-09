import { createAiModel } from "@orbi/ai";
import { openDb, purgeExpiredCache } from "@orbi/db";
import { createGeoProviders } from "@orbi/geo";
import { createApp } from "./app.ts";
import type { ApiEnv } from "./env.ts";

/**
 * Builds the ORBI API from environment settings. Shared by the standalone server (VM/Docker) and the
 * Next.js route that serves the API on Vercel, so both are configured identically.
 */
export async function createAppFromEnv(
  env: ApiEnv,
  options: { version: string; log?: (message: string) => void },
) {
  const log = options.log ?? (() => undefined);
  const { db, close, backupPath } = await openDb({
    url: env.ORBI_DATABASE_URL,
    authToken: env.ORBI_DATABASE_AUTH_TOKEN,
  });
  if (backupPath) log(`Backed up database before migrating: ${backupPath}`);
  log(
    `Database: ${env.ORBI_DATABASE_URL.replace(/\?.*$/, "")} (purged ${await purgeExpiredCache(db)} expired cache rows)`,
  );

  const geo = createGeoProviders({
    userAgent:
      env.GEO_USER_AGENT ??
      `ORBI/${options.version} (self-hosted open-source travel planner; https://github.com/kaizenics/orbi)`,
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
  log(ai ? `AI: ${ai.provider} / ${ai.modelId}` : "AI: off (set AI_PROVIDER and AI_MODEL to enable)");

  const app = createApp({
    version: options.version,
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
    log,
  });
  return { app, close };
}
