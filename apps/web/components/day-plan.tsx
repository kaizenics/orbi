"use client";

import { useState } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Car, Footprints, MapPin, Plus, Route, SlidersHorizontal } from "lucide-react";
import {
  ACTIVITY_TYPES,
  computeDaySchedule,
  itemDurationMin,
  itemLegSeconds,
  type ActivityType,
  type DayRoute,
  type Destination,
  type ItineraryItem,
  type RouteLeg,
  type TravelMode,
  type TripAggregate,
  type TripDayWithItems,
} from "@orbi/core";
import { formatDuration } from "@orbi/geo/utils";
import { ACTIVITY_META } from "@/lib/activities";
import { useFormatters } from "@/lib/preferences";
import type { TripActions } from "@/lib/mutations";
import { formatMinutes, formatMoney } from "@/lib/format";
import { labelClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ActivityCard } from "./activity-card";
import { FormSelect } from "./form-select";
import { PanelMessage } from "./planner-shell";
import { StopCard } from "./stop-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const { clock, distance } = useFormatters();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mode: TravelMode = day.travelMode ?? data.trip.defaultTravelMode;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const schedule = computeDaySchedule({
    startTime: day.startTime ?? data.preferences.dayStartTime,
    endTime: data.preferences.dayEndTime,
    maxTravelMin: data.preferences.maxDailyTravelMin,
    stops: day.items.map((i) => ({
      itemId: i.id,
      durationMin: itemDurationMin(
        i,
        i.destinationId ? byId.get(i.destinationId)?.visitDurationMin : undefined,
      ),
      fixedStartTime: i.fixedStartTime,
    })),
    legSeconds: itemLegSeconds(day.items, route?.legs),
  });
  const late = new Map(
    schedule.warnings.flatMap((w) =>
      w.code === "fixed_time_missed" ? [[w.itemId, w.lateMin] as const] : [],
    ),
  );
  const legInto = (itemId: string): RouteLeg | undefined => route?.legs.find((l) => l.toItemId === itemId);
  const placeCount = day.items.filter((i) => i.destinationId).length;
  const end = schedule.stops.at(-1)?.departure;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = day.items.map((i) => i.id);
    actions.reorder.mutate({
      dayId: day.id,
      itemIds: arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    });
  };

  let placeNumber = 0;
  let placesSeen = 0;

  return (
    <section aria-label={`Day ${props.dayIndex + 1}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
        <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border py-1.5">
          <span className="text-lg leading-none font-bold">{props.dayIndex + 1}</span>
          {day.date ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              {new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="truncate font-semibold">{day.title ?? `Day ${props.dayIndex + 1}`}</p>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground uppercase">
            {route && route.totals.distanceM > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                {mode === "walking" ? (
                  <Footprints aria-hidden className="size-3" />
                ) : (
                  <Car aria-hidden className="size-3" />
                )}
                {distance(route.totals.distanceM)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
              <MapPin aria-hidden className="size-3" /> {placeCount}
            </span>
            {end != null ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                <Route aria-hidden className="size-3" /> ends {clock(end)}
              </span>
            ) : null}
            {props.dayCostMinor > 0 ? (
              <span className="rounded-full border px-2 py-0.5">
                {formatMoney(props.dayCostMinor, data.trip.currency)}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Day settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((o) => !o)}
          className="size-8 shrink-0 text-muted-foreground"
        >
          <SlidersHorizontal aria-hidden />
        </Button>
      </div>

      {settingsOpen ? (
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
          <Label className={labelClass}>
            Day title
            <Input
              key={`title-${day.id}`}
              defaultValue={day.title ?? ""}
              placeholder={`Day ${props.dayIndex + 1}`}
              maxLength={120}
              onBlur={(e) => {
                const title = e.target.value.trim() || null;
                if (title !== day.title) actions.updateDay.mutate({ id: day.id, title });
              }}
            />
          </Label>
          <Label className={labelClass}>
            Start
            <Input
              key={`start-${day.id}`}
              type="time"
              defaultValue={day.startTime ?? data.preferences.dayStartTime}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== day.startTime) {
                  actions.updateDay.mutate({ id: day.id, startTime: e.target.value });
                }
              }}
            />
          </Label>
          <Label className={labelClass}>
            Travel
            <FormSelect<TravelMode>
              value={mode}
              onValueChange={(travelMode) => actions.updateDay.mutate({ id: day.id, travelMode })}
              options={[
                { value: "walking", label: "Walking" },
                { value: "driving", label: "Driving" },
              ]}
            />
          </Label>
        </div>
      ) : null}

      {schedule.warnings.some((w) => w.code !== "fixed_time_missed") ? (
        <ul role="alert" className="flex flex-col gap-1 rounded-md border border-amber-500/40 p-2 text-xs">
          {schedule.warnings.map((w) =>
            w.code === "fixed_time_missed" ? null : (
              <li key={w.code} className="flex items-center gap-1.5">
                <AlertTriangle aria-hidden className="size-3.5 shrink-0 text-amber-500" />
                {w.code === "past_day_end"
                  ? `The day runs ${formatMinutes(w.overMin)} past ${data.preferences.dayEndTime}.`
                  : `Travel is ${formatMinutes(w.overMin)} over your daily limit.`}
              </li>
            ),
          )}
        </ul>
      ) : null}

      {actions.reorder.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t save the new order ({actions.reorder.error.message}). It was put back.
        </p>
      ) : null}

      {day.items.length === 0 ? (
        <PanelMessage title="Nothing planned for this day yet">
          Search for a place, schedule an idea, or add an activity like breakfast below.
        </PanelMessage>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="relative flex flex-col">
              <span aria-hidden className="absolute top-4 bottom-4 left-[15px] w-px bg-border" />
              {day.items.map((item, i) => {
                const isPlace = Boolean(item.destinationId);
                const dest = item.destinationId ? byId.get(item.destinationId) : undefined;
                if (isPlace && !dest) return null;
                const travel = isPlace && placesSeen++ > 0 ? legInto(item.id) : null;
                return (
                  <TimelineRow
                    key={item.id}
                    item={item}
                    label={dest?.name ?? item.title ?? "Activity"}
                    marker={
                      isPlace ? (
                        <span
                          className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-background"
                          style={{ backgroundColor: props.color }}
                        >
                          {++placeNumber}
                        </span>
                      ) : (
                        <ActivityMarker type={item.activityType!} />
                      )
                    }
                    before={travel === null ? null : <LegPill leg={travel} />}
                  >
                    {dest ? (
                      <StopCard
                        item={item}
                        destination={dest}
                        mode={mode}
                        currency={data.trip.currency}
                        schedule={schedule.stops[i]}
                        lateMin={late.get(item.id)}
                        selected={props.selectedItemId === item.id}
                        onSelect={() => props.onSelectItem(item.id)}
                        days={data.days.map((d, n) => ({ id: d.id, label: `Day ${n + 1}` }))}
                        currentDayId={day.id}
                        actions={actions}
                      />
                    ) : (
                      <ActivityCard
                        item={item}
                        schedule={schedule.stops[i]}
                        lateMin={late.get(item.id)}
                        actions={actions}
                      />
                    )}
                  </TimelineRow>
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <AddActivity dayId={day.id} actions={actions} />
    </section>
  );
}

/** One timeline entry: the marker on the line (also the drag handle) and its card. */
function TimelineRow({
  item,
  label,
  marker,
  before,
  children,
}: {
  item: ItineraryItem;
  label: string;
  marker: React.ReactNode;
  before: React.ReactNode;
  children: React.ReactNode;
}) {
  const sortable = useSortable({ id: item.id });
  return (
    <li
      ref={sortable.setNodeRef}
      data-item-id={item.id}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={cn("relative flex flex-col", sortable.isDragging && "z-10 opacity-90")}
    >
      {before ? <div className="py-1 pl-10">{before}</div> : null}
      <div className="grid grid-cols-[32px_1fr] items-start gap-2 py-1">
        <button
          type="button"
          aria-label={`Reorder ${label} (space to pick up, arrows to move)`}
          className="mt-1.5 cursor-grab touch-none rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          {marker}
        </button>
        <div className="min-w-0">{children}</div>
      </div>
    </li>
  );
}

function ActivityMarker({ type }: { type: ActivityType }) {
  const Icon = ACTIVITY_META[type].icon;
  return (
    <span className="flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground ring-4 ring-background">
      <Icon aria-hidden className="size-4" />
    </span>
  );
}

/** "🚗 49.1 km in 41 min" between two places. */
function LegPill({ leg }: { leg: RouteLeg | undefined }) {
  const { distance } = useFormatters();
  const Icon = leg?.mode === "walking" ? Footprints : Car;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      <Icon aria-hidden className="size-3.5" />
      {!leg ? (
        "Calculating…"
      ) : leg.status === "routed" ? (
        `${distance(leg.distanceM)} in ${formatDuration(leg.durationS)}`
      ) : (
        <span title={leg.reason}>{distance(leg.straightLineM)} straight line · no road route</span>
      )}
    </span>
  );
}

/** Adds a moment without a place (wake up, breakfast, rest…) to the end of the day. */
function AddActivity({ dayId, actions }: { dayId: string; actions: TripActions }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("breakfast");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(ACTIVITY_META.breakfast.defaultMin);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add activity
      </Button>
    );
  }
  return (
    <form
      aria-label="Add activity"
      className="flex flex-col gap-2 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        actions.addActivity.mutate(
          {
            dayId,
            activity: { type, title: title.trim() || ACTIVITY_META[type].label },
            durationOverrideMin: minutes,
          },
          { onSuccess: () => (setOpen(false), setTitle("")) },
        );
      }}
    >
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <Label className={labelClass}>
          Activity
          <FormSelect<ActivityType>
            value={type}
            onValueChange={(t) => {
              setType(t);
              setMinutes(ACTIVITY_META[t].defaultMin);
            }}
            options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_META[t].label }))}
          />
        </Label>
        <Label className={labelClass}>
          Minutes
          <Input
            type="number"
            min={5}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 5)}
          />
        </Label>
      </div>
      <Label className={labelClass}>
        Label (optional)
        <Input
          value={title}
          maxLength={120}
          placeholder={`${ACTIVITY_META[type].label}, e.g. at the hotel`}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Label>
      {actions.addActivity.isError ? (
        <p className="text-sm text-destructive">{actions.addActivity.error.message}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={actions.addActivity.isPending}>
          Add
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
