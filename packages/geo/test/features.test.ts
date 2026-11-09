import { describe, expect, it } from "vitest";
import type { DayRoute, TripAggregate } from "@orbi/core";
import { buildMapFeatures, encodePolyline } from "../src/utils.ts";

const id = (n: number) => `0190d8a2-4b7e-7c3f-9a1b-00000000000${n}`;
const dest = (n: number, lat: number, lng: number) => ({
  id: id(n),
  name: `P${n}`,
  latitude: lat,
  longitude: lng,
});
const item = (n: number, destN: number, position: number) => ({
  id: id(n),
  destinationId: id(destN),
  position,
});

const data = {
  destinations: [dest(1, 10.29, 123.9), dest(2, 10.3, 123.91), dest(3, 10.31, 123.92)],
  days: [
    { id: id(7), items: [item(4, 1, 0), item(5, 2, 1), item(6, 3, 2)] },
    { id: id(8), items: [] },
  ],
} as unknown as TripAggregate;

describe("buildMapFeatures", () => {
  it("numbers stops per day and flags unrouted legs as straight lines", () => {
    const route: DayRoute = {
      dayId: id(7),
      provider: "osrm",
      totals: { distanceM: 1500, durationS: 600, unroutedLegs: 1 },
      legs: [
        {
          status: "routed",
          fromItemId: id(4),
          toItemId: id(5),
          mode: "walking",
          distanceM: 1500,
          durationS: 600,
          geometry: encodePolyline([
            [123.9, 10.29],
            [123.905, 10.295],
            [123.91, 10.3],
          ]),
        },
        {
          status: "unrouted",
          fromItemId: id(5),
          toItemId: id(6),
          mode: "walking",
          straightLineM: 1500,
          reason: "down",
        },
      ],
    };
    const { stops, legs } = buildMapFeatures(data, new Map([[id(7), route]]), (i) => `#00${i}`);

    expect(stops.features.map((f) => f.properties.number)).toEqual([1, 2, 3]);
    expect(stops.features[0]!.geometry.coordinates).toEqual([123.9, 10.29]);
    expect(legs.features.map((f) => [f.properties.routed, f.geometry.coordinates.length])).toEqual([
      [true, 3],
      [false, 2],
    ]);
    expect(legs.features[0]!.properties.color).toBe("#000");
  });

  it("omits legs that no longer match the itinerary (stale route)", () => {
    const stale: DayRoute = {
      dayId: id(7),
      provider: "osrm",
      totals: { distanceM: 0, durationS: 0, unroutedLegs: 0 },
      legs: [
        {
          status: "unrouted",
          fromItemId: id(9),
          toItemId: id(4),
          mode: "walking",
          straightLineM: 1,
          reason: "x",
        },
      ],
    };
    expect(buildMapFeatures(data, new Map([[id(7), stale]]), () => "#000").legs.features).toEqual([]);
  });
});

describe("buildMapFeatures with activities", () => {
  it("skips activities and numbers places 1, 2, 3 like the day plan", () => {
    const withBreakfast = {
      ...data,
      days: [
        {
          id: id(7),
          items: [
            { id: id(9), destinationId: null, activityType: "breakfast", position: 0 },
            item(4, 1, 1),
            item(5, 2, 2),
          ],
        },
      ],
    } as unknown as TripAggregate;
    const f = buildMapFeatures(withBreakfast, new Map(), () => "#000");
    expect(f.stops.features.map((s) => s.properties.number)).toEqual([1, 2]);
  });
});
