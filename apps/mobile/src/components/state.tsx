import { ActivityIndicator, Pressable, Text, View } from "react-native";

export function Centered({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center gap-3 bg-background px-6">{children}</View>;
}

export function Loading({ label }: { label: string }) {
  return (
    <Centered>
      <ActivityIndicator />
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </Centered>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Centered>
      <Text className="text-center text-base text-foreground">{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} className="rounded-md bg-primary px-4 py-2">
        <Text className="text-sm font-medium text-primary-foreground">Try again</Text>
      </Pressable>
    </Centered>
  );
}
