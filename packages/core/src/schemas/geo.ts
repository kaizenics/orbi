import { z } from "zod";
import { bboxSchema, idSchema, latitudeSchema, longitudeSchema } from "./common.ts";
import { destinationCategorySchema, travelModeSchema } from "./trip.ts";

/** A place returned by a geocoder. Coordinates always come from the provider, never from AI. */
export const placeCandidateSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  category: destinationCategorySchema,
  source: z.enum(["nominatim", "photon"]),
  /** Provider record reference, e.g. "osm:way/332819231". */
  sourceRef: z.string().nullable(),
  bbox: bboxSchema.nullable(),
});
export type PlaceCandidate = z.infer<typeof placeCandidateSchema>;

export const placeSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  /** Bias results towards this point: "lat,lng". */
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, "Expected near=lat,lng")
    .optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const reverseQuerySchema = z.object({
  lat: z.coerce.number().pipe(latitudeSchema),
  lng: z.coerce.number().pipe(longitudeSchema),
});

/**
 * One leg between consecutive stops. "unrouted" legs have no road geometry: clients must draw them
 * as dashed straight lines labelled as such and must not show a travel duration.
 */
export const routeLegSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("routed"),
    fromItemId: idSchema,
    toItemId: idSchema,
    mode: travelModeSchema,
    distanceM: z.number().nonnegative(),
    durationS: z.number().nonnegative(),
    /** Encoded polyline, precision 6. */
    geometry: z.string(),
  }),
  z.object({
    status: z.literal("unrouted"),
    fromItemId: idSchema,
    toItemId: idSchema,
    mode: travelModeSchema,
    straightLineM: z.number().nonnegative(),
    reason: z.string(),
  }),
]);
export type RouteLeg = z.infer<typeof routeLegSchema>;

export const dayRouteSchema = z.object({
  dayId: idSchema,
  legs: z.array(routeLegSchema),
  totals: z.object({
    distanceM: z.number().nonnegative(),
    durationS: z.number().nonnegative(),
    /** Number of legs without road geometry (their distance/duration is not in the totals). */
    unroutedLegs: z.int().nonnegative(),
  }),
  provider: z.string(),
});
export type DayRoute = z.infer<typeof dayRouteSchema>;

/** Runtime client configuration served by GET /config, so map providers change without rebuilding apps. */
export const clientConfigSchema = z.object({
  map: z.object({ styleUrl: z.url(), attribution: z.string() }),
  travelModes: z.array(travelModeSchema),
  routingProvider: z.string(),
  geocoder: z.object({ provider: z.string(), typeahead: z.boolean() }),
});
export type ClientConfig = z.infer<typeof clientConfigSchema>;
