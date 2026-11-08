import { and, gt, inArray, lt, eq } from "drizzle-orm";
import type { DbOrTx } from "../client.ts";
import { geocodeCache, routeLegCache } from "../schema.ts";
import { now } from "./shared.ts";

export interface CachedLeg {
  key: string;
  provider: string;
  profile: string;
  distanceM: number;
  durationS: number;
  /** Encoded polyline (precision 6). */
  geometry: string;
}

/** Unexpired cached legs for the given keys. */
export function getCachedLegs(db: DbOrTx, keys: readonly string[]): Map<string, CachedLeg> {
  if (keys.length === 0) return new Map();
  const rows = db
    .select()
    .from(routeLegCache)
    .where(and(inArray(routeLegCache.key, [...keys]), gt(routeLegCache.expiresAt, now())))
    .all();
  return new Map(rows.map((r) => [r.key, r]));
}

export function putCachedLegs(db: DbOrTx, legs: readonly CachedLeg[], ttlMs: number): void {
  const t = now();
  for (const leg of legs) {
    const values = { ...leg, createdAt: t, expiresAt: t + ttlMs };
    db.insert(routeLegCache)
      .values(values)
      .onConflictDoUpdate({ target: routeLegCache.key, set: values })
      .run();
  }
}

export function getCachedGeocode<T>(db: DbOrTx, key: string): T | null {
  const row = db
    .select()
    .from(geocodeCache)
    .where(and(eq(geocodeCache.key, key), gt(geocodeCache.expiresAt, now())))
    .get();
  return row ? (row.results as T) : null;
}

export function putCachedGeocode(
  db: DbOrTx,
  entry: { key: string; provider: string; op: string; results: unknown },
  ttlMs: number,
): void {
  const t = now();
  const values = { ...entry, createdAt: t, expiresAt: t + ttlMs };
  db.insert(geocodeCache).values(values).onConflictDoUpdate({ target: geocodeCache.key, set: values }).run();
}

/** Deletes expired cache rows; returns how many were removed. */
export function purgeExpiredCache(db: DbOrTx): number {
  const t = now();
  const legs = db.delete(routeLegCache).where(lt(routeLegCache.expiresAt, t)).run().changes;
  const geocodes = db.delete(geocodeCache).where(lt(geocodeCache.expiresAt, t)).run().changes;
  return legs + geocodes;
}
