import { eq } from "drizzle-orm";
import {
  TRIP_EXPORT_FORMAT,
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

/** Imports a trip file as a new trip. Every ID is regenerated; references are remapped. */
export function importTrip(db: Db, file: TripExport): TripAggregate {
  const { trip, preferences, days, destinations: dests } = file.data;
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
    for (const day of days) {
      const dayId = newId();
      const { items, ...dayFields } = day;
      tx.insert(tripDays)
        .values({ ...dayFields, id: dayId, tripId, createdAt: t, updatedAt: t })
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
    }
    const origin = trip.originDestinationId ? destIds.get(trip.originDestinationId) : undefined;
    if (origin) tx.update(trips).set({ originDestinationId: origin }).where(eq(trips.id, tripId)).run();
  });
  return getTripAggregate(db, tripId);
}
