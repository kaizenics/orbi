import { asc, eq } from "drizzle-orm";
import { OrbiError, notFound, type ItineraryItem, type TripDay } from "@orbi/core";
import type { DbOrTx } from "../client.ts";
import { itineraryItems, tripDays, trips } from "../schema.ts";

export const now = () => Date.now();

/**
 * Concurrency guard used by every mutation: verifies the trip exists, optionally that it is still
 * at `expectedRevision` (another device may have changed it), then bumps revision + updated_at.
 */
export async function touchTrip(tx: DbOrTx, tripId: string, expectedRevision?: number): Promise<number> {
  const row = await tx.select({ revision: trips.revision }).from(trips).where(eq(trips.id, tripId)).get();
  if (!row) throw notFound("Trip", tripId);
  if (expectedRevision !== undefined && row.revision !== expectedRevision) {
    throw new OrbiError("conflict", "The trip was changed elsewhere; reload and try again", {
      expectedRevision,
      currentRevision: row.revision,
    });
  }
  const revision = row.revision + 1;
  await tx.update(trips).set({ revision, updatedAt: now() }).where(eq(trips.id, tripId)).run();
  return revision;
}

export async function getDayOrThrow(tx: DbOrTx, dayId: string) {
  const day = await tx.select().from(tripDays).where(eq(tripDays.id, dayId)).get();
  if (!day) throw notFound("Day", dayId);
  return day;
}

export async function dayItemIds(tx: DbOrTx, dayId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: itineraryItems.id })
    .from(itineraryItems)
    .where(eq(itineraryItems.tripDayId, dayId))
    .orderBy(asc(itineraryItems.position))
    .all();
  return rows.map((r) => r.id);
}

/**
 * Writes positions 0..n-1 for `itemIds` on `dayId`. SQLite cannot defer UNIQUE checks, so positions
 * are first moved to negative placeholders, then to their final values (database.md §5).
 */
export async function writePositions(tx: DbOrTx, dayId: string, itemIds: readonly string[]): Promise<void> {
  const t = now();
  for (const [i, id] of itemIds.entries()) {
    await tx
      .update(itineraryItems)
      .set({ tripDayId: dayId, position: -(i + 1), updatedAt: t })
      .where(eq(itineraryItems.id, id))
      .run();
  }
  for (const [i, id] of itemIds.entries()) {
    await tx.update(itineraryItems).set({ position: i }).where(eq(itineraryItems.id, id)).run();
  }
}

export function toDay(row: typeof tripDays.$inferSelect): TripDay {
  return {
    id: row.id,
    tripId: row.tripId,
    dayIndex: row.dayIndex,
    date: row.date,
    title: row.title,
    notes: row.notes,
    startTime: row.startTime,
    travelMode: row.travelMode,
  };
}

export function toItem(row: typeof itineraryItems.$inferSelect): ItineraryItem {
  return {
    id: row.id,
    tripDayId: row.tripDayId,
    destinationId: row.destinationId,
    position: row.position,
    fixedStartTime: row.fixedStartTime,
    durationOverrideMin: row.durationOverrideMin,
    travelModeToNext: row.travelModeToNext,
    notes: row.notes,
  };
}
