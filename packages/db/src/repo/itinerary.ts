import { and, asc, eq, inArray } from "drizzle-orm";
import {
  DEFAULTS,
  LIMITS,
  OrbiError,
  newId,
  notFound,
  type CreateDestinationInput,
  type ActivityType,
  type CreateItemInput,
  type Destination,
  type ItineraryItem,
  type MoveItemInput,
  type TravelMode,
  type TripDay,
  type UpdateDayInput,
  type UpdateDestinationInput,
  type UpdateItemInput,
} from "@orbi/core";
import type { Db, DbOrTx } from "../client.ts";
import { destinations, itineraryItems, tripDays, trips } from "../schema.ts";
import { dayItemIds, getDayOrThrow, now, toDay, toItem, touchTrip, writePositions } from "./shared.ts";

export interface Mutation<T> {
  value: T;
  /** The trip's revision after the change. */
  revision: number;
}

async function getDestinationOrThrow(tx: DbOrTx, id: string) {
  const row = await tx.select().from(destinations).where(eq(destinations.id, id)).get();
  if (!row) throw notFound("Destination", id);
  return row;
}

async function getItemOrThrow(tx: DbOrTx, id: string) {
  const row = await tx.select().from(itineraryItems).where(eq(itineraryItems.id, id)).get();
  if (!row) throw notFound("Itinerary item", id);
  return row;
}

async function assertDayHasRoom(tx: DbOrTx, dayId: string) {
  if ((await dayItemIds(tx, dayId)).length >= LIMITS.maxItemsPerDay) {
    throw new OrbiError("validation", `A day can hold at most ${LIMITS.maxItemsPerDay} stops`);
  }
}

/** What an item is: a saved place, or an activity without a location. */
export type ItemTarget = string | { type: ActivityType; title: string };

/** Inserts an item at `position` (default: end) and re-packs the day. */
export async function insertItem(
  tx: DbOrTx,
  dayId: string,
  target: ItemTarget,
  fields: Omit<CreateItemInput, "destinationId" | "activity">,
): Promise<string> {
  await assertDayHasRoom(tx, dayId);
  const ids = await dayItemIds(tx, dayId);
  const id = newId();
  const t = now();
  await tx
    .insert(itineraryItems)
    .values({
      id,
      tripDayId: dayId,
      ...(typeof target === "string"
        ? { destinationId: target }
        : { destinationId: null, activityType: target.type, title: target.title }),
      position: -(ids.length + 1000), // temporary, rewritten below
      fixedStartTime: fields.fixedStartTime ?? null,
      durationOverrideMin: fields.durationOverrideMin ?? null,
      notes: fields.notes ?? null,
      createdAt: t,
      updatedAt: t,
    })
    .run();
  const at = Math.min(fields.position ?? ids.length, ids.length);
  ids.splice(at, 0, id);
  await writePositions(tx, dayId, ids);
  return id;
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export async function createDestination(
  db: DbOrTx,
  tripId: string,
  input: CreateDestinationInput,
  expectedRevision?: number,
): Promise<Mutation<Destination>> {
  return db.transaction(async (tx) => {
    const revision = await touchTrip(tx, tripId, expectedRevision);
    const { dayId, ...fields } = input;
    if (fields.sourceRef) {
      const dup = await tx
        .select({ id: destinations.id, tripId: destinations.tripId, sourceRef: destinations.sourceRef })
        .from(destinations)
        .where(and(eq(destinations.sourceRef, fields.sourceRef), eq(destinations.tripId, tripId)))
        .get();
      if (dup) {
        throw new OrbiError("conflict", "This place is already in the trip", { destinationId: dup.id });
      }
    }
    const t = now();
    const row = {
      id: newId(),
      tripId,
      name: fields.name,
      description: fields.description ?? null,
      address: fields.address ?? null,
      latitude: fields.latitude,
      longitude: fields.longitude,
      category: fields.category ?? "other",
      visitDurationMin: fields.visitDurationMin ?? DEFAULTS.visitDurationMin,
      openingHours: fields.openingHours ?? null,
      openingHoursSource: fields.openingHoursSource ?? null,
      estCostMinor: fields.estCostMinor ?? null,
      costSource: fields.costSource ?? null,
      notes: fields.notes ?? null,
      locationSource: fields.locationSource,
      sourceRef: fields.sourceRef ?? null,
      locationVerifiedAt: t,
      origin: "user" as const,
      createdAt: t,
      updatedAt: t,
    };
    await tx.insert(destinations).values(row).run();
    if (dayId) {
      const day = await getDayOrThrow(tx, dayId);
      if (day.tripId !== tripId) throw notFound("Day", dayId);
      await insertItem(tx, dayId, row.id, {});
    }
    return { value: row, revision };
  });
}

export async function updateDestination(
  db: DbOrTx,
  id: string,
  input: UpdateDestinationInput,
  expectedRevision?: number,
): Promise<Mutation<Destination>> {
  return db.transaction(async (tx) => {
    const current = await getDestinationOrThrow(tx, id);
    const revision = await touchTrip(tx, current.tripId, expectedRevision);
    const t = now();
    const coordsChanged = input.latitude !== undefined;
    const set = { ...input, updatedAt: t, ...(coordsChanged ? { locationVerifiedAt: t } : {}) };
    await tx.update(destinations).set(set).where(eq(destinations.id, id)).run();
    return { value: await getDestinationOrThrow(tx, id), revision };
  });
}

/** Deletes a destination, its scheduled occurrences (cascade), and re-packs affected days. */
export async function deleteDestination(
  db: DbOrTx,
  id: string,
  expectedRevision?: number,
): Promise<Mutation<null>> {
  return db.transaction(async (tx) => {
    const current = await getDestinationOrThrow(tx, id);
    const revision = await touchTrip(tx, current.tripId, expectedRevision);
    const occurrences = await tx
      .select({ dayId: itineraryItems.tripDayId })
      .from(itineraryItems)
      .where(eq(itineraryItems.destinationId, id))
      .all();
    const affectedDays = [...new Set(occurrences.map((r) => r.dayId))];
    await tx.delete(destinations).where(eq(destinations.id, id)).run();
    for (const dayId of affectedDays) await writePositions(tx, dayId, await dayItemIds(tx, dayId));
    return { value: null, revision };
  });
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export async function updateDay(
  db: DbOrTx,
  dayId: string,
  input: UpdateDayInput,
  expectedRevision?: number,
): Promise<Mutation<TripDay>> {
  return db.transaction(async (tx) => {
    const day = await getDayOrThrow(tx, dayId);
    const revision = await touchTrip(tx, day.tripId, expectedRevision);
    await tx
      .update(tripDays)
      .set({ ...input, updatedAt: now() })
      .where(eq(tripDays.id, dayId))
      .run();
    return { value: toDay(await getDayOrThrow(tx, dayId)), revision };
  });
}

// ---------------------------------------------------------------------------
// Itinerary items
// ---------------------------------------------------------------------------

export async function createItem(
  db: DbOrTx,
  dayId: string,
  input: CreateItemInput,
  expectedRevision?: number,
): Promise<Mutation<ItineraryItem>> {
  return db.transaction(async (tx) => {
    const day = await getDayOrThrow(tx, dayId);
    const { destinationId, activity, ...fields } = input;
    if (destinationId !== undefined) {
      const dest = await getDestinationOrThrow(tx, destinationId);
      // Same-trip invariant (database.md §4.5): enforced here, the single choke point.
      if (dest.tripId !== day.tripId) throw notFound("Destination", destinationId);
    }
    const revision = await touchTrip(tx, day.tripId, expectedRevision);
    const id = await insertItem(tx, dayId, destinationId ?? activity!, fields);
    return { value: toItem(await getItemOrThrow(tx, id)), revision };
  });
}

export async function updateItem(
  db: DbOrTx,
  id: string,
  input: UpdateItemInput,
  expectedRevision?: number,
): Promise<Mutation<ItineraryItem>> {
  return db.transaction(async (tx) => {
    const item = await getItemOrThrow(tx, id);
    if (item.activityType && input.title === null)
      throw new OrbiError("validation", "An activity needs a title");
    const day = await getDayOrThrow(tx, item.tripDayId);
    const revision = await touchTrip(tx, day.tripId, expectedRevision);
    await tx
      .update(itineraryItems)
      .set({ ...input, updatedAt: now() })
      .where(eq(itineraryItems.id, id))
      .run();
    return { value: toItem(await getItemOrThrow(tx, id)), revision };
  });
}

/** Unschedules an occurrence; the destination stays in the trip's ideas list. */
export async function deleteItem(db: DbOrTx, id: string, expectedRevision?: number): Promise<Mutation<null>> {
  return db.transaction(async (tx) => {
    const item = await getItemOrThrow(tx, id);
    const day = await getDayOrThrow(tx, item.tripDayId);
    const revision = await touchTrip(tx, day.tripId, expectedRevision);
    await tx.delete(itineraryItems).where(eq(itineraryItems.id, id)).run();
    await writePositions(tx, day.id, await dayItemIds(tx, day.id));
    return { value: null, revision };
  });
}

/** Idempotent reorder: `itemIds` must be exactly the day's current items, in the new order. */
export async function reorderDay(
  db: DbOrTx,
  dayId: string,
  itemIds: readonly string[],
  expectedRevision?: number,
): Promise<Mutation<ItineraryItem[]>> {
  return db.transaction(async (tx) => {
    const day = await getDayOrThrow(tx, dayId);
    const current = await dayItemIds(tx, dayId);
    const same =
      current.length === itemIds.length &&
      new Set(itemIds).size === itemIds.length &&
      itemIds.every((i) => current.includes(i));
    if (!same) {
      throw new OrbiError("conflict", "itemIds must list exactly the day's current items", {
        currentItemIds: current,
      });
    }
    const revision = await touchTrip(tx, day.tripId, expectedRevision);
    await writePositions(tx, dayId, itemIds);
    return { value: await listDayItems(tx, dayId), revision };
  });
}

/** Moves an item to another day (or another position on the same day). */
export async function moveItem(
  db: DbOrTx,
  id: string,
  input: MoveItemInput,
  expectedRevision?: number,
): Promise<Mutation<ItineraryItem>> {
  return db.transaction(async (tx) => {
    const item = await getItemOrThrow(tx, id);
    const from = await getDayOrThrow(tx, item.tripDayId);
    const to = await getDayOrThrow(tx, input.toDayId);
    if (to.tripId !== from.tripId) throw notFound("Day", input.toDayId);
    const revision = await touchTrip(tx, from.tripId, expectedRevision);

    const source = (await dayItemIds(tx, from.id)).filter((i) => i !== id);
    const target = from.id === to.id ? source : await dayItemIds(tx, to.id);
    if (from.id !== to.id && target.length >= LIMITS.maxItemsPerDay) {
      throw new OrbiError("validation", `A day can hold at most ${LIMITS.maxItemsPerDay} stops`);
    }
    target.splice(Math.min(input.toPosition, target.length), 0, id);

    if (from.id !== to.id) {
      // Park the moved item outside both days' position ranges before re-packing.
      await tx.update(itineraryItems).set({ position: -100_000 }).where(eq(itineraryItems.id, id)).run();
      await writePositions(tx, from.id, source);
    }
    await writePositions(tx, to.id, target);
    return { value: toItem(await getItemOrThrow(tx, id)), revision };
  });
}

async function listDayItems(tx: DbOrTx, dayId: string): Promise<ItineraryItem[]> {
  const ids = await dayItemIds(tx, dayId);
  if (!ids.length) return [];
  const rows = await tx.select().from(itineraryItems).where(inArray(itineraryItems.id, ids)).all();
  return ids.map((i) => toItem(rows.find((r) => r.id === i)!));
}

export interface DayStop {
  itemId: string;
  destinationId: string;
  name: string;
  latitude: number;
  longitude: number;
  travelModeToNext: TravelMode | null;
}

export interface DayStops {
  day: TripDay;
  defaultTravelMode: TravelMode;
  stops: DayStop[];
}

/** The ordered stops of one day with coordinates: the authoritative input for route calculation. */
export async function getDayStops(db: DbOrTx, dayId: string): Promise<DayStops> {
  const day = await getDayOrThrow(db, dayId);
  const trip = await db
    .select({ mode: trips.defaultTravelMode })
    .from(trips)
    .where(eq(trips.id, day.tripId))
    .get();
  const rows = await db
    .select({
      itemId: itineraryItems.id,
      destinationId: destinations.id,
      name: destinations.name,
      latitude: destinations.latitude,
      longitude: destinations.longitude,
      travelModeToNext: itineraryItems.travelModeToNext,
    })
    .from(itineraryItems)
    .innerJoin(destinations, eq(destinations.id, itineraryItems.destinationId))
    .where(eq(itineraryItems.tripDayId, dayId))
    .orderBy(asc(itineraryItems.position))
    .all();
  return { day: toDay(day), defaultTravelMode: trip!.mode, stops: rows };
}
