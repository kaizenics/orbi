export const TRAVEL_MODES = ["driving", "walking"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const PACES = ["relaxed", "moderate", "packed"] as const;
export type Pace = (typeof PACES)[number];

export const DESTINATION_CATEGORIES = [
  "attraction",
  "history",
  "food",
  "beach",
  "nature",
  "shopping",
  "lodging",
  "transport",
  "activity",
  "other",
] as const;
export type DestinationCategory = (typeof DESTINATION_CATEGORIES)[number];

/** Itinerary moments that are not a place on the map (they take time but have no location). */
export const ACTIVITY_TYPES = [
  "wake_up",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "rest",
  "free_time",
  "check_in",
  "check_out",
  "transfer",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Where a destination's coordinates came from. Deliberately has no "ai" member: AI never supplies coordinates. */
export const LOCATION_SOURCES = ["nominatim", "photon", "map_pin", "import", "seed"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const ORIGINS = ["user", "ai"] as const;
export type Origin = (typeof ORIGINS)[number];

export const OPENING_HOURS_SOURCES = ["user", "osm", "ai_estimate"] as const;
export const COST_SOURCES = ["user", "ai_estimate"] as const;

export const LIMITS = {
  maxTripDays: 60,
  maxItemsPerDay: 40,
  maxDestinationsPerTrip: 500,
  maxNameLength: 120,
  maxTextLength: 4000,
} as const;

export const DEFAULTS = {
  timezone: "Asia/Manila",
  currency: "PHP",
  travelMode: "driving" as TravelMode,
  pace: "moderate" as Pace,
  dayStartTime: "09:00",
  dayEndTime: "20:00",
  visitDurationMin: 60,
} as const;

/** AI providers a user can connect with their own API key. */
export const AI_PROVIDERS = ["openrouter", "openai", "anthropic", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
