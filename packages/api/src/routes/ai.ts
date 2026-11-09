import { Hono } from "hono";
import { z } from "zod";
import { aiDraftRequestSchema, aiEditRequestSchema, applyProposalRequestSchema, idSchema } from "@orbi/core";
import { generateDraft, proposeEdit, type AiConfig, type AiModel, type Geocode } from "@orbi/ai";
import {
  applyProposal,
  createProposal,
  discardProposal,
  getProposal,
  getTripAggregate,
  type Db,
} from "@orbi/db";
import type { Geocoder } from "@orbi/geo";
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

  return new Hono()
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
