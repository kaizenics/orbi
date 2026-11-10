"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Copy, Loader2, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { TripSummary } from "@orbi/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMoney } from "@/lib/format";
import { useDeleteTrip, useDuplicateTrip } from "@/lib/mutations";
import { useTrips } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useConfirm } from "./confirm-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_TIMEZONES, setPreference, usePreferences } from "@/lib/preferences";
import { NewTripDialog } from "./new-trip-form";
import { PanelMessage } from "./planner-shell";
import { TripsGridSkeleton } from "./skeletons";

type Filter = "upcoming" | "past" | "all";

/** Today as YYYY-MM-DD in the viewer's time zone (trip dates are calendar dates). */
const today = () => new Date().toLocaleDateString("en-CA");
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** "In 8 months", "Tomorrow", "Ongoing", "Ended", or null for undated trips. */
function countdown(trip: TripSummary, now: string): string | null {
  if (!trip.startDate) return null;
  if (trip.endDate && trip.endDate < now) return "Ended";
  if (trip.startDate <= now) return "Ongoing";
  const days = daysBetween(now, trip.startDate);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (days < 14) return rtf.format(days, "day");
  if (days < 60) return rtf.format(Math.round(days / 7), "week");
  return rtf.format(Math.round(days / 30.4), "month");
}

const isPast = (t: TripSummary, now: string) => Boolean(t.endDate && t.endDate < now);

/** A colourful cover derived from the trip name (trips have no photos). */
function coverStyle(name: string): React.CSSProperties {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return {
    backgroundImage: `radial-gradient(circle at 20% 15%, hsl(${(h + 40) % 360} 70% 60% / 0.55), transparent 55%),
      radial-gradient(circle at 85% 80%, hsl(${(h + 200) % 360} 60% 45% / 0.5), transparent 50%),
      linear-gradient(135deg, hsl(${h} 55% 32%), hsl(${(h + 60) % 360} 50% 18%))`,
  };
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export function TripsDashboard() {
  const trips = useTrips();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [creating, setCreating] = useState(false);
  const now = today();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (trips.data ?? [])
      .filter((t) => (filter === "all" ? true : filter === "past" ? isPast(t, now) : !isPast(t, now)))
      .filter((t) => !q || `${t.name} ${t.regionName ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) =>
        filter === "past"
          ? (b.startDate ?? "").localeCompare(a.startDate ?? "")
          : (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"),
      );
  }, [trips.data, query, filter, now]);

  const upcoming = (trips.data ?? [])
    .filter((t) => t.startDate && !isPast(t, now))
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 lg:flex-row lg:p-8">
      <section aria-labelledby="my-trips" className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 id="my-trips" className="text-3xl font-bold tracking-tight">
            My Trips
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Search trips or places"
                placeholder="Search trips or places"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-56 rounded-full pl-9"
              />
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-label="Show trips"
              value={filter}
              onValueChange={(v) => v && setFilter(v as Filter)}
            >
              <ToggleGroupItem value="upcoming" className="px-3">
                Upcoming
              </ToggleGroupItem>
              <ToggleGroupItem value="past" className="px-3">
                Past
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="px-3">
                All
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {trips.isPending ? (
          <TripsGridSkeleton />
        ) : trips.isError ? (
          <PanelMessage title="Couldn't load trips">
            {trips.error.message}{" "}
            <Button variant="link" className="h-auto p-0" onClick={() => trips.refetch()}>
              Try again
            </Button>
          </PanelMessage>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} now={now} />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-full min-h-72 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed text-center transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Plus aria-hidden className="size-5" />
                </span>
                <span className="font-semibold">New Trip</span>
                <span className="text-sm text-muted-foreground">Plan a new trip from scratch</span>
              </button>
            </li>
          </ul>
        )}
        {trips.data && shown.length === 0 && trips.data.length > 0 ? (
          <p className="text-sm text-muted-foreground">No trips match. Try another search or filter.</p>
        ) : null}
      </section>

      <aside aria-label="Overview" className="flex flex-col gap-5 lg:w-96 lg:shrink-0">
        <TimezonesCard trips={upcoming} />
        <UpcomingCard trips={upcoming} now={now} />
      </aside>

      <Button
        onClick={() => setCreating(true)}
        className="fixed right-20 bottom-4 z-40 h-12 rounded-full px-5 shadow-lg"
        variant="outline"
      >
        <Plus aria-hidden /> New Trip
      </Button>
      <NewTripDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function TripCard({ trip, now }: { trip: TripSummary; now: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const del = useDeleteTrip();
  const duplicate = useDuplicateTrip();
  const badge = countdown(trip, now);
  const href = `/trips/${trip.id}`;
  const action =
    "size-9 rounded-full border border-white/25 bg-black/35 text-white backdrop-blur hover:bg-black/55 hover:text-white";

  return (
    <article className="group relative overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
      <div
        className="relative flex h-48 flex-col justify-between p-4 text-white"
        style={coverStyle(trip.name)}
      >
        <div className="flex items-start justify-between gap-2">
          {badge ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur">
              <span aria-hidden className="size-1.5 rounded-full bg-amber-400" />
              {badge}
            </span>
          ) : (
            <span />
          )}
          <div className="relative z-10 flex gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              className={action}
              aria-label={`Edit ${trip.name}`}
              onClick={() => router.push(href)}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={action}
              aria-label={`Duplicate ${trip.name}`}
              disabled={duplicate.isPending}
              onClick={() => duplicate.mutate(trip.id)}
            >
              {duplicate.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Copy aria-hidden />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={action}
              aria-label={`Delete ${trip.name}`}
              disabled={del.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete "${trip.name}"?`,
                    description: "Everything in this trip will be deleted. This cannot be undone.",
                    confirmLabel: "Delete trip",
                    destructive: true,
                  })
                )
                  del.mutate(trip.id);
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </div>
        <div>
          {trip.regionName ? (
            <p className="flex items-center gap-1 text-xs font-medium text-white/80">
              <MapPin aria-hidden className="size-3.5" /> {trip.regionName}
            </p>
          ) : null}
          <h2 className="text-2xl leading-tight font-bold tracking-tight text-balance drop-shadow">
            {/* The link covers the whole card; the action buttons sit above it. */}
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {trip.name}
            </Link>
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {trip.startDate && trip.endDate ? (
            <>
              {shortDate(trip.startDate)} <span aria-hidden>→</span> {shortDate(trip.endDate)}
            </>
          ) : (
            "No dates yet"
          )}
        </p>
        <dl className="grid grid-cols-3 border-t pt-4 text-center">
          {[
            [trip.dayCount, "Days"],
            [trip.destinationCount, "Places"],
            [trip.budgetMinor === null ? "—" : formatMoney(trip.budgetMinor, trip.currency), "Budget"],
          ].map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse gap-1">
              <dt className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                {label}
              </dt>
              <dd className="text-lg font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

function SideCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-3xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase [&_svg]:size-4">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Live clocks. Automatic (you + upcoming trips) until the user adds or removes one; at most 5. */
function TimezonesCard({ trips }: { trips: TripSummary[] }) {
  const prefs = usePreferences();
  const [now, setNow] = useState<Date | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones =
    prefs.timezones ?? [...new Set([local, ...trips.map((t) => t.timezone)])].slice(0, MAX_TIMEZONES);
  const full = zones.length >= MAX_TIMEZONES;
  const cityOf = (zone: string) => zone.split("/").at(-1)!.replace(/_/g, " ");
  const q = search.trim().toLowerCase().replace(/\s+/g, "_");
  const matches = adding
    ? Intl.supportedValuesOf("timeZone")
        .filter((z) => !zones.includes(z) && (!q || z.toLowerCase().includes(q)))
        .slice(0, 50)
    : [];

  return (
    <SideCard
      icon={<Clock aria-hidden />}
      title="Timezones"
      action={
        <Popover open={adding} onOpenChange={(o) => (setAdding(o), setSearch(""))}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="Add a timezone"
              title={full ? `Up to ${MAX_TIMEZONES} timezones` : "Add a timezone"}
              disabled={full}
            >
              <Plus aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <Input
              autoFocus
              aria-label="Search timezones"
              placeholder="Search a city, e.g. Tokyo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="mt-2 max-h-64 overflow-y-auto" aria-label="Timezones">
              {matches.map((zone) => (
                <li key={zone}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setPreference("timezones", [...zones, zone]);
                      setAdding(false);
                    }}
                  >
                    <span className="truncate">{cityOf(zone)}</span>
                    <span className="truncate text-xs text-muted-foreground">{zone}</span>
                  </button>
                </li>
              ))}
              {matches.length === 0 ? (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">No match</li>
              ) : null}
            </ul>
          </PopoverContent>
        </Popover>
      }
    >
      {zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clocks. Add a timezone with +.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {zones.map((zone) => {
            const city = cityOf(zone);
            const offset = now
              ? new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
                  .formatToParts(now)
                  .find((p) => p.type === "timeZoneName")?.value
              : "";
            return (
              <li key={zone} className="group flex items-center gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {city[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {city}
                    {zone === local ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">You</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{offset}</span>
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {now
                    ? now.toLocaleTimeString(prefs.timeFormat === "12h" ? "en-US" : "en-GB", {
                        timeZone: zone,
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove ${city}`}
                  onClick={() =>
                    setPreference(
                      "timezones",
                      zones.filter((z) => z !== zone),
                    )
                  }
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}

function UpcomingCard({ trips, now }: { trips: TripSummary[]; now: string }) {
  return (
    <SideCard icon={<CalendarDays aria-hidden />} title="Upcoming trips">
      {trips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No dated trips coming up. Add dates to a trip to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.slice(0, 6).map((t) => {
            const start = new Date(`${t.startDate}T00:00:00Z`);
            return (
              <li key={t.id}>
                <Link
                  href={`/trips/${t.id}`}
                  className="flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-muted"
                >
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl border py-1.5">
                    <span className="text-lg leading-none font-bold">{start.getUTCDate()}</span>
                    <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                      {start.toLocaleDateString("en", { month: "short", timeZone: "UTC" })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.dayCount} days{t.regionName ? ` · ${t.regionName}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      t.startDate! <= now
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted",
                    )}
                  >
                    {countdown(t, now)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}
