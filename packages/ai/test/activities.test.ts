import { describe, expect, it } from "vitest";
import { normalizeChatTrip } from "../src/chat.ts";
import { locateItinerary } from "../src/pipelines.ts";

describe("locateItinerary", () => {
  it("looks up places but never activities", async () => {
    const queries: string[] = [];
    const geocode = async (q: string) => {
      queries.push(q);
      return [];
    };
    const stop = {
      localityHint: "Cebu City",
      category: "history" as const,
      visitDurationMin: 60,
      estCost: null,
      why: "",
    };
    const [day] = await locateItinerary(
      [
        {
          title: "Day 1",
          stops: [
            { ...stop, name: "Breakfast at the hotel", localityHint: "", activity: "breakfast" },
            { ...stop, name: "Fort San Pedro", activity: null },
          ],
        },
      ],
      null,
      geocode,
    );
    // Nothing was found, so the fallbacks were tried for the place, and never for the activity.
    expect(queries).toEqual(["Fort San Pedro, Cebu City", "Fort San Pedro"]);
    expect(day!.stops.map((s) => [s.name, s.activityType])).toEqual([
      ["Breakfast at the hotel", "breakfast"],
      ["Fort San Pedro", null],
    ]);
  });
});

describe("normalizeChatTrip", () => {
  it("tidies an itinerary that breaks strict limits instead of rejecting it", () => {
    const stops = Array.from({ length: 20 }, (_, i) => ({ name: `Stop ${i}`, visitDurationMin: 5 }));
    const trip = normalizeChatTrip({
      name: "Cebu",
      startDate: "not a date",
      summary: "x".repeat(900),
      days: [
        { stops: [{ name: "Wake up", activity: "Wake Up", visitDurationMin: 5 }, ...stops] },
        { title: "Empty", stops: [] },
      ],
    });
    expect(trip).not.toBeNull();
    expect(trip!.startDate).toBeNull();
    expect(trip!.summary).toHaveLength(400);
    expect(trip!.days).toHaveLength(1); // the empty day is dropped
    expect(trip!.days[0]!.stops[0]).toMatchObject({
      activity: "wake_up",
      visitDurationMin: 5,
      localityHint: "",
    });
    expect(trip!.days[0]!.stops[1]).toMatchObject({ category: "other", why: "", activity: null });
  });

  it("returns null when nothing usable was sent", () => {
    expect(normalizeChatTrip({ name: "x", days: [] })).toBeNull();
    expect(normalizeChatTrip("garbage")).toBeNull();
  });
});

describe("place lookup fallbacks", () => {
  const hotel = {
    name: "Hotel Lantaw",
    localityHint: "Lapu-Lapu",
    category: "lodging" as const,
    visitDurationMin: 60,
    estCost: null,
    why: "",
    activity: null,
  };
  const found = {
    name: "Hotel Lantaw",
    address: null,
    latitude: 10.3,
    longitude: 123.97,
    source: "nominatim" as const,
    sourceRef: "n:1",
  };

  it("retries with the region, then stops at the first hit", async () => {
    const queries: string[] = [];
    const geocode = async (q: string) => {
      queries.push(q);
      return q === "Hotel Lantaw, Cebu, Philippines" ? [found] : [];
    };
    const [day] = await locateItinerary(
      [{ title: "Day 1", stops: [hotel] }],
      "Cebu, Philippines",
      geocode as never,
    );
    // The first lookup is the region itself (to know where the trip is).
    expect(queries).toEqual([
      "Cebu, Philippines",
      "Hotel Lantaw, Lapu-Lapu",
      "Hotel Lantaw, Cebu, Philippines",
    ]);
    expect(day!.stops[0]!.location).toMatchObject({ latitude: 10.3, longitude: 123.97 });
  });
});
