import { MapPlaceholder, PlannerShell } from "@/components/planner-shell";
import { TripList } from "@/components/trip-list";

export default function HomePage() {
  return (
    <PlannerShell panel={<TripList />} map={<MapPlaceholder label="Open a trip to see it on the map." />} />
  );
}
