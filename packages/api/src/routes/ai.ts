import { Hono } from "hono";
import { z } from "zod";
import {
  OrbiError,
  aiDraftRequestSchema,
  aiEditRequestSchema,
  applyProposalRequestSchema,
  idSchema,
} from "@orbi/core";
import { generateDraft, proposeEdit, type AiModel, type Geocode } from "@orbi/ai";
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
  ai: AiModel | null;
  geocoder: Geocoder;
  cacheTtlMs: number;
  log?: (message: string) => void;
}

const tripParam = validate("param", z.object({ tripId: idSchema }));
const idParam = validate("param", z.object({ id: idSchema }));

export function aiRoutes(deps: AiRouteDeps) {
  const geocode: Geocode = (q, near) =>
    searchPlaces({ db: deps.db, geocoder: deps.geocoder, cacheTtlMs: deps.cacheTtlMs, log: deps.log }, q, {
      near,
      limit: 5,
    });
  const pipeline = () => {
    if (!deps.ai) {
      throw new OrbiError(
        "provider_unavailable",
        "AI is not configured on this server (set AI_PROVIDER and AI_MODEL)",
      );
    }
    return { model: deps.ai.model, geocode };
  };

  return new Hono()
    .post("/trips/:tripId/ai/drafts", tripParam, validate("json", aiDraftRequestSchema), async (c) => {
      const { tripId } = c.req.valid("param");
      const payload = await generateDraft(
        pipeline(),
        await getTripAggregate(deps.db, tripId),
        c.req.valid("json").prompt,
      );
      return c.json(await createProposal(deps.db, tripId, payload), 201);
    })
    .post("/trips/:tripId/ai/edits", tripParam, validate("json", aiEditRequestSchema), async (c) => {
      const { tripId } = c.req.valid("param");
      const payload = await proposeEdit(
        pipeline(),
        await getTripAggregate(deps.db, tripId),
        c.req.valid("json").instruction,
      );
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
