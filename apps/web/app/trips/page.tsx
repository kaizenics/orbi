import { TopBar } from "@/components/planner-shell";
import { TripsDashboard } from "@/components/trips-dashboard";

export default function TripsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex-1">
        <TripsDashboard />
      </main>
    </div>
  );
}
