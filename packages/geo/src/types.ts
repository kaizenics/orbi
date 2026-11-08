import type { LatLng, PlaceCandidate, TravelMode } from "@orbi/core";

export interface GeocodeSearchOptions {
  near?: LatLng;
  limit?: number;
  lang?: string;
}

export interface Geocoder {
  readonly name: "nominatim" | "photon";
  search(query: string, options?: GeocodeSearchOptions): Promise<PlaceCandidate[]>;
  reverse(at: LatLng): Promise<PlaceCandidate | null>;
}

export interface RoutedLeg {
  distanceM: number;
  durationS: number;
  /** [lng, lat] pairs along the road/path. */
  coordinates: [number, number][];
}

export interface Router {
  readonly name: string;
  readonly modes: readonly TravelMode[];
  /** One request for all waypoints; returns one leg per consecutive pair. */
  route(waypoints: readonly LatLng[], mode: TravelMode): Promise<RoutedLeg[]>;
}
