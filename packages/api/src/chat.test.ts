import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { describe, expect, it } from "vitest";
import { tripAggregateSchema, type AiConnection } from "@orbi/core";
import { createApp } from "./app.ts";
import { testDeps } from "../test/fakes.ts";

const AI: AiConnection = { provider: "openrouter", model: "test/model:free", apiKey: "sk-or-test-key-1234" };
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const finish = { type: "finish" as const, finishReason: { unified: "stop" as const, raw: undefined }, usage };

/** A model that streams the given chunks; `calls` counts how often the API used it. */
async function setup(chunks: unknown[]) {
  const calls: number[] = [];
  const deps = await testDeps({
    createModel: (config) => {
      calls.push(1);
      return {
        model: new MockLanguageModelV4({
          doStream: async () => {
            return { stream: simulateReadableStream({ chunks: [...chunks, finish] as never[] }) };
          },
        }),
        provider: config.provider,
        modelId: config.model,
      };
    },
  });
  const app = createApp(deps);
  const chat = async (content: string, user = "ana@example.com") => {
    const res = await app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-orbi-user": user },
      body: JSON.stringify({ messages: [{ role: "user", content }], ai: AI }),
    });
    expect(res.status).toBe(200);
    const lines = (await res.text()).trim().split("\n");
    return lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  };
  return { app, chat, calls };
}

describe("travel chat", () => {
  it("refuses code requests and profanity without calling the model", async () => {
    const { chat, calls } = await setup([]);
    const code = await chat("Write a python script to sort a list");
    expect(String(code[0]!.text)).toMatch(/only help with travel/);
    expect(String((await chat("this is shit"))[0]!.text)).toMatch(/friendly/);
    // The model was built for each request but never asked for tokens.
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it("streams the answer as text chunks", async () => {
    const { chat } = await setup([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Visit " },
      { type: "text-delta", id: "t", delta: "Kyoto in autumn." },
      { type: "text-end", id: "t" },
    ]);
    const events = await chat("Where should I go in Japan?");
    expect(events.map((e) => e.text).join("")).toBe("Visit Kyoto in autumn.");
  });

  it("creates the caller's trip from a pasted itinerary", async () => {
    const stop = (name: string) => ({
      name,
      localityHint: "Cebu City",
      category: "history",
      visitDurationMin: 60,
      estCost: null,
      why: "From your list",
    });
    const input = {
      name: "Cebu weekend",
      regionName: "Cebu, Philippines",
      startDate: "2026-12-01",
      summary: "Two days in Cebu",
      days: [
        { title: "Old town", stops: [stop("Fort San Pedro"), stop("Nowhere Museum")] },
        { title: "Day 2", stops: [stop("Fort San Pedro")] },
      ],
    };
    const { app, chat } = await setup([
      { type: "tool-call", toolCallId: "c1", toolName: "create_trip", input: JSON.stringify(input) },
    ]);
    const events = await chat("Day 1: Fort San Pedro, Nowhere Museum. Day 2: Fort San Pedro");
    const created = events.find((e) => e.trip)?.trip as { id: string; added: number; missing: string[] };
    expect(created).toMatchObject({ added: 2, missing: ["Nowhere Museum"] });

    const get = (user: string) => app.request(`/trips/${created.id}`, { headers: { "x-orbi-user": user } });
    const trip = tripAggregateSchema.parse(await (await get("ana@example.com")).json());
    expect(trip.trip).toMatchObject({ name: "Cebu weekend", startDate: "2026-12-01", endDate: "2026-12-02" });
    expect(trip.days.map((d) => d.items.length)).toEqual([1, 1]);
    expect((await get("ben@example.com")).status).toBe(404); // private to the account that asked
  });
});
