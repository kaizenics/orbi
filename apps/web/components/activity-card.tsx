"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, X } from "lucide-react";
import { itemDurationMin, type ItineraryItem, type ScheduledStop } from "@orbi/core";
import type { TripActions } from "@/lib/mutations";
import { formatMinutes } from "@/lib/format";
import { useFormatters } from "@/lib/preferences";
import { labelClass, textOrNull } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "./stop-card";

/** A moment without a place (wake up, breakfast at the hotel, rest…) on the day timeline. */
export function ActivityCard({
  item,
  schedule,
  lateMin,
  actions,
}: {
  item: ItineraryItem;
  schedule: ScheduledStop | undefined;
  lateMin: number | undefined;
  actions: TripActions;
}) {
  const [editing, setEditing] = useState(false);
  const { clock } = useFormatters();
  const duration = itemDurationMin(item, undefined);

  if (editing) {
    return (
      <form
        aria-label={`Edit ${item.title}`}
        className="flex flex-col gap-2 rounded-xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          actions.updateItem.mutate({
            id: item.id,
            title: String(f.get("title")).trim() || item.title,
            durationOverrideMin: Number(f.get("duration")) || duration,
            fixedStartTime: textOrNull(f.get("fixedStartTime")),
          });
          setEditing(false);
        }}
      >
        <Label className={labelClass}>
          Activity
          <Input name="title" required maxLength={120} defaultValue={item.title ?? ""} />
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Label className={labelClass}>
            Minutes
            <Input name="duration" type="number" min={5} max={1440} defaultValue={duration} />
          </Label>
          <Label className={labelClass}>
            Fixed time
            <Input name="fixedStartTime" type="time" defaultValue={item.fixedStartTime ?? ""} />
          </Label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-medium">{item.title}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {schedule?.arrival != null ? clock(schedule.arrival) : "–"}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Chip>
            {item.fixedStartTime ? "AT" : "FOR"} <b>{item.fixedStartTime ?? formatMinutes(duration)}</b>
          </Chip>
          {lateMin ? (
            <Chip tone="warn">
              <AlertTriangle aria-hidden className="size-3" /> +{formatMinutes(lateMin)}
            </Chip>
          ) : null}
        </span>
      </div>
      <div className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`Edit ${item.title}`}
          onClick={() => setEditing(true)}
          className="size-7 text-muted-foreground"
        >
          <Pencil aria-hidden className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`Remove ${item.title}`}
          onClick={() => actions.removeItem.mutate(item.id)}
          className="size-7 text-muted-foreground hover:text-destructive"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
