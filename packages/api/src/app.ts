import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { APP_NAME, type ClientConfig, type HealthResponse } from "@orbi/core";
import type { Db } from "@orbi/db";
import type { GeoProviders } from "@orbi/geo";
import { bearerAuth } from "./http/auth.ts";
import { problem, problemFromError } from "./http/problem.ts";
import { configRoutes, dayRouteRoutes, placeRoutes } from "./routes/geo.ts";
import { dayRoutes, destinationRoutes, itemRoutes } from "./routes/itinerary.ts";
import { tripRoutes } from "./routes/trips.ts";

export interface AppDeps {
  version: string;
  db: Db;
  geo: GeoProviders;
  clientConfig: ClientConfig;
  /** How long geocoding and routing results stay cached (default 30 days). */
  cacheTtlMs?: number;
  /** When set, every route except GET /health requires `Authorization: Bearer <token>`. */
  apiToken?: string;
  /** Browser origins allowed to call the API directly (the web app uses a same-origin proxy instead). */
  corsOrigins?: string[];
  log?: (message: string) => void;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Builds the ORBI API. Dependencies are injected so tests can construct it freely. */
export function createApp(deps: AppDeps) {
  const app = new Hono();
  const geoDeps = {
    db: deps.db,
    geo: deps.geo,
    clientConfig: deps.clientConfig,
    cacheTtlMs: deps.cacheTtlMs ?? THIRTY_DAYS_MS,
    log: deps.log,
  };

  app.use(requestId());
  if (deps.corsOrigins?.length) app.use(cors({ origin: deps.corsOrigins }));
  if (deps.apiToken) app.use(bearerAuth(deps.apiToken));
  app.use(
    bodyLimit({
      maxSize: 2 * 1024 * 1024,
      onError: (c) => problem(c, 413, "bad_request", { detail: "Request body is larger than 2 MB" }),
    }),
  );
  app.onError((error, c) => problemFromError(c, error));
  app.notFound((c) => problem(c, 404, "not_found", { detail: `No route for ${c.req.method} ${c.req.path}` }));

  return app
    .get("/health", (c) =>
      c.json({ status: "ok", name: APP_NAME, version: deps.version } satisfies HealthResponse),
    )
    .route("/config", configRoutes(geoDeps))
    .route("/places", placeRoutes(geoDeps))
    .route("/trips", tripRoutes(deps.db))
    .route("/destinations", destinationRoutes(deps.db))
    .route("/days", dayRoutes(deps.db))
    .route("/days", dayRouteRoutes(geoDeps))
    .route("/items", itemRoutes(deps.db));
}

export type AppType = ReturnType<typeof createApp>;
