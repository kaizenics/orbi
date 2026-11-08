"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateDestinationInput, LatLng, TripAggregate } from "@orbi/core";
import { api, unwrap } from "./api";

export const queryKeys = {
  config: ["config"] as const,
  trips: ["trips"] as const,
  trip: (tripId: string) => ["trips", tripId] as const,
  dayRoute: (dayId: string, signature: string) => ["dayRoute", dayId, signature] as const,
  placeSearch: (q: string, near: string | undefined) => ["placeSearch", q, near] as const,
};

export function useClientConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: async () => unwrap(await api().config.$get()),
    staleTime: Infinity,
  });
}

export function useTrips() {
  return useQuery({ queryKey: queryKeys.trips, queryFn: async () => unwrap(await api().trips.$get()) });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: async () => unwrap(await api().trips[":tripId"].$get({ param: { tripId } })),
  });
}

/**
 * Routes for every day of a trip. The query key includes the day's ordered stops and mode, so any
 * itinerary change refetches exactly the affected day (the server serves unchanged legs from cache).
 */
export function useDayRoutes(data: TripAggregate | undefined) {
  const days = data?.days ?? [];
  const results = useQueries({
    queries: days.map((day) => {
      const signature = `${day.travelMode ?? data!.trip.defaultTravelMode}:${day.items.map((i) => `${i.id}/${i.travelModeToNext ?? ""}`).join(",")}`;
      return {
        queryKey: queryKeys.dayRoute(day.id, signature),
        queryFn: async () => unwrap(await api().days[":id"].route.$get({ param: { id: day.id }, query: {} })),
        enabled: day.items.length >= 2,
        staleTime: 5 * 60_000,
      };
    }),
  });
  return days.map((day, i) => ({ dayId: day.id, query: results[i]! }));
}

export function usePlaceSearch(q: string, near: LatLng | undefined) {
  const nearParam = near ? `${near.lat.toFixed(4)},${near.lng.toFixed(4)}` : undefined;
  return useQuery({
    queryKey: queryKeys.placeSearch(q, nearParam),
    queryFn: async () =>
      unwrap(await api().places.search.$get({ query: { q, near: nearParam, limit: "8" } })),
    enabled: q.trim().length >= 2,
    staleTime: Infinity,
  });
}

export function useAddDestination(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDestinationInput) =>
      unwrap(await api().trips[":tripId"].destinations.$post({ param: { tripId }, json: input })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
  });
}
