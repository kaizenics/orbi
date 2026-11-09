"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { summarizeCosts, type DayRoute, type ProposedStop, type TripAggregate } from "@orbi/core";
import { dayColor } from "@orbi/theme";
import { useTripActions } from "@/lib/mutations";
import { useClientConfig, useDayRoutes, useTrip } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { AiAssistant } from "./ai-assistant";
import { DayPlan } from "./day-plan";
import { IdeasList } from "./ideas-list";
import { MapPlaceholder, PanelMessage, PlannerShell } from "./planner-shell";
import { PlaceSearch } from "./place-search";
import { TripHeader } from "./trip-header";
import { TripMap } from "./trip-map";

export function TripView({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId);

  if (trip.isPending) return <PlannerShell panel={<PanelMessage title="Loading trip…" />} map={null} />;
  if (trip.isError) {
    return (
      <PlannerShell
        panel={
          <PanelMessage title={trip.error.message}>
            <Link href="/trips" className="underline">
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
  const actions = useTripActions(data.trip.id);
  const [preview, setPreview] = useState<{ dayId: string; stop: ProposedStop }[] | null>(null);
  const onPreview = useCallback((p: { dayId: string; stop: ProposedStop }[] | null) => setPreview(p), []);
  const mapData = useMemo(() => withPreview(data, preview), [data, preview]);

  const routes = useMemo(() => {
    const map = new Map<string, DayRoute>();
    for (const r of routeQueries) if (r.query.data) map.set(r.dayId, r.query.data);
    return map;
  }, [routeQueries]);
  const byId = useMemo(() => new Map(data.destinations.map((d) => [d.id, d])), [data.destinations]);
  const costs = useMemo(() => summarizeCosts(data), [data]);
  const scheduled = new Set(data.days.flatMap((d) => d.items.map((i) => i.destinationId)));
  const existingRefs = new Set(data.destinations.flatMap((d) => (d.sourceRef ? [d.sourceRef] : [])));

  const safeIndex = Math.min(dayIndex, data.days.length - 1);
  const day = data.days[safeIndex];
  const firstStop = day?.items[0] ? byId.get(day.items[0].destinationId) : data.destinations[0];
  const near = firstStop ? { lat: firstStop.latitude, lng: firstStop.longitude } : undefined;

  useEffect(() => {
    if (selectedItemId) {
      document
        .querySelector(`[data-item-id="${selectedItemId}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedItemId]);

  const panel = (
    <>
      <TripHeader data={data} costs={costs} actions={actions} />

      <div role="tablist" aria-label="Trip days" className="flex gap-2 overflow-x-auto pb-1">
        {data.days.map((d, i) => (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={i === safeIndex}
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
        <DayPlan
          key={day.id}
          data={data}
          day={day}
          dayIndex={safeIndex}
          color={dayColor(safeIndex)}
          route={routes.get(day.id)}
          byId={byId}
          dayCostMinor={costs.perDayMinor[safeIndex] ?? 0}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          actions={actions}
        />
      ) : null}

      {config.data ? <AiAssistant data={data} ai={config.data.ai} onPreview={onPreview} /> : null}

      <PlaceSearch
        tripId={data.trip.id}
        dayId={day?.id}
        dayLabel={`Day ${safeIndex + 1}`}
        near={near}
        existingRefs={existingRefs}
      />

      <IdeasList
        ideas={data.destinations.filter((d) => !scheduled.has(d.id))}
        dayId={day?.id}
        dayLabel={`Day ${safeIndex + 1}`}
        actions={actions}
      />
    </>
  );

  const map = config.isPending ? (
    <MapPlaceholder label="Loading map…" />
  ) : config.isError ? (
    <MapPlaceholder label={`Map unavailable: ${config.error.message}`} />
  ) : (
    <TripMap
      styleUrl={config.data.map.styleUrl}
      data={mapData}
      routes={routes}
      dayIndex={safeIndex}
      selectedItemId={selectedItemId}
      onSelectItem={(itemId, i) => {
        setDayIndex(i);
        setSelectedItemId(itemId);
      }}
      routeLoading={routeQueries[safeIndex]?.query.isFetching ?? false}
    />
  );

  return <PlannerShell panel={panel} map={map} />;
}

/**
 * Adds AI-proposed (not yet applied) stops to a copy of the trip so the map can preview them.
 * Preview stops have no routes; they appear as numbered markers after the day's real stops.
 */
function withPreview(
  data: TripAggregate,
  preview: { dayId: string; stop: ProposedStop }[] | null,
): TripAggregate {
  if (!preview?.length) return data;
  const destinations = [...data.destinations];
  const days = data.days.map((day) => {
    const extra = preview.filter((p) => p.dayId === day.id && p.stop.location);
    return {
      ...day,
      items: [
        ...day.items,
        ...extra.map(({ stop }, i) => {
          const id = `preview-${stop.key}`;
          destinations.push({
            id,
            tripId: data.trip.id,
            name: stop.name,
            description: stop.why,
            address: stop.location!.address,
            latitude: stop.location!.latitude,
            longitude: stop.location!.longitude,
            category: stop.category,
            visitDurationMin: stop.visitDurationMin,
            openingHours: null,
            openingHoursSource: null,
            estCostMinor: stop.estCostMinor,
            costSource: stop.estCostMinor === null ? null : "ai_estimate",
            notes: null,
            locationSource: stop.location!.source,
            sourceRef: stop.location!.sourceRef,
            locationVerifiedAt: 0,
            origin: "ai",
            createdAt: 0,
            updatedAt: 0,
          });
          return {
            id,
            tripDayId: day.id,
            destinationId: id,
            position: day.items.length + i,
            fixedStartTime: null,
            durationOverrideMin: null,
            travelModeToNext: null,
            notes: null,
          };
        }),
      ],
    };
  });
  return { ...data, days, destinations };
}
