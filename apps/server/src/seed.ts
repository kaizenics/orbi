import { createDestination, createTrip, listTrips, openDb, updateDay } from "@orbi/db";
import { resolve } from "node:path";
import { parseEnv } from "./env.ts";
import { seedDayModes, seedDayTitles, seedPlaces, seedTrip } from "./seed-data.ts";

const env = parseEnv(process.env);
const { db, close } = openDb(resolve(env.ORBI_DATABASE_PATH));

if (listTrips(db).some((t) => t.name === seedTrip.name)) {
  console.log(`"${seedTrip.name}" already exists; nothing to do.`);
} else {
  const trip = createTrip(db, seedTrip);
  trip.days.forEach((day, i) =>
    updateDay(db, day.id, { title: seedDayTitles[i] ?? null, travelMode: seedDayModes[i] ?? null }),
  );
  for (const { day, ...p } of seedPlaces) {
    createDestination(db, trip.trip.id, { ...p, locationSource: "nominatim", dayId: trip.days[day]!.id });
  }
  console.log(
    `Seeded "${seedTrip.name}" (${seedPlaces.length} stops over ${trip.days.length} days): ${trip.trip.id}`,
  );
}
close();
