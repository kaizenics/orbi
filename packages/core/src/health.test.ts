import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health.ts";

describe("healthResponseSchema", () => {
  it("accepts a valid health payload", () => {
    expect(healthResponseSchema.parse({ status: "ok", name: "ORBI", version: "0.0.0" })).toEqual({
      status: "ok",
      name: "ORBI",
      version: "0.0.0",
    });
  });

  it("rejects an unknown status", () => {
    expect(healthResponseSchema.safeParse({ status: "down", name: "ORBI", version: "0.0.0" }).success).toBe(
      false,
    );
  });
});
