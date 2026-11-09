import { and, eq } from "drizzle-orm";
import {
  OrbiError,
  newId,
  notFound,
  proposalPayloadSchema,
  type Proposal,
  type ProposalPayload,
  type ProposedStop,
} from "@orbi/core";
import type { Db, DbOrTx } from "../client.ts";
import { aiProposals, destinations, trips } from "../schema.ts";
import { deleteItem, insertItem, moveItem, updateDestination, updateItem } from "./itinerary.ts";
import { now, touchTrip } from "./shared.ts";

function toProposal(row: typeof aiProposals.$inferSelect): Proposal {
  return {
    id: row.id,
    tripId: row.tripId!,
    status: row.status,
    baseRevision: row.baseRevision ?? 0,
    payload: proposalPayloadSchema.parse(row.payload),
    createdAt: row.createdAt,
  };
}

/** Stores an AI proposal against the trip's current revision. Nothing in the itinerary changes. */
export function createProposal(db: Db, tripId: string, payload: ProposalPayload): Proposal {
  const trip = db.select({ revision: trips.revision }).from(trips).where(eq(trips.id, tripId)).get();
  if (!trip) throw notFound("Trip", tripId);
  const row = {
    id: newId(),
    tripId,
    kind: payload.kind,
    payload,
    baseRevision: trip.revision,
    status: "pending" as const,
    createdAt: now(),
    conversationId: null,
    resolvedAt: null,
  };
  db.insert(aiProposals).values(row).run();
  return toProposal(row);
}

export function getProposal(db: DbOrTx, id: string): Proposal {
  const row = db.select().from(aiProposals).where(eq(aiProposals.id, id)).get();
  if (!row) throw notFound("Proposal", id);
  return toProposal(row);
}

export function discardProposal(db: Db, id: string): Proposal {
  const proposal = getProposal(db, id);
  if (proposal.status !== "pending")
    throw new OrbiError("conflict", `Proposal is already ${proposal.status}`);
  db.update(aiProposals).set({ status: "discarded", resolvedAt: now() }).where(eq(aiProposals.id, id)).run();
  return { ...proposal, status: "discarded" };
}

/** Creates (or reuses, by provider reference) the trip destination for an AI-proposed stop. */
function destinationFor(tx: DbOrTx, tripId: string, stop: ProposedStop): string {
  const loc = stop.location;
  if (!loc)
    throw new OrbiError("validation", `"${stop.name}" has no verified location; remove it before applying`);
  if (loc.sourceRef) {
    const existing = tx
      .select({ id: destinations.id })
      .from(destinations)
      .where(and(eq(destinations.tripId, tripId), eq(destinations.sourceRef, loc.sourceRef)))
      .get();
    if (existing) return existing.id;
  }
  const t = now();
  const id = newId();
  tx.insert(destinations)
    .values({
      id,
      tripId,
      name: stop.name,
      description: stop.why || null,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      category: stop.category,
      visitDurationMin: stop.visitDurationMin,
      estCostMinor: stop.estCostMinor,
      costSource: stop.estCostMinor === null ? null : "ai_estimate",
      locationSource: loc.source,
      sourceRef: loc.sourceRef,
      locationVerifiedAt: t,
      origin: "ai",
      createdAt: t,
      updatedAt: t,
    })
    .run();
  return id;
}

/**
 * Applies a pending proposal in ONE transaction (all or nothing). `exclude` lists draft stop keys
 * or edit operation indexes the user unticked. Fails with 409 if the trip changed since the
 * proposal was made, marking the proposal stale.
 */
export function applyProposal(db: Db, id: string, exclude: readonly string[]): Proposal {
  const proposal = getProposal(db, id);
  if (proposal.status !== "pending")
    throw new OrbiError("conflict", `Proposal is already ${proposal.status}`);
  const skip = new Set(exclude);

  const stale = db.transaction((tx) => {
    const trip = tx
      .select({ revision: trips.revision })
      .from(trips)
      .where(eq(trips.id, proposal.tripId))
      .get();
    if (!trip) throw notFound("Trip", proposal.tripId);
    if (trip.revision !== proposal.baseRevision) {
      tx.update(aiProposals).set({ status: "stale", resolvedAt: now() }).where(eq(aiProposals.id, id)).run();
      return true;
    }

    const { payload } = proposal;
    let applied = 0;
    let total = 0;
    if (payload.kind === "draft") {
      for (const day of payload.days) {
        for (const stop of day.stops) {
          total++;
          if (skip.has(stop.key)) continue;
          insertItem(tx, day.dayId, destinationFor(tx, proposal.tripId, stop), {});
          applied++;
        }
      }
    } else {
      payload.operations.forEach((op, i) => {
        total++;
        if (skip.has(String(i))) return;
        if (op.op === "move") moveItem(tx, op.itemId, { toDayId: op.toDayId, toPosition: op.toPosition });
        else if (op.op === "remove") deleteItem(tx, op.itemId);
        else if (op.op === "add") {
          insertItem(tx, op.dayId, destinationFor(tx, proposal.tripId, op.stop), { position: op.toPosition });
        } else {
          updateItem(tx, op.itemId, { fixedStartTime: op.fixedStartTime, notes: op.notes });
          if (op.visitDurationMin !== null)
            updateDestination(tx, op.destinationId, { visitDurationMin: op.visitDurationMin });
        }
        applied++;
      });
    }
    if (applied === 0) throw new OrbiError("validation", "Nothing selected to apply");

    touchTrip(tx, proposal.tripId);
    tx.update(aiProposals)
      .set({ status: applied === total ? "applied" : "partially_applied", resolvedAt: now() })
      .where(eq(aiProposals.id, id))
      .run();
    return false;
  });

  if (stale) {
    throw new OrbiError("conflict", "The trip changed after this proposal was made; generate a new one", {
      proposalStatus: "stale",
    });
  }
  return getProposal(db, id);
}
