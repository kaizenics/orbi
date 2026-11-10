import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shaped like a trip card on My Trips (cover, dates, three stats). */
function TripCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <Skeleton className="h-48 rounded-none" />
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="mx-auto h-4 w-2/3" />
        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Loading state of the My Trips grid. */
export function TripsGridSkeleton() {
  return (
    <ul role="status" aria-label="Loading trips" className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <TripCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Left panel of a trip while it loads: header, day picker, day summary and a few timeline rows. */
export function TripPanelSkeleton() {
  return (
    <div role="status" aria-label="Loading trip" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex items-center gap-3 rounded-2xl border p-3">
        <Skeleton className="h-14 w-12 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-20 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right panel of a trip while it loads: place search and the assistant box. */
export function TripSideSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
