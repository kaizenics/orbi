import { authConfig } from "@/lib/session";
import { MapPlaceholder, PlannerShell } from "@/components/planner-shell";
import { TripList } from "@/components/trip-list";

export default function TripsPage() {
  const panel = (
    <>
      <TripList />
      {authConfig() ? (
        <form method="post" action="/auth/logout" className="mt-auto">
          <button type="submit" className="text-sm text-muted-foreground underline hover:text-foreground">
            Log out
          </button>
        </form>
      ) : null}
    </>
  );
  return <PlannerShell panel={panel} map={<MapPlaceholder label="Open a trip to see it on the map." />} />;
}
