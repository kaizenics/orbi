import { Hono } from "hono";
import { z } from "zod";
import {
  OrbiError,
  idSchema,
  placeSearchQuerySchema,
  reverseQuerySchema,
  type ClientConfig,
} from "@orbi/core";
import type { Db } from "@orbi/db";
import type { GeoProviders } from "@orbi/geo";
import { validate } from "../http/validate.ts";
import { reversePlace, searchPlaces } from "../services/places.ts";
import { getDayRoute } from "../services/routing.ts";

export interface GeoRouteDeps {
  db: Db;
  geo: GeoProviders;
  clientConfig: ClientConfig;
  cacheTtlMs: number;
  log?: (message: string) => void;
}

const parseNear = (near: string | undefined) => {
  if (!near) return undefined;
  const [lat, lng] = near.split(",").map(Number) as [number, number];
  return { lat, lng };
};

export function configRoutes(deps: GeoRouteDeps) {
  return new Hono().get("/", (c) => c.json(deps.clientConfig));
}

export function placeRoutes(deps: GeoRouteDeps) {
  const places = { db: deps.db, geocoder: deps.geo.geocoder, cacheTtlMs: deps.cacheTtlMs, log: deps.log };
  return new Hono()
    .get("/search", validate("query", placeSearchQuerySchema), async (c) => {
      const { q, near, limit } = c.req.valid("query");
      return c.json(await searchPlaces(places, q, { near: parseNear(near), limit }));
    })
    .get("/suggest", validate("query", placeSearchQuerySchema), async (c) => {
      if (!deps.geo.typeahead) {
        throw new OrbiError("not_found", "Search-as-you-type is not configured (set PHOTON_BASE_URL)");
      }
      const { q, near, limit } = c.req.valid("query");
      const typeahead = { ...places, geocoder: deps.geo.typeahead };
      return c.json(await searchPlaces(typeahead, q, { near: parseNear(near), limit }));
    })
    .get("/reverse", validate("query", reverseQuerySchema), async (c) => {
      const { lat, lng } = c.req.valid("query");
      return c.json({ place: await reversePlace(places, { lat, lng }) });
    });
}

export function dayRouteRoutes(deps: GeoRouteDeps) {
  const routing = { db: deps.db, router: deps.geo.router, cacheTtlMs: deps.cacheTtlMs, log: deps.log };
  return new Hono().get(
    "/:id/route",
    validate("param", z.object({ id: idSchema })),
    validate("query", z.object({ refresh: z.enum(["0", "1"]).optional() })),
    async (c) =>
      c.json(
        await getDayRoute(routing, c.req.valid("param").id, {
          refresh: c.req.valid("query").refresh === "1",
        }),
      ),
  );
}
