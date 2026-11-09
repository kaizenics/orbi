import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  ACTIVITY_TYPES,
  COST_SOURCES,
  DESTINATION_CATEGORIES,
  LOCATION_SOURCES,
  OPENING_HOURS_SOURCES,
  ORIGINS,
  PACES,
  TRAVEL_MODES,
  type BBox,
} from "@orbi/core";

/** SQL `IN (...)` list from a constant tuple, so CHECK constraints follow the core enums. */
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

const timestamps = {
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
};

export const trips = sqliteTable(
  "trips",
  {
    id: text("id").primaryKey(),
    /** Google account email of the owner; "local" when sign-in is off (local development). */
    owner: text("owner").notNull().default("local"),
    name: text("name").notNull(),
    description: text("description"),
    // Circular FK (destinations also reference trips); nullable + SET NULL so deletes never block.
    originDestinationId: text("origin_destination_id").references((): AnySQLiteColumn => destinations.id, {
      onDelete: "set null",
    }),
    regionName: text("region_name"),
    regionBbox: text("region_bbox", { mode: "json" }).$type<BBox>(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull(),
    budgetMinor: integer("budget_minor"),
    defaultTravelMode: text("default_travel_mode", { enum: TRAVEL_MODES }).notNull(),
    revision: integer("revision").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("trips_owner_updated_at_idx").on(t.owner, t.updatedAt),
    check(
      "trips_dates_check",
      sql`${t.endDate} IS NULL OR ${t.startDate} IS NULL OR ${t.endDate} >= ${t.startDate}`,
    ),
    check("trips_currency_check", sql`length(${t.currency}) = 3`),
    check("trips_budget_check", sql`${t.budgetMinor} IS NULL OR ${t.budgetMinor} >= 0`),
    check("trips_travel_mode_check", sql`${t.defaultTravelMode} IN (${inList(TRAVEL_MODES)})`),
  ],
);

export const tripPreferences = sqliteTable(
  "trip_preferences",
  {
    tripId: text("trip_id")
      .primaryKey()
      .references(() => trips.id, { onDelete: "cascade" }),
    pace: text("pace", { enum: PACES }).notNull(),
    interests: text("interests", { mode: "json" }).$type<string[]>().notNull(),
    dayStartTime: text("day_start_time").notNull(),
    dayEndTime: text("day_end_time").notNull(),
    maxDailyTravelMin: integer("max_daily_travel_min"),
    notes: text("notes"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [check("trip_preferences_pace_check", sql`${t.pace} IN (${inList(PACES)})`)],
);

export const tripDays = sqliteTable(
  "trip_days",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    date: text("date"),
    title: text("title"),
    notes: text("notes"),
    startTime: text("start_time"),
    travelMode: text("travel_mode", { enum: TRAVEL_MODES }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("trip_days_trip_index_uq").on(t.tripId, t.dayIndex),
    check("trip_days_index_check", sql`${t.dayIndex} >= 0`),
    check(
      "trip_days_travel_mode_check",
      sql`${t.travelMode} IS NULL OR ${t.travelMode} IN (${inList(TRAVEL_MODES)})`,
    ),
  ],
);

export const destinations = sqliteTable(
  "destinations",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    address: text("address"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    category: text("category", { enum: DESTINATION_CATEGORIES }).notNull().default("other"),
    visitDurationMin: integer("visit_duration_min").notNull().default(60),
    openingHours: text("opening_hours"),
    openingHoursSource: text("opening_hours_source", { enum: OPENING_HOURS_SOURCES }),
    estCostMinor: integer("est_cost_minor"),
    costSource: text("cost_source", { enum: COST_SOURCES }),
    notes: text("notes"),
    locationSource: text("location_source", { enum: LOCATION_SOURCES }).notNull(),
    sourceRef: text("source_ref"),
    locationVerifiedAt: integer("location_verified_at").notNull(),
    origin: text("origin", { enum: ORIGINS }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("destinations_trip_idx").on(t.tripId),
    uniqueIndex("destinations_trip_source_ref_uq")
      .on(t.tripId, t.sourceRef)
      .where(sql`${t.sourceRef} IS NOT NULL`),
    check("destinations_latitude_check", sql`${t.latitude} BETWEEN -90 AND 90`),
    check("destinations_longitude_check", sql`${t.longitude} BETWEEN -180 AND 180`),
    check("destinations_duration_check", sql`${t.visitDurationMin} BETWEEN 0 AND 1440`),
    check("destinations_cost_check", sql`${t.estCostMinor} IS NULL OR ${t.estCostMinor} >= 0`),
    check("destinations_category_check", sql`${t.category} IN (${inList(DESTINATION_CATEGORIES)})`),
    check("destinations_location_source_check", sql`${t.locationSource} IN (${inList(LOCATION_SOURCES)})`),
    check("destinations_origin_check", sql`${t.origin} IN (${inList(ORIGINS)})`),
  ],
);

export const itineraryItems = sqliteTable(
  "itinerary_items",
  {
    id: text("id").primaryKey(),
    tripDayId: text("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    /** Null for activities (wake up, meals at the hotel, rest…), which have no location. */
    destinationId: text("destination_id").references(() => destinations.id, { onDelete: "cascade" }),
    activityType: text("activity_type", { enum: ACTIVITY_TYPES }),
    title: text("title"),
    position: integer("position").notNull(),
    fixedStartTime: text("fixed_start_time"),
    durationOverrideMin: integer("duration_override_min"),
    travelModeToNext: text("travel_mode_to_next", { enum: TRAVEL_MODES }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("itinerary_items_day_position_uq").on(t.tripDayId, t.position),
    index("itinerary_items_destination_idx").on(t.destinationId),
    // A row is either a place or a titled activity, never both or neither.
    check(
      "itinerary_items_kind_check",
      sql`(${t.destinationId} IS NOT NULL AND ${t.activityType} IS NULL) OR (${t.destinationId} IS NULL AND ${t.activityType} IN (${inList(ACTIVITY_TYPES)}) AND ${t.title} IS NOT NULL)`,
    ),
  ],
);

export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    title: text("title"),
    ...timestamps,
  },
  (t) => [index("ai_conversations_trip_idx").on(t.tripId, t.updatedAt)],
);

export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    provider: text("provider"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const aiProposals = sqliteTable(
  "ai_proposals",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["draft", "edit", "optimize"] }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    baseRevision: integer("base_revision"),
    status: text("status", {
      enum: ["pending", "applied", "partially_applied", "discarded", "stale"],
    }).notNull(),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
  },
  (t) => [index("ai_proposals_trip_status_idx").on(t.tripId, t.status)],
);

/** Derived, disposable: per-leg routing results (database.md §6.1). */
export const routeLegCache = sqliteTable(
  "route_leg_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    profile: text("profile").notNull(),
    distanceM: real("distance_m").notNull(),
    durationS: real("duration_s").notNull(),
    geometry: text("geometry").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("route_leg_cache_expires_idx").on(t.expiresAt)],
);

/** Derived, disposable: geocoder responses (database.md §6.3). */
export const geocodeCache = sqliteTable(
  "geocode_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    op: text("op").notNull(),
    results: text("results", { mode: "json" }).notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("geocode_cache_expires_idx").on(t.expiresAt)],
);
