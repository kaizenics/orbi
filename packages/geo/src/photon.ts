import type { BBox, LatLng, PlaceCandidate } from "@orbi/core";
import { categoryFromOsm } from "./categories.ts";
import { getJson, type HttpOptions } from "./http.ts";
import type { RateLimiter } from "./rate-limit.ts";
import type { GeocodeSearchOptions, Geocoder } from "./types.ts";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: "N" | "W" | "R";
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    /** [minLon, maxLat, maxLon, minLat] */
    extent?: [number, number, number, number];
  };
}

export interface PhotonOptions extends HttpOptions {
  baseUrl: string;
  limiter: RateLimiter;
}

const OSM_TYPES = { N: "node", W: "way", R: "relation" } as const;

function toCandidate(f: PhotonFeature): PlaceCandidate {
  const p = f.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const name = p.name || street || p.locality || p.city || "Unnamed place";
  const address = [street, p.locality, p.district, p.city, p.state, p.country]
    .filter((part) => part && part !== name)
    .join(", ");
  const bbox: BBox | null = p.extent ? [p.extent[0], p.extent[3], p.extent[2], p.extent[1]] : null;
  return {
    name,
    address: address || null,
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    category: categoryFromOsm(p.osm_key, p.osm_value),
    source: "photon",
    sourceRef: p.osm_type && p.osm_id ? `osm:${OSM_TYPES[p.osm_type]}/${p.osm_id}` : null,
    bbox,
  };
}

/** Photon (komoot public instance or self-hosted): suitable for search-as-you-type. */
export function createPhotonGeocoder(options: PhotonOptions): Geocoder {
  const base = options.baseUrl.replace(/\/$/, "");
  return {
    name: "photon",
    async search(query: string, opts: GeocodeSearchOptions = {}) {
      const params = new URLSearchParams({ q: query, limit: String(opts.limit ?? 8) });
      if (opts.near) {
        params.set("lat", String(opts.near.lat));
        params.set("lon", String(opts.near.lng));
      }
      if (opts.lang) params.set("lang", opts.lang);
      const body = await options.limiter(() =>
        getJson<{ features: PhotonFeature[] }>(`${base}/api/?${params}`, options),
      );
      return body.features.map(toCandidate);
    },
    async reverse(at: LatLng) {
      const params = new URLSearchParams({ lat: String(at.lat), lon: String(at.lng) });
      const body = await options.limiter(() =>
        getJson<{ features: PhotonFeature[] }>(`${base}/reverse?${params}`, options),
      );
      const first = body.features[0];
      return first ? toCandidate(first) : null;
    },
  };
}
