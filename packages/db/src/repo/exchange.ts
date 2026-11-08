import { eq } from "drizzle-orm";
import {
  OrbiError,
  TRIP_EXPORT_FORMAT,
  addDays,
  daysBetweenInclusive,
  TRIP_EXPORT_VERSION,
  newId,
  type TripAggregate,
  type TripExport,
} from "@orbi/core";
import type { Db } from "../client.ts";
import { destinations, itineraryItems, tripDays, tripPreferences, trips } from "../schema.ts";
import { now } from "./shared.ts";
import { getTripAggregate } from "./trips.ts";

export function exportTrip(db: Db, tripId: string): TripExport {
  return {
    format: TRIP_EXPORT_FORMAT,
    version: TRIP_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: getTripAggregate(db, tripId),
  };
}

/**
 * Imports a trip file as a new trip. Every ID is regenerated and references are remapped. Size
 * limits are enforced by the schema; day numbers and dates are rebuilt from the trip instead of
 * trusted from the file, and conflicts are reported as validation errors (not database errors).
 */
export function importTrip(db: Db, file: TripExport): TripAggregate {
  const { trip, preferences, days, destinations: dests } = file.data;
  if (days.length === 0) throw new OrbiError("validation", "A trip file must contain at least one day");
  if (trip.startDate && trip.endDate && daysBetweenInclusive(trip.startDate, trip.endDate) !== days.length) {
    throw new OrbiError("validation", "The number of days does not match the trip's start and end dates");
  }
  const refs = dests.flatMap((d) => (d.sourceRef ? [d.sourceRef] : []));
  if (new Set(refs).size !== refs.length) {
    throw new OrbiError("validation", "The trip file lists the same place more than once");
  }
  const t = now();
  const tripId = newId();
  const destIds = new Map(dests.map((d) => [d.id, newId()]));

  db.transaction((tx) => {
    tx.insert(trips)
      .values({ ...trip, id: tripId, originDestinationId: null, revision: 0, createdAt: t, updatedAt: t })
      .run();
    tx.insert(tripPreferences)
      .values({ tripId, ...preferences, updatedAt: t })
      .run();
    for (const d of dests) {
      tx.insert(destinations)
        .values({ ...d, id: destIds.get(d.id)!, tripId, createdAt: t, updatedAt: t })
        .run();
    }
    days.forEach((day, dayIndex) => {
      const dayId = newId();
      const { items, ...dayFields } = day;
      const date = trip.startDate ? addDays(trip.startDate, dayIndex) : null;
      tx.insert(tripDays)
        .values({ ...dayFields, id: dayId, tripId, dayIndex, date, createdAt: t, updatedAt: t })
        .run();
      items.forEach((item, position) => {
        const destinationId = destIds.get(item.destinationId);
        if (!destinationId) return; // dangling reference in the file: skip the occurrence
        tx.insert(itineraryItems)
          .values({
            ...item,
            id: newId(),
            tripDayId: dayId,
            destinationId,
            position,
            createdAt: t,
            updatedAt: t,
          })
          .run();
      });
    });
    const origin = trip.originDestinationId ? destIds.get(trip.originDestinationId) : undefined;
    if (origin) tx.update(trips).set({ originDestinationId: origin }).where(eq(trips.id, tripId)).run();
  });
  return getTripAggregate(db, tripId);
}
