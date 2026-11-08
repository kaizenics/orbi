import type { CreateDestinationInput, CreateTripInput } from "@orbi/core";

/**
 * Demo trip. Coordinates, addresses and OSM references were retrieved from the public Nominatim
 * geocoder on 2026-11-09 (© OpenStreetMap contributors, ODbL) — never typed by hand.
 * Costs and opening hours are intentionally left empty: they were not verified.
 */
export const seedTrip: CreateTripInput = {
  name: "3 days in Cebu",
  description: "Historic downtown, hilltop temples and a Mactan beach day.",
  regionName: "Cebu, Philippines",
  startDate: "2026-12-11",
  endDate: "2026-12-13",
  budgetMinor: 1_000_000,
  preferences: { pace: "moderate", interests: ["history", "local-food", "beaches"] },
};

type SeedPlace = Omit<CreateDestinationInput, "dayId" | "locationSource"> & { day: number };

const place = (
  day: number,
  name: string,
  latitude: number,
  longitude: number,
  sourceRef: string,
  address: string,
  category: CreateDestinationInput["category"],
  visitDurationMin: number,
): SeedPlace => ({ day, name, latitude, longitude, sourceRef, address, category, visitDurationMin });

export const seedDayTitles = ["Historic downtown", "Hills and temples", "Mactan"];
export const seedDayModes = ["walking", "driving", "driving"] as const;

export const seedPlaces: SeedPlace[] = [
  place(
    0,
    "Magellan's Cross",
    10.2935702,
    123.9019584,
    "osm:way/94081127",
    "Magallanes Street, Señor Santo Niño, Cebu City",
    "history",
    30,
  ),
  place(
    0,
    "Basilica Minore del Santo Niño",
    10.2943421,
    123.9021033,
    "osm:relation/18267945",
    "Osmeña Boulevard, San Roque, Cebu City",
    "history",
    45,
  ),
  place(
    0,
    "Fort San Pedro",
    10.2927283,
    123.9058911,
    "osm:way/332819231",
    "A. Pigafetta Street, San Roque, Cebu City",
    "history",
    60,
  ),
  place(
    0,
    "Heritage of Cebu Monument",
    10.2988934,
    123.903617,
    "osm:node/4161650691",
    "Sikatuna Street, Pari-an, Cebu City",
    "history",
    20,
  ),
  place(
    0,
    "Casa Gorordo Museum",
    10.299915,
    123.904823,
    "osm:way/721502852",
    "35 Eduardo Aboitiz Street, Tinago, Cebu City",
    "history",
    60,
  ),
  place(0, "Carbon Market", 10.2920377, 123.8978143, "osm:way/1350370290", "Ermita, Cebu City", "food", 60),
  place(
    1,
    "Cebu Taoist Temple",
    10.3343184,
    123.8879852,
    "osm:way/1539233294",
    "5th Street, Beverly Hills, Kalunasan, Cebu City",
    "attraction",
    45,
  ),
  place(
    1,
    "Temple of Leah",
    10.3688795,
    123.8733158,
    "osm:way/614656886",
    "Roosevelt Drive, Busay, Cebu City",
    "attraction",
    60,
  ),
  place(
    1,
    "Tops Lookout",
    10.37061,
    123.8708771,
    "osm:way/65600726",
    "Cebu Tops Road, Upper Busay, Cebu City",
    "nature",
    60,
  ),
  place(
    2,
    "Liberty Shrine",
    10.3109738,
    124.015138,
    "osm:way/538178017",
    "Mactan, Lapu-Lapu City",
    "history",
    45,
  ),
  place(
    2,
    "Hadsan Beach",
    10.2790557,
    123.9954765,
    "osm:way/46416342",
    "Maribago, Lapu-Lapu City",
    "beach",
    180,
  ),
];
