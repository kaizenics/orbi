import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiDraftOutputSchema, aiEditOutputSchema } from "./ai.ts";

/** Every property name anywhere in a JSON schema. */
function propertyNames(schema: unknown, out = new Set<string>()): Set<string> {
  if (schema && typeof schema === "object") {
    for (const [k, v] of Object.entries(schema)) {
      if (k === "properties" && v && typeof v === "object") Object.keys(v).forEach((p) => out.add(p));
      propertyNames(v, out);
    }
  }
  return out;
}

describe("AI output schemas", () => {
  it("contain no coordinate fields: locations always come from the geocoder", () => {
    for (const schema of [aiDraftOutputSchema, aiEditOutputSchema]) {
      const names = [...propertyNames(z.toJSONSchema(schema))];
      expect(names.length).toBeGreaterThan(3);
      expect(names.filter((n) => /lat|lng|lon|coord|geo/i.test(n))).toEqual([]);
    }
  });
});
