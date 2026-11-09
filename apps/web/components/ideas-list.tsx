"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import type { Destination } from "@orbi/core";
import type { TripActions } from "@/lib/mutations";
import { Button } from "@/components/ui/button";

/** Places saved to the trip but not scheduled on any day. */
export function IdeasList(props: {
  ideas: Destination[];
  dayId: string | undefined;
  dayLabel: string;
  actions: TripActions;
}) {
  if (props.ideas.length === 0) return null;
  return (
    <section aria-labelledby="ideas-heading" className="flex flex-col gap-2">
      <h2 id="ideas-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Ideas · not scheduled
      </h2>
      <ul className="flex flex-col gap-1 text-sm">
        {props.ideas.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            {props.dayId ? (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`Add ${d.name} to ${props.dayLabel}`}
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  props.actions.scheduleItem.mutate({ dayId: props.dayId!, destinationId: d.id })
                }
              >
                <CalendarPlus aria-hidden className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`Delete ${d.name}`}
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => props.actions.deleteDestination.mutate(d.id)}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
