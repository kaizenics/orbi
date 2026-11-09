"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTripInput,
  TripAggregate,
  TripPreferences,
  UpdateDayInput,
  UpdateDestinationInput,
  UpdateItemInput,
  UpdateTripInput,
} from "@orbi/core";
import { api, unwrap } from "./api";
import { queryKeys } from "./queries";

/** Runs a mutation, then refetches the trip (routes refetch themselves from the new order). */
function useTripAction<V>(tripId: string, run: (vars: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripInput) => unwrap(await api().trips.$post({ json: input })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips }),
  });
}

export function useTripActions(tripId: string) {
  const queryClient = useQueryClient();
  const tripKey = queryKeys.trip(tripId);

  /** Optimistic reorder with rollback: the list moves instantly and snaps back if saving fails. */
  const reorder = useMutation({
    mutationFn: async ({ dayId, itemIds }: { dayId: string; itemIds: string[] }) =>
      unwrap(await api().days[":id"].order.$put({ param: { id: dayId }, json: { itemIds } })),
    onMutate: async ({ dayId, itemIds }) => {
      await queryClient.cancelQueries({ queryKey: tripKey });
      const previous = queryClient.getQueryData<TripAggregate>(tripKey);
      if (previous) {
        queryClient.setQueryData<TripAggregate>(tripKey, {
          ...previous,
          days: previous.days.map((d) =>
            d.id !== dayId
              ? d
              : {
                  ...d,
                  items: itemIds.map((id, position) => ({ ...d.items.find((i) => i.id === id)!, position })),
                },
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(tripKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tripKey }),
  });

  return {
    reorder,
    updateTrip: useTripAction(tripId, async (json: UpdateTripInput) =>
      unwrap(await api().trips[":tripId"].$patch({ param: { tripId }, json })),
    ),
    putPreferences: useTripAction(tripId, async (json: TripPreferences) =>
      unwrap(await api().trips[":tripId"].preferences.$put({ param: { tripId }, json })),
    ),
    updateDay: useTripAction(tripId, async ({ id, ...json }: UpdateDayInput & { id: string }) =>
      unwrap(await api().days[":id"].$patch({ param: { id }, json })),
    ),
    scheduleItem: useTripAction(
      tripId,
      async ({ dayId, destinationId }: { dayId: string; destinationId: string }) =>
        unwrap(await api().days[":id"].items.$post({ param: { id: dayId }, json: { destinationId } })),
    ),
    moveItem: useTripAction(
      tripId,
      async ({ id, toDayId, toPosition }: { id: string; toDayId: string; toPosition: number }) =>
        unwrap(await api().items[":id"].move.$post({ param: { id }, json: { toDayId, toPosition } })),
    ),
    updateItem: useTripAction(tripId, async ({ id, ...json }: UpdateItemInput & { id: string }) =>
      unwrap(await api().items[":id"].$patch({ param: { id }, json })),
    ),
    removeItem: useTripAction(tripId, async (id: string) =>
      unwrap(await api().items[":id"].$delete({ param: { id } })),
    ),
    updateDestination: useTripAction(
      tripId,
      async ({ id, ...json }: UpdateDestinationInput & { id: string }) =>
        unwrap(await api().destinations[":id"].$patch({ param: { id }, json })),
    ),
    deleteDestination: useTripAction(tripId, async (id: string) =>
      unwrap(await api().destinations[":id"].$delete({ param: { id } })),
    ),
  };
}

export type TripActions = ReturnType<typeof useTripActions>;

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await api().trips[":tripId"].$delete({ param: { tripId } });
      if (!res.ok) await unwrap(res);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips }),
  });
}

export function useAiActions(tripId: string) {
  const queryClient = useQueryClient();
  return {
    draft: useMutation({
      mutationFn: async (prompt: string) =>
        unwrap(await api().trips[":tripId"].ai.drafts.$post({ param: { tripId }, json: { prompt } })),
    }),
    edit: useMutation({
      mutationFn: async (instruction: string) =>
        unwrap(await api().trips[":tripId"].ai.edits.$post({ param: { tripId }, json: { instruction } })),
    }),
    apply: useMutation({
      mutationFn: async ({ id, exclude }: { id: string; exclude: string[] }) =>
        unwrap(await api().proposals[":id"].apply.$post({ param: { id }, json: { exclude } })),
      onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) }),
    }),
    discard: useMutation({
      mutationFn: async (id: string) => unwrap(await api().proposals[":id"].$delete({ param: { id } })),
    }),
  };
}
