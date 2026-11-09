"use client";

import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { useTrips } from "@/lib/queries";
import { formatDateRange } from "@/lib/format";
import { NewTripForm } from "./new-trip-form";
import { PanelMessage } from "./planner-shell";

export function TripList() {
  const trips = useTrips();

  if (trips.isPending) return <PanelMessage title="Loading trips…" />;
  if (trips.isError) {
    return (
      <PanelMessage title="Couldn't load trips">
        {trips.error.message}{" "}
        <button type="button" className="underline" onClick={() => trips.refetch()}>
          Try again
        </button>
      </PanelMessage>
    );
  }
  if (trips.data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PanelMessage title="No trips yet">
          Create one, or load the demo trip with{" "}
          <code className="font-mono">pnpm --filter @orbi/server db:seed</code>.
        </PanelMessage>
        <NewTripForm />
      </div>
    );
  }

  return (
    <section aria-labelledby="trips-heading" className="flex flex-col gap-3">
      <h1 id="trips-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Trips
      </h1>
      <NewTripForm />
      <ul className="flex flex-col gap-2">
        {trips.data.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/trips/${trip.id}`}
              className="flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="font-medium">{trip.name}</span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {trip.regionName ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden className="size-3.5" />
                    {trip.regionName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden className="size-3.5" />
                  {formatDateRange(trip.startDate, trip.endDate) ?? `${trip.dayCount} days`}
                </span>
                <span>{trip.destinationCount} places</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
