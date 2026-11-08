"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Car, Clock, ExternalLink, Footprints } from "lucide-react";
import Link from "next/link";
import type { DayRoute, Destination, RouteLeg, TravelMode, TripAggregate } from "@orbi/core";
import { buildNavigationLinks, formatDistance, formatDuration, formatRouteTotals } from "@orbi/geo/utils";
import { dayColor } from "@orbi/theme";
import { useClientConfig, useDayRoutes, useTrip } from "@/lib/queries";
import { formatDate, formatDateRange, formatMinutes, formatMoney } from "@/lib/format";
import { MapPlaceholder, PanelMessage, PlannerShell } from "./planner-shell";
import { PlaceSearch } from "./place-search";
import { TripMap } from "./trip-map";

export function TripView({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId);

  if (trip.isPending) return <PlannerShell panel={<PanelMessage title="Loading trip…" />} map={null} />;
  if (trip.isError) {
    return (
      <PlannerShell
        panel={
          <PanelMessage title={trip.error.message}>
            <Link href="/" className="underline">
              Back to trips
            </Link>
          </PanelMessage>
        }
        map={null}
      />
    );
  }
  return <TripPlanner data={trip.data} />;
}

function TripPlanner({ data }: { data: TripAggregate }) {
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const config = useClientConfig();
  const routeQueries = useDayRoutes(data);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const routes = useMemo(() => {
    const map = new Map<string, DayRoute>();
    for (const r of routeQueries) if (r.query.data) map.set(r.dayId, r.query.data);
    return map;
  }, [routeQueries]);

  const byId = useMemo(() => new Map(data.destinations.map((d) => [d.id, d])), [data.destinations]);
  const scheduled = useMemo(
    () => new Set(data.days.flatMap((d) => d.items.map((i) => i.destinationId))),
    [data.days],
  );
  const existingRefs = useMemo(
    () => new Set(data.destinations.flatMap((d) => (d.sourceRef ? [d.sourceRef] : []))),
    [data.destinations],
  );
  const ideas = data.destinations.filter((d) => !scheduled.has(d.id));
  const day = data.days[dayIndex] ?? data.days[0];
  const dayRoute = day ? routes.get(day.id) : undefined;
  const dayMode: TravelMode = day?.travelMode ?? data.trip.defaultTravelMode;
  const { trip } = data;

  const firstStop = day?.items[0] ? byId.get(day.items[0].destinationId) : data.destinations[0];
  const near = firstStop ? { lat: firstStop.latitude, lng: firstStop.longitude } : undefined;

  useEffect(() => {
    if (selectedItemId)
      cardRefs.current.get(selectedItemId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedItemId]);

  const legAfter = (itemId: string): RouteLeg | undefined =>
    dayRoute?.legs.find((l) => l.fromItemId === itemId);

  const panel = (
    <>
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" /> Trips
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[
            trip.regionName,
            formatDateRange(trip.startDate, trip.endDate),
            trip.budgetMinor !== null ? `Budget ${formatMoney(trip.budgetMinor, trip.currency)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div role="tablist" aria-label="Trip days" className="flex gap-2 overflow-x-auto pb-1">
        {data.days.map((d, i) => (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={i === dayIndex}
            onClick={() => {
              setDayIndex(i);
              setSelectedItemId(null);
            }}
            className="flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm aria-selected:border-foreground aria-selected:bg-muted"
          >
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: dayColor(i) }} />
            Day {i + 1}
            {d.date ? <span className="text-muted-foreground">{formatDate(d.date)}</span> : null}
          </button>
        ))}
      </div>

      {day ? (
        <section role="tabpanel" aria-label={`Day ${dayIndex + 1}`} className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between gap-2">
            <h2 className="font-medium">{day.title ?? `Day ${dayIndex + 1}`}</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {dayMode === "walking" ? (
                <Footprints aria-hidden className="size-3.5" />
              ) : (
                <Car aria-hidden className="size-3.5" />
              )}
              {dayMode}
              {dayRoute ? ` · ${formatRouteTotals(dayRoute.totals) ?? "no road route"}` : null}
            </span>
          </header>
          {day.items.length === 0 ? (
            <PanelMessage title="No stops on this day yet">Search for a place below to add one.</PanelMessage>
          ) : (
            <ol className="flex flex-col">
              {day.items.map((item, i) => {
                const dest = byId.get(item.destinationId);
                if (!dest) return null;
                const leg = i < day.items.length - 1 ? legAfter(item.id) : undefined;
                return (
                  <li
                    key={item.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(item.id, el);
                      else cardRefs.current.delete(item.id);
                    }}
                  >
                    <StopCard
                      number={i + 1}
                      color={dayColor(dayIndex)}
                      destination={dest}
                      mode={dayMode}
                      durationMin={item.durationOverrideMin ?? dest.visitDurationMin}
                      selected={selectedItemId === item.id}
                      onSelect={() => setSelectedItemId(item.id)}
                    />
                    {i < day.items.length - 1 ? <LegRow leg={leg} /> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      <PlaceSearch
        tripId={trip.id}
        dayId={day?.id}
        dayLabel={`Day ${dayIndex + 1}`}
        near={near}
        existingRefs={existingRefs}
      />

      {ideas.length ? (
        <section aria-labelledby="ideas-heading" className="flex flex-col gap-2">
          <h2
            id="ideas-heading"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Ideas · not scheduled
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {ideas.map((d) => (
              <li key={d.id} className="rounded-md border px-3 py-2">
                {d.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );

  const map = config.isPending ? (
    <MapPlaceholder label="Loading map…" />
  ) : config.isError ? (
    <MapPlaceholder label={`Map unavailable: ${config.error.message}`} />
  ) : (
    <TripMap
      styleUrl={config.data.map.styleUrl}
      data={data}
      routes={routes}
      dayIndex={dayIndex}
      selectedItemId={selectedItemId}
      onSelectItem={(itemId, i) => {
        setDayIndex(i);
        setSelectedItemId(itemId);
      }}
      routeLoading={routeQueries[dayIndex]?.query.isFetching ?? false}
    />
  );

  return <PlannerShell panel={panel} map={map} />;
}

function LegRow({ leg }: { leg: RouteLeg | undefined }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-5 text-xs text-muted-foreground">
      <ArrowDown aria-hidden className="size-3.5" />
      {!leg ? (
        <span>…</span>
      ) : leg.status === "routed" ? (
        <span>
          {formatDuration(leg.durationS)} · {formatDistance(leg.distanceM)}{" "}
          {leg.mode === "walking" ? "walk" : "drive"}
        </span>
      ) : (
        <span title={leg.reason}>
          {formatDistance(leg.straightLineM)} straight line · no road route available
        </span>
      )}
    </div>
  );
}

function StopCard(props: {
  number: number;
  color: string;
  destination: Destination;
  mode: TravelMode;
  durationMin: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { destination: d } = props;
  const nav = buildNavigationLinks({ lat: d.latitude, lng: d.longitude, name: d.name }, props.mode);
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${props.selected ? "border-foreground bg-muted" : "hover:bg-muted"}`}
    >
      <button
        type="button"
        onClick={props.onSelect}
        aria-pressed={props.selected}
        className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none"
      >
        <span
          aria-label={`Stop ${props.number}`}
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: props.color }}
        >
          {props.number}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{d.name}</span>
          {d.address ? <span className="truncate text-xs text-muted-foreground">{d.address}</span> : null}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock aria-hidden className="size-3" />
            {formatMinutes(props.durationMin)} · {d.category}
          </span>
        </span>
      </button>
      <a
        href={nav.google}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${d.name} in Google Maps`}
        className="rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink aria-hidden className="size-4" />
      </a>
    </div>
  );
}
