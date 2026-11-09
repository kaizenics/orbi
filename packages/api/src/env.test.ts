import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

describe("parseEnv", () => {
  it("defaults to loopback on port 3100 with a local database file", () => {
    expect(parseEnv({})).toMatchObject({
      ORBI_HOST: "127.0.0.1",
      ORBI_PORT: 3100,
      ORBI_DATABASE_URL: "file:./data/orbi.db",
      ORBI_CORS_ORIGINS: [],
    });
  });

  it("rejects an invalid port with a readable message", () => {
    expect(() => parseEnv({ ORBI_PORT: "99999" })).toThrow(/ORBI_PORT/);
  });

  it("refuses to listen beyond loopback without an API token", () => {
    expect(() => parseEnv({ ORBI_HOST: "0.0.0.0" })).toThrow(/ORBI_API_TOKEN: required/);
    expect(parseEnv({ ORBI_HOST: "0.0.0.0", ORBI_API_TOKEN: "a".repeat(24) }).ORBI_HOST).toBe("0.0.0.0");
  });

  it("rejects short tokens", () => {
    expect(() => parseEnv({ ORBI_API_TOKEN: "short" })).toThrow(/at least 16/);
  });

  it("refuses a file database on Vercel", () => {
    expect(() => parseEnv({ VERCEL: "1" })).toThrow(/Turso/);
    expect(
      parseEnv({
        VERCEL: "1",
        ORBI_DATABASE_URL: "libsql://orbi.turso.io",
      }).ORBI_DATABASE_URL,
    ).toContain("turso");
  });

  it("treats blank values (as copied from .env.example) as not set", () => {
    const env = parseEnv({
      ORBI_API_TOKEN: "",
      ORBI_DATABASE_AUTH_TOKEN: "",
      PHOTON_BASE_URL: "",
      GEO_CONTACT_EMAIL: "",
    });
    expect(env.ORBI_API_TOKEN).toBeUndefined();
    expect(env.ORBI_DATABASE_URL).toBe("file:./data/orbi.db");
  });
});
