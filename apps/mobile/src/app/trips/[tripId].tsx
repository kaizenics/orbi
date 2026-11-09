import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { computeDaySchedule, formatClock, type DayRoute, type TravelMode } from "@orbi/core";
import { buildNavigationLinks, formatDistance, formatDuration } from "@orbi/geo/utils";
import { dayColor } from "@orbi/theme";
import { ErrorState, Loading } from "@/components/state";
import { TripMap } from "@/components/trip-map";
import { formatDate, formatMinutes } from "@/lib/format";
import { useClientConfig, useDayRoutes, useTrip, useTripEdits } from "@/lib/queries";

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useTrip(tripId);
  const config = useClientConfig();
  const routeQueries = useDayRoutes(trip.data);
  const edits = useTripEdits(tripId);
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const routes = useMemo(() => {
    const map = new Map<string, DayRoute>();
    for (const r of routeQueries) if (r.query.data) map.set(r.dayId, r.query.data);
    return map;
  }, [routeQueries]);

  if (trip.isPending) return <Loading label="Loading trip…" />;
  if (trip.isError) return <ErrorState message={trip.error.message} onRetry={() => trip.refetch()} />;

  const { days, destinations } = trip.data;
  const day = days[dayIndex] ?? days[0];
  const mode: TravelMode = day?.travelMode ?? trip.data.trip.defaultTravelMode;
  const dayRoute = day ? routes.get(day.id) : undefined;
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const items = day?.items ?? [];
  const schedule = computeDaySchedule({
    startTime: day?.startTime ?? trip.data.preferences.dayStartTime,
    endTime: trip.data.preferences.dayEndTime,
    maxTravelMin: trip.data.preferences.maxDailyTravelMin,
    stops: items.map((i) => ({
      itemId: i.id,
      durationMin: i.durationOverrideMin ?? byId.get(i.destinationId)?.visitDurationMin ?? 0,
      fixedStartTime: i.fixedStartTime,
    })),
    legSeconds: items.slice(0, -1).map((i) => {
      const leg = dayRoute?.legs.find((l) => l.fromItemId === i.id);
      return leg?.status === "routed" ? leg.durationS : null;
    }),
  });
  /** Accessible reorder (no drag needed): swaps the item with its neighbour. */
  const shift = (index: number, by: -1 | 1) => {
    const ids = items.map((i) => i.id);
    const target = index + by;
    if (!day || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    edits.reorder.mutate({ dayId: day.id, itemIds: ids });
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: trip.data.trip.name }} />
      <View className="h-[45%] bg-muted">
        {config.data ? (
          <TripMap
            styleUrl={config.data.map.styleUrl}
            data={trip.data}
            routes={routes}
            dayIndex={dayIndex}
            selectedItemId={selectedItemId}
            onSelectItem={(itemId, i) => {
              setDayIndex(i);
              setSelectedItemId(itemId);
            }}
          />
        ) : (
          <Loading label={config.isError ? "Map unavailable" : "Loading map…"} />
        )}
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 py-3"
        >
          {days.map((d, i) => (
            <Pressable
              key={d.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === dayIndex }}
              onPress={() => {
                setDayIndex(i);
                setSelectedItemId(null);
              }}
              className={`flex-row items-center gap-2 rounded-md border px-3 py-2 ${
                i === dayIndex ? "border-foreground bg-muted" : "border-border"
              }`}
            >
              <View className="size-2.5 rounded-full" style={{ backgroundColor: dayColor(i) }} />
              <Text className="text-sm text-foreground">Day {i + 1}</Text>
              {d.date ? <Text className="text-sm text-muted-foreground">{formatDate(d.date)}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={day?.items ?? []}
        keyExtractor={(i) => i.id}
        contentContainerClassName="px-4 pb-6"
        ListHeaderComponent={
          day?.title ? (
            <Text className="pb-2 text-base font-semibold text-foreground">{day.title}</Text>
          ) : undefined
        }
        ListEmptyComponent={<Text className="text-sm text-muted-foreground">No stops on this day yet.</Text>}
        renderItem={({ item, index }) => {
          const dest = byId.get(item.destinationId);
          if (!dest) return null;
          const leg = dayRoute?.legs.find((l) => l.fromItemId === item.id);
          const selected = selectedItemId === item.id;
          return (
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedItemId(item.id)}
                className={`flex-row gap-3 rounded-lg border bg-card p-3 ${selected ? "border-foreground" : "border-border"}`}
              >
                <View
                  accessibilityLabel={`Stop ${index + 1}`}
                  className="size-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: dayColor(dayIndex) }}
                >
                  <Text className="text-xs font-semibold text-white">{index + 1}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-medium text-foreground">{dest.name}</Text>
                  {dest.address ? (
                    <Text className="text-xs text-muted-foreground">{dest.address}</Text>
                  ) : null}
                  <Text className="text-xs text-muted-foreground">
                    {schedule.stops[index]?.arrival != null
                      ? `${formatClock(schedule.stops[index]!.arrival!)}–${formatClock(schedule.stops[index]!.departure!)} · `
                      : ""}
                    {formatMinutes(item.durationOverrideMin ?? dest.visitDurationMin)} · {dest.category}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${dest.name} in maps`}
                  hitSlop={8}
                  onPress={() =>
                    Linking.openURL(
                      buildNavigationLinks({ lat: dest.latitude, lng: dest.longitude, name: dest.name }, mode)
                        .geo,
                    )
                  }
                >
                  <Text className="text-xs font-medium text-accent-foreground">Navigate</Text>
                </Pressable>
              </Pressable>
              {selected ? (
                <View className="flex-row flex-wrap gap-2 pt-2">
                  <ActionChip label="Move up" disabled={index === 0} onPress={() => shift(index, -1)} />
                  <ActionChip
                    label="Move down"
                    disabled={index === items.length - 1}
                    onPress={() => shift(index, 1)}
                  />
                  {days.map((d, n) =>
                    d.id === day?.id ? null : (
                      <ActionChip
                        key={d.id}
                        label={`To day ${n + 1}`}
                        onPress={() => {
                          setSelectedItemId(null);
                          edits.move.mutate({ id: item.id, toDayId: d.id });
                        }}
                      />
                    ),
                  )}
                  <ActionChip
                    label="Remove"
                    onPress={() => {
                      setSelectedItemId(null);
                      edits.remove.mutate(item.id);
                    }}
                  />
                </View>
              ) : null}
              {index < (day?.items.length ?? 0) - 1 ? (
                <Text className="py-1.5 pl-4 text-xs text-muted-foreground">
                  {!leg
                    ? "…"
                    : leg.status === "routed"
                      ? `↓ ${formatDuration(leg.durationS)} · ${formatDistance(leg.distanceM)} ${leg.mode === "walking" ? "walk" : "drive"}`
                      : `↓ ${formatDistance(leg.straightLineM)} straight line · no road route`}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

function ActionChip(props: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      className={`rounded-md border border-border px-3 py-1.5 ${props.disabled ? "opacity-40" : ""}`}
    >
      <Text className="text-xs font-medium text-foreground">{props.label}</Text>
    </Pressable>
  );
}
