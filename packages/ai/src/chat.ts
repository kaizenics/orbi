import { APICallError, stepCountIs, streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import {
  ACTIVITY_TYPES,
  DESTINATION_CATEGORIES,
  LIMITS,
  aiDraftOutputSchema,
  isoDateSchema,
} from "@orbi/core";
import { DETAILED_DAY } from "./prompts.ts";

/** What the model passes to create_trip: the traveller's itinerary, structured. No coordinates. */
export const chatTripSchema = z.object({
  name: z.string().min(1).max(120).describe("Short trip name, e.g. 'Kyoto in autumn'"),
  regionName: z.string().max(200).nullable().describe("City/region/country of the trip"),
  startDate: isoDateSchema.nullable().describe("YYYY-MM-DD if the traveller gave dates, else null"),
  summary: aiDraftOutputSchema.shape.summary,
  days: aiDraftOutputSchema.shape.days.max(LIMITS.maxTripDays),
});
export type ChatTrip = z.infer<typeof chatTripSchema>;

/**
 * What the model is asked to send: deliberately forgiving (no length or range limits). Long pasted
 * itineraries often break strict limits by a little (a 5-minute wake up, a long summary), and
 * rejecting the whole trip for that is worse than tidying it up, so `normalizeChatTrip` clamps
 * and trims before the strict `chatTripSchema` check.
 */
const looseStop = z.object({
  name: z.string().describe("Place name, or a short label for an activity"),
  localityHint: z.string().optional().describe("City/area, e.g. 'Cebu City'; empty for activities"),
  category: z
    .string()
    .optional()
    .describe(`One of: ${DESTINATION_CATEGORIES.join(", ")}`),
  visitDurationMin: z.number().optional().describe("Minutes spent here"),
  estCost: z.number().nullable().optional().describe("Rough cost per person, or null"),
  why: z.string().optional().describe("Short note, e.g. 'From your list'"),
  activity: z
    .string()
    .nullish()
    .describe(`null for a real place; else one of: ${ACTIVITY_TYPES.join(", ")}`),
});
const looseTrip = z.object({
  name: z.string().describe("Short trip name, e.g. 'Kyoto in autumn'"),
  regionName: z.string().nullish().describe("City/region/country"),
  startDate: z.string().nullish().describe("YYYY-MM-DD if the traveller gave dates, else null"),
  summary: z.string().optional().describe("One short sentence"),
  days: z.array(z.object({ title: z.string().optional(), stops: z.array(looseStop) })),
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  list.find(
    (x) =>
      x ===
      (typeof v === "string"
        ? v
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_")
        : ""),
  ) ?? null;

/** Turns the model's loose itinerary into a valid ChatTrip, or null when there is nothing usable. */
export function normalizeChatTrip(input: unknown): ChatTrip | null {
  const loose = looseTrip.safeParse(input);
  if (!loose.success) return null;
  const t = loose.data;
  const days = t.days
    .slice(0, LIMITS.maxTripDays)
    .map((d, i) => ({
      title: text(d.title, 120) || `Day ${i + 1}`,
      stops: d.stops
        .filter((s) => text(s.name, 1))
        .slice(0, LIMITS.maxItemsPerDay)
        .map((s) => {
          const activity = oneOf(ACTIVITY_TYPES, s.activity);
          const minutes = Math.round(Number(s.visitDurationMin));
          return {
            name: text(s.name, 120),
            localityHint: activity ? "" : text(s.localityHint, 120),
            category: oneOf(DESTINATION_CATEGORIES, s.category) ?? "other",
            visitDurationMin: Number.isFinite(minutes) ? Math.min(600, Math.max(5, minutes)) : 60,
            estCost: typeof s.estCost === "number" && s.estCost >= 0 ? s.estCost : null,
            why: text(s.why, 240),
            activity,
          };
        }),
    }))
    .filter((d) => d.stops.length > 0);
  const date = isoDateSchema.safeParse(t.startDate);
  const result = chatTripSchema.safeParse({
    name: text(t.name, 120) || "My trip",
    regionName: text(t.regionName, 200) || null,
    startDate: date.success ? date.data : null,
    summary: text(t.summary, 400),
    days,
  });
  return result.success ? result.data : null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Events the chat stream emits; the API turns them into the HTTP response. */
export type ChatEvent =
  { type: "text"; text: string } | { type: "trip"; trip: ChatTrip } | { type: "error"; message: string };

/** Only the latest messages are sent to the model: older context costs tokens and rarely helps. */
const HISTORY = 6;
/** Room for a long pasted itinerary as a tool call; normal answers are told to stay short. */
const MAX_OUTPUT_TOKENS = 3000;

const SYSTEM = `You are ORBI, a friendly travel assistant inside a trip-planning app.
Scope: travel only (destinations, itineraries, sights, food, transport, budgets, packing, safety, culture). Politely decline anything else in one sentence, including programming/code, maths homework, politics and adult content. Never write code. Keep language clean.
Be brief: at most 120 words, plain sentences or short bullet lists, no filler.
If the user pastes or describes a day-by-day itinerary, or asks you to create/build a trip, call create_trip once with every day and stop in order (real, official place names; never coordinates). Keep every activity the user listed (wake up, meals, rests...) and fill obvious gaps. Do not repeat the itinerary in text.
${DETAILED_DAY}`;

const CODE_HINTS =
  /```|\b(write|generate|fix|debug|refactor)\b[^.?!]{0,40}\b(code|script|function|program|regex|sql|html|css|api)\b|\b(python|javascript|typescript|java|c\+\+|c#|golang|rust|php|bash|powershell)\b|console\.log|def \w+\(|function \w*\(|<\/?[a-z]+>/i;
// shortcut: a small English list; the system prompt is the main guard. Extend if abuse appears.
const PROFANITY =
  /\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|cunt\w*|motherfuck\w*|dick(head)?s?|bastard\w*|slut\w*|whore\w*)\b/i;

/**
 * Cheap pre-check before any tokens are spent. Returns a reply to send instead of calling the
 * model, or null when the message may go to the model.
 */
export function screenMessage(text: string): string | null {
  if (CODE_HINTS.test(text))
    return "I can only help with travel — trips, places to visit, food, transport and budgets. I can't help with code.";
  if (PROFANITY.test(text))
    return "Let's keep it friendly. Ask me anything about your travels — where to go, what to see or how to plan your days.";
  return null;
}

/**
 * Streams the assistant's answer. A create_trip call arrives as a `trip` event; the API layer
 * (which owns the database) creates the trip and reports it — no second model call.
 */
export async function* travelChat(
  model: LanguageModel,
  messages: ChatMessage[],
  abortSignal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const last = messages.at(-1);
  const refusal = last?.role === "user" ? screenMessage(last.content) : null;
  if (refusal) {
    yield { type: "text", text: refusal };
    return;
  }

  const result = streamText({
    model,
    system: SYSTEM,
    messages: messages.slice(-HISTORY),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.4,
    abortSignal,
    tools: {
      create_trip: tool({
        description: "Create a trip in ORBI from an itinerary the traveller pasted or asked for.",
        inputSchema: looseTrip,
      }),
    },
    // One model step only: the tool is executed by the API, which then reports the result itself.
    stopWhen: stepCountIs(1),
  });

  try {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") yield { type: "text", text: part.text };
      else if (part.type === "tool-call" && part.toolName === "create_trip") {
        const trip = normalizeChatTrip(part.input);
        if (trip) yield { type: "trip", trip };
        else yield { type: "error", message: "I couldn't read that itinerary. Try listing it day by day." };
      } else if (part.type === "error") throw part.error;
    }
  } catch (error) {
    yield {
      type: "error",
      message:
        APICallError.isInstance(error) && (error.statusCode === 401 || error.statusCode === 403)
          ? "Your AI provider rejected the API key. Check it in Settings → Integrations."
          : "The AI service could not be reached. Try again in a moment.",
    };
  }
}
