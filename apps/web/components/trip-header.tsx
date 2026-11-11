"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ApiError } from "@orbi/api/client";
import { PACES, type CostSummary, type Pace, type TripAggregate, type UpdateTripInput } from "@orbi/core";
import { useDeleteTrip, type TripActions } from "@/lib/mutations";
import { CURRENCY_OPTIONS, currencySymbol, formatDateRange, formatMoney } from "@/lib/format";
import { labelClass, parseMoney, textOrNull } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import { FormSelect } from "./form-select";
import { useConfirm } from "./confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const confirm = useConfirm();

  const save = async (form: FormData) => {
    setError(null);
    const startDate = textOrNull(form.get("startDate"));
    const endDate = textOrNull(form.get("endDate"));
    const update: UpdateTripInput = {
      name: String(form.get("name")).trim(),
      regionName: textOrNull(form.get("regionName")),
      budgetMinor: parseMoney(form.get("budget")),
      currency: String(form.get("currency") || trip.currency),
      ...(startDate && endDate
        ? { startDate, endDate }
        : { startDate: null, endDate: null, dayCount: Number(form.get("dayCount") || data.days.length) }),
    };
    try {
      await actions.updateTrip.mutateAsync(update).catch(async (e: unknown) => {
        if (
          !(e instanceof ApiError) ||
          e.code !== "confirmation_required" ||
          !(await confirm({
            title: "Remove days from this trip?",
            description: `${e.message.split(". Resend")[0]}.`,
            confirmLabel: "Remove days",
            destructive: true,
          }))
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
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Edit trip"
            aria-expanded={editing}
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Delete trip"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (
                await confirm({
                  title: `Delete "${trip.name}"?`,
                  description: "Everything in this trip will be deleted. This cannot be undone.",
                  confirmLabel: "Delete trip",
                  destructive: true,
                })
              ) {
                del.mutate(trip.id, { onSuccess: () => router.push("/trips") });
              }
            }}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
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

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit trip</DialogTitle>
            <DialogDescription>Dates, budget and how you like to travel.</DialogDescription>
          </DialogHeader>
          <form
            aria-label="Edit trip"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget));
            }}
          >
            <Label className={labelClass}>
              Name
              <Input name="name" required maxLength={120} defaultValue={trip.name} />
            </Label>
            <Label className={labelClass}>
              Region
              <Input name="regionName" defaultValue={trip.regionName ?? ""} />
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Label className={labelClass}>
                Start date
                <DatePicker name="startDate" defaultValue={trip.startDate ?? ""} />
              </Label>
              <Label className={labelClass}>
                End date
                <DatePicker name="endDate" defaultValue={trip.endDate ?? ""} />
              </Label>
              <Label className={labelClass}>
                Days (if no dates)
                <Input name="dayCount" type="number" min={1} max={60} defaultValue={data.days.length} />
              </Label>
              <Label className={labelClass}>
                Budget ({currencySymbol(trip.currency)})
                <Input
                  name="budget"
                  inputMode="decimal"
                  defaultValue={trip.budgetMinor === null ? "" : String(trip.budgetMinor / 100)}
                />
              </Label>
              <Label className={`${labelClass} col-span-2`}>
                Currency
                <FormSelect name="currency" defaultValue={trip.currency} options={CURRENCY_OPTIONS} />
              </Label>
              <Label className={labelClass}>
                Day starts
                <Input name="dayStartTime" type="time" required defaultValue={preferences.dayStartTime} />
              </Label>
              <Label className={labelClass}>
                Day ends
                <Input name="dayEndTime" type="time" required defaultValue={preferences.dayEndTime} />
              </Label>
              <Label className={labelClass}>
                Pace
                <FormSelect
                  name="pace"
                  defaultValue={preferences.pace}
                  options={PACES.map((p) => ({ value: p, label: p }))}
                />
              </Label>
              <Label className={labelClass}>
                Max travel per day (min)
                <Input
                  name="maxTravel"
                  type="number"
                  min={0}
                  max={1440}
                  defaultValue={preferences.maxDailyTravelMin ?? ""}
                />
              </Label>
            </div>
            <Label className={labelClass}>
              Interests (comma separated)
              <Input name="interests" defaultValue={preferences.interests.join(", ")} />
            </Label>
            <Label className={labelClass}>
              Notes for planning
              <Textarea name="notes" rows={2} defaultValue={preferences.notes ?? ""} />
            </Label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={actions.updateTrip.isPending}>
                Save
              </Button>
              <Button variant="outline" type="button" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
