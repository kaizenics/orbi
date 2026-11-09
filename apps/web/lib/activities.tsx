import {
  Bed,
  Coffee,
  Cookie,
  Hotel,
  LogOut,
  Luggage,
  Moon,
  Sparkles,
  Sun,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType } from "@orbi/core";

/** Label, default title and icon for each activity type (moments without a map location). */
export const ACTIVITY_META: Record<ActivityType, { label: string; icon: LucideIcon; defaultMin: number }> = {
  wake_up: { label: "Wake up", icon: Sun, defaultMin: 30 },
  breakfast: { label: "Breakfast", icon: Coffee, defaultMin: 45 },
  lunch: { label: "Lunch", icon: Utensils, defaultMin: 60 },
  dinner: { label: "Dinner", icon: Moon, defaultMin: 75 },
  snack: { label: "Snack", icon: Cookie, defaultMin: 20 },
  rest: { label: "Rest", icon: Bed, defaultMin: 60 },
  free_time: { label: "Free time", icon: Sparkles, defaultMin: 60 },
  check_in: { label: "Check in", icon: Hotel, defaultMin: 30 },
  check_out: { label: "Check out", icon: LogOut, defaultMin: 30 },
  transfer: { label: "Transfer", icon: Luggage, defaultMin: 60 },
  other: { label: "Activity", icon: Sparkles, defaultMin: 30 },
};
