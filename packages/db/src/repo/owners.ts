import { eq } from "drizzle-orm";
import type { DbOrTx } from "../client.ts";
import { aiProposals, destinations, itineraryItems, tripDays, trips } from "../schema.ts";

export type OwnedKind = "trip" | "destination" | "day" | "item" | "proposal";

/**
 * Owner of the trip that a record belongs to, or null when the record does not exist.
 * The API checks this on every route that takes an ID, so accounts only reach their own trips.
 */
export async function tripOwnerOf(db: DbOrTx, kind: OwnedKind, id: string): Promise<string | null> {
  const row = await (() => {
    switch (kind) {
      case "trip":
        return db.select({ owner: trips.owner }).from(trips).where(eq(trips.id, id)).get();
      case "destination":
        return db
          .select({ owner: trips.owner })
          .from(destinations)
          .innerJoin(trips, eq(trips.id, destinations.tripId))
          .where(eq(destinations.id, id))
          .get();
      case "day":
        return db
          .select({ owner: trips.owner })
          .from(tripDays)
          .innerJoin(trips, eq(trips.id, tripDays.tripId))
          .where(eq(tripDays.id, id))
          .get();
      case "item":
        return db
          .select({ owner: trips.owner })
          .from(itineraryItems)
          .innerJoin(tripDays, eq(tripDays.id, itineraryItems.tripDayId))
          .innerJoin(trips, eq(trips.id, tripDays.tripId))
          .where(eq(itineraryItems.id, id))
          .get();
      case "proposal":
        return db
          .select({ owner: trips.owner })
          .from(aiProposals)
          .innerJoin(trips, eq(trips.id, aiProposals.tripId))
          .where(eq(aiProposals.id, id))
          .get();
    }
  })();
  return row?.owner ?? null;
}
