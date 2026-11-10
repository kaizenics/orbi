"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { summarizeCosts, type DayRoute, type ProposedStop, type TripAggregate } from "@orbi/core";
import { dayColor } from "@orbi/theme";
import { useTripActions } from "@/lib/mutations";
import { useClientConfig, useDayRoutes, useTrip } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { SATELLITE_STYLE } from "@/lib/map-styles";
import { setPreference, usePreferences } from "@/lib/preferences";
import { useTheme } from "@/lib/theme";
import { AiAssistant } from "./ai-assistant";
import { DayPlan } from "./day-plan";
import { IdeasList } from "./ideas-list";
import { MapPlaceholder, PanelMessage, PlannerShell } from "./planner-shell";
import { TripPanelSkeleton, TripSideSkeleton } from "./skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceSearch } from "./place-search";
import { TripHeader } from "./trip-header";
import { TripMap } from "./trip-map";
import { FormSelect } from "./form-select";

export function TripView({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId);

  if (trip.isPending && trip.fetchStatus === "paused") {
    return (
      <PlannerShell
        panel={
          <PanelMessage title="You're offline">
            This trip isn't saved on this device. Open it once while online to read it offline.{" "}
            <Link href="/trips" className="underline">
              Back to trips
            </Link>
          </PanelMessage>
        }
        map={null}
      />
    );
  }
  if (trip.isPending)
    return (
      <PlannerShell
        panel={<TripPanelSkeleton />}
        side={<TripSideSkeleton />}
        map={<Skeleton className="size-full min-h-[50vh] rounded-none lg:min-h-0" />}
      />
    );
  // A failed refresh keeps showing the saved copy; the error only replaces the page when there is none.
  if (trip.isError && !trip.data) {
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
  return <TripPlanner data={trip.data!} />;
}

function TripPlanner({ data }: { data: TripAggregate }) {
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const config = useClientConfig();
  const theme = useTheme();
  const { mapStyle } = usePreferences();
  const darkMap = mapStyle === "auto" ? theme === "dark" : mapStyle === "dark";
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
  const scheduled = new Set(
    data.days.flatMap((d) => d.items.flatMap((i) => (i.destinationId ? [i.destinationId] : []))),
  );
  const existingRefs = new Set(data.destinations.flatMap((d) => (d.sourceRef ? [d.sourceRef] : [])));

  const safeIndex = Math.min(dayIndex, data.days.length - 1);
  const day = data.days[safeIndex];
  const firstPlaceId = day?.items.find((i) => i.destinationId)?.destinationId;
  const firstStop = firstPlaceId ? byId.get(firstPlaceId) : data.destinations[0];
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

      <FormSelect
        aria-label="Trip day"
        value={String(safeIndex)}
        onValueChange={(v) => {
          setDayIndex(Number(v));
          setSelectedItemId(null);
        }}
        options={data.days.map((d, i) => ({
          value: String(i),
          label: (
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: dayColor(i) }} />
              <span className="font-medium">Day {i + 1}</span>
              {d.date ? <span className="text-muted-foreground">{formatDate(d.date)}</span> : null}
            </span>
          ),
        }))}
      />

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
    </>
  );

  const side = (
    <>
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

      <AiAssistant data={data} onPreview={onPreview} />
    </>
  );

  const map = config.isPending ? (
    <MapPlaceholder label="Loading map…" />
  ) : config.isError ? (
    <MapPlaceholder label={`Map unavailable: ${config.error.message}`} />
  ) : (
    <TripMap
      styleUrl={
        mapStyle === "satellite"
          ? SATELLITE_STYLE
          : darkMap
            ? darkStyle(config.data.map.styleUrl)
            : config.data.map.styleUrl
      }
      satellite={mapStyle === "satellite"}
      onToggleSatellite={() => setPreference("mapStyle", mapStyle === "satellite" ? "auto" : "satellite")}
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

  return (
    <PlannerShell
      panel={panel}
      side={side}
      map={map}
      title={
        <Link href="/trips" className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted">
          ‹ {data.trip.name}
        </Link>
      }
    />
  );
}

/** OpenFreeMap ships a dark variant of its default style; other styles stay as configured. */
const darkStyle = (url: string) =>
  url.replace(/^(https:\/\/tiles\.openfreemap\.org\/styles\/)liberty$/, "$1dark");

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
            activityType: null,
            title: null,
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
