import { asc, eq, inArray } from "drizzle-orm";
import {
  DEFAULTS,
  LIMITS,
  OrbiError,
  newId,
  notFound,
  type CreateDestinationInput,
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

function getDestinationOrThrow(tx: DbOrTx, id: string) {
  const row = tx.select().from(destinations).where(eq(destinations.id, id)).get();
  if (!row) throw notFound("Destination", id);
  return row;
}

function getItemOrThrow(tx: DbOrTx, id: string) {
  const row = tx.select().from(itineraryItems).where(eq(itineraryItems.id, id)).get();
  if (!row) throw notFound("Itinerary item", id);
  return row;
}

function assertDayHasRoom(tx: DbOrTx, dayId: string) {
  if (dayItemIds(tx, dayId).length >= LIMITS.maxItemsPerDay) {
    throw new OrbiError("validation", `A day can hold at most ${LIMITS.maxItemsPerDay} stops`);
  }
}

/** Inserts an item at `position` (default: end) and re-packs the day. */
export function insertItem(
  tx: DbOrTx,
  dayId: string,
  destinationId: string,
  fields: Omit<CreateItemInput, "destinationId">,
): string {
  assertDayHasRoom(tx, dayId);
  const ids = dayItemIds(tx, dayId);
  const id = newId();
  const t = now();
  tx.insert(itineraryItems)
    .values({
      id,
      tripDayId: dayId,
      destinationId,
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
  writePositions(tx, dayId, ids);
  return id;
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export function createDestination(
  db: DbOrTx,
  tripId: string,
  input: CreateDestinationInput,
  expectedRevision?: number,
): Mutation<Destination> {
  return db.transaction((tx) => {
    const revision = touchTrip(tx, tripId, expectedRevision);
    const { dayId, ...fields } = input;
    if (fields.sourceRef) {
      const dup = tx
        .select({ id: destinations.id, tripId: destinations.tripId, sourceRef: destinations.sourceRef })
        .from(destinations)
        .where(eq(destinations.sourceRef, fields.sourceRef))
        .all()
        .find((d) => d.tripId === tripId);
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
    tx.insert(destinations).values(row).run();
    if (dayId) {
      const day = getDayOrThrow(tx, dayId);
      if (day.tripId !== tripId) throw notFound("Day", dayId);
      insertItem(tx, dayId, row.id, {});
    }
    return { value: row, revision };
  });
}

export function updateDestination(
  db: DbOrTx,
  id: string,
  input: UpdateDestinationInput,
  expectedRevision?: number,
): Mutation<Destination> {
  return db.transaction((tx) => {
    const current = getDestinationOrThrow(tx, id);
    const revision = touchTrip(tx, current.tripId, expectedRevision);
    const t = now();
    const coordsChanged = input.latitude !== undefined;
    const set = { ...input, updatedAt: t, ...(coordsChanged ? { locationVerifiedAt: t } : {}) };
    tx.update(destinations).set(set).where(eq(destinations.id, id)).run();
    return { value: getDestinationOrThrow(tx, id), revision };
  });
}

/** Deletes a destination, its scheduled occurrences (cascade), and re-packs affected days. */
export function deleteDestination(db: DbOrTx, id: string, expectedRevision?: number): Mutation<null> {
  return db.transaction((tx) => {
    const current = getDestinationOrThrow(tx, id);
    const revision = touchTrip(tx, current.tripId, expectedRevision);
    const affectedDays = [
      ...new Set(
        tx
          .select({ dayId: itineraryItems.tripDayId })
          .from(itineraryItems)
          .where(eq(itineraryItems.destinationId, id))
          .all()
          .map((r) => r.dayId),
      ),
    ];
    tx.delete(destinations).where(eq(destinations.id, id)).run();
    for (const dayId of affectedDays) writePositions(tx, dayId, dayItemIds(tx, dayId));
    return { value: null, revision };
  });
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export function updateDay(
  db: DbOrTx,
  dayId: string,
  input: UpdateDayInput,
  expectedRevision?: number,
): Mutation<TripDay> {
  return db.transaction((tx) => {
    const day = getDayOrThrow(tx, dayId);
    const revision = touchTrip(tx, day.tripId, expectedRevision);
    tx.update(tripDays)
      .set({ ...input, updatedAt: now() })
      .where(eq(tripDays.id, dayId))
      .run();
    return { value: toDay(getDayOrThrow(tx, dayId)), revision };
  });
}

// ---------------------------------------------------------------------------
// Itinerary items
// ---------------------------------------------------------------------------

export function createItem(
  db: DbOrTx,
  dayId: string,
  input: CreateItemInput,
  expectedRevision?: number,
): Mutation<ItineraryItem> {
  return db.transaction((tx) => {
    const day = getDayOrThrow(tx, dayId);
    const dest = getDestinationOrThrow(tx, input.destinationId);
    // Same-trip invariant (database.md §4.5): enforced here, the single choke point.
    if (dest.tripId !== day.tripId) throw notFound("Destination", input.destinationId);
    const revision = touchTrip(tx, day.tripId, expectedRevision);
    const { destinationId, ...fields } = input;
    const id = insertItem(tx, dayId, destinationId, fields);
    return { value: toItem(getItemOrThrow(tx, id)), revision };
  });
}

export function updateItem(
  db: DbOrTx,
  id: string,
  input: UpdateItemInput,
  expectedRevision?: number,
): Mutation<ItineraryItem> {
  return db.transaction((tx) => {
    const item = getItemOrThrow(tx, id);
    const day = getDayOrThrow(tx, item.tripDayId);
    const revision = touchTrip(tx, day.tripId, expectedRevision);
    tx.update(itineraryItems)
      .set({ ...input, updatedAt: now() })
      .where(eq(itineraryItems.id, id))
      .run();
    return { value: toItem(getItemOrThrow(tx, id)), revision };
  });
}

/** Unschedules an occurrence; the destination stays in the trip's ideas list. */
export function deleteItem(db: DbOrTx, id: string, expectedRevision?: number): Mutation<null> {
  return db.transaction((tx) => {
    const item = getItemOrThrow(tx, id);
    const day = getDayOrThrow(tx, item.tripDayId);
    const revision = touchTrip(tx, day.tripId, expectedRevision);
    tx.delete(itineraryItems).where(eq(itineraryItems.id, id)).run();
    writePositions(tx, day.id, dayItemIds(tx, day.id));
    return { value: null, revision };
  });
}

/** Idempotent reorder: `itemIds` must be exactly the day's current items, in the new order. */
export function reorderDay(
  db: DbOrTx,
  dayId: string,
  itemIds: readonly string[],
  expectedRevision?: number,
): Mutation<ItineraryItem[]> {
  return db.transaction((tx) => {
    const day = getDayOrThrow(tx, dayId);
    const current = dayItemIds(tx, dayId);
    const same =
      current.length === itemIds.length &&
      new Set(itemIds).size === itemIds.length &&
      itemIds.every((i) => current.includes(i));
    if (!same) {
      throw new OrbiError("conflict", "itemIds must list exactly the day's current items", {
        currentItemIds: current,
      });
    }
    const revision = touchTrip(tx, day.tripId, expectedRevision);
    writePositions(tx, dayId, itemIds);
    return { value: listDayItems(tx, dayId), revision };
  });
}

/** Moves an item to another day (or another position on the same day). */
export function moveItem(
  db: DbOrTx,
  id: string,
  input: MoveItemInput,
  expectedRevision?: number,
): Mutation<ItineraryItem> {
  return db.transaction((tx) => {
    const item = getItemOrThrow(tx, id);
    const from = getDayOrThrow(tx, item.tripDayId);
    const to = getDayOrThrow(tx, input.toDayId);
    if (to.tripId !== from.tripId) throw notFound("Day", input.toDayId);
    const revision = touchTrip(tx, from.tripId, expectedRevision);

    const source = dayItemIds(tx, from.id).filter((i) => i !== id);
    const target = from.id === to.id ? source : dayItemIds(tx, to.id);
    if (from.id !== to.id && target.length >= LIMITS.maxItemsPerDay) {
      throw new OrbiError("validation", `A day can hold at most ${LIMITS.maxItemsPerDay} stops`);
    }
    target.splice(Math.min(input.toPosition, target.length), 0, id);

    if (from.id !== to.id) {
      // Park the moved item outside both days' position ranges before re-packing.
      tx.update(itineraryItems).set({ position: -100_000 }).where(eq(itineraryItems.id, id)).run();
      writePositions(tx, from.id, source);
    }
    writePositions(tx, to.id, target);
    return { value: toItem(getItemOrThrow(tx, id)), revision };
  });
}

function listDayItems(tx: DbOrTx, dayId: string): ItineraryItem[] {
  const ids = dayItemIds(tx, dayId);
  if (!ids.length) return [];
  const rows = tx.select().from(itineraryItems).where(inArray(itineraryItems.id, ids)).all();
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
export function getDayStops(db: DbOrTx, dayId: string): DayStops {
  const day = getDayOrThrow(db, dayId);
  const trip = db.select({ mode: trips.defaultTravelMode }).from(trips).where(eq(trips.id, day.tripId)).get();
  const rows = db
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
