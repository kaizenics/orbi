import { APICallError, NoObjectGeneratedError, Output, generateText, type LanguageModel } from "ai";
import type { ZodType } from "zod";
import {
  OrbiError,
  aiDraftOutputSchema,
  aiEditOutputSchema,
  type AiDraftOutput,
  type EditOperation,
  type LatLng,
  type PlaceCandidate,
  type ProposalPayload,
  type ProposedStop,
  type TripAggregate,
} from "@orbi/core";
import { draftPrompt, editPrompt, itinerarySnapshot } from "./prompts.ts";

/** Geocoder lookup injected by the API layer (cached + rate limited there). */
export type Geocode = (query: string, near: LatLng | undefined) => Promise<PlaceCandidate[]>;

export interface PipelineDeps {
  model: LanguageModel;
  geocode: Geocode;
}

/** AI suggestions farther than this from the trip area are treated as wrong matches. */
const MAX_DISTANCE_FROM_AREA_KM = 150;

/**
 * One structured-output call with a single repair retry that tells the model what was wrong.
 * Network/provider failures surface as provider_unavailable; two invalid answers as ai_output_invalid.
 */
async function structured<T>(
  model: LanguageModel,
  schema: ZodType<T>,
  system: string,
  prompt: string,
): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateText({
        model,
        system,
        prompt:
          attempt === 0
            ? prompt
            : `${prompt}\n\nYour previous answer was rejected: ${lastError}\nReturn corrected JSON only.`,
        output: Output.object({ schema }),
      });
      return result.output as T;
    } catch (error) {
      if (APICallError.isInstance(error) && (error.statusCode === 401 || error.statusCode === 403)) {
        throw new OrbiError(
          "provider_unavailable",
          "Your AI provider rejected the API key. Check it in Settings.",
        );
      }
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw new OrbiError(
          "provider_unavailable",
          `The AI service could not be reached: ${String(error).slice(0, 200)}`,
        );
      }
      lastError = String(error.cause ?? error.message).slice(0, 500);
    }
  }
  throw new OrbiError(
    "ai_output_invalid",
    "The AI returned an invalid answer twice. Try again or rephrase.",
    {
      reason: lastError,
    },
  );
}

const rad = (d: number) => (d * Math.PI) / 180;
function distanceKm(a: LatLng, b: LatLng) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

/** Where the trip happens: centroid of existing stops, else the geocoded region name. */
async function tripArea(data: TripAggregate, geocode: Geocode): Promise<LatLng | undefined> {
  if (data.destinations.length) {
    const n = data.destinations.length;
    return {
      lat: data.destinations.reduce((s, d) => s + d.latitude, 0) / n,
      lng: data.destinations.reduce((s, d) => s + d.longitude, 0) / n,
    };
  }
  if (!data.trip.regionName) return undefined;
  const [hit] = await geocode(data.trip.regionName, undefined);
  return hit ? { lat: hit.latitude, lng: hit.longitude } : undefined;
}

/** Resolves an AI-named place through the geocoder; null when nothing plausible is found. */
async function locate(
  stop: AiDraftOutput["days"][number]["stops"][number],
  key: string,
  area: LatLng | undefined,
  geocode: Geocode,
): Promise<ProposedStop> {
  const query = [stop.name, stop.localityHint].filter(Boolean).join(", ");
  const candidates = await geocode(query, area);
  const location =
    candidates.find(
      (c) => !area || distanceKm(area, { lat: c.latitude, lng: c.longitude }) <= MAX_DISTANCE_FROM_AREA_KM,
    ) ?? null;
  return {
    key,
    name: stop.name,
    category: stop.category,
    visitDurationMin: stop.visitDurationMin,
    estCostMinor: stop.estCost === null ? null : Math.round(stop.estCost * 100),
    why: stop.why,
    query,
    location,
  };
}

/** Natural-language request → reviewable draft for the trip's existing days. Writes nothing. */
export async function generateDraft(
  deps: PipelineDeps,
  data: TripAggregate,
  request: string,
): Promise<ProposalPayload> {
  const { system, prompt } = draftPrompt(data, request);
  const output = await structured(deps.model, aiDraftOutputSchema, system, prompt);
  const area = await tripArea(data, deps.geocode);

  const days = [];
  for (const [i, day] of output.days.slice(0, data.days.length).entries()) {
    const stops: ProposedStop[] = [];
    // Sequential on purpose: the geocoder is rate limited (1 req/s on public Nominatim).
    for (const [j, stop] of day.stops.entries())
      stops.push(await locate(stop, `d${i + 1}s${j + 1}`, area, deps.geocode));
    days.push({ dayId: data.days[i]!.id, title: day.title, stops });
  }
  return { kind: "draft", summary: output.summary, days };
}

/** Natural-language instruction → minimal edit operations on the existing itinerary. Writes nothing. */
export async function proposeEdit(
  deps: PipelineDeps,
  data: TripAggregate,
  instruction: string,
): Promise<ProposalPayload> {
  const snapshot = itinerarySnapshot(data);
  const { system, prompt } = editPrompt(data, snapshot.text, instruction);
  const output = await structured(deps.model, aiEditOutputSchema, system, prompt);
  const area = await tripArea(data, deps.geocode);

  const operations: EditOperation[] = [];
  const rejected: string[] = [];
  for (const [i, op] of output.operations.entries()) {
    const stop = "stop" in op ? snapshot.stopRefs.get(op.stop) : undefined;
    if (op.op === "move") {
      const toDayId = snapshot.dayRefs.get(op.toDay);
      if (stop && toDayId)
        operations.push({ op: "move", itemId: stop.itemId, toDayId, toPosition: op.position - 1 });
      else rejected.push(`Move of unknown stop/day (${op.stop} → ${op.toDay})`);
    } else if (op.op === "remove") {
      if (stop) operations.push({ op: "remove", itemId: stop.itemId });
      else rejected.push(`Removal of unknown stop ${op.stop}`);
    } else if (op.op === "update") {
      if (stop) {
        operations.push({
          op: "update",
          itemId: stop.itemId,
          destinationId: stop.destinationId,
          visitDurationMin: op.visitDurationMin,
          fixedStartTime: op.fixedStartTime,
          notes: op.notes,
        });
      } else rejected.push(`Update of unknown stop ${op.stop}`);
    } else {
      const dayId = snapshot.dayRefs.get(op.day);
      if (!dayId) rejected.push(`Addition to unknown day ${op.day}`);
      else {
        const proposed = await locate(op.place, `op${i + 1}`, area, deps.geocode);
        operations.push({ op: "add", dayId, toPosition: op.position - 1, stop: proposed });
      }
    }
  }
  return { kind: "edit", summary: output.summary, operations, rejected };
}
