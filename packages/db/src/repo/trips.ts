import { asc, count, desc, eq, gte, inArray, and } from "drizzle-orm";
import {
  DEFAULTS,
  OrbiError,
  addDays,
  daysBetweenInclusive,
  newId,
  notFound,
  type CreateTripInput,
  type TripAggregate,
  type TripPreferences,
  type TripSummary,
  type UpdateTripInput,
} from "@orbi/core";
import type { Db, DbOrTx } from "../client.ts";
import { destinations, itineraryItems, tripDays, tripPreferences, trips } from "../schema.ts";
import { now, toDay, toItem, touchTrip } from "./shared.ts";

export function listTrips(db: DbOrTx): TripSummary[] {
  const rows = db.select().from(trips).orderBy(desc(trips.updatedAt)).all();
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const dayCounts = new Map(
    db
      .select({ tripId: tripDays.tripId, n: count() })
      .from(tripDays)
      .where(inArray(tripDays.tripId, ids))
      .groupBy(tripDays.tripId)
      .all()
      .map((r) => [r.tripId, r.n]),
  );
  const destCounts = new Map(
    db
      .select({ tripId: destinations.tripId, n: count() })
      .from(destinations)
      .where(inArray(destinations.tripId, ids))
      .groupBy(destinations.tripId)
      .all()
      .map((r) => [r.tripId, r.n]),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    regionName: r.regionName,
    startDate: r.startDate,
    endDate: r.endDate,
    updatedAt: r.updatedAt,
    dayCount: dayCounts.get(r.id) ?? 0,
    destinationCount: destCounts.get(r.id) ?? 0,
  }));
}

export function getTripAggregate(db: DbOrTx, tripId: string): TripAggregate {
  const trip = db.select().from(trips).where(eq(trips.id, tripId)).get();
  if (!trip) throw notFound("Trip", tripId);
  const prefs = db.select().from(tripPreferences).where(eq(tripPreferences.tripId, tripId)).get();
  const days = db
    .select()
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.dayIndex))
    .all();
  const items = days.length
    ? db
        .select()
        .from(itineraryItems)
        .where(
          inArray(
            itineraryItems.tripDayId,
            days.map((d) => d.id),
          ),
        )
        .orderBy(asc(itineraryItems.position))
        .all()
    : [];
  const dests = db
    .select()
    .from(destinations)
    .where(eq(destinations.tripId, tripId))
    .orderBy(asc(destinations.createdAt))
    .all();

  return {
    trip,
    preferences: prefs ? toPreferences(prefs) : defaultPreferences(),
    days: days.map((d) => ({ ...toDay(d), items: items.filter((i) => i.tripDayId === d.id).map(toItem) })),
    destinations: dests,
  };
}

function toPreferences(row: typeof tripPreferences.$inferSelect): TripPreferences {
  return {
    pace: row.pace,
    interests: row.interests,
    dayStartTime: row.dayStartTime,
    dayEndTime: row.dayEndTime,
    maxDailyTravelMin: row.maxDailyTravelMin,
    notes: row.notes,
  };
}

export function defaultPreferences(): TripPreferences {
  return {
    pace: DEFAULTS.pace,
    interests: [],
    dayStartTime: DEFAULTS.dayStartTime,
    dayEndTime: DEFAULTS.dayEndTime,
    maxDailyTravelMin: null,
    notes: null,
  };
}

/** Number of days implied by dates (dated trip) or dayCount (undated trip). */
function targetDayCount(
  startDate: string | null,
  endDate: string | null,
  dayCount: number | undefined,
): number {
  if (startDate && endDate) return daysBetweenInclusive(startDate, endDate);
  return dayCount ?? 1;
}

function insertDays(
  tx: DbOrTx,
  tripId: string,
  fromIndex: number,
  toIndexExclusive: number,
  startDate: string | null,
) {
  const t = now();
  for (let i = fromIndex; i < toIndexExclusive; i++) {
    tx.insert(tripDays)
      .values({
        id: newId(),
        tripId,
        dayIndex: i,
        date: startDate ? addDays(startDate, i) : null,
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }
}

export function createTrip(db: Db, input: CreateTripInput): TripAggregate {
  const id = newId();
  const t = now();
  const startDate = input.startDate ?? null;
  const endDate = input.endDate ?? null;
  const days = targetDayCount(startDate, endDate, input.dayCount);
  if (days > 60) throw new OrbiError("validation", "A trip can have at most 60 days");

  db.transaction((tx) => {
    tx.insert(trips)
      .values({
        id,
        name: input.name,
        description: input.description ?? null,
        regionName: input.regionName ?? null,
        regionBbox: input.regionBbox ?? null,
        startDate,
        endDate,
        timezone: input.timezone ?? DEFAULTS.timezone,
        currency: input.currency ?? DEFAULTS.currency,
        budgetMinor: input.budgetMinor ?? null,
        defaultTravelMode: input.defaultTravelMode ?? DEFAULTS.travelMode,
        revision: 0,
        createdAt: t,
        updatedAt: t,
      })
      .run();
    tx.insert(tripPreferences)
      .values({ tripId: id, ...defaultPreferences(), ...input.preferences, updatedAt: t })
      .run();
    insertDays(tx, id, 0, days, startDate);
  });
  return getTripAggregate(db, id);
}

export function updateTrip(
  db: Db,
  tripId: string,
  input: UpdateTripInput,
  expectedRevision?: number,
): TripAggregate {
  db.transaction((tx) => {
    const current = tx.select().from(trips).where(eq(trips.id, tripId)).get();
    if (!current) throw notFound("Trip", tripId);
    touchTrip(tx, tripId, expectedRevision);

    const { confirmRemoveDays, dayCount, ...fields } = input;
    if (fields.originDestinationId) {
      const dest = tx
        .select()
        .from(destinations)
        .where(eq(destinations.id, fields.originDestinationId))
        .get();
      if (!dest || dest.tripId !== tripId) throw notFound("Destination", fields.originDestinationId);
    }

    const datesTouched = "startDate" in fields || "endDate" in fields || dayCount !== undefined;
    if (Object.keys(fields).length) tx.update(trips).set(fields).where(eq(trips.id, tripId)).run();
    if (!datesTouched) return;

    const startDate = "startDate" in fields ? (fields.startDate ?? null) : current.startDate;
    const endDate = "endDate" in fields ? (fields.endDate ?? null) : current.endDate;
    const existing = tx
      .select()
      .from(tripDays)
      .where(eq(tripDays.tripId, tripId))
      .orderBy(asc(tripDays.dayIndex))
      .all();
    const target = targetDayCount(startDate, endDate, dayCount ?? existing.length);
    if (target > 60) throw new OrbiError("validation", "A trip can have at most 60 days");

    if (target < existing.length) {
      const removed = existing.slice(target);
      const removedIds = removed.map((d) => d.id);
      const [{ n }] = tx
        .select({ n: count() })
        .from(itineraryItems)
        .where(inArray(itineraryItems.tripDayId, removedIds))
        .all() as [{ n: number }];
      if (n > 0 && !confirmRemoveDays) {
        throw new OrbiError(
          "confirmation_required",
          `This change removes ${removed.length} day(s) containing ${n} scheduled stop(s). Resend with confirmRemoveDays: true.`,
          { removedDayIds: removedIds, scheduledItems: n },
        );
      }
      tx.delete(tripDays)
        .where(and(eq(tripDays.tripId, tripId), gte(tripDays.dayIndex, target)))
        .run();
    } else if (target > existing.length) {
      insertDays(tx, tripId, existing.length, target, startDate);
    }

    const t = now();
    for (const day of existing.slice(0, target)) {
      tx.update(tripDays)
        .set({ date: startDate ? addDays(startDate, day.dayIndex) : null, updatedAt: t })
        .where(eq(tripDays.id, day.id))
        .run();
    }
  });
  return getTripAggregate(db, tripId);
}

export function deleteTrip(db: Db, tripId: string, expectedRevision?: number): void {
  db.transaction((tx) => {
    touchTrip(tx, tripId, expectedRevision);
    tx.delete(trips).where(eq(trips.id, tripId)).run();
  });
}

export function putPreferences(
  db: Db,
  tripId: string,
  prefs: TripPreferences,
  expectedRevision?: number,
): TripAggregate {
  db.transaction((tx) => {
    touchTrip(tx, tripId, expectedRevision);
    const values = { ...prefs, updatedAt: now() };
    tx.insert(tripPreferences)
      .values({ tripId, ...values })
      .onConflictDoUpdate({ target: tripPreferences.tripId, set: values })
      .run();
  });
  return getTripAggregate(db, tripId);
}
