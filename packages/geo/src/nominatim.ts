import type { BBox, LatLng, PlaceCandidate } from "@orbi/core";
import { categoryFromOsm } from "./categories.ts";
import { getJson, type HttpOptions } from "./http.ts";
import type { RateLimiter } from "./rate-limit.ts";
import type { GeocodeSearchOptions, Geocoder } from "./types.ts";

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  name?: string;
  display_name?: string;
  address?: { road?: string };
  /** [south, north, west, east] as strings. */
  boundingbox?: [string, string, string, string];
}

export interface NominatimOptions extends HttpOptions {
  baseUrl: string;
  limiter: RateLimiter;
  /** Recommended by the OSMF usage policy; sent as the `email` parameter. */
  contactEmail?: string;
}

const firstSegment = (s: string | undefined) => s?.split(",")[0]?.trim() || null;

function toCandidate(p: NominatimPlace): PlaceCandidate {
  const name = p.name || p.address?.road || firstSegment(p.display_name) || "Unnamed place";
  const display = p.display_name ?? null;
  const address = display?.startsWith(`${name}, `) ? display.slice(name.length + 2) : display;
  const bb = p.boundingbox?.map(Number);
  const bbox: BBox | null = bb && bb.length === 4 ? [bb[2]!, bb[0]!, bb[3]!, bb[1]!] : null;
  return {
    name,
    address,
    latitude: Number(p.lat),
    longitude: Number(p.lon),
    category: categoryFromOsm(p.category, p.type),
    source: "nominatim",
    sourceRef: p.osm_type && p.osm_id ? `osm:${p.osm_type}/${p.osm_id}` : null,
    bbox,
  };
}

/** Public Nominatim allows at most 1 req/s for the whole app and no autocomplete: submit-based search only. */
export function createNominatimGeocoder(options: NominatimOptions): Geocoder {
  const base = options.baseUrl.replace(/\/$/, "");
  const withCommon = (params: URLSearchParams) => {
    params.set("format", "jsonv2");
    if (options.contactEmail) params.set("email", options.contactEmail);
    return params;
  };

  return {
    name: "nominatim",
    async search(query: string, opts: GeocodeSearchOptions = {}) {
      const params = withCommon(new URLSearchParams({ q: query, limit: String(opts.limit ?? 8) }));
      if (opts.near) {
        // Bias box of about 50 km; results outside it are still allowed because bounded=0.
        const d = 0.5;
        params.set(
          "viewbox",
          `${opts.near.lng - d},${opts.near.lat + d},${opts.near.lng + d},${opts.near.lat - d}`,
        );
        params.set("bounded", "0");
      }
      if (opts.lang) params.set("accept-language", opts.lang);
      const results = await options.limiter(() =>
        getJson<NominatimPlace[]>(`${base}/search?${params}`, options),
      );
      return results.map(toCandidate);
    },
    async reverse(at: LatLng) {
      const params = withCommon(new URLSearchParams({ lat: String(at.lat), lon: String(at.lng) }));
      const result = await options.limiter(() =>
        getJson<NominatimPlace & { error?: string }>(`${base}/reverse?${params}`, options),
      );
      return result.error ? null : toCandidate(result);
    },
  };
}
