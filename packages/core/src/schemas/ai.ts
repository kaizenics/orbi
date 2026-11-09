import { z } from "zod";
import { idSchema, localTimeSchema, moneyMinorSchema, timestampSchema } from "./common.ts";
import { placeCandidateSchema } from "./geo.ts";
import { destinationCategorySchema } from "./trip.ts";
import { AI_PROVIDERS, LIMITS } from "../constants.ts";

// ---------------------------------------------------------------------------
// What the model may return. Deliberately has NO coordinate fields: locations are
// always resolved by the geocoder on the server (tested in ai.test.ts).
// ---------------------------------------------------------------------------

const aiStopSchema = z.object({
  name: z.string().min(1).max(120).describe("Official name of a real, visitable place"),
  localityHint: z.string().max(120).describe("City/area to disambiguate the place, e.g. 'Cebu City'"),
  category: destinationCategorySchema,
  visitDurationMin: z.int().min(10).max(600).describe("Typical visit length in minutes"),
  estCost: z
    .number()
    .min(0)
    .nullable()
    .describe("Estimated cost per person in the trip currency (major units), or null"),
  why: z.string().max(240).describe("One sentence on why it fits the request"),
});

export const aiDraftOutputSchema = z.object({
  summary: z.string().max(400),
  days: z
    .array(z.object({ title: z.string().max(120), stops: z.array(aiStopSchema).min(1).max(8) }))
    .min(1)
    .max(LIMITS.maxTripDays),
});
export type AiDraftOutput = z.infer<typeof aiDraftOutputSchema>;

/** Edit operations as the model writes them, referring to stops ("s3") and days ("d2") by short refs. */
export const aiEditOutputSchema = z.object({
  summary: z.string().max(400),
  operations: z
    .array(
      z.discriminatedUnion("op", [
        z.object({ op: z.literal("move"), stop: z.string(), toDay: z.string(), position: z.int().min(1) }),
        z.object({ op: z.literal("remove"), stop: z.string() }),
        z.object({
          op: z.literal("add"),
          day: z.string(),
          position: z.int().min(1),
          place: aiStopSchema,
        }),
        z.object({
          op: z.literal("update"),
          stop: z.string(),
          visitDurationMin: z.int().min(10).max(600).nullable(),
          fixedStartTime: localTimeSchema.nullable(),
          notes: z.string().max(240).nullable(),
        }),
      ]),
    )
    .max(30),
});
export type AiEditOutput = z.infer<typeof aiEditOutputSchema>;

// ---------------------------------------------------------------------------
// Proposals: validated, geocoded, reviewable by the user before anything is saved.
// ---------------------------------------------------------------------------

export const proposedStopSchema = z.object({
  /** Stable key within the proposal, used to exclude stops when applying. */
  key: z.string(),
  name: z.string(),
  category: destinationCategorySchema,
  visitDurationMin: z.int(),
  estCostMinor: moneyMinorSchema.nullable(),
  why: z.string(),
  /** What was sent to the geocoder. */
  query: z.string(),
  /** Provider result, or null = "needs location" (cannot be applied). */
  location: placeCandidateSchema.nullable(),
});
export type ProposedStop = z.infer<typeof proposedStopSchema>;

export const editOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("move"), itemId: idSchema, toDayId: idSchema, toPosition: z.int().nonnegative() }),
  z.object({ op: z.literal("remove"), itemId: idSchema }),
  z.object({
    op: z.literal("add"),
    dayId: idSchema,
    toPosition: z.int().nonnegative(),
    stop: proposedStopSchema,
  }),
  z.object({
    op: z.literal("update"),
    itemId: idSchema,
    destinationId: idSchema,
    visitDurationMin: z.int().nullable(),
    fixedStartTime: localTimeSchema.nullable(),
    notes: z.string().nullable(),
  }),
]);
export type EditOperation = z.infer<typeof editOperationSchema>;

export const proposalPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("draft"),
    summary: z.string(),
    days: z.array(z.object({ dayId: idSchema, title: z.string(), stops: z.array(proposedStopSchema) })),
  }),
  z.object({
    kind: z.literal("edit"),
    summary: z.string(),
    operations: z.array(editOperationSchema),
    /** Model operations that referred to unknown stops/days; shown to the user, never applied. */
    rejected: z.array(z.string()),
  }),
]);
export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;

export const proposalSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  status: z.enum(["pending", "applied", "partially_applied", "discarded", "stale"]),
  baseRevision: z.int(),
  payload: proposalPayloadSchema,
  createdAt: timestampSchema,
});
export type Proposal = z.infer<typeof proposalSchema>;

// ---------------------------------------------------------------------------
// Bring your own key: the user's AI connection lives in their browser and is sent with each AI
// request. The server uses it for that request only; it is never stored or logged.
// ---------------------------------------------------------------------------

export const aiProviderSchema = z.enum(AI_PROVIDERS);

export const aiConnectionSchema = z.object({
  provider: aiProviderSchema,
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().min(10).max(500),
});
export type AiConnection = z.infer<typeof aiConnectionSchema>;

export const aiDraftRequestSchema = z.object({
  prompt: z.string().trim().min(5).max(2000),
  ai: aiConnectionSchema,
});
export const aiEditRequestSchema = z.object({
  instruction: z.string().trim().min(3).max(1000),
  ai: aiConnectionSchema,
});
export const applyProposalRequestSchema = z.object({
  /** Draft stop keys or edit operation indexes (as strings) the user unticked. */
  exclude: z.array(z.string()).max(500).default([]),
});
