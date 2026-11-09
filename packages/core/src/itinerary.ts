import type { TripAggregate } from "./schemas/trip.ts";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** Minutes since midnight → "HH:MM"; times past midnight get a " +1" day suffix. */
export function formatClock(min: number): string {
  const day = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return day > 0 ? `${hhmm} +${day}` : hhmm;
}

export interface ScheduleStopInput {
  itemId: string;
  durationMin: number;
  fixedStartTime: string | null;
}

export interface ScheduleInput {
  startTime: string;
  endTime: string;
  maxTravelMin: number | null;
  stops: readonly ScheduleStopInput[];
  /** Travel seconds from stop i to i+1; null when unknown (leg not routed or still loading). */
  legSeconds: readonly (number | null)[];
}

export type ScheduleWarning =
  | { code: "fixed_time_missed"; itemId: string; lateMin: number }
  | { code: "past_day_end"; overMin: number }
  | { code: "too_much_travel"; overMin: number };

export interface ScheduledStop {
  itemId: string;
  /** Minutes since midnight, or null when an unknown travel time precedes this stop. */
  arrival: number | null;
  departure: number | null;
}

export interface DaySchedule {
  stops: ScheduledStop[];
  travelMin: number;
  visitMin: number;
  /** True when some leg's travel time is unknown, so travelMin is a lower bound. */
  travelIncomplete: boolean;
  warnings: ScheduleWarning[];
}

/**
 * Derives arrival/departure times for a day. Never invents numbers: after a leg with unknown
 * travel time, times stay null until a stop with a fixed start time re-anchors the clock.
 */
export function computeDaySchedule(input: ScheduleInput): DaySchedule {
  const warnings: ScheduleWarning[] = [];
  const stops: ScheduledStop[] = [];
  let travelMin = 0;
  let travelIncomplete = false;
  let prevDeparture: number | null = null;

  input.stops.forEach((stop, i) => {
    let reached: number | null;
    if (i === 0) reached = toMin(input.startTime);
    else {
      const leg = input.legSeconds[i - 1] ?? null;
      if (leg === null) travelIncomplete = true;
      else travelMin += Math.round(leg / 60);
      reached = prevDeparture !== null && leg !== null ? prevDeparture + Math.round(leg / 60) : null;
    }

    let arrival = reached;
    if (stop.fixedStartTime) {
      const fixed = toMin(stop.fixedStartTime);
      if (reached !== null && reached > fixed) {
        warnings.push({ code: "fixed_time_missed", itemId: stop.itemId, lateMin: reached - fixed });
      } else arrival = fixed; // wait until the fixed time (or re-anchor after an unknown leg)
    }
    const departure = arrival === null ? null : arrival + stop.durationMin;
    stops.push({ itemId: stop.itemId, arrival, departure });
    prevDeparture = departure;
  });

  const end = stops.at(-1)?.departure;
  if (end != null && end > toMin(input.endTime)) {
    warnings.push({ code: "past_day_end", overMin: end - toMin(input.endTime) });
  }
  if (input.maxTravelMin !== null && travelMin > input.maxTravelMin) {
    warnings.push({ code: "too_much_travel", overMin: travelMin - input.maxTravelMin });
  }
  return {
    stops,
    travelMin,
    visitMin: input.stops.reduce((sum, s) => sum + s.durationMin, 0),
    travelIncomplete,
    warnings,
  };
}

/** Default length of an activity without its own duration (wake up, breakfast…). */
export const DEFAULT_ACTIVITY_MIN = 30;

/** Minutes an item takes: its override, else the place's visit time, else the activity default. */
export function itemDurationMin(
  item: { durationOverrideMin: number | null; activityType: string | null },
  visitDurationMin: number | undefined,
): number {
  return item.durationOverrideMin ?? (item.activityType ? DEFAULT_ACTIVITY_MIN : (visitDurationMin ?? 0));
}

/**
 * Travel seconds into each item after the first, for computeDaySchedule. Routes only connect places,
 * so moving into an activity takes 0 and moving into a place uses the leg from the previous place
 * (null while that leg is unknown). An activity happens where the traveller already is.
 */
export function itemLegSeconds(
  items: readonly { id: string; activityType: string | null }[],
  legs: readonly { toItemId: string; status: string; durationS?: number }[] | undefined,
): (number | null)[] {
  let placesSoFar = items[0] && !items[0].activityType ? 1 : 0;
  return items.slice(1).map((item) => {
    if (item.activityType) return 0;
    if (placesSoFar++ === 0) return 0; // first place of the day: nothing to travel from
    const leg = legs?.find((l) => l.toItemId === item.id);
    return leg?.status === "routed" && leg.durationS !== undefined ? leg.durationS : null;
  });
}

export interface CostSummary {
  /** Estimated cost per day (minor units); occurrences without a cost estimate count as 0. */
  perDayMinor: number[];
  totalMinor: number;
  /** null when the trip has no budget. */
  remainingMinor: number | null;
}

export function summarizeCosts(data: TripAggregate): CostSummary {
  const cost = new Map(data.destinations.map((d) => [d.id, d.estCostMinor ?? 0]));
  const perDayMinor = data.days.map((day) =>
    day.items.reduce((sum, i) => sum + (i.destinationId ? (cost.get(i.destinationId) ?? 0) : 0), 0),
  );
  const totalMinor = perDayMinor.reduce((a, b) => a + b, 0);
  return {
    perDayMinor,
    totalMinor,
    remainingMinor: data.trip.budgetMinor === null ? null : data.trip.budgetMinor - totalMinor,
  };
}
