import { z } from "zod";
import { isValidIsoDate } from "../dates.ts";
import { LIMITS } from "../constants.ts";

export const idSchema = z.uuid();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD")
  .refine(isValidIsoDate, "Not a real calendar date");

/** Local wall-clock time HH:MM (00:00–23:59), interpreted in the trip's timezone. */
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a time as HH:MM");

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/** [west, south, east, north] in WGS84 degrees. */
export const bboxSchema = z.tuple([longitudeSchema, latitudeSchema, longitudeSchema, latitudeSchema]);
export type BBox = z.infer<typeof bboxSchema>;

export const latLngSchema = z.object({ lat: latitudeSchema, lng: longitudeSchema });
export type LatLng = z.infer<typeof latLngSchema>;

/** Money as integer minor units (e.g. centavos) in the trip currency. */
export const moneyMinorSchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected an ISO 4217 currency code such as PHP");

export const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown IANA timezone");

export const nameSchema = z.string().trim().min(1).max(LIMITS.maxNameLength);
export const textSchema = z.string().max(LIMITS.maxTextLength);

/** Epoch milliseconds. */
export const timestampSchema = z.int().nonnegative();
