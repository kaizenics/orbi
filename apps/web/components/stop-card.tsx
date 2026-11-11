"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Pencil, X } from "lucide-react";
import {
  DESTINATION_CATEGORIES,
  type Destination,
  type ItineraryItem,
  type ScheduledStop,
  type TravelMode,
} from "@orbi/core";
import { buildNavigationLinks } from "@orbi/geo/utils";
import type { TripActions } from "@/lib/mutations";
import { currencySymbol, formatMinutes, formatMoney } from "@/lib/format";
import { useFormatters } from "@/lib/preferences";
import { labelClass, parseMoney, textOrNull } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormSelect } from "./form-select";
import { cn } from "@/lib/utils";

interface StopCardProps {
  item: ItineraryItem;
  destination: Destination;
  mode: TravelMode;
  currency: string;
  schedule: ScheduledStop | undefined;
  /** Minutes this stop is reached after its fixed time, if late. */
  lateMin: number | undefined;
  selected: boolean;
  onSelect: () => void;
  days: { id: string; label: string }[];
  currentDayId: string;
  actions: TripActions;
}

/** Small rounded label like "STAY 1 h" on a timeline card. */
export function Chip({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        tone === "warn"
          ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
          : "text-muted-foreground [&_b]:text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** A place on the day timeline: name and time, chips, and actions. Dragging is handled by the row. */
export function StopCard(props: StopCardProps) {
  const { item, destination: d, actions } = props;
  const [editing, setEditing] = useState(false);
  const nav = buildNavigationLinks({ lat: d.latitude, lng: d.longitude, name: d.name }, props.mode);
  const duration = item.durationOverrideMin ?? d.visitDurationMin;
  const s = props.schedule;
  const { clock } = useFormatters();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        props.selected && "border-primary/60 bg-accent/40",
      )}
    >
      <div className="flex">
        <button
          type="button"
          onClick={props.onSelect}
          aria-pressed={props.selected}
          className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 text-left focus-visible:outline-none"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="font-semibold">{d.name}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {s?.arrival != null ? clock(s.arrival) : "–"}
            </span>
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Chip>
              STAY <b>{formatMinutes(duration)}</b>
            </Chip>
            {item.fixedStartTime ? (
              <Chip>
                FIXED <b>{item.fixedStartTime}</b>
              </Chip>
            ) : null}
            {d.estCostMinor !== null ? (
              <Chip>
                <b>{formatMoney(d.estCostMinor, props.currency)}</b>
                {d.costSource === "ai_estimate" ? "est." : ""}
              </Chip>
            ) : null}
            {props.lateMin ? (
              <Chip tone="warn">
                <AlertTriangle aria-hidden className="size-3" /> +{formatMinutes(props.lateMin)}
              </Chip>
            ) : null}
          </span>
          {d.address ? <span className="truncate text-xs text-muted-foreground">{d.address}</span> : null}
          {item.notes ? <span className="text-xs">{item.notes}</span> : null}
        </button>
        {/* Own column, so long names and addresses can never run under the buttons. */}
        <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l px-1 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={`Edit ${d.name}`}
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
            className="size-7 text-muted-foreground"
          >
            <Pencil aria-hidden className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" asChild className="size-7 text-muted-foreground">
            <a
              href={nav.google}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${d.name} in Google Maps`}
            >
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={`Remove ${d.name} from this day`}
            onClick={() => actions.removeItem.mutate(item.id)}
            className="size-7 text-muted-foreground hover:text-destructive"
          >
            <X aria-hidden className="size-3.5" />
          </Button>
        </div>
      </div>

      {editing ? (
        <form
          aria-label={`Edit ${d.name}`}
          className="flex flex-col gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            actions.updateDestination.mutate({
              id: d.id,
              name: String(f.get("name")).trim(),
              category: f.get("category") as Destination["category"],
              visitDurationMin: Number(f.get("duration")),
              estCostMinor: parseMoney(f.get("cost")),
              costSource: parseMoney(f.get("cost")) === null ? null : "user",
              openingHours: textOrNull(f.get("openingHours")),
              openingHoursSource: textOrNull(f.get("openingHours")) ? "user" : null,
              description: textOrNull(f.get("description")),
            });
            actions.updateItem.mutate({
              id: item.id,
              fixedStartTime: textOrNull(f.get("fixedStartTime")),
              durationOverrideMin: null,
              notes: textOrNull(f.get("notes")),
            });
            setEditing(false);
          }}
        >
          <Label className={labelClass}>
            Name
            <Input name="name" required maxLength={120} defaultValue={d.name} />
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Label className={labelClass}>
              Visit (minutes)
              <Input name="duration" type="number" min={0} max={1440} defaultValue={duration} />
            </Label>
            <Label className={labelClass}>
              Fixed arrival
              <Input name="fixedStartTime" type="time" defaultValue={item.fixedStartTime ?? ""} />
            </Label>
            <Label className={labelClass}>
              Category
              <FormSelect
                name="category"
                defaultValue={d.category}
                options={DESTINATION_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </Label>
            <Label className={labelClass}>
              Estimated cost ({currencySymbol(props.currency)})
              <Input
                name="cost"
                inputMode="decimal"
                defaultValue={d.estCostMinor === null ? "" : String(d.estCostMinor / 100)}
              />
            </Label>
          </div>
          <Label className={labelClass}>
            Opening hours (as you know them)
            <Input name="openingHours" defaultValue={d.openingHours ?? ""} />
          </Label>
          <Label className={labelClass}>
            Description
            <Textarea name="description" rows={2} defaultValue={d.description ?? ""} />
          </Label>
          <Label className={labelClass}>
            Notes for this visit
            <Textarea name="notes" rows={2} defaultValue={item.notes ?? ""} />
          </Label>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit">Save</Button>
            <Button variant="outline" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Label className={`${labelClass} ml-auto`}>
              Move to day
              <FormSelect
                value={props.currentDayId}
                onValueChange={(toDayId) =>
                  actions.moveItem.mutate({ id: item.id, toDayId, toPosition: 999 })
                }
                options={props.days.map((day) => ({ value: day.id, label: day.label }))}
              />
            </Label>
          </div>
        </form>
      ) : null}
    </div>
  );
}
