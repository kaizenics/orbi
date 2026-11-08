import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { OrbiError, placeCandidateSchema } from "@orbi/core";
import {
  createNominatimGeocoder,
  createOsrmRouter,
  createPhotonGeocoder,
  createRateLimiter,
  getJson,
} from "../src/index.ts";
import {
  buildNavigationLinks,
  decodePolyline,
  encodePolyline,
  formatDuration,
  formatRouteTotals,
  haversineM,
} from "../src/utils.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/** Fake fetch that serves recorded fixtures and records requested URLs/headers. */
function fakeFetch(routes: Record<string, string>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(fixture(routes[key]!), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetch: impl as unknown as typeof fetch, calls };
}

const noLimit = createRateLimiter(0);
const UA = "ORBI-test/1.0";

describe("Nominatim", () => {
  it("maps search results to validated candidates with OSM refs and sends the User-Agent", async () => {
    const f = fakeFetch({ "/search": "nominatim-search.json" });
    const geocoder = createNominatimGeocoder({
      baseUrl: "https://nominatim.test",
      userAgent: UA,
      limiter: noLimit,
      fetch: f.fetch,
    });
    const results = await geocoder.search("Fort San Pedro, Cebu", { near: { lat: 10.3, lng: 123.9 } });

    expect(results[0]).toMatchObject({
      name: "Fort San Pedro",
      sourceRef: "osm:way/332819231",
      category: "attraction",
      source: "nominatim",
    });
    expect(results[0]!.latitude).toBeCloseTo(10.2927, 3);
    results.forEach((r) => placeCandidateSchema.parse(r));
    expect(f.calls[0]!.headers["User-Agent"]).toBe(UA);
    expect(f.calls[0]!.url).toContain("viewbox=");
  });

  it("falls back to a readable name for unnamed reverse results", async () => {
    const f = fakeFetch({ "/reverse": "nominatim-reverse.json" });
    const geocoder = createNominatimGeocoder({
      baseUrl: "https://nominatim.test",
      userAgent: UA,
      limiter: noLimit,
      fetch: f.fetch,
    });
    const place = await geocoder.reverse({ lat: 10.2927, lng: 123.9058 });
    expect(place?.name).not.toBe("");
    expect(place?.name).not.toBe("Unnamed place");
  });
});

describe("Photon", () => {
  it("maps GeoJSON features, extent and OSM types", async () => {
    const f = fakeFetch({ "/api/": "photon-search.json" });
    const geocoder = createPhotonGeocoder({
      baseUrl: "https://photon.test",
      userAgent: UA,
      limiter: noLimit,
      fetch: f.fetch,
    });
    const [first] = await geocoder.search("Fort San Pedro", { near: { lat: 10.3, lng: 123.9 } });
    expect(first).toMatchObject({ name: "Fort San Pedro", sourceRef: "osm:way/332819231", source: "photon" });
    expect(first!.bbox![0]).toBeLessThan(first!.bbox![2]);
    expect(first!.bbox![1]).toBeLessThan(first!.bbox![3]);
  });
});

describe("OSRM", () => {
  const waypoints = [
    { lat: 10.2935702, lng: 123.9019584 },
    { lat: 10.2927283, lng: 123.9058911 },
    { lat: 10.299915, lng: 123.904823 },
  ];

  it("returns one road-following leg per consecutive pair", async () => {
    const f = fakeFetch({ "routed-foot": "osrm-foot.json" });
    const router = createOsrmRouter({
      userAgent: UA,
      limiter: noLimit,
      fetch: f.fetch,
      endpoints: { walking: { baseUrl: "https://osrm.test/routed-foot" } },
    });
    const legs = await router.route(waypoints, "walking");

    expect(legs).toHaveLength(2);
    expect(f.calls).toHaveLength(1); // whole day in one request
    for (const [i, leg] of legs.entries()) {
      expect(leg.coordinates.length).toBeGreaterThan(2); // real geometry, not a straight line
      const [startLng, startLat] = leg.coordinates[0]!;
      const [endLng, endLat] = leg.coordinates.at(-1)!;
      expect(haversineM({ lat: startLat, lng: startLng }, waypoints[i]!)).toBeLessThan(150);
      expect(haversineM({ lat: endLat, lng: endLng }, waypoints[i + 1]!)).toBeLessThan(150);
      expect(leg.distanceM).toBeGreaterThan(haversineM(waypoints[i]!, waypoints[i + 1]!) * 0.9);
    }
  });

  it("gives different durations for walking and driving", async () => {
    const f = fakeFetch({ "routed-foot": "osrm-foot.json", "routed-car": "osrm-car.json" });
    const router = createOsrmRouter({
      userAgent: UA,
      limiter: noLimit,
      fetch: f.fetch,
      endpoints: {
        walking: { baseUrl: "https://osrm.test/routed-foot" },
        driving: { baseUrl: "https://osrm.test/routed-car" },
      },
    });
    const walk = await router.route(waypoints, "walking");
    const drive = await router.route(waypoints, "driving");
    expect(walk[0]!.durationS).toBeGreaterThan(drive[0]!.durationS);
  });

  it("refuses modes without a configured endpoint", async () => {
    const router = createOsrmRouter({ userAgent: UA, limiter: noLimit, endpoints: {} });
    await expect(router.route(waypoints, "walking")).rejects.toBeInstanceOf(OrbiError);
  });
});

describe("getJson", () => {
  it("retries 5xx then succeeds, and does not retry 4xx", async () => {
    let n = 0;
    const flaky = (async () =>
      ++n < 2 ? new Response("", { status: 503 }) : new Response('{"ok":1}')) as unknown as typeof fetch;
    await expect(getJson("https://x.test", { userAgent: UA, fetch: flaky, retries: 2 })).resolves.toEqual({
      ok: 1,
    });

    let m = 0;
    const bad = (async () => {
      m++;
      return new Response("", { status: 400 });
    }) as unknown as typeof fetch;
    await expect(getJson("https://x.test", { userAgent: UA, fetch: bad, retries: 2 })).rejects.toMatchObject({
      code: "provider_unavailable",
    });
    expect(m).toBe(1);
  });
});

describe("rate limiter", () => {
  it("never starts two calls less than the interval apart, even in a burst", async () => {
    const limiter = createRateLimiter(1000);
    const starts: number[] = [];
    vi.useFakeTimers();
    const burst = Promise.all(
      Array.from({ length: 10 }, () =>
        limiter(async () => {
          starts.push(Date.now());
        }),
      ),
    );
    await vi.runAllTimersAsync();
    await burst;
    vi.useRealTimers();
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(1000);
  });
});

describe("utils", () => {
  it("round-trips polylines at precision 6", () => {
    const coords: [number, number][] = [
      [123.9019584, 10.2935702],
      [123.905891, 10.292728],
      [-0.1, -51.5],
    ];
    const decoded = decodePolyline(encodePolyline(coords));
    decoded.forEach(([lng, lat], i) => {
      expect(lng).toBeCloseTo(coords[i]![0], 6);
      expect(lat).toBeCloseTo(coords[i]![1], 6);
    });
  });

  it("builds external navigation links per mode", () => {
    const links = buildNavigationLinks({ lat: 10.29, lng: 123.9, name: "Fort San Pedro" }, "walking");
    expect(links.google).toContain("travelmode=walking");
    expect(links.apple).toContain("dirflg=w");
    expect(links.geo).toBe("geo:10.29,123.9?q=10.29,123.9(Fort%20San%20Pedro)");
  });

  it("never invents travel times", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(20)).toBe("< 1 min");
    expect(formatDuration(3600 + 25 * 60)).toBe("1 h 25 min");
    expect(formatRouteTotals({ distanceM: 0, durationS: 0, unroutedLegs: 5 })).toBeNull();
    expect(formatRouteTotals({ distanceM: 3358, durationS: 2697, unroutedLegs: 1 })).toBe("3.4 km · 45 min");
  });
});
