import { APP_NAME } from "@orbi/core";
import Link from "next/link";
import { ServerStatus } from "./server-status";

/** Split planner layout: itinerary panel on the left, map on the right (stacked on small screens). */
export function PlannerShell({ panel, map }: { panel: React.ReactNode; map: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      <aside className="flex w-full flex-col border-b bg-card lg:w-[440px] lg:shrink-0 lg:border-r lg:border-b-0">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <ServerStatus />
        </header>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 *:shrink-0">{panel}</div>
      </aside>
      <section aria-label="Map" className="relative min-h-[50vh] flex-1 bg-muted lg:min-h-0">
        {map}
      </section>
    </main>
  );
}

export function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function PanelMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-dashed p-6">
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
