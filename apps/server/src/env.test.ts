import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

describe("parseEnv", () => {
  it("defaults to loopback on port 3100", () => {
    expect(parseEnv({})).toEqual({ ORBI_HOST: "127.0.0.1", ORBI_PORT: 3100 });
  });

  it("rejects an invalid port with a readable message", () => {
    expect(() => parseEnv({ ORBI_PORT: "99999" })).toThrow(/ORBI_PORT/);
  });
});
