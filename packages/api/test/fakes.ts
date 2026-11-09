import { OrbiError, type ClientConfig, type LatLng, type PlaceCandidate, type TravelMode } from "@orbi/core";
import { createTestDb } from "@orbi/db";
import type { GeoProviders, RoutedLeg } from "@orbi/geo";
import type { AppDeps } from "../src/app.ts";

export const clientConfig: ClientConfig = {
  map: { styleUrl: "https://tiles.example.test/styles/liberty", attribution: "© OpenStreetMap contributors" },
  travelModes: ["driving", "walking"],
  routingProvider: "osrm",
  geocoder: { provider: "nominatim", typeahead: false },
  ai: { available: false, provider: null, model: null },
};

/** Counting fakes: a geocoder with one fixed result and a router that bends each leg (not a straight line). */
export function fakeGeo(options: { failRouting?: boolean; modes?: TravelMode[] } = {}) {
  const calls = { search: 0, reverse: 0, route: [] as { mode: TravelMode; waypoints: number }[] };
  const candidate: PlaceCandidate = {
    name: "Fort San Pedro",
    address: "A. Pigafetta Street, Cebu City",
    latitude: 10.2927283,
    longitude: 123.9058911,
    category: "history",
    source: "nominatim",
    sourceRef: "osm:way/332819231",
    bbox: null,
  };
  const geo: GeoProviders = {
    geocoder: {
      name: "nominatim",
      async search(query: string) {
        calls.search++;
        return query.includes("Nowhere") ? [] : [candidate];
      },
      async reverse() {
        calls.reverse++;
        return candidate;
      },
    },
    typeahead: null,
    router: {
      name: "osrm",
      modes: options.modes ?? ["driving", "walking"],
      async route(waypoints: readonly LatLng[], mode: TravelMode): Promise<RoutedLeg[]> {
        calls.route.push({ mode, waypoints: waypoints.length });
        if (options.failRouting) throw new OrbiError("provider_unavailable", "Routing service unavailable");
        const speed = mode === "walking" ? 1.3 : 8; // m/s
        return waypoints.slice(1).map((to, i) => {
          const from = waypoints[i]!;
          const mid: [number, number] = [(from.lng + to.lng) / 2 + 0.001, (from.lat + to.lat) / 2];
          const distanceM = 1000 + i;
          return {
            distanceM,
            durationS: distanceM / speed,
            coordinates: [[from.lng, from.lat], mid, [to.lng, to.lat]],
          };
        });
      },
    },
  };
  return { geo, calls };
}

export async function testDeps(overrides: Partial<AppDeps> = {}): Promise<AppDeps> {
  return { version: "1.2.3", db: await createTestDb(), geo: fakeGeo().geo, clientConfig, ...overrides };
}
