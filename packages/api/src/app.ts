import { Hono } from "hono";
import { APP_NAME, type HealthResponse } from "@orbi/core";

export interface AppDeps {
  version: string;
}

/** Builds the ORBI API. Dependencies are injected so tests can construct it freely. */
export function createApp(deps: AppDeps) {
  return new Hono().get("/health", (c) =>
    c.json({ status: "ok", name: APP_NAME, version: deps.version } satisfies HealthResponse),
  );
}

export type AppType = ReturnType<typeof createApp>;
