"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ApiError } from "@orbi/api/client";
import { PACES, type CostSummary, type Pace, type TripAggregate, type UpdateTripInput } from "@orbi/core";
import { useDeleteTrip, type TripActions } from "@/lib/mutations";
import { formatDateRange, formatMoney } from "@/lib/format";
import { inputClass, labelClass, parseMoney, primaryButton, secondaryButton, textOrNull } from "@/lib/ui";

export function TripHeader({
  data,
  costs,
  actions,
}: {
  data: TripAggregate;
  costs: CostSummary;
  actions: TripActions;
}) {
  const { trip, preferences } = data;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const del = useDeleteTrip();
  const router = useRouter();

  const save = async (form: FormData) => {
    setError(null);
    const startDate = textOrNull(form.get("startDate"));
    const endDate = textOrNull(form.get("endDate"));
    const update: UpdateTripInput = {
      name: String(form.get("name")).trim(),
      regionName: textOrNull(form.get("regionName")),
      budgetMinor: parseMoney(form.get("budget")),
      ...(startDate && endDate
        ? { startDate, endDate }
        : { startDate: null, endDate: null, dayCount: Number(form.get("dayCount") || data.days.length) }),
    };
    try {
      await actions.updateTrip.mutateAsync(update).catch(async (e: unknown) => {
        if (
          !(e instanceof ApiError) ||
          e.code !== "confirmation_required" ||
          !window.confirm(`${e.message.split(". Resend")[0]}. Continue?`)
        ) {
          throw e;
        }
        await actions.updateTrip.mutateAsync({ ...update, confirmRemoveDays: true });
      });
      await actions.putPreferences.mutateAsync({
        pace: form.get("pace") as Pace,
        interests: String(form.get("interests") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        dayStartTime: String(form.get("dayStartTime")),
        dayEndTime: String(form.get("dayEndTime")),
        maxDailyTravelMin: form.get("maxTravel") ? Number(form.get("maxTravel")) : null,
        notes: textOrNull(form.get("notes")),
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the trip");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" /> Trips
        </Link>
        <span className="flex gap-1">
          <button
            type="button"
            aria-label="Edit trip"
            aria-expanded={editing}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Delete trip"
            className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (window.confirm(`Delete "${trip.name}" and everything in it? This cannot be undone.`)) {
                del.mutate(trip.id, { onSuccess: () => router.push("/trips") });
              }
            }}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
      <p className="text-sm text-muted-foreground">
        {[trip.regionName, formatDateRange(trip.startDate, trip.endDate) ?? `${data.days.length} days`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-sm">
        Estimated {formatMoney(costs.totalMinor, trip.currency)}
        {trip.budgetMinor !== null ? (
          <span className={costs.remainingMinor! < 0 ? "text-destructive" : "text-muted-foreground"}>
            {" "}
            of {formatMoney(trip.budgetMinor, trip.currency)} budget
            {costs.remainingMinor! < 0 ? ` · ${formatMoney(-costs.remainingMinor!, trip.currency)} over` : ""}
          </span>
        ) : null}
      </p>

      {editing ? (
        <form
          aria-label="Edit trip"
          className="flex flex-col gap-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(new FormData(e.currentTarget));
          }}
        >
          <label className={labelClass}>
            Name
            <input name="name" required maxLength={120} defaultValue={trip.name} className={inputClass} />
          </label>
          <label className={labelClass}>
            Region
            <input name="regionName" defaultValue={trip.regionName ?? ""} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Start date
              <input
                name="startDate"
                type="date"
                defaultValue={trip.startDate ?? ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              End date
              <input name="endDate" type="date" defaultValue={trip.endDate ?? ""} className={inputClass} />
            </label>
            <label className={labelClass}>
              Days (if no dates)
              <input
                name="dayCount"
                type="number"
                min={1}
                max={60}
                defaultValue={data.days.length}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Budget (₱)
              <input
                name="budget"
                inputMode="decimal"
                defaultValue={trip.budgetMinor === null ? "" : String(trip.budgetMinor / 100)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Day starts
              <input
                name="dayStartTime"
                type="time"
                required
                defaultValue={preferences.dayStartTime}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Day ends
              <input
                name="dayEndTime"
                type="time"
                required
                defaultValue={preferences.dayEndTime}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Pace
              <select name="pace" defaultValue={preferences.pace} className={inputClass}>
                {PACES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Max travel per day (min)
              <input
                name="maxTravel"
                type="number"
                min={0}
                max={1440}
                defaultValue={preferences.maxDailyTravelMin ?? ""}
                className={inputClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Interests (comma separated)
            <input name="interests" defaultValue={preferences.interests.join(", ")} className={inputClass} />
          </label>
          <label className={labelClass}>
            Notes for planning
            <textarea name="notes" rows={2} defaultValue={preferences.notes ?? ""} className={inputClass} />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" className={primaryButton} disabled={actions.updateTrip.isPending}>
              Save
            </button>
            <button type="button" className={secondaryButton} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
