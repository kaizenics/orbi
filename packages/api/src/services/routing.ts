import { createHash } from "node:crypto";
import { OrbiError, type DayRoute, type RouteLeg, type TravelMode } from "@orbi/core";
import { getCachedLegs, getDayStops, putCachedLegs, type CachedLeg, type Db, type DayStop } from "@orbi/db";
import type { Router } from "@orbi/geo";
import { encodePolyline, haversineM, round5 } from "@orbi/geo/utils";

export interface RoutingDeps {
  db: Db;
  router: Router;
  cacheTtlMs: number;
  log?: (message: string) => void;
}

interface LegPlan {
  from: DayStop;
  to: DayStop;
  mode: TravelMode;
  key: string;
}

const legKey = (provider: string, mode: TravelMode, from: DayStop, to: DayStop) =>
  createHash("sha256")
    .update(
      `${provider}|${mode}|${round5(from.latitude)},${round5(from.longitude)}|${round5(to.latitude)},${round5(to.longitude)}`,
    )
    .digest("hex");

const latLng = (s: DayStop) => ({ lat: s.latitude, lng: s.longitude });

/**
 * Derived route for a day (database.md §6.1). Legs are cached by content (provider, mode, rounded
 * coordinates), so reordering only recomputes new legs. On a miss, each run of consecutive uncached
 * legs that share a travel mode is fetched in ONE provider request. Legs that cannot be routed are
 * returned as "unrouted" with a straight-line distance — never disguised as a road route.
 */
export async function getDayRoute(
  deps: RoutingDeps,
  dayId: string,
  options: { refresh?: boolean } = {},
): Promise<DayRoute> {
  const { day, defaultTravelMode, stops } = await getDayStops(deps.db, dayId);
  const dayMode = day.travelMode ?? defaultTravelMode;

  const plans: LegPlan[] = stops.slice(0, -1).map((from, i) => {
    const to = stops[i + 1]!;
    const mode = from.travelModeToNext ?? dayMode;
    return { from, to, mode, key: legKey(deps.router.name, mode, from, to) };
  });

  const cached = options.refresh
    ? new Map<string, CachedLeg>()
    : await getCachedLegs(
        deps.db,
        plans.map((p) => p.key),
      );
  const resolved = new Map<number, RouteLeg>();
  plans.forEach((p, i) => {
    const hit = cached.get(p.key);
    if (hit) resolved.set(i, routed(p, hit.distanceM, hit.durationS, hit.geometry));
  });

  for (const run of missingRuns(plans, resolved)) {
    const runPlans = plans.slice(run.start, run.end + 1);
    const mode = runPlans[0]!.mode;
    if (!deps.router.modes.includes(mode)) {
      runPlans.forEach((p, k) =>
        resolved.set(run.start + k, unrouted(p, `No ${mode} routing is configured`)),
      );
      continue;
    }
    try {
      deps.log?.(`[geo] ${deps.router.name} ${mode} route (cache miss): ${runPlans.length} leg(s)`);
      const waypoints = [...runPlans.map((p) => latLng(p.from)), latLng(runPlans.at(-1)!.to)];
      const legs = await deps.router.route(waypoints, mode);
      if (legs.length !== runPlans.length) {
        throw new OrbiError("provider_unavailable", "Router returned an unexpected number of legs");
      }
      const toCache: CachedLeg[] = legs.map((leg, k) => ({
        key: runPlans[k]!.key,
        provider: deps.router.name,
        profile: mode,
        distanceM: leg.distanceM,
        durationS: leg.durationS,
        geometry: encodePolyline(leg.coordinates),
      }));
      await putCachedLegs(deps.db, toCache, deps.cacheTtlMs);
      toCache.forEach((c, k) =>
        resolved.set(run.start + k, routed(runPlans[k]!, c.distanceM, c.durationS, c.geometry)),
      );
    } catch (error) {
      const reason = error instanceof OrbiError ? error.message : "Routing service unavailable";
      runPlans.forEach((p, k) => resolved.set(run.start + k, unrouted(p, reason)));
    }
  }

  const legs = plans.map((_, i) => resolved.get(i)!);
  const routedLegs = legs.filter((l) => l.status === "routed");
  return {
    dayId,
    legs,
    totals: {
      distanceM: routedLegs.reduce((sum, l) => sum + l.distanceM, 0),
      durationS: routedLegs.reduce((sum, l) => sum + l.durationS, 0),
      unroutedLegs: legs.length - routedLegs.length,
    },
    provider: deps.router.name,
  };
}

/** Maximal runs of consecutive unresolved legs sharing one travel mode. */
function missingRuns(plans: readonly LegPlan[], resolved: ReadonlyMap<number, RouteLeg>) {
  const runs: { start: number; end: number }[] = [];
  plans.forEach((p, i) => {
    if (resolved.has(i)) return;
    const last = runs.at(-1);
    if (last && last.end === i - 1 && plans[last.start]!.mode === p.mode) last.end = i;
    else runs.push({ start: i, end: i });
  });
  return runs;
}

const routed = (p: LegPlan, distanceM: number, durationS: number, geometry: string): RouteLeg => ({
  status: "routed",
  fromItemId: p.from.itemId,
  toItemId: p.to.itemId,
  mode: p.mode,
  distanceM,
  durationS,
  geometry,
});

const unrouted = (p: LegPlan, reason: string): RouteLeg => ({
  status: "unrouted",
  fromItemId: p.from.itemId,
  toItemId: p.to.itemId,
  mode: p.mode,
  straightLineM: haversineM(latLng(p.from), latLng(p.to)),
  reason,
});
