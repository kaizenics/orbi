import { OrbiError, type LatLng, type TravelMode } from "@orbi/core";
import { getJson, type HttpOptions } from "./http.ts";
import type { RateLimiter } from "./rate-limit.ts";
import type { RoutedLeg, Router } from "./types.ts";
import { decodePolyline } from "./utils.ts";

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: { legs: { distance: number; duration: number; steps: { geometry: string }[] }[] }[];
}

export interface OsrmEndpoint {
  /** For example https://routing.openstreetmap.de/routed-foot */
  baseUrl: string;
  /** URL profile segment; the FOSSGIS instances use "driving" for every dataset. */
  profile?: string;
}

export interface OsrmOptions extends HttpOptions {
  /** One OSRM dataset per travel mode (OSRM preprocesses each profile separately). */
  endpoints: Partial<Record<TravelMode, OsrmEndpoint>>;
  limiter: RateLimiter;
}

/** Joins per-step geometries into one leg line, dropping the duplicated joint points. */
function legCoordinates(steps: { geometry: string }[]): [number, number][] {
  const coords: [number, number][] = [];
  for (const step of steps) {
    const part = decodePolyline(step.geometry, 6);
    const last = coords.at(-1);
    const first = part[0];
    const joins = last && first && last[0] === first[0] && last[1] === first[1];
    coords.push(...(joins ? part.slice(1) : part));
  }
  return coords;
}

export function createOsrmRouter(options: OsrmOptions): Router {
  const modes = (Object.keys(options.endpoints) as TravelMode[]).filter((m) => options.endpoints[m]);
  return {
    name: "osrm",
    modes,
    async route(waypoints: readonly LatLng[], mode: TravelMode): Promise<RoutedLeg[]> {
      const endpoint = options.endpoints[mode];
      if (!endpoint)
        throw new OrbiError("provider_unavailable", `No routing endpoint configured for ${mode}`);
      if (waypoints.length < 2) return [];
      const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
      const base = endpoint.baseUrl.replace(/\/$/, "");
      const url = `${base}/route/v1/${endpoint.profile ?? "driving"}/${coords}?overview=false&steps=true&geometries=polyline6`;
      const body = await options.limiter(() => getJson<OsrmResponse>(url, options));
      const route = body.routes?.[0];
      if (body.code !== "Ok" || !route) {
        throw new OrbiError("provider_unavailable", `Routing failed: ${body.message ?? body.code}`, {
          code: body.code,
        });
      }
      return route.legs.map((leg) => ({
        distanceM: leg.distance,
        durationS: leg.duration,
        coordinates: legCoordinates(leg.steps),
      }));
    },
  };
}
