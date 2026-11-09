"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertTriangle, ArrowDown } from "lucide-react";
import {
  computeDaySchedule,
  formatClock,
  type DayRoute,
  type Destination,
  type RouteLeg,
  type TravelMode,
  type TripAggregate,
  type TripDayWithItems,
} from "@orbi/core";
import { formatDistance, formatDuration } from "@orbi/geo/utils";
import type { TripActions } from "@/lib/mutations";
import { formatMinutes, formatMoney } from "@/lib/format";
import { inputClass, labelClass } from "@/lib/ui";
import { PanelMessage } from "./planner-shell";
import { StopCard } from "./stop-card";

interface DayPlanProps {
  data: TripAggregate;
  day: TripDayWithItems;
  dayIndex: number;
  color: string;
  route: DayRoute | undefined;
  byId: ReadonlyMap<string, Destination>;
  dayCostMinor: number;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  actions: TripActions;
}

export function DayPlan(props: DayPlanProps) {
  const { data, day, route, byId, actions } = props;
  const mode: TravelMode = day.travelMode ?? data.trip.defaultTravelMode;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const legAfter = (itemId: string): RouteLeg | undefined => route?.legs.find((l) => l.fromItemId === itemId);
  const schedule = computeDaySchedule({
    startTime: day.startTime ?? data.preferences.dayStartTime,
    endTime: data.preferences.dayEndTime,
    maxTravelMin: data.preferences.maxDailyTravelMin,
    stops: day.items.map((i) => ({
      itemId: i.id,
      durationMin: i.durationOverrideMin ?? byId.get(i.destinationId)?.visitDurationMin ?? 0,
      fixedStartTime: i.fixedStartTime,
    })),
    legSeconds: day.items.slice(0, -1).map((i) => {
      const leg = legAfter(i.id);
      return leg?.status === "routed" ? leg.durationS : null;
    }),
  });
  const nameOf = (itemId: string) =>
    byId.get(day.items.find((i) => i.id === itemId)?.destinationId ?? "")?.name;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = day.items.map((i) => i.id);
    actions.reorder.mutate({
      dayId: day.id,
      itemIds: arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    });
  };

  return (
    <section role="tabpanel" aria-label={`Day ${props.dayIndex + 1}`} className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
        <label className={labelClass}>
          Day title
          <input
            key={`title-${day.id}`}
            defaultValue={day.title ?? ""}
            placeholder={`Day ${props.dayIndex + 1}`}
            maxLength={120}
            className={inputClass}
            onBlur={(e) => {
              const title = e.target.value.trim() || null;
              if (title !== day.title) actions.updateDay.mutate({ id: day.id, title });
            }}
          />
        </label>
        <label className={labelClass}>
          Start
          <input
            key={`start-${day.id}`}
            type="time"
            defaultValue={day.startTime ?? data.preferences.dayStartTime}
            className={inputClass}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== day.startTime) {
                actions.updateDay.mutate({ id: day.id, startTime: e.target.value });
              }
            }}
          />
        </label>
        <label className={labelClass}>
          Travel
          <select
            value={mode}
            className={inputClass}
            onChange={(e) =>
              actions.updateDay.mutate({ id: day.id, travelMode: e.target.value as TravelMode })
            }
          >
            <option value="walking">Walking</option>
            <option value="driving">Driving</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {day.items.length} stop{day.items.length === 1 ? "" : "s"} · visits {formatMinutes(schedule.visitMin)}{" "}
        · travel {schedule.travelIncomplete ? "at least " : ""}
        {formatMinutes(schedule.travelMin)}
        {route && route.totals.distanceM > 0 ? ` (${formatDistance(route.totals.distanceM)})` : ""} · est.{" "}
        {formatMoney(props.dayCostMinor, data.trip.currency)}
        {schedule.stops.at(-1)?.departure != null
          ? ` · ends ${formatClock(schedule.stops.at(-1)!.departure!)}`
          : ""}
      </p>

      {schedule.warnings.length ? (
        <ul role="alert" className="flex flex-col gap-1 rounded-md border border-destructive/40 p-2 text-xs">
          {schedule.warnings.map((w) => (
            <li key={`${w.code}-${"itemId" in w ? w.itemId : ""}`} className="flex items-center gap-1.5">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0 text-destructive" />
              {w.code === "fixed_time_missed"
                ? `${nameOf(w.itemId)} is reached ${formatMinutes(w.lateMin)} after its fixed time.`
                : w.code === "past_day_end"
                  ? `The day runs ${formatMinutes(w.overMin)} past ${data.preferences.dayEndTime}.`
                  : `Travel is ${formatMinutes(w.overMin)} over your daily limit.`}
            </li>
          ))}
        </ul>
      ) : null}

      {actions.reorder.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t save the new order ({actions.reorder.error.message}). It was put back.
        </p>
      ) : null}

      {day.items.length === 0 ? (
        <PanelMessage title="No stops on this day yet">
          Search for a place below, or schedule an idea.
        </PanelMessage>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col">
              {day.items.map((item, i) => {
                const dest = byId.get(item.destinationId);
                if (!dest) return null;
                return (
                  <li key={item.id} data-item-id={item.id}>
                    <StopCard
                      item={item}
                      destination={dest}
                      number={i + 1}
                      color={props.color}
                      mode={mode}
                      currency={data.trip.currency}
                      schedule={schedule.stops[i]}
                      selected={props.selectedItemId === item.id}
                      onSelect={() => props.onSelectItem(item.id)}
                      days={data.days.map((d, n) => ({ id: d.id, label: `Day ${n + 1}` }))}
                      currentDayId={day.id}
                      actions={actions}
                    />
                    {i < day.items.length - 1 ? <LegRow leg={legAfter(item.id)} /> : null}
                  </li>
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function LegRow({ leg }: { leg: RouteLeg | undefined }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-7 text-xs text-muted-foreground">
      <ArrowDown aria-hidden className="size-3.5" />
      {!leg ? (
        <span>Calculating…</span>
      ) : leg.status === "routed" ? (
        <span>
          {formatDuration(leg.durationS)} · {formatDistance(leg.distanceM)}{" "}
          {leg.mode === "walking" ? "walk" : "drive"}
        </span>
      ) : (
        <span title={leg.reason}>
          {formatDistance(leg.straightLineM)} straight line · no road route available
        </span>
      )}
    </div>
  );
}
