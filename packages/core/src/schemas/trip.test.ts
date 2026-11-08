import { describe, expect, it } from "vitest";
import { createDestinationInputSchema, createTripInputSchema, updateDestinationInputSchema } from "./trip.ts";
import { LOCATION_SOURCES } from "../constants.ts";

describe("createTripInputSchema", () => {
  it("accepts a dated trip", () => {
    expect(
      createTripInputSchema.safeParse({ name: "Cebu", startDate: "2026-12-01", endDate: "2026-12-03" })
        .success,
    ).toBe(true);
  });

  it("requires start and end dates together, in order", () => {
    expect(createTripInputSchema.safeParse({ name: "Cebu", startDate: "2026-12-01" }).success).toBe(false);
    expect(
      createTripInputSchema.safeParse({ name: "Cebu", startDate: "2026-12-03", endDate: "2026-12-01" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown timezones and lowercase currencies", () => {
    expect(createTripInputSchema.safeParse({ name: "x", timezone: "Mars/Olympus" }).success).toBe(false);
    expect(createTripInputSchema.safeParse({ name: "x", currency: "php" }).success).toBe(false);
  });
});

describe("destination inputs", () => {
  it("never accepts AI as a location source", () => {
    expect(LOCATION_SOURCES).not.toContain("ai");
    const result = createDestinationInputSchema.safeParse({
      name: "Fort San Pedro",
      latitude: 10.29,
      longitude: 123.9,
      locationSource: "ai",
    });
    expect(result.success).toBe(false);
  });

  it("requires coordinates and their source to change together", () => {
    expect(updateDestinationInputSchema.safeParse({ latitude: 10 }).success).toBe(false);
    expect(
      updateDestinationInputSchema.safeParse({ latitude: 10, longitude: 123, locationSource: "map_pin" })
        .success,
    ).toBe(true);
  });
});
