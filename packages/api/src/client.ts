import { hc } from "hono/client";
import type { AppType } from "./app.ts";

/** Typed API client for web and mobile. Imports server types only, never server code. */
export function createOrbiClient(baseUrl: string) {
  return hc<AppType>(baseUrl);
}

export type OrbiClient = ReturnType<typeof createOrbiClient>;
