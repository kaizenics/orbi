import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { DayRoute, TravelMode } from "@orbi/core";
import { buildNavigationLinks, formatDistance, formatDuration } from "@orbi/geo/utils";
import { dayColor } from "@orbi/theme";
import { ErrorState, Loading } from "@/components/state";
import { TripMap } from "@/components/trip-map";
import { formatDate, formatMinutes } from "@/lib/format";
import { useClientConfig, useDayRoutes, useTrip } from "@/lib/queries";

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useTrip(tripId);
  const config = useClientConfig();
  const routeQueries = useDayRoutes(trip.data);
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
