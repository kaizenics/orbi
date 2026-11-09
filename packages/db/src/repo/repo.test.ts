import { beforeEach, describe, expect, it } from "vitest";
import { OrbiError, tripExportSchema, type CreateDestinationInput, type TripAggregate } from "@orbi/core";
import { createTestDb, type Db } from "../client.ts";
import * as schema from "../schema.ts";
import { exportTrip, importTrip } from "./exchange.ts";
import {
  createDestination,
  createItem,
  deleteDestination,
  deleteItem,
  moveItem,
  reorderDay,
  updateDestination,
} from "./itinerary.ts";
import { createTrip, deleteTrip, getTripAggregate, listTrips, updateTrip } from "./trips.ts";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const place = (name: string, i = 0): CreateDestinationInput => ({
  name,
  latitude: 10.29 + i / 1000,
  longitude: 123.9 + i / 1000,
  locationSource: "seed",
  sourceRef: `test:${name}`,
});

async function threeDayTrip(): Promise<TripAggregate> {
  return await createTrip(db, { name: "Cebu", startDate: "2026-12-01", endDate: "2026-12-03" }, "local");
}

/** Asserts every day's positions are exactly 0..n-1 in order. */
async function expectDensePositions(tripId: string) {
  for (const day of (await getTripAggregate(db, tripId)).days) {
    expect(day.items.map((i) => i.position)).toEqual(day.items.map((_, i) => i));
  }
}

const expectCode = async (fn: () => Promise<unknown>, code: OrbiError["code"]) => {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(OrbiError);
    expect((error as OrbiError).code).toBe(code);
    return;
  }
  throw new Error(`expected OrbiError(${code})`);
};

describe("trips", () => {
  it("creates one day per date with default preferences", async () => {
    const agg = await threeDayTrip();
    expect(agg.days.map((d) => d.date)).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
    expect(agg.trip).toMatchObject({ currency: "PHP", timezone: "Asia/Manila", revision: 0 });
    expect(agg.preferences.pace).toBe("moderate");
    expect(await listTrips(db, "local")).toMatchObject([
      { id: agg.trip.id, dayCount: 3, destinationCount: 0 },
    ]);
  });

  it("creates undated trips from dayCount", async () => {
    const agg = await createTrip(db, { name: "Someday", dayCount: 2 }, "local");
    expect(agg.days.map((d) => [d.dayIndex, d.date])).toEqual([
      [0, null],
      [1, null],
    ]);
  });

  it("re-dates days and adds trailing days when the date range grows", async () => {
    const agg = await threeDayTrip();
    const next = await updateTrip(db, agg.trip.id, { startDate: "2026-12-10", endDate: "2026-12-14" });
    expect(next.days.map((d) => d.date)).toEqual([
      "2026-12-10",
      "2026-12-11",
      "2026-12-12",
      "2026-12-13",
      "2026-12-14",
    ]);
    expect(next.days.slice(0, 3).map((d) => d.id)).toEqual(agg.days.map((d) => d.id));
  });

  it("requires confirmation before removing days that have stops", async () => {
    const agg = await threeDayTrip();
    await createDestination(db, agg.trip.id, { ...place("Beach"), dayId: agg.days[2]!.id });
    const shrink = { startDate: "2026-12-01", endDate: "2026-12-02" };

    await expectCode(() => updateTrip(db, agg.trip.id, shrink), "confirmation_required");
    expect((await getTripAggregate(db, agg.trip.id)).days).toHaveLength(3);

    const next = await updateTrip(db, agg.trip.id, { ...shrink, confirmRemoveDays: true });
    expect(next.days).toHaveLength(2);
    expect(next.destinations).toHaveLength(1); // destination stays in the ideas list
  });

  it("detects concurrent edits through the revision", async () => {
    const agg = await threeDayTrip();
    await updateTrip(db, agg.trip.id, { name: "Cebu & Bohol" }, 0);
    await expectCode(() => updateTrip(db, agg.trip.id, { name: "stale" }, 0), "conflict");
    expect((await getTripAggregate(db, agg.trip.id)).trip).toMatchObject({
      name: "Cebu & Bohol",
      revision: 1,
    });
  });

  it("deletes everything that belongs to a trip", async () => {
    const agg = await threeDayTrip();
    await createDestination(db, agg.trip.id, { ...place("Fort"), dayId: agg.days[0]!.id });
    await deleteTrip(db, agg.trip.id);
    for (const table of [
      schema.trips,
      schema.tripDays,
      schema.destinations,
      schema.itineraryItems,
      schema.tripPreferences,
    ]) {
      expect(await db.select().from(table).all()).toHaveLength(0);
    }
  });
});

describe("destinations and items", () => {
  it("schedules on create, rejects duplicate places, and allows the same place on several days", async () => {
    const agg = await threeDayTrip();
    const hotel = (await createDestination(db, agg.trip.id, { ...place("Hotel"), dayId: agg.days[0]!.id }))
      .value;
    await expectCode(() => createDestination(db, agg.trip.id, place("Hotel")), "conflict");
    await createItem(db, agg.days[1]!.id, { destinationId: hotel.id });
    const days = (await getTripAggregate(db, agg.trip.id)).days;
    expect(days[0]!.items[0]!.destinationId).toBe(hotel.id);
    expect(days[1]!.items[0]!.destinationId).toBe(hotel.id);
  });

  it("refuses to schedule another trip's destination", async () => {
    const a = await threeDayTrip();
    const b = await createTrip(db, { name: "Other", dayCount: 1 }, "local");
    const foreign = (await createDestination(db, b.trip.id, place("Elsewhere"))).value;
    await expectCode(() => createItem(db, a.days[0]!.id, { destinationId: foreign.id }), "not_found");
  });

  it("deleting a destination removes its occurrences and re-packs positions", async () => {
    const agg = await threeDayTrip();
    const day = agg.days[0]!.id;
    const ids: string[] = [];
    for (const [i, n] of ["A", "B", "C"].entries()) {
      ids.push((await createDestination(db, agg.trip.id, { ...place(n, i), dayId: day })).value.id);
    }
    await deleteDestination(db, ids[1]!);
    const items = (await getTripAggregate(db, agg.trip.id)).days[0]!.items;
    expect(items.map((i) => i.destinationId)).toEqual([ids[0], ids[2]]);
    await expectDensePositions(agg.trip.id);
  });

  it("refreshes locationVerifiedAt only when coordinates change", async () => {
    const agg = await threeDayTrip();
    const d = (await createDestination(db, agg.trip.id, place("Fort"))).value;
    expect((await updateDestination(db, d.id, { notes: "bring water" })).value.locationVerifiedAt).toBe(
      d.locationVerifiedAt,
    );
  });

  it("reorder must name exactly the day's items", async () => {
    const agg = await threeDayTrip();
    const day = agg.days[0]!.id;
    const a = (await createDestination(db, agg.trip.id, { ...place("A", 1), dayId: day })).value;
    await createDestination(db, agg.trip.id, { ...place("B", 2), dayId: day });
    const itemIds = (await getTripAggregate(db, agg.trip.id)).days[0]!.items.map((i) => i.id);
    await expectCode(() => reorderDay(db, day, [itemIds[0]!]), "conflict");
    const reordered = (await reorderDay(db, day, [itemIds[1]!, itemIds[0]!])).value;
    expect(reordered.map((i) => i.destinationId).at(-1)).toBe(a.id);
  });

  it("keeps positions dense and unique under random reorders, moves, inserts and deletes", async () => {
    const agg = await threeDayTrip();
    const dayIds = agg.days.map((d) => d.id);
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed % n;
    };
    const dests = [];
    for (let i = 0; i < 8; i++)
      dests.push((await createDestination(db, agg.trip.id, place(`P${i}`, i))).value);

    for (let step = 0; step < 300; step++) {
      const state = await getTripAggregate(db, agg.trip.id);
      const allItems = state.days.flatMap((d) => d.items);
      const op = rand(4);
      if ((op === 0 && allItems.length < 30) || allItems.length === 0) {
        await createItem(db, dayIds[rand(3)]!, {
          destinationId: dests[rand(dests.length)]!.id,
          position: rand(6),
        });
      } else if (op === 1) {
        const item = allItems[rand(allItems.length)]!;
        await moveItem(db, item.id, { toDayId: dayIds[rand(3)]!, toPosition: rand(8) });
      } else if (op === 2) {
        const day = state.days[rand(3)]!;
        const ids = day.items.map((i) => i.id);
        for (let i = ids.length - 1; i > 0; i--) {
          const j = rand(i + 1);
          [ids[i], ids[j]] = [ids[j]!, ids[i]!];
        }
        await reorderDay(db, day.id, ids);
      } else {
        await deleteItem(db, allItems[rand(allItems.length)]!.id);
      }
      await expectDensePositions(agg.trip.id);
    }
  });
});

describe("export / import", () => {
  it("rejects oversized files and rebuilds day numbers and dates", async () => {
    const agg = await threeDayTrip();
    const file = await exportTrip(db, agg.trip.id);
    const tooMany = {
      ...file,
      data: { ...file.data, days: Array.from({ length: 61 }, () => file.data.days[0]!) },
    };
    expect(tripExportSchema.safeParse(tooMany).success).toBe(false);

    const scrambled = structuredClone(file);
    scrambled.data.days.forEach((d) => {
      d.dayIndex = 7;
      d.date = "1999-01-01";
    });
    const copy = await importTrip(db, tripExportSchema.parse(scrambled), "local");
    expect(copy.days.map((d) => [d.dayIndex, d.date])).toEqual([
      [0, "2026-12-01"],
      [1, "2026-12-02"],
      [2, "2026-12-03"],
    ]);

    const mismatch = structuredClone(file);
    mismatch.data.days.pop();
    await expectCode(() => importTrip(db, mismatch, "local"), "validation");

    await createDestination(db, agg.trip.id, place("Fort"));
    const dup = await exportTrip(db, agg.trip.id);
    dup.data.destinations.push({ ...dup.data.destinations[0]!, id: "0190d8a2-4b7e-7c3f-9a1b-2c3d4e5f6a7b" });
    await expectCode(() => importTrip(db, dup, "local"), "validation");
  });

  it("round-trips a trip with fresh IDs", async () => {
    const agg = await threeDayTrip();
    const hotel = (await createDestination(db, agg.trip.id, { ...place("Hotel"), dayId: agg.days[0]!.id }))
      .value;
    await createDestination(db, agg.trip.id, { ...place("Fort", 1), dayId: agg.days[0]!.id });
    await createItem(db, agg.days[1]!.id, { destinationId: hotel.id });
    await updateTrip(db, agg.trip.id, { originDestinationId: hotel.id });

    const file = tripExportSchema.parse(JSON.parse(JSON.stringify(await exportTrip(db, agg.trip.id))));
    const copy = await importTrip(db, file, "local");
    const original = await getTripAggregate(db, agg.trip.id);

    expect(copy.trip.id).not.toBe(original.trip.id);
    const shape = (a: TripAggregate) => ({
      name: a.trip.name,
      dates: a.days.map((d) => d.date),
      days: a.days.map((d) => d.items.map((i) => a.destinations.find((x) => x.id === i.destinationId)!.name)),
      origin: a.destinations.find((x) => x.id === a.trip.originDestinationId)?.name,
      places: a.destinations.map((d) => [d.name, d.latitude, d.longitude]),
    });
    expect(shape(copy)).toEqual(shape(original));
  });
});
