"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateTrip } from "@/lib/mutations";
import { inputClass, labelClass, parseMoney, primaryButton, secondaryButton, textOrNull } from "@/lib/ui";

export function NewTripForm() {
  const [open, setOpen] = useState(false);
  const create = useCreateTrip();
  const router = useRouter();

  if (!open) {
    return (
      <button type="button" className={primaryButton} onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" /> New trip
      </button>
    );
  }

  return (
    <form
      aria-label="New trip"
      className="flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const startDate = textOrNull(f.get("startDate"));
        const endDate = textOrNull(f.get("endDate"));
        create.mutate(
          {
            name: String(f.get("name")).trim(),
            regionName: textOrNull(f.get("regionName")),
            ...(startDate && endDate ? { startDate, endDate } : { dayCount: Number(f.get("dayCount") || 1) }),
            budgetMinor: parseMoney(f.get("budget")),
          },
          { onSuccess: (trip) => router.push(`/trips/${trip.trip.id}`) },
        );
      }}
    >
      <label className={labelClass}>
        Trip name
        <input name="name" required maxLength={120} className={inputClass} placeholder="Weekend in Bohol" />
      </label>
      <label className={labelClass}>
        Destination region
        <input name="regionName" className={inputClass} placeholder="Bohol, Philippines" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={labelClass}>
          Start date
          <input name="startDate" type="date" className={inputClass} />
        </label>
        <label className={labelClass}>
          End date
          <input name="endDate" type="date" className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={labelClass}>
          Days (if no dates)
          <input name="dayCount" type="number" min={1} max={60} defaultValue={3} className={inputClass} />
        </label>
        <label className={labelClass}>
          Budget (₱)
          <input name="budget" inputMode="decimal" className={inputClass} placeholder="10000" />
        </label>
      </div>
      {create.isError ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className={primaryButton} disabled={create.isPending}>
          Create trip
        </button>
        <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
