import type { TripAggregate } from "@orbi/core";

/** Bump when prompt wording changes, so proposals can be traced to a prompt version. */
export const PROMPT_VERSION = "2026-11-10.1";

const RULES = `Rules:
- Suggest only real, existing, publicly visitable places that you are confident exist. Use their official names.
- Never output coordinates or addresses; locations are looked up separately.
- Keep each day geographically compact so travel time stays low.
- Costs are rough per-person estimates in the trip currency (major units); use null when unsure. Do not claim prices or opening hours are verified.
- Answer with JSON only, matching the requested schema.`;

/** How a full, realistic day is laid out (shared by drafts and the chat). */
export const DETAILED_DAY = `Plan complete days in time order, like a real travel itinerary:
- Start with wake up and breakfast, end with dinner and returning to the hotel. Include lunch, and short rests or free time when the pace is relaxed.
- A meal or stay at a specific, named restaurant, cafe, market or hotel is a real place (activity: null, category food or lodging) so it appears on the map. A generic moment (wake up, breakfast at the hotel, rest, free time, getting ready, transfer) is an activity: set activity, use a short label as name, leave localityHint empty, and give a realistic duration.
- Travel between places is calculated by the app; do not add separate travel entries except a transfer that takes its own time (e.g. airport check-in).`;

function tripContext(data: TripAggregate): string {
  const { trip, preferences: p } = data;
  return [
    `Trip: ${trip.name}`,
    trip.regionName ? `Region: ${trip.regionName}` : null,
    `Days: ${data.days.length}${trip.startDate ? ` (${trip.startDate} to ${trip.endDate})` : ""}`,
    `Currency: ${trip.currency}`,
    trip.budgetMinor !== null ? `Total budget: ${trip.budgetMinor / 100} ${trip.currency}` : null,
    `Pace: ${p.pace}; day from ${p.dayStartTime} to ${p.dayEndTime}`,
    p.interests.length ? `Interests: ${p.interests.join(", ")}` : null,
    p.notes ? `Traveller notes: ${p.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function draftPrompt(data: TripAggregate, request: string) {
  return {
    system: `You are a careful travel planner. Plan exactly ${data.days.length} day(s). Each day has 3 to 7 real places depending on pace, plus activities, in a sensible visiting order.\n${DETAILED_DAY}\n${RULES}`,
    prompt: `${tripContext(data)}\n\nRequest from the traveller:\n${request}`,
  };
}

/** Itinerary snapshot with short refs (d1, s1…) that small models copy reliably. */
export function itinerarySnapshot(data: TripAggregate) {
  const names = new Map(data.destinations.map((d) => [d.id, d]));
  const stopRefs = new Map<string, { itemId: string; destinationId: string | null }>();
  const dayRefs = new Map<string, string>();
  const lines: string[] = [];
  let n = 0;
  data.days.forEach((day, i) => {
    dayRefs.set(`d${i + 1}`, day.id);
    lines.push(
      `d${i + 1}: Day ${i + 1}${day.title ? ` "${day.title}"` : ""}${day.date ? ` (${day.date})` : ""}`,
    );
    day.items.forEach((item) => {
      if (item.activityType) {
        const ref = `s${++n}`;
        stopRefs.set(ref, { itemId: item.id, destinationId: null });
        lines.push(
          `  ${ref}: ${item.title} [activity: ${item.activityType}, ${item.durationOverrideMin ?? 30} min]`,
        );
        return;
      }
      const dest = item.destinationId ? names.get(item.destinationId) : undefined;
      if (!dest) return;
      const ref = `s${++n}`;
      stopRefs.set(ref, { itemId: item.id, destinationId: dest.id });
      lines.push(
        `  ${ref}: ${dest.name} [${dest.category}, ${item.durationOverrideMin ?? dest.visitDurationMin} min${
          item.fixedStartTime ? `, fixed ${item.fixedStartTime}` : ""
        }]`,
      );
    });
  });
  return { text: lines.join("\n"), stopRefs, dayRefs };
}

export function editPrompt(data: TripAggregate, snapshotText: string, instruction: string) {
  return {
    system: `You edit an existing travel itinerary. Return the smallest list of operations that fulfils the instruction; do not rebuild the itinerary. Refer to existing days and stops only by their refs (d1, s3, ...). Positions are 1-based within the target day.\n${RULES}`,
    prompt: `${tripContext(data)}\n\nCurrent itinerary:\n${snapshotText}\n\nInstruction:\n${instruction}`,
  };
}
