import { z } from "zod";
import { tripAggregateSchema } from "./trip.ts";

export const TRIP_EXPORT_FORMAT = "orbi.trip";
export const TRIP_EXPORT_VERSION = 1;

/** Portable trip file: user backup, import, and the future SQLite → Postgres migration path. */
export const tripExportSchema = z.object({
  format: z.literal(TRIP_EXPORT_FORMAT),
  version: z.literal(TRIP_EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  data: tripAggregateSchema,
});
export type TripExport = z.infer<typeof tripExportSchema>;
