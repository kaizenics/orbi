import { describe, expect, it } from "vitest";
import { clientConfigSchema, dayRouteSchema, tripAggregateSchema, type DayRoute } from "@orbi/core";
import { decodePolyline } from "@orbi/geo/utils";
import { createApp } from "./app.ts";
import { fakeGeo, testDeps } from "../test/fakes.ts";

async function setup(geoOptions?: Parameters<typeof fakeGeo>[0]) {
  const { geo, calls } = fakeGeo(geoOptions);
  const app = createApp(await testDeps({ geo }));
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    });
  return { app, calls, send };
}

/** A trip with one walking day holding `n` stops spread around Cebu City. */
async function tripWithStops(send: Awaited<ReturnType<typeof setup>>["send"], n: number) {
  const trip = tripAggregateSchema.parse(
    await (await send("POST", "/trips", { name: "Cebu", dayCount: 1 })).json(),
  );
  const dayId = trip.days[0]!.id;
  await send("PATCH", `/days/${dayId}`, { travelMode: "walking" });
  for (let i = 0; i < n; i++) {
    await send("POST", `/trips/${trip.trip.id}/destinations`, {
      name: `Stop ${i}`,
      latitude: 10.29 + i * 0.002,
      longitude: 123.9 + i * 0.002,
      locationSource: "map_pin",
      dayId,
    });
  }
  const full = tripAggregateSchema.parse(await (await send("GET", `/trips/${trip.trip.id}`)).json());
  return { dayId, itemIds: full.days[0]!.items.map((i) => i.id) };
}

const route = async (send: Awaited<ReturnType<typeof setup>>["send"], dayId: string, refresh = false) =>
  dayRouteSchema.parse(
    await (await send("GET", `/days/${dayId}/route${refresh ? "?refresh=1" : ""}`)).json(),
  ) as DayRoute;

describe("GET /config", () => {
  it("serves the client configuration", async () => {
    const { send } = await setup();
    const config = clientConfigSchema.parse(await (await send("GET", "/config")).json());
    expect(config.map.styleUrl).toContain("tiles.example.test");
  });
});

describe("places", () => {
  it("caches searches: the same query (any case/spacing) never reaches the provider twice", async () => {
    const { send, calls } = await setup();
    const first = await send("GET", "/places/search?q=Fort%20San%20Pedro&near=10.3,123.9");
    expect(first.status).toBe(200);
    expect(((await first.json()) as { name: string }[])[0]).toMatchObject({
      name: "Fort San Pedro",
      sourceRef: "osm:way/332819231",
    });

    await send("GET", "/places/search?q=fort%20%20san%20pedro&near=10.3,123.9");
    await send("GET", "/places/search?q=FORT%20SAN%20PEDRO&near=10.301,123.899");
    expect(calls.search).toBe(1);
  });

  it("validates queries and reports missing type-ahead", async () => {
    const { send } = await setup();
    expect((await send("GET", "/places/search?q=x")).status).toBe(400);
    expect((await send("GET", "/places/search?q=fort&near=north")).status).toBe(400);
    expect((await send("GET", "/places/suggest?q=fort")).status).toBe(404);
  });

  it("reverse-geocodes a map pin", async () => {
    const { send, calls } = await setup();
    const res = await send("GET", "/places/reverse?lat=10.2927&lng=123.9058");
    expect(((await res.json()) as { place: { name: string } }).place.name).toBe("Fort San Pedro");
    await send("GET", "/places/reverse?lat=10.2927&lng=123.9058");
    expect(calls.reverse).toBe(1);
  });
});

describe("day routes", () => {
  it("routes a whole day in one request and serves it from cache afterwards", async () => {
    const { send, calls } = await setup();
    const { dayId } = await tripWithStops(send, 5);

    const first = await route(send, dayId);
    expect(first.legs).toHaveLength(4);
    expect(first.legs.every((l) => l.status === "routed")).toBe(true);
    expect(calls.route).toEqual([{ mode: "walking", waypoints: 5 }]);
    const leg = first.legs[0]!;
    if (leg.status === "routed") expect(decodePolyline(leg.geometry).length).toBe(3);
    expect(first.totals.durationS).toBeGreaterThan(0);

    await route(send, dayId);
    expect(calls.route).toHaveLength(1);
  });

  it("recomputes only the changed legs after a reorder, in at most one request", async () => {
    const { send, calls } = await setup();
    const { dayId, itemIds } = await tripWithStops(send, 5);
    await route(send, dayId);

    const [a, b, c, d, e] = itemIds as [string, string, string, string, string];
    await send("PUT", `/days/${dayId}/order`, { itemIds: [a, b, d, c, e] });
    const after = await route(send, dayId);

    expect(calls.route).toHaveLength(2);
    expect(calls.route[1]!.waypoints).toBeLessThanOrEqual(4); // only the B→D→C→E run, not the whole day
    expect(after.legs.map((l) => [l.fromItemId, l.toItemId])).toEqual([
      [a, b],
      [b, d],
      [d, c],
      [c, e],
    ]);
  });

  it("degrades to labelled straight-line legs when routing fails", async () => {
    const { send } = await setup({ failRouting: true });
    const { dayId } = await tripWithStops(send, 3);
    const result = await route(send, dayId);
    expect(result.legs.every((l) => l.status === "unrouted")).toBe(true);
    expect(result.totals).toMatchObject({ distanceM: 0, durationS: 0, unroutedLegs: 2 });
    const leg = result.legs[0]!;
    if (leg.status === "unrouted") {
      expect(leg.straightLineM).toBeGreaterThan(200);
      expect(leg.reason).toContain("unavailable");
    }
  });

  it("marks legs unrouted when the travel mode has no configured router", async () => {
    const { send, calls } = await setup({ modes: ["driving"] });
    const { dayId } = await tripWithStops(send, 2);
    const result = await route(send, dayId);
    expect(result.legs[0]).toMatchObject({ status: "unrouted", mode: "walking" });
    expect(calls.route).toHaveLength(0);
  });

  it("walking and driving yield different durations; refresh bypasses the cache", async () => {
    const { send, calls } = await setup();
    const { dayId } = await tripWithStops(send, 3);
    const walking = await route(send, dayId);
    await send("PATCH", `/days/${dayId}`, { travelMode: "driving" });
    const driving = await route(send, dayId);
    expect(walking.totals.durationS).toBeGreaterThan(driving.totals.durationS);

    await route(send, dayId, true);
    expect(calls.route).toHaveLength(3);
  });

  it("returns an empty route for days with fewer than two stops", async () => {
    const { send } = await setup();
    const { dayId } = await tripWithStops(send, 1);
    expect((await route(send, dayId)).legs).toEqual([]);
  });
});
