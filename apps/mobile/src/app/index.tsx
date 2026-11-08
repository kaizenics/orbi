import { Link } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { APP_TAGLINE } from "@orbi/core";
import { Centered, ErrorState, Loading } from "@/components/state";
import { apiUrl } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useTrips } from "@/lib/queries";

export default function TripsScreen() {
  const trips = useTrips();

  if (!apiUrl) {
    return (
      <Centered>
        <Text className="text-center text-base text-foreground">
          Set EXPO_PUBLIC_API_URL in apps/mobile/.env
        </Text>
      </Centered>
    );
  }
  if (trips.isPending) return <Loading label="Loading trips…" />;
  if (trips.isError) return <ErrorState message={trips.error.message} onRetry={() => trips.refetch()} />;

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 p-4"
      data={trips.data}
      keyExtractor={(t) => t.id}
      refreshing={trips.isRefetching}
      onRefresh={() => trips.refetch()}
      ListHeaderComponent={<Text className="pb-1 text-sm text-muted-foreground">{APP_TAGLINE}</Text>}
      ListEmptyComponent={
        <Text className="text-base text-foreground">No trips yet. Run pnpm db:seed for a demo trip.</Text>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: "/trips/[tripId]", params: { tripId: item.id } }} asChild>
          <Pressable accessibilityRole="button" className="gap-1 rounded-lg border border-border bg-card p-4">
            <Text className="text-base font-semibold text-foreground">{item.name}</Text>
            <View className="flex-row flex-wrap gap-x-3">
              {item.regionName ? (
                <Text className="text-sm text-muted-foreground">{item.regionName}</Text>
              ) : null}
              <Text className="text-sm text-muted-foreground">
                {item.startDate
                  ? `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`
                  : `${item.dayCount} days`}
              </Text>
              <Text className="text-sm text-muted-foreground">{item.destinationCount} places</Text>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}
