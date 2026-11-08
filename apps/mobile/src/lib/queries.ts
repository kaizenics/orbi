import { useQueries, useQuery } from "@tanstack/react-query";
import type { TripAggregate } from "@orbi/core";
import { api, unwrap } from "./api";

export function useClientConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => unwrap(await api.config.$get()),
    staleTime: Infinity,
  });
}

export function useTrips() {
  return useQuery({ queryKey: ["trips"], queryFn: async () => unwrap(await api.trips.$get()) });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ["trips", tripId],
    queryFn: async () => unwrap(await api.trips[":tripId"].$get({ param: { tripId } })),
  });
}

/** Routes per day; the key includes the ordered stops so itinerary changes refetch the affected day. */
export function useDayRoutes(data: TripAggregate | undefined) {
  const days = data?.days ?? [];
  const results = useQueries({
    queries: days.map((day) => ({
      queryKey: [
        "dayRoute",
        day.id,
        `${day.travelMode ?? data!.trip.defaultTravelMode}:${day.items.map((i) => `${i.id}/${i.travelModeToNext ?? ""}`).join(",")}`,
      ],
      queryFn: async () => unwrap(await api.days[":id"].route.$get({ param: { id: day.id }, query: {} })),
      enabled: day.items.length >= 2,
      staleTime: 5 * 60_000,
    })),
  });
  return days.map((day, i) => ({ dayId: day.id, query: results[i]! }));
}
