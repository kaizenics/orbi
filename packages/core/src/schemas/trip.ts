import { z } from "zod";
import {
  COST_SOURCES,
  DESTINATION_CATEGORIES,
  LIMITS,
  LOCATION_SOURCES,
  OPENING_HOURS_SOURCES,
  ORIGINS,
  PACES,
  TRAVEL_MODES,
} from "../constants.ts";
import {
  bboxSchema,
  currencySchema,
  idSchema,
  isoDateSchema,
  latitudeSchema,
  localTimeSchema,
  longitudeSchema,
  moneyMinorSchema,
  nameSchema,
  textSchema,
  timestampSchema,
  timezoneSchema,
} from "./common.ts";

export const travelModeSchema = z.enum(TRAVEL_MODES);
export const paceSchema = z.enum(PACES);
export const destinationCategorySchema = z.enum(DESTINATION_CATEGORIES);
export const locationSourceSchema = z.enum(LOCATION_SOURCES);

const durationMinSchema = z
  .int()
  .min(0)
  .max(24 * 60);

// ---------------------------------------------------------------------------
// Entities (as returned by the API)
// ---------------------------------------------------------------------------

export const tripSchema = z.object({
  id: idSchema,
  name: nameSchema,
  description: textSchema.nullable(),
  originDestinationId: idSchema.nullable(),
  regionName: z.string().nullable(),
  regionBbox: bboxSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  timezone: timezoneSchema,
  currency: currencySchema,
  budgetMinor: moneyMinorSchema.nullable(),
  defaultTravelMode: travelModeSchema,
  revision: z.int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Trip = z.infer<typeof tripSchema>;

export const tripPreferencesSchema = z.object({
  pace: paceSchema,
  interests: z.array(z.string().trim().min(1).max(40)).max(30),
  dayStartTime: localTimeSchema,
  dayEndTime: localTimeSchema,
  maxDailyTravelMin: z
    .int()
    .min(0)
    .max(24 * 60)
    .nullable(),
  notes: textSchema.nullable(),
});
export type TripPreferences = z.infer<typeof tripPreferencesSchema>;

export const tripDaySchema = z.object({
  id: idSchema,
  tripId: idSchema,
  dayIndex: z.int().nonnegative(),
  date: isoDateSchema.nullable(),
  title: z.string().max(LIMITS.maxNameLength).nullable(),
  notes: textSchema.nullable(),
  startTime: localTimeSchema.nullable(),
  travelMode: travelModeSchema.nullable(),
});
export type TripDay = z.infer<typeof tripDaySchema>;

export const destinationSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  name: nameSchema,
  description: textSchema.nullable(),
  address: z.string().max(500).nullable(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  category: destinationCategorySchema,
  visitDurationMin: durationMinSchema,
  openingHours: z.string().max(500).nullable(),
  openingHoursSource: z.enum(OPENING_HOURS_SOURCES).nullable(),
  estCostMinor: moneyMinorSchema.nullable(),
  costSource: z.enum(COST_SOURCES).nullable(),
  notes: textSchema.nullable(),
  locationSource: locationSourceSchema,
  sourceRef: z.string().max(200).nullable(),
  locationVerifiedAt: timestampSchema,
  origin: z.enum(ORIGINS),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Destination = z.infer<typeof destinationSchema>;

export const itineraryItemSchema = z.object({
  id: idSchema,
  tripDayId: idSchema,
  destinationId: idSchema,
  position: z.int().nonnegative(),
  fixedStartTime: localTimeSchema.nullable(),
  durationOverrideMin: durationMinSchema.nullable(),
  travelModeToNext: travelModeSchema.nullable(),
  notes: textSchema.nullable(),
});
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;

export const tripDayWithItemsSchema = tripDaySchema.extend({ items: z.array(itineraryItemSchema) });
export type TripDayWithItems = z.infer<typeof tripDayWithItemsSchema>;

/** Everything the planner needs in one response. Days and items are ordered. */
export const tripAggregateSchema = z.object({
  trip: tripSchema,
  preferences: tripPreferencesSchema,
  days: z.array(tripDayWithItemsSchema),
  destinations: z.array(destinationSchema),
});
export type TripAggregate = z.infer<typeof tripAggregateSchema>;

export const tripSummarySchema = tripSchema
  .pick({ id: true, name: true, regionName: true, startDate: true, endDate: true, updatedAt: true })
  .extend({ dayCount: z.int(), destinationCount: z.int() });
export type TripSummary = z.infer<typeof tripSummarySchema>;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** A trip is either dated (start + end) or undated (dayCount). */
const tripDatesRefinement = <T extends { startDate?: string | null; endDate?: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  const hasStart = value.startDate != null;
  const hasEnd = value.endDate != null;
  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: "custom",
      message: "startDate and endDate must be set together",
      path: ["endDate"],
    });
  } else if (hasStart && hasEnd && value.endDate! < value.startDate!) {
    ctx.addIssue({ code: "custom", message: "endDate must not be before startDate", path: ["endDate"] });
  }
};

export const createTripInputSchema = z
  .object({
    name: nameSchema,
    description: textSchema.nullish(),
    regionName: z.string().max(200).nullish(),
    regionBbox: bboxSchema.nullish(),
    startDate: isoDateSchema.nullish(),
    endDate: isoDateSchema.nullish(),
    dayCount: z.int().min(1).max(LIMITS.maxTripDays).optional(),
    timezone: timezoneSchema.optional(),
    currency: currencySchema.optional(),
    budgetMinor: moneyMinorSchema.nullish(),
    defaultTravelMode: travelModeSchema.optional(),
    preferences: tripPreferencesSchema.partial().optional(),
  })
  .superRefine(tripDatesRefinement);
export type CreateTripInput = z.infer<typeof createTripInputSchema>;

export const updateTripInputSchema = z
  .object({
    name: nameSchema,
    description: textSchema.nullable(),
    originDestinationId: idSchema.nullable(),
    regionName: z.string().max(200).nullable(),
    regionBbox: bboxSchema.nullable(),
    startDate: isoDateSchema.nullable(),
    endDate: isoDateSchema.nullable(),
    dayCount: z.int().min(1).max(LIMITS.maxTripDays),
    timezone: timezoneSchema,
    currency: currencySchema,
    budgetMinor: moneyMinorSchema.nullable(),
    defaultTravelMode: travelModeSchema,
    /** Required (true) when the change removes days that still contain itinerary items. */
    confirmRemoveDays: z.boolean(),
  })
  .partial()
  .superRefine(tripDatesRefinement);
export type UpdateTripInput = z.infer<typeof updateTripInputSchema>;

export const createDestinationInputSchema = z.object({
  name: nameSchema,
  description: textSchema.nullish(),
  address: z.string().max(500).nullish(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  category: destinationCategorySchema.optional(),
  visitDurationMin: durationMinSchema.optional(),
  openingHours: z.string().max(500).nullish(),
  openingHoursSource: z.enum(OPENING_HOURS_SOURCES).nullish(),
  estCostMinor: moneyMinorSchema.nullish(),
  costSource: z.enum(COST_SOURCES).nullish(),
  notes: textSchema.nullish(),
  locationSource: locationSourceSchema,
  sourceRef: z.string().max(200).nullish(),
  /** Optionally schedule it straight away: appended to the end of this day. */
  dayId: idSchema.optional(),
});
export type CreateDestinationInput = z.infer<typeof createDestinationInputSchema>;

export const updateDestinationInputSchema = createDestinationInputSchema
  .omit({ dayId: true })
  .partial()
  .superRefine((value, ctx) => {
    const coords = [value.latitude, value.longitude, value.locationSource].filter((v) => v !== undefined);
    if (coords.length !== 0 && coords.length !== 3) {
      ctx.addIssue({
        code: "custom",
        message: "latitude, longitude and locationSource must be changed together",
        path: ["locationSource"],
      });
    }
  });
export type UpdateDestinationInput = z.infer<typeof updateDestinationInputSchema>;

export const updateDayInputSchema = tripDaySchema
  .pick({ title: true, notes: true, startTime: true, travelMode: true })
  .partial();
export type UpdateDayInput = z.infer<typeof updateDayInputSchema>;

export const createItemInputSchema = z.object({
  destinationId: idSchema,
  /** 0-based insert position; defaults to the end of the day. */
  position: z.int().nonnegative().optional(),
  fixedStartTime: localTimeSchema.nullish(),
  durationOverrideMin: durationMinSchema.nullish(),
  notes: textSchema.nullish(),
});
export type CreateItemInput = z.infer<typeof createItemInputSchema>;

export const updateItemInputSchema = itineraryItemSchema
  .pick({ fixedStartTime: true, durationOverrideMin: true, travelModeToNext: true, notes: true })
  .partial();
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;

export const reorderDayInputSchema = z.object({
  itemIds: z.array(idSchema).max(LIMITS.maxItemsPerDay),
});
export type ReorderDayInput = z.infer<typeof reorderDayInputSchema>;

export const moveItemInputSchema = z.object({
  toDayId: idSchema,
  toPosition: z.int().nonnegative(),
});
export type MoveItemInput = z.infer<typeof moveItemInputSchema>;
