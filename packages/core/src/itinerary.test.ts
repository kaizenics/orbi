import { describe, expect, it } from "vitest";
import {
  computeDaySchedule,
  formatClock,
  itemLegSeconds,
  summarizeCosts,
  type ScheduleInput,
} from "./itinerary.ts";
import type { TripAggregate } from "./schemas/trip.ts";

const base: ScheduleInput = {
  startTime: "09:00",
  endTime: "18:00",
  maxTravelMin: null,
  stops: [],
  legSeconds: [],
};
const stop = (itemId: string, durationMin: number, fixedStartTime: string | null = null) => ({
  itemId,
  durationMin,
  fixedStartTime,
});

describe("computeDaySchedule", () => {
  it("handles empty and one-stop days", () => {
    expect(computeDaySchedule(base)).toMatchObject({ stops: [], travelMin: 0, visitMin: 0, warnings: [] });
    const one = computeDaySchedule({ ...base, stops: [stop("a", 60)] });
    expect(one.stops).toEqual([{ itemId: "a", arrival: 540, departure: 600 }]);
  });

  it("chains visits and travel", () => {
    const s = computeDaySchedule({ ...base, stops: [stop("a", 60), stop("b", 30)], legSeconds: [15 * 60] });
    expect(s.stops.map((x) => [x.arrival, x.departure].map((m) => formatClock(m!)))).toEqual([
      ["09:00", "10:00"],
      ["10:15", "10:45"],
    ]);
    expect(s).toMatchObject({ travelMin: 15, visitMin: 90, travelIncomplete: false });
  });

  it("waits for fixed times and warns when one is missed", () => {
    const wait = computeDaySchedule({
      ...base,
      stops: [stop("a", 30), stop("b", 60, "12:00")],
      legSeconds: [600],
    });
    expect(formatClock(wait.stops[1]!.arrival!)).toBe("12:00");
    expect(wait.warnings).toEqual([]);

    const late = computeDaySchedule({
      ...base,
      stops: [stop("a", 240), stop("b", 60, "12:00")],
      legSeconds: [1800],
    });
    expect(late.warnings).toContainEqual({ code: "fixed_time_missed", itemId: "b", lateMin: 90 });
    expect(formatClock(late.stops[1]!.arrival!)).toBe("13:30");
  });

  it("stops inventing times after an unknown leg until a fixed time re-anchors", () => {
    const s = computeDaySchedule({
      ...base,
      stops: [stop("a", 60), stop("b", 30), stop("c", 30), stop("d", 30, "16:00")],
      legSeconds: [null, 600, 600],
    });
    expect(s.stops.map((x) => x.arrival)).toEqual([540, null, null, 960]);
    expect(s.travelIncomplete).toBe(true);
    expect(s.travelMin).toBe(20);
  });

  it("warns past the day end and over the travel limit", () => {
    const s = computeDaySchedule({
      ...base,
      endTime: "10:00",
      maxTravelMin: 10,
      stops: [stop("a", 60), stop("b", 60)],
      legSeconds: [1800],
    });
    expect(s.warnings).toEqual(
      expect.arrayContaining([
        { code: "past_day_end", overMin: 90 },
        { code: "too_much_travel", overMin: 20 },
      ]),
    );
  });

  it("formats times past midnight", () => {
    expect(formatClock(25 * 60 + 5)).toBe("01:05 +1");
  });
});

describe("summarizeCosts", () => {
  it("sums estimated costs per scheduled occurrence and compares with the budget", () => {
    const data = {
      trip: { budgetMinor: 10_000 },
      destinations: [
        { id: "a", estCostMinor: 3_000 },
        { id: "b", estCostMinor: null },
        { id: "c", estCostMinor: 5_000 },
      ],
      days: [
        { items: [{ destinationId: "a" }, { destinationId: "b" }] },
        { items: [{ destinationId: "a" }, { destinationId: "c" }] },
      ],
    } as unknown as TripAggregate;
    expect(summarizeCosts(data)).toEqual({
      perDayMinor: [3_000, 8_000],
      totalMinor: 11_000,
      remainingMinor: -1_000,
    });
    expect(
      summarizeCosts({ ...data, trip: { budgetMinor: null } } as unknown as TripAggregate).remainingMinor,
    ).toBeNull();
  });
});

describe("itemLegSeconds", () => {
  it("routes between places only; activities take no travel", () => {
    const items = [
      { id: "wake", activityType: "wake_up" },
      { id: "a", activityType: null },
      { id: "lunch", activityType: "lunch" },
      { id: "b", activityType: null },
      { id: "c", activityType: null },
    ];
    const legs = [
      { toItemId: "b", status: "routed", durationS: 600 },
      { toItemId: "c", status: "unrouted" },
    ];
    expect(itemLegSeconds(items, legs)).toEqual([0, 0, 600, null]);
  });
});
