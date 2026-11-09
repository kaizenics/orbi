import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { OrbiError, type PlaceCandidate, type TripAggregate } from "@orbi/core";
import { generateDraft, proposeEdit, type Geocode } from "../src/index.ts";

const id = (n: number) => `0190d8a2-4b7e-7c3f-9a1b-${String(n).padStart(12, "0")}`;

/** Mock model returning the given raw text responses in order. */
function model(...texts: string[]) {
  return new MockLanguageModelV4({
    doGenerate: texts.map((text) => ({
      content: [{ type: "text" as const, text }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      warnings: [],
    })),
  });
}

const place = (name: string, latitude: number, longitude: number): PlaceCandidate => ({
  name,
  address: null,
  latitude,
  longitude,
  category: "history",
  source: "nominatim",
  sourceRef: `osm:node/${Math.round(latitude * 1000)}`,
  bbox: null,
});

const trip = {
  trip: {
    id: id(1),
    name: "Cebu",
    regionName: "Cebu",
    startDate: null,
    endDate: null,
    currency: "PHP",
    budgetMinor: 1_000_000,
  },
  preferences: {
    pace: "moderate",
    interests: ["history"],
    dayStartTime: "09:00",
    dayEndTime: "18:00",
    maxDailyTravelMin: null,
    notes: null,
  },
  days: [
    {
      id: id(10),
      title: null,
      date: null,
      items: [{ id: id(20), destinationId: id(30), durationOverrideMin: null, fixedStartTime: null }],
    },
    { id: id(11), title: null, date: null, items: [] },
  ],
  destinations: [
    {
      id: id(30),
      name: "Fort San Pedro",
      category: "history",
      visitDurationMin: 60,
      latitude: 10.2927,
      longitude: 123.9059,
    },
  ],
} as unknown as TripAggregate;

const stop = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  localityHint: "Cebu City",
  category: "history",
  visitDurationMin: 60,
  estCost: 50,
  why: "Fits history",
  ...extra,
});

/** Geocoder fake: Basilica resolves nearby, "Far Place" only matches in Manila (~570 km away). */
const geocode: Geocode = async (query) =>
  query.startsWith("Basilica")
    ? [place("Basilica Minore del Santo Niño", 10.2943, 123.9021)]
    : query.startsWith("Far Place")
      ? [place("Far Place", 14.5995, 120.9842)]
      : [];

describe("generateDraft", () => {
  it("geocodes every stop, ignores model-supplied coordinates and flags implausible matches", async () => {
    const output = JSON.stringify({
      summary: "History",
      days: [
        {
          title: "Old town",
          stops: [stop("Basilica Minore del Santo Niño", { latitude: 1, longitude: 2 }), stop("Far Place")],
        },
        { title: "Day 2", stops: [stop("Nowhere Museum")] },
        { title: "Extra day beyond the trip", stops: [stop("Basilica")] },
      ],
    });
    const draft = await generateDraft({ model: model(output), geocode }, trip, "History please");
    if (draft.kind !== "draft") throw new Error("expected draft");

    expect(draft.days).toHaveLength(2); // never more days than the trip has
    const [basilica, far] = draft.days[0]!.stops;
    expect(basilica!.location).toMatchObject({ latitude: 10.2943, longitude: 123.9021 }); // geocoder's, not the model's
    expect(basilica!.estCostMinor).toBe(5000);
    expect(far!.location).toBeNull(); // 570 km from the trip area
    expect(draft.days[1]!.stops[0]!.location).toBeNull(); // not found at all
  });

  it("retries once with the validation error, then succeeds", async () => {
    const valid = JSON.stringify({ summary: "ok", days: [{ title: "D1", stops: [stop("Basilica")] }] });
    const m = model("{ not json", valid);
    const draft = await generateDraft({ model: m, geocode }, trip, "x");
    expect(draft.kind).toBe("draft");
    expect(m.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(m.doGenerateCalls[1]!.prompt)).toContain("previous answer was rejected");
  });

  it("gives up with ai_output_invalid after two invalid answers", async () => {
    await expect(
      generateDraft({ model: model("nope", '{"days": []}'), geocode }, trip, "x"),
    ).rejects.toMatchObject({
      code: "ai_output_invalid",
    });
  });

  it("reports an unreachable model as provider_unavailable", async () => {
    const broken = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("ECONNREFUSED 127.0.0.1:11434");
      },
    });
    const error = await generateDraft({ model: broken, geocode }, trip, "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrbiError);
    expect((error as OrbiError).code).toBe("provider_unavailable");
  });
});

describe("proposeEdit", () => {
  it("maps short refs to real IDs and rejects unknown refs instead of guessing", async () => {
    const output = JSON.stringify({
      summary: "Moved the fort to day 2",
      operations: [
        { op: "move", stop: "s1", toDay: "d2", position: 1 },
        { op: "remove", stop: "s9" },
        { op: "add", day: "d2", position: 2, place: stop("Basilica") },
        { op: "update", stop: "s1", visitDurationMin: 45, fixedStartTime: null, notes: "Bring water" },
      ],
    });
    const edit = await proposeEdit({ model: model(output), geocode }, trip, "Move the fort to day 2");
    if (edit.kind !== "edit") throw new Error("expected edit");

    expect(edit.operations).toEqual([
      { op: "move", itemId: id(20), toDayId: id(11), toPosition: 0 },
      expect.objectContaining({ op: "add", dayId: id(11), toPosition: 1 }),
      {
        op: "update",
        itemId: id(20),
        destinationId: id(30),
        visitDurationMin: 45,
        fixedStartTime: null,
        notes: "Bring water",
      },
    ]);
    expect(edit.rejected).toEqual(["Removal of unknown stop s9"]);
  });
});
