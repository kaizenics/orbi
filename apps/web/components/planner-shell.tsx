import { APP_NAME } from "@orbi/core";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const floating =
  "flex flex-col gap-6 bg-card p-5 *:shrink-0 lg:absolute lg:top-3 lg:bottom-3 lg:z-10 lg:overflow-y-auto lg:rounded-2xl lg:border lg:shadow-lg";

/**
 * Top bar over a full-screen map with floating panels: the plan on the left and, optionally,
 * places and AI on the right. On small screens the map comes first and the panels stack below it.
 */
export function PlannerShell({
  panel,
  side,
  map,
  title,
}: {
  panel: React.ReactNode;
  side?: React.ReactNode;
  map: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <Link href="/trips" className="text-lg font-bold tracking-tight">
          {APP_NAME}
        </Link>
        {title ? <div className="min-w-0 truncate">{title}</div> : null}
        <span className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Settings aria-hidden className="size-4" />
          </Link>
        </span>
      </header>
      <main className={`relative flex flex-1 flex-col lg:min-h-0 ${side ? "with-side" : ""}`}>
        <section aria-label="Map" className="relative h-[50vh] bg-muted lg:absolute lg:inset-0 lg:h-auto">
          {map}
        </section>
        <aside aria-label="Plan" className={`${floating} border-b lg:left-3 lg:w-[400px]`}>
          {panel}
        </aside>
        {side ? (
          <aside aria-label="Places and AI" className={`${floating} lg:right-3 lg:w-[360px]`}>
            {side}
          </aside>
        ) : null}
      </main>
    </div>
  );
}

export function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground lg:min-h-0">
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
