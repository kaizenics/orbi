/**
 * Client-safe geographic utilities (no I/O). Imported by web and mobile via "@orbi/geo/utils".
 */
import type { BBox, LatLng, TravelMode } from "@orbi/core";

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. Straight-line only — never present it as a road distance. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box [west, south, east, north] of points, or null when empty. */
export function bboxOf(points: readonly LatLng[]): BBox | null {
  if (points.length === 0) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    w = Math.min(w, p.lng);
    s = Math.min(s, p.lat);
    e = Math.max(e, p.lng);
    n = Math.max(n, p.lat);
  }
  return [w, s, e, n];
}

/** Rounds to 5 decimals (~1.1 m) — the precision used in route cache keys. */
export const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Decodes a Google-style encoded polyline into [lng, lat] pairs (GeoJSON order). */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

/** Encodes [lng, lat] pairs as a polyline (inverse of decodePolyline). */
export function encodePolyline(coords: readonly (readonly [number, number])[], precision = 6): string {
  const factor = 10 ** precision;
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const put = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of coords) {
    const iLat = Math.round(lat * factor);
    const iLng = Math.round(lng * factor);
    put(iLat - prevLat);
    put(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }
  return out;
}

export interface NavigationLinks {
  google: string;
  apple: string;
  /** Android "geo:" intent; opens the default maps app. */
  geo: string;
}

/** Deep links to external navigation apps (ORBI does not do turn-by-turn navigation). */
export function buildNavigationLinks(to: LatLng & { name?: string }, mode: TravelMode): NavigationLinks {
  const dest = `${to.lat},${to.lng}`;
  const label = to.name ? encodeURIComponent(to.name) : "";
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`,
    apple: `https://maps.apple.com/?daddr=${dest}&dirflg=${mode === "walking" ? "w" : "d"}`,
    geo: `geo:${dest}?q=${dest}${label ? `(${label})` : ""}`,
  };
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function formatDuration(s: number): string {
  if (s < 60) return s <= 0 ? "0 min" : "< 1 min";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/**
 * "3.4 km · 45 min" for a day's routed legs, or null when no leg has road data — callers then
 * say so instead of showing invented zero totals.
 */
export function formatRouteTotals(totals: {
  distanceM: number;
  durationS: number;
  unroutedLegs: number;
}): string | null {
  if (totals.distanceM === 0 && totals.unroutedLegs > 0) return null;
  return `${formatDistance(totals.distanceM)} · ${formatDuration(totals.durationS)}`;
}

export { buildMapFeatures, type LegProperties, type MapFeatures, type StopProperties } from "./features.ts";
