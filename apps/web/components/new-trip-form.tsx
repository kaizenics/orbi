"use client";

import { useRouter } from "next/navigation";
import { useCreateTrip } from "@/lib/mutations";
import { labelClass, parseMoney, textOrNull } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import { FormSelect } from "@/components/form-select";
import { DEFAULTS } from "@orbi/core";
import { CURRENCY_OPTIONS } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** "New trip" form in a shadcn dialog; opens the trip once it is created. */
export function NewTripDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTrip();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New trip</DialogTitle>
          <DialogDescription>
            Add dates now or later. You can also paste an itinerary into the chat.
          </DialogDescription>
        </DialogHeader>
        <form
          aria-label="New trip"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const startDate = textOrNull(f.get("startDate"));
            const endDate = textOrNull(f.get("endDate"));
            create.mutate(
              {
                name: String(f.get("name")).trim(),
                regionName: textOrNull(f.get("regionName")),
                ...(startDate && endDate
                  ? { startDate, endDate }
                  : { dayCount: Number(f.get("dayCount") || 1) }),
                budgetMinor: parseMoney(f.get("budget")),
                currency: String(f.get("currency") || DEFAULTS.currency),
              },
              { onSuccess: (trip) => router.push(`/trips/${trip.trip.id}`) },
            );
          }}
        >
          <Label className={labelClass}>
            Trip name
            <Input name="name" required maxLength={120} placeholder="Weekend in Bohol" />
          </Label>
          <Label className={labelClass}>
            Destination region
            <Input name="regionName" placeholder="Bohol, Philippines" />
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Label className={labelClass}>
              Start date
              <DatePicker name="startDate" />
            </Label>
            <Label className={labelClass}>
              End date
              <DatePicker name="endDate" />
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Label className={labelClass}>
              Days (if no dates)
              <Input name="dayCount" type="number" min={1} max={60} defaultValue={3} />
            </Label>
            <Label className={labelClass}>
              Budget
              <Input name="budget" inputMode="decimal" placeholder="10000" />
            </Label>
          </div>
          <Label className={labelClass}>
            Currency
            <FormSelect name="currency" defaultValue={DEFAULTS.currency} options={CURRENCY_OPTIONS} />
          </Label>
          {create.isError ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              Create trip
            </Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
