import { MapPinned, Plus } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@orbi/core";
import { ServerStatus } from "@/components/server-status";

export default function PlannerPage() {
  return (
    <main className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      <aside className="flex w-full flex-col gap-8 border-b bg-card p-6 lg:w-[440px] lg:shrink-0 lg:border-r lg:border-b-0">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </header>

        <section aria-labelledby="trips-heading" className="flex flex-1 flex-col gap-4">
          <h2
            id="trips-heading"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Trips
          </h2>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
            <p className="text-sm">No trips yet. Trip planning arrives in Phase 2.</p>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus aria-hidden className="size-4" />
              New trip
            </button>
          </div>
        </section>

        <ServerStatus />
      </aside>

      <section
        aria-label="Map"
        className="relative flex min-h-[50vh] flex-1 items-center justify-center bg-muted lg:min-h-0"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPinned aria-hidden className="size-8" />
          <p className="text-sm">Interactive map arrives in Phase 3.</p>
        </div>
      </section>
    </main>
  );
}
