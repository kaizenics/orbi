import { describe, expect, it } from "vitest";
import { addDays, daysBetweenInclusive, isValidIsoDate } from "./dates.ts";

describe("dates", () => {
  it("adds days across month and leap-year boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days inclusively", () => {
    expect(daysBetweenInclusive("2026-12-01", "2026-12-03")).toBe(3);
    expect(daysBetweenInclusive("2026-12-01", "2026-12-01")).toBe(1);
  });

  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-2-3")).toBe(false);
    expect(isValidIsoDate("2026-02-28")).toBe(true);
  });
});
