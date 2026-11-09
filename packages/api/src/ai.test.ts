import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { proposalSchema, tripAggregateSchema, type AiConnection } from "@orbi/core";
import { createApp } from "./app.ts";
import { testDeps } from "../test/fakes.ts";

/** The part of the libSQL client used to inspect the raw database in tests. */
interface Sql {
  execute(sql: string): Promise<{ rows: unknown[] }>;
}

const stop = (name: string) => ({
  name,
  localityHint: "Cebu City",
  category: "history",
  visitDurationMin: 60,
  estCost: 100,
  why: "Because",
});

function mockModel(json: unknown) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: JSON.stringify(json) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

/** The caller's own AI connection, sent with every AI request (bring your own key). */
const AI: AiConnection = { provider: "openrouter", model: "test/model:free", apiKey: "sk-or-test-key-1234" };

/** App whose AI model answers with `aiJson`; `seen` records which connections the API was given. */
async function setup(aiJson: unknown = {}) {
  const seen: AiConnection[] = [];
  const deps = await testDeps({
    createModel: (config) => {
      seen.push(config);
      return { model: mockModel(aiJson), provider: config.provider, modelId: config.model };
    },
  });
  const app = createApp(deps);
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    });
  const trip = tripAggregateSchema.parse(
    await (await send("POST", "/trips", { name: "Cebu", regionName: "Cebu", dayCount: 2 })).json(),
  );
  const getTrip = async () =>
    tripAggregateSchema.parse(await (await send("GET", `/trips/${trip.trip.id}`)).json());
  const draft = (prompt = "Plan 2 days of history") =>
    send("POST", `/trips/${trip.trip.id}/ai/drafts`, { prompt, ai: AI });
  return { send, trip, getTrip, seen, draft, db: deps.db };
}

const draftJson = {
  summary: "Old town",
  days: [
    { title: "History", stops: [stop("Fort San Pedro"), stop("Nowhere Museum")] },
    { title: "Day 2", stops: [stop("Fort San Pedro")] },
  ],
};

describe("AI drafts", () => {
  it("rejects requests without the caller's own AI connection, leaving other routes working", async () => {
    const { send, trip, seen } = await setup(draftJson);
    const missing = await send("POST", `/trips/${trip.trip.id}/ai/drafts`, {
      prompt: "Plan 2 days of history",
    });
    expect(missing.status).toBe(400);
    const shortKey = await send("POST", `/trips/${trip.trip.id}/ai/drafts`, {
      prompt: "Plan 2 days of history",
      ai: { ...AI, apiKey: "short" },
    });
    expect(shortKey.status).toBe(400);
    expect(seen).toHaveLength(0);
    expect((await send("GET", `/trips/${trip.trip.id}`)).status).toBe(200);
  });

  it("uses the key from the request, and never returns or keeps it", async () => {
    const { draft, seen, db } = await setup(draftJson);
    const res = await draft();
    expect(res.status).toBe(201);
    expect(seen).toEqual([AI]);
    expect(JSON.stringify(await res.json())).not.toContain("sk-or-test");

    // Nothing in the database contains the key: look at every table's rows.
    const client = (db as unknown as { $client: Sql }).$client;
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const { name } of tables.rows as unknown as { name: string }[]) {
      const rows = await client.execute(`SELECT * FROM "${name}"`);
      expect(JSON.stringify(rows.rows)).not.toContain("sk-or-test");
    }
  });

  it("stores a proposal and writes nothing to the itinerary until applied", async () => {
    const { draft, getTrip } = await setup(draftJson);
    const res = await draft();
    expect(res.status).toBe(201);
    const proposal = proposalSchema.parse(await res.json());
    expect(proposal.status).toBe("pending");
    if (proposal.payload.kind !== "draft") throw new Error("expected draft");
    expect(proposal.payload.days[0]!.stops.map((s) => s.location !== null)).toEqual([true, false]);

    const after = await getTrip();
    expect(after.destinations).toHaveLength(0);
    expect(after.days.flatMap((d) => d.items)).toHaveLength(0);
  });

  it("refuses unresolved stops, then applies the rest with provider coordinates and AI labels", async () => {
    const { send, draft, getTrip } = await setup(draftJson);
    const proposal = proposalSchema.parse(await (await draft()).json());

    const refused = await send("POST", `/proposals/${proposal.id}/apply`, {});
    expect(refused.status).toBe(422);
    expect((await getTrip()).destinations).toHaveLength(0); // all or nothing

    const applied = await send("POST", `/proposals/${proposal.id}/apply`, { exclude: ["d1s2"] });
    expect(applied.status).toBe(200);
    expect(proposalSchema.parse(await applied.json()).status).toBe("partially_applied");

    const state = await getTrip();
    expect(state.destinations).toHaveLength(1); // the same OSM place on two days is one destination
    expect(state.destinations[0]).toMatchObject({
      origin: "ai",
      locationSource: "nominatim",
      latitude: 10.2927283,
      costSource: "ai_estimate",
      estCostMinor: 10000,
    });
    expect(state.days.map((d) => d.items.length)).toEqual([1, 1]);
  });

  it("marks the proposal stale when the trip changed in the meantime", async () => {
    const { send, trip, draft } = await setup(draftJson);
    const proposal = proposalSchema.parse(await (await draft()).json());
    await send("PATCH", `/trips/${trip.trip.id}`, { name: "Cebu, edited" });
    const res = await send("POST", `/proposals/${proposal.id}/apply`, { exclude: ["d1s2"] });
    expect(res.status).toBe(409);
    expect(proposalSchema.parse(await (await send("GET", `/proposals/${proposal.id}`)).json()).status).toBe(
      "stale",
    );
  });

  it("can be discarded", async () => {
    const { send, draft } = await setup(draftJson);
    const proposal = proposalSchema.parse(await (await draft()).json());
    expect((await send("DELETE", `/proposals/${proposal.id}`)).status).toBe(200);
    expect((await send("POST", `/proposals/${proposal.id}/apply`, {})).status).toBe(409);
  });
});

describe("AI edits", () => {
  it("applies operations against the existing itinerary instead of regenerating it", async () => {
    const { send, trip, getTrip, seen } = await setup({
      summary: "Moved",
      operations: [{ op: "move", stop: "s1", toDay: "d2", position: 1 }],
    });
    await send("POST", `/trips/${trip.trip.id}/destinations`, {
      name: "Beach",
      latitude: 10.28,
      longitude: 123.99,
      locationSource: "map_pin",
      dayId: trip.days[0]!.id,
    });
    const proposal = proposalSchema.parse(
      await (
        await send("POST", `/trips/${trip.trip.id}/ai/edits`, {
          instruction: "Move the beach to day 2",
          ai: AI,
        })
      ).json(),
    );
    expect(seen).toEqual([AI]);
    expect((await send("POST", `/proposals/${proposal.id}/apply`, {})).status).toBe(200);
    const state = await getTrip();
    expect(state.days.map((d) => d.items.length)).toEqual([0, 1]);
    expect(state.destinations).toHaveLength(1);
  });
});
