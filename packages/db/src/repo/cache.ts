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
export async function getCachedLegs(db: DbOrTx, keys: readonly string[]): Promise<Map<string, CachedLeg>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select()
    .from(routeLegCache)
    .where(and(inArray(routeLegCache.key, [...keys]), gt(routeLegCache.expiresAt, now())))
    .all();
  return new Map(rows.map((r) => [r.key, r]));
}

export async function putCachedLegs(db: DbOrTx, legs: readonly CachedLeg[], ttlMs: number): Promise<void> {
  const t = now();
  for (const leg of legs) {
    const values = { ...leg, createdAt: t, expiresAt: t + ttlMs };
    await db
      .insert(routeLegCache)
      .values(values)
      .onConflictDoUpdate({ target: routeLegCache.key, set: values })
      .run();
  }
}

export async function getCachedGeocode<T>(db: DbOrTx, key: string): Promise<T | null> {
  const row = await db
    .select()
    .from(geocodeCache)
    .where(and(eq(geocodeCache.key, key), gt(geocodeCache.expiresAt, now())))
    .get();
  return row ? (row.results as T) : null;
}

export async function putCachedGeocode(
  db: DbOrTx,
  entry: { key: string; provider: string; op: string; results: unknown },
  ttlMs: number,
): Promise<void> {
  const t = now();
  const values = { ...entry, createdAt: t, expiresAt: t + ttlMs };
  await db
    .insert(geocodeCache)
    .values(values)
    .onConflictDoUpdate({ target: geocodeCache.key, set: values })
    .run();
}

/** Deletes expired cache rows; returns how many were removed. */
export async function purgeExpiredCache(db: DbOrTx): Promise<number> {
  const t = now();
  const legs = (await db.delete(routeLegCache).where(lt(routeLegCache.expiresAt, t)).run()).rowsAffected;
  const geocodes = (await db.delete(geocodeCache).where(lt(geocodeCache.expiresAt, t)).run()).rowsAffected;
  return legs + geocodes;
}
