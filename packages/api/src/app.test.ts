import { beforeEach, describe, expect, it } from "vitest";
import { healthResponseSchema, tripAggregateSchema, type TripAggregate } from "@orbi/core";
import { createApp } from "./app.ts";
import { testDeps } from "../test/fakes.ts";

let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  app = createApp(await testDeps());
});

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...headers },
});
const send = (method: string, path: string, body?: unknown, headers?: Record<string, string>) =>
  app.request(path, { method, ...(body === undefined ? { headers } : json(body, headers)) });

async function createTrip(): Promise<TripAggregate> {
  const res = await send("POST", "/trips", { name: "Cebu", startDate: "2026-12-01", endDate: "2026-12-03" });
  expect(res.status).toBe(201);
  return tripAggregateSchema.parse(await j(res));
}

async function addPlace(tripId: string, name: string, dayId?: string) {
  const res = await send("POST", `/trips/${tripId}/destinations`, {
    name,
    latitude: 10.2934,
    longitude: 123.9022,
    locationSource: "seed",
    ...(dayId ? { dayId } : {}),
  });
  expect(res.status).toBe(201);
  return (await j(res)) as { data: { id: string }; revision: number };
}

/** Test-only: parse a JSON response body without a schema. */
const j = (res: Response): Promise<any> => res.json();

const getTrip = async (id: string) => tripAggregateSchema.parse(await j(await send("GET", `/trips/${id}`)));

describe("health", () => {
  it("returns a payload matching the shared schema", async () => {
    const res = await send("GET", "/health");
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await j(res))).toEqual({
      status: "ok",
      name: "ORBI",
      version: "1.2.3",
    });
  });
});

describe("trips", () => {
  it("creates, lists, reads, updates and deletes", async () => {
    const trip = await createTrip();
    expect(trip.days).toHaveLength(3);

    const list = await j(await send("GET", "/trips"));
    expect(list).toMatchObject([{ id: trip.trip.id, dayCount: 3 }]);

    const patched = await send("PATCH", `/trips/${trip.trip.id}`, { name: "Cebu & Bohol" });
    expect(patched.status).toBe(200);
    expect((await j(patched)).trip.name).toBe("Cebu & Bohol");

    const prefs = await send("PUT", `/trips/${trip.trip.id}/preferences`, {
      pace: "relaxed",
      interests: ["history", "beaches"],
      dayStartTime: "08:30",
      dayEndTime: "19:00",
      maxDailyTravelMin: 120,
      notes: null,
    });
    expect((await j(prefs)).preferences.interests).toEqual(["history", "beaches"]);

    expect((await send("DELETE", `/trips/${trip.trip.id}`)).status).toBe(204);
    expect((await send("GET", `/trips/${trip.trip.id}`)).status).toBe(404);
  });

  it("rejects invalid bodies with field-level problem details", async () => {
    const res = await send("POST", "/trips", { name: "", startDate: "2026-02-30" });
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    const body = await j(res);
    expect(body.code).toBe("bad_request");
    expect(body.errors.map((e: { path: string }) => e.path)).toEqual(
      expect.arrayContaining(["name", "startDate"]),
    );
  });

  it("returns 404 problems for unknown trips and routes, 400 for malformed ids", async () => {
    const unknown = await send("GET", "/trips/0190d8a2-4b7e-7c3f-9a1b-2c3d4e5f6a7b");
    expect(unknown.status).toBe(404);
    expect((await j(unknown)).code).toBe("not_found");
    expect((await send("GET", "/trips/not-a-uuid")).status).toBe(400);
    expect((await send("GET", "/nope")).status).toBe(404);
  });

  it("enforces If-Match revisions", async () => {
    const trip = await createTrip();
    const ok = await send("PATCH", `/trips/${trip.trip.id}`, { name: "A" }, { "If-Match": "0" });
    expect(ok.status).toBe(200);
    const stale = await send("PATCH", `/trips/${trip.trip.id}`, { name: "B" }, { "If-Match": "0" });
    expect(stale.status).toBe(409);
    expect(await j(stale)).toMatchObject({ code: "conflict", currentRevision: 1 });
  });

  it("asks for confirmation before dropping days with stops", async () => {
    const trip = await createTrip();
    await addPlace(trip.trip.id, "Beach", trip.days[2]!.id);
    const res = await send("PATCH", `/trips/${trip.trip.id}`, {
      startDate: "2026-12-01",
      endDate: "2026-12-01",
    });
    expect(res.status).toBe(409);
    expect((await j(res)).code).toBe("confirmation_required");
  });

  it("exports and re-imports a trip", async () => {
    const trip = await createTrip();
    await addPlace(trip.trip.id, "Fort San Pedro", trip.days[0]!.id);
    const exported = await send("GET", `/trips/${trip.trip.id}/export`);
    expect(exported.headers.get("Content-Disposition")).toContain('filename="cebu.orbi.json"');
    const imported = await send("POST", "/trips/import", await j(exported));
    expect(imported.status).toBe(201);
    const copy = tripAggregateSchema.parse(await j(imported));
    expect(copy.trip.id).not.toBe(trip.trip.id);
    expect(copy.days[0]!.items).toHaveLength(1);
  });
});

describe("itinerary", () => {
  it("adds, schedules, reorders, moves and removes stops", async () => {
    const trip = await createTrip();
    const [d1, d2] = [trip.days[0]!.id, trip.days[1]!.id];
    const a = await addPlace(trip.trip.id, "A", d1);
    await addPlace(trip.trip.id, "B", d1);
    expect(a.revision).toBe(1);

    let state = await getTrip(trip.trip.id);
    const [i1, i2] = state.days[0]!.items.map((i) => i.id) as [string, string];

    const reorder = await send("PUT", `/days/${d1}/order`, { itemIds: [i2, i1] });
    expect(reorder.status).toBe(200);
    expect((await j(reorder)).data.map((i: { id: string }) => i.id)).toEqual([i2, i1]);

    expect((await send("PUT", `/days/${d1}/order`, { itemIds: [i1] })).status).toBe(409);

    const move = await send("POST", `/items/${i1}/move`, { toDayId: d2, toPosition: 0 });
    expect(move.status).toBe(200);

    const sched = await send("POST", `/days/${d2}/items`, { destinationId: a.data.id });
    expect(sched.status).toBe(201);

    expect((await send("PATCH", `/items/${i2}`, { fixedStartTime: "19:00" })).status).toBe(200);
    expect((await send("PATCH", `/days/${d1}`, { title: "Old town" })).status).toBe(200);
    expect((await send("PATCH", `/destinations/${a.data.id}`, { notes: "Bring water" })).status).toBe(200);

    state = await getTrip(trip.trip.id);
    expect(state.days[0]!.items.map((i) => i.id)).toEqual([i2]);
    expect(state.days[1]!.items).toHaveLength(2);

    expect((await send("DELETE", `/items/${i2}`)).status).toBe(200);
    expect((await send("DELETE", `/destinations/${a.data.id}`)).status).toBe(200);
    state = await getTrip(trip.trip.id);
    expect(state.days.flatMap((d) => d.items).every((i) => i.destinationId !== a.data.id)).toBe(true);
  });

  it("returns 404 when scheduling onto an unknown day", async () => {
    const trip = await createTrip();
    const a = await addPlace(trip.trip.id, "A");
    const res = await send("POST", "/days/0190d8a2-4b7e-7c3f-9a1b-2c3d4e5f6a7b/items", {
      destinationId: a.data.id,
    });
    expect(res.status).toBe(404);
  });
});

describe("auth and limits", () => {
  it("requires the bearer token except for health", async () => {
    const secured = createApp(await testDeps({ apiToken: "s3cret" }));
    expect((await secured.request("/health")).status).toBe(200);
    const denied = await secured.request("/trips");
    expect(denied.status).toBe(401);
    expect((await j(denied)).code).toBe("unauthorized");
    expect((await secured.request("/trips", { headers: { Authorization: "Bearer wrong" } })).status).toBe(
      401,
    );
    expect((await secured.request("/trips", { headers: { Authorization: "Bearer s3cret" } })).status).toBe(
      200,
    );
  });

  it("rejects bodies over 2 MB", async () => {
    const res = await send("POST", "/trips", { name: "x", description: "a".repeat(2 * 1024 * 1024 + 10) });
    expect(res.status).toBe(413);
  });
});
