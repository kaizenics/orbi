"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Clock, ExternalLink, GripVertical, Pencil, X } from "lucide-react";
import {
  DESTINATION_CATEGORIES,
  formatClock,
  type Destination,
  type ItineraryItem,
  type ScheduledStop,
  type TravelMode,
} from "@orbi/core";
import { buildNavigationLinks } from "@orbi/geo/utils";
import type { TripActions } from "@/lib/mutations";
import { formatMinutes, formatMoney } from "@/lib/format";
import { inputClass, labelClass, parseMoney, primaryButton, secondaryButton, textOrNull } from "@/lib/ui";

interface StopCardProps {
  item: ItineraryItem;
  destination: Destination;
  number: number;
  color: string;
  mode: TravelMode;
  currency: string;
  schedule: ScheduledStop | undefined;
  selected: boolean;
  onSelect: () => void;
  days: { id: string; label: string }[];
  currentDayId: string;
  actions: TripActions;
}

export function StopCard(props: StopCardProps) {
  const { item, destination: d, actions } = props;
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id: item.id });
  const nav = buildNavigationLinks({ lat: d.latitude, lng: d.longitude, name: d.name }, props.mode);
  const duration = item.durationOverrideMin ?? d.visitDurationMin;
  const s = props.schedule;

  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={`rounded-lg border bg-card transition-colors ${props.selected ? "border-foreground bg-muted" : ""} ${
        sortable.isDragging ? "relative z-10 shadow-md" : ""
      }`}
    >
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          aria-label={`Reorder ${d.name} (space to pick up, arrows to move)`}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={props.onSelect}
          aria-pressed={props.selected}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none"
        >
          <span
            aria-label={`Stop ${props.number}`}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: props.color }}
          >
            {props.number}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{d.name}</span>
            <span className="inline-flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
              <Clock aria-hidden className="size-3" />
              {s?.arrival != null && s.departure != null
                ? `${formatClock(s.arrival)}–${formatClock(s.departure)}`
                : "Time unknown"}
              {" · "}
              {formatMinutes(duration)}
              {item.fixedStartTime ? ` · fixed ${item.fixedStartTime}` : ""}
              {d.estCostMinor !== null
                ? ` · ${formatMoney(d.estCostMinor, props.currency)}${d.costSource === "ai_estimate" ? " (AI estimate)" : ""}`
                : ""}
            </span>
            {d.address ? <span className="truncate text-xs text-muted-foreground">{d.address}</span> : null}
            {item.notes ? <span className="text-xs">{item.notes}</span> : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={`Edit ${d.name}`}
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <a
            href={nav.google}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${d.name} in Google Maps`}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink aria-hidden className="size-4" />
          </a>
          <button
            type="button"
            aria-label={`Remove ${d.name} from this day`}
            onClick={() => actions.removeItem.mutate(item.id)}
            className="rounded-md p-1 text-muted-foreground hover:text-destructive"
          >
            <X aria-hidden className="size-4" />
          </button>
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
          <label className={labelClass}>
            Name
            <input name="name" required maxLength={120} defaultValue={d.name} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Visit (minutes)
              <input
                name="duration"
                type="number"
                min={0}
                max={1440}
                defaultValue={duration}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Fixed arrival
              <input
                name="fixedStartTime"
                type="time"
                defaultValue={item.fixedStartTime ?? ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Category
              <select name="category" defaultValue={d.category} className={inputClass}>
                {DESTINATION_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Estimated cost (₱)
              <input
                name="cost"
                inputMode="decimal"
                defaultValue={d.estCostMinor === null ? "" : String(d.estCostMinor / 100)}
                className={inputClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Opening hours (as you know them)
            <input name="openingHours" defaultValue={d.openingHours ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Description
            <textarea name="description" rows={2} defaultValue={d.description ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Notes for this visit
            <textarea name="notes" rows={2} defaultValue={item.notes ?? ""} className={inputClass} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="submit" className={primaryButton}>
              Save
            </button>
            <button type="button" className={secondaryButton} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <label className={`${labelClass} ml-auto`}>
              Move to day
              <select
                className={inputClass}
                value={props.currentDayId}
                onChange={(e) =>
                  actions.moveItem.mutate({ id: item.id, toDayId: e.target.value, toPosition: 999 })
                }
              >
                {props.days.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
      ) : null}
    </div>
  );
}
