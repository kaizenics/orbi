import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@orbi/core";
import { createApp } from "./app.ts";

describe("GET /health", () => {
  it("returns a payload matching the shared health schema", async () => {
    const res = await createApp({ version: "1.2.3" }).request("/health");

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json())).toEqual({
      status: "ok",
      name: "ORBI",
      version: "1.2.3",
    });
  });
});
