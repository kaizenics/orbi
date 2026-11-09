import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import {
  addDays,
  aiChatRequestSchema,
  aiModelsRequestSchema,
  aiDraftRequestSchema,
  aiEditRequestSchema,
  applyProposalRequestSchema,
  idSchema,
} from "@orbi/core";
import {
  generateDraft,
  listCheapModels,
  locateItinerary,
  proposeEdit,
  travelChat,
  type AiConfig,
  type AiModel,
  type ChatTrip,
  type Geocode,
} from "@orbi/ai";
import {
  applyProposal,
  createProposal,
  createTrip,
  discardProposal,
  getProposal,
  getTripAggregate,
  listTrips,
  type Db,
} from "@orbi/db";
import type { Geocoder } from "@orbi/geo";
import { ownerOf } from "../http/owner.ts";
import { validate } from "../http/validate.ts";
import { searchPlaces } from "../services/places.ts";

export interface AiRouteDeps {
  db: Db;
  /** Injected for tests; defaults to the real provider SDKs. */
  createModel: (config: AiConfig) => AiModel;
  geocoder: Geocoder;
  cacheTtlMs: number;
  log?: (message: string) => void;
}

const tripParam = validate("param", z.object({ tripId: idSchema }));
const idParam = validate("param", z.object({ id: idSchema }));

/**
 * AI requests carry the caller's own provider, model and API key (bring your own key). The key is
 * used to build a model for this one request and is neither stored nor logged.
 */
export function aiRoutes(deps: AiRouteDeps) {
  const geocode: Geocode = (q, near) =>
    searchPlaces({ db: deps.db, geocoder: deps.geocoder, cacheTtlMs: deps.cacheTtlMs, log: deps.log }, q, {
      near,
      limit: 5,
    });

  /** Creates a trip from a chat itinerary: new trip, geocoded stops, everything found is added. */
  async function createTripFromChat(owner: string, input: ChatTrip) {
    const dayCount = input.days.length;
    const trip = await createTrip(
      deps.db,
      {
        name: input.name,
        regionName: input.regionName,
        ...(input.startDate
          ? { startDate: input.startDate, endDate: addDays(input.startDate, dayCount - 1) }
          : { dayCount }),
      },
      owner,
    );
    const located = await locateItinerary(input.days, input.regionName, geocode);
    const proposal = await createProposal(deps.db, trip.trip.id, {
      kind: "draft",
      summary: input.summary,
      days: located.map((d, i) => ({ dayId: trip.days[i]!.id, title: d.title, stops: d.stops })),
    });
    const stops = located.flatMap((d) => d.stops);
    const missing = stops.filter((s) => !s.activityType && !s.location);
    // Places the geocoder could not find are left out; the user can add them by search.
    if (missing.length < stops.length) {
      await applyProposal(
        deps.db,
        proposal.id,
        missing.map((s) => s.key),
      );
    }
    return {
      id: trip.trip.id,
      name: trip.trip.name,
      added: stops.length - missing.length,
      missing: missing.map((s) => s.name),
    };
  }

  /**
   * Applies a chat edit to one of the caller's trips: the existing edit pipeline proposes the
   * operations, and everything that can be applied is applied (the user asked for it in the chat).
   */
  async function editTripFromChat(model: AiModel["model"], tripId: string, instruction: string) {
    const trip = await getTripAggregate(deps.db, tripId);
    const payload = await proposeEdit({ model, geocode }, trip, instruction);
    if (payload.kind !== "edit" || payload.operations.length === 0) {
      return { id: tripId, name: trip.trip.name, summary: payload.summary, applied: 0 };
    }
    const proposal = await createProposal(deps.db, tripId, payload);
    // New places the geocoder could not find cannot be added.
    const skip = payload.operations.flatMap((op, i) =>
      op.op === "add" && !op.stop.location ? [String(i)] : [],
    );
    if (skip.length < payload.operations.length) await applyProposal(deps.db, proposal.id, skip);
    return {
      id: tripId,
      name: trip.trip.name,
      summary: payload.summary,
      applied: payload.operations.length - skip.length,
    };
  }

  return new Hono()
    .post("/ai/models", validate("json", aiModelsRequestSchema), async (c) => {
      const { provider, apiKey } = c.req.valid("json");
      return c.json(await listCheapModels(provider, apiKey));
    })
    .post("/ai/chat", validate("json", aiChatRequestSchema), async (c) => {
      const { messages, ai, tripId } = c.req.valid("json");
      const owner = ownerOf(c);
      const model = deps.createModel(ai).model;
      // Only the caller's own trips are offered, and edits can only target them.
      const trips = await listTrips(deps.db, owner);
      const current = trips.find((t) => t.id === tripId);
      const findTrip = (name: string) => {
        const n = name.trim().toLowerCase();
        return (
          trips.find((t) => t.name.toLowerCase() === n) ??
          (n
            ? trips.find((t) => t.name.toLowerCase().includes(n) || n.includes(t.name.toLowerCase()))
            : undefined) ??
          current
        );
      };
      c.header("Content-Type", "application/x-ndjson; charset=utf-8");
      c.header("Cache-Control", "no-store");
      // One JSON object per line: {"text"} chunks while the model writes, then {"trip"} or {"error"}.
      return stream(c, async (out) => {
        const send = (event: object) =>
          out.write(`${JSON.stringify(event)}
`);
        const context = { tripNames: trips.slice(0, 50).map((t) => t.name), currentTrip: current?.name };
        for await (const event of travelChat(model, messages, c.req.raw.signal, context)) {
          if (event.type === "text") await send({ text: event.text });
          else if (event.type === "error") await send({ error: event.message });
          else if (event.type === "edit") {
            const target = findTrip(event.trip);
            if (!target) {
              await send({ error: "I couldn't tell which trip to change. Open it, or say its name." });
              continue;
            }
            await send({ status: `Updating ${target.name}…` });
            try {
              await send({ edited: await editTripFromChat(model, target.id, event.instruction) });
            } catch (error) {
              deps.log?.(`chat trip edit failed: ${String(error)}`);
              await send({ error: error instanceof Error ? error.message : "I couldn't change that trip." });
            }
          } else {
            await send({ status: "Creating your trip and finding each place on the map…" });
            try {
              await send({ trip: await createTripFromChat(owner, event.trip) });
            } catch (error) {
              deps.log?.(`chat trip creation failed: ${String(error)}`);
              await send({ error: "I couldn't create that trip. Try again or shorten the itinerary." });
            }
          }
        }
      });
    })
    .post("/trips/:tripId/ai/drafts", tripParam, validate("json", aiDraftRequestSchema), async (c) => {
      const { tripId } = c.req.valid("param");
      const { prompt, ai } = c.req.valid("json");
      const trip = await getTripAggregate(deps.db, tripId);
      const payload = await generateDraft({ model: deps.createModel(ai).model, geocode }, trip, prompt);
      return c.json(await createProposal(deps.db, tripId, payload), 201);
    })
    .post("/trips/:tripId/ai/edits", tripParam, validate("json", aiEditRequestSchema), async (c) => {
      const { tripId } = c.req.valid("param");
      const { instruction, ai } = c.req.valid("json");
      const trip = await getTripAggregate(deps.db, tripId);
      const payload = await proposeEdit({ model: deps.createModel(ai).model, geocode }, trip, instruction);
      return c.json(await createProposal(deps.db, tripId, payload), 201);
    })
    .get("/proposals/:id", idParam, async (c) => c.json(await getProposal(deps.db, c.req.valid("param").id)))
    .post("/proposals/:id/apply", idParam, validate("json", applyProposalRequestSchema), async (c) =>
      c.json(await applyProposal(deps.db, c.req.valid("param").id, c.req.valid("json").exclude)),
    )
    .delete("/proposals/:id", idParam, async (c) =>
      c.json(await discardProposal(deps.db, c.req.valid("param").id)),
    );
}
