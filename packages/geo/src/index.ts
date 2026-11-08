import type { TravelMode } from "@orbi/core";
import { createNominatimGeocoder } from "./nominatim.ts";
import { createOsrmRouter } from "./osrm.ts";
import { createPhotonGeocoder } from "./photon.ts";
import { createRateLimiter } from "./rate-limit.ts";
import type { Geocoder, Router } from "./types.ts";

export * from "./types.ts";
export { createNominatimGeocoder } from "./nominatim.ts";
export { createPhotonGeocoder } from "./photon.ts";
export { createOsrmRouter } from "./osrm.ts";
export { createRateLimiter, type RateLimiter } from "./rate-limit.ts";
export { getJson, type HttpOptions } from "./http.ts";

export interface GeoConfig {
  userAgent: string;
  contactEmail?: string;
  geocoder: { provider: "nominatim" | "photon"; baseUrl: string };
  /** Optional search-as-you-type geocoder (Photon). Public Nominatim forbids autocomplete. */
  typeahead?: { baseUrl: string };
  routing: Partial<Record<TravelMode, { baseUrl: string; profile?: string }>>;
  /** Minimum gap between requests to one provider: 1000+ for public instances, 0 when self-hosted. */
  minIntervalMs: number;
}

export interface GeoProviders {
  geocoder: Geocoder;
  typeahead: Geocoder | null;
  router: Router;
}

export function createGeoProviders(config: GeoConfig): GeoProviders {
  const http = { userAgent: config.userAgent };
  const limiter = () => createRateLimiter(config.minIntervalMs);
  const geocoderOptions = { ...http, baseUrl: config.geocoder.baseUrl, limiter: limiter() };
  return {
    geocoder:
      config.geocoder.provider === "photon"
        ? createPhotonGeocoder(geocoderOptions)
        : createNominatimGeocoder({ ...geocoderOptions, contactEmail: config.contactEmail }),
    typeahead: config.typeahead
      ? createPhotonGeocoder({ ...http, baseUrl: config.typeahead.baseUrl, limiter: limiter() })
      : null,
    router: createOsrmRouter({ ...http, endpoints: config.routing, limiter: limiter() }),
  };
}
