import { createHash } from "node:crypto";
import type { LatLng, PlaceCandidate } from "@orbi/core";
import { getCachedGeocode, putCachedGeocode, type Db } from "@orbi/db";
import type { Geocoder } from "@orbi/geo";

export interface PlacesDeps {
  db: Db;
  geocoder: Geocoder;
  cacheTtlMs: number;
  log?: (message: string) => void;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
/** ~1 km grid for the bias point, so nearby map views share cache entries. */
const roundBias = (p: LatLng | undefined) => (p ? `${p.lat.toFixed(2)},${p.lng.toFixed(2)}` : "-");

/**
 * Geocoder access with a persistent cache in front: repeated searches never reach the provider,
 * which is the main protection for public Nominatim's 1 request/second policy.
 */
export async function searchPlaces(
  deps: PlacesDeps,
  query: string,
  options: { near?: LatLng; limit: number },
): Promise<PlaceCandidate[]> {
  const key = hash(
    `${deps.geocoder.name}|search|${normalize(query)}|${roundBias(options.near)}|${options.limit}`,
  );
  const cached = await getCachedGeocode<PlaceCandidate[]>(deps.db, key);
  if (cached) return cached;

  deps.log?.(`[geo] ${deps.geocoder.name} search (cache miss): "${normalize(query)}"`);
  const results = await deps.geocoder.search(query, options);
  await putCachedGeocode(
    deps.db,
    { key, provider: deps.geocoder.name, op: "search", results },
    deps.cacheTtlMs,
  );
  return results;
}

export async function reversePlace(deps: PlacesDeps, at: LatLng): Promise<PlaceCandidate | null> {
  const key = hash(`${deps.geocoder.name}|reverse|${at.lat.toFixed(5)},${at.lng.toFixed(5)}`);
  const cached = await getCachedGeocode<{ place: PlaceCandidate | null }>(deps.db, key);
  if (cached) return cached.place;

  deps.log?.(`[geo] ${deps.geocoder.name} reverse (cache miss): ${at.lat},${at.lng}`);
  const place = await deps.geocoder.reverse(at);
  await putCachedGeocode(
    deps.db,
    { key, provider: deps.geocoder.name, op: "reverse", results: { place } },
    deps.cacheTtlMs,
  );
  return place;
}
