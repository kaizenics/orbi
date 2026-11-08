import type { DayRoute, TripAggregate } from "@orbi/core";
import { decodePolyline } from "./utils.ts";

export interface StopProperties {
  itemId: string;
  destinationId: string;
  dayIndex: number;
  /** 1-based number shown on the marker. */
  number: number;
  name: string;
  color: string;
}

export interface LegProperties {
  dayIndex: number;
  color: string;
  /** false = no road geometry: render dashed and label as a straight line. */
  routed: boolean;
}

type Point = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: StopProperties;
};
type Line = {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: LegProperties;
};

export interface MapFeatures {
  stops: { type: "FeatureCollection"; features: Point[] };
  legs: { type: "FeatureCollection"; features: Line[] };
}

/**
 * Builds the GeoJSON both apps render: numbered stop points and per-leg route lines.
 * Legs without a route yet (still loading) are omitted; unrouted legs become straight lines
 * flagged `routed: false` so renderers draw them dashed.
 */
export function buildMapFeatures(
  data: TripAggregate,
  routes: ReadonlyMap<string, DayRoute>,
  colorForDay: (dayIndex: number) => string,
): MapFeatures {
  const byId = new Map(data.destinations.map((d) => [d.id, d]));
  const stops: Point[] = [];
  const legs: Line[] = [];

  data.days.forEach((day, dayIndex) => {
    const color = colorForDay(dayIndex);
    const coordsByItem = new Map<string, [number, number]>();
    day.items.forEach((item, i) => {
      const dest = byId.get(item.destinationId);
      if (!dest) return;
      const coordinates: [number, number] = [dest.longitude, dest.latitude];
      coordsByItem.set(item.id, coordinates);
      stops.push({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties: {
          itemId: item.id,
          destinationId: dest.id,
          dayIndex,
          number: i + 1,
          name: dest.name,
          color,
        },
      });
    });

    for (const leg of routes.get(day.id)?.legs ?? []) {
      const from = coordsByItem.get(leg.fromItemId);
      const to = coordsByItem.get(leg.toItemId);
      if (!from || !to) continue; // route is stale relative to the itinerary; wait for the refetch
      legs.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: leg.status === "routed" ? decodePolyline(leg.geometry) : [from, to],
        },
        properties: { dayIndex, color, routed: leg.status === "routed" },
      });
    }
  });

  return {
    stops: { type: "FeatureCollection", features: stops },
    legs: { type: "FeatureCollection", features: legs },
  };
}
