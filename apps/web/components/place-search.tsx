"use client";

import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import type { LatLng, PlaceCandidate } from "@orbi/core";
import { useAddDestination, usePlaceSearch } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PlaceSearchProps {
  tripId: string;
  dayId: string | undefined;
  dayLabel: string;
  near: LatLng | undefined;
  existingRefs: ReadonlySet<string>;
}

/**
 * Submit-based place search (public Nominatim forbids search-as-you-type). Results carry the
 * provider's coordinates; adding one stores them unchanged.
 */
export function PlaceSearch({ tripId, dayId, dayLabel, near, existingRefs }: PlaceSearchProps) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const search = usePlaceSearch(query, near);
  const add = useAddDestination(tripId);

  const addPlace = (p: PlaceCandidate, toDay: boolean) =>
    add.mutate({
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      category: p.category,
      locationSource: p.source,
      sourceRef: p.sourceRef,
      ...(toDay && dayId ? { dayId } : {}),
    });

  return (
    <section aria-labelledby="search-heading" className="flex flex-col gap-3">
      <h2 id="search-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Add a place
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <Label htmlFor="place-query" className="sr-only">
          Search for a place
        </Label>
        <Input
          id="place-query"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search places, e.g. Fort San Pedro"
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={input.trim().length < 2 || search.isFetching}>
          {search.isFetching ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Search aria-hidden className="size-4" />
          )}
          Search
        </Button>
      </form>

      {search.isError ? <p className="text-sm text-destructive">{search.error.message}</p> : null}
      {add.isError ? <p className="text-sm text-destructive">{add.error.message}</p> : null}
      {search.data?.length === 0 ? <p className="text-sm text-muted-foreground">No places found.</p> : null}

      {search.data?.length ? (
        <ul className="flex flex-col gap-2" aria-label="Search results">
          {search.data.map((p) => {
            const added = p.sourceRef !== null && existingRefs.has(p.sourceRef);
            return (
              <li
                key={`${p.sourceRef ?? p.name}-${p.latitude}`}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.address ? <span className="text-xs text-muted-foreground">{p.address}</span> : null}
                </span>
                {added ? (
                  <span className="text-xs text-muted-foreground">Already in this trip</span>
                ) : (
                  <span className="flex flex-wrap gap-2">
                    {dayId ? (
                      <Button
                        size="sm"
                        type="button"
                        disabled={add.isPending}
                        onClick={() => addPlace(p, true)}
                      >
                        <Plus aria-hidden className="size-3.5" /> Add to {dayLabel}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={add.isPending}
                      onClick={() => addPlace(p, false)}
                    >
                      Save as idea
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
