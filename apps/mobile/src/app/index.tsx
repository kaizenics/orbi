import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createOrbiClient } from "@orbi/api/client";
import { APP_NAME, APP_TAGLINE, healthResponseSchema } from "@orbi/core";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

type Status =
  { state: "checking" } | { state: "online"; version: string } | { state: "offline"; reason: string };

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>(
    apiUrl ? { state: "checking" } : { state: "offline", reason: "EXPO_PUBLIC_API_URL is not set" },
  );

  useEffect(() => {
    if (!apiUrl) return;
    let cancelled = false;

    createOrbiClient(apiUrl)
      .health.$get()
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return healthResponseSchema.parse(await res.json());
      })
      .then((health) => !cancelled && setStatus({ state: "online", version: health.version }))
      .catch((error: unknown) => !cancelled && setStatus({ state: "offline", reason: String(error) }));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-2 px-6">
        <Text className="text-3xl font-semibold text-foreground">{APP_NAME}</Text>
        <Text className="text-base text-muted-foreground">{APP_TAGLINE}</Text>
        <Text accessibilityRole="text" className="mt-6 font-mono text-xs text-muted-foreground">
          {status.state === "online"
            ? `Server online · v${status.version}`
            : status.state === "offline"
              ? `Server offline (${status.reason})`
              : `Checking ${apiUrl}…`}
        </Text>
      </View>
    </SafeAreaView>
  );
}
