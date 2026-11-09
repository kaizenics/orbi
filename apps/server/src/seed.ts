import { parseEnv } from "@orbi/api";
import { createDestination, createTrip, listTrips, openDb, updateDay } from "@orbi/db";
import { seedDayModes, seedDayTitles, seedPlaces, seedTrip } from "./seed-data.ts";

const env = parseEnv(process.env);
const { db, close } = await openDb({ url: env.ORBI_DATABASE_URL, authToken: env.ORBI_DATABASE_AUTH_TOKEN });

if ((await listTrips(db, "local")).some((t) => t.name === seedTrip.name)) {
  console.log(`"${seedTrip.name}" already exists; nothing to do.`);
} else {
  const trip = await createTrip(db, seedTrip, "local");
  for (const [i, day] of trip.days.entries()) {
    await updateDay(db, day.id, { title: seedDayTitles[i] ?? null, travelMode: seedDayModes[i] ?? null });
  }
  for (const { day, ...p } of seedPlaces) {
    await createDestination(db, trip.trip.id, {
      ...p,
      locationSource: "nominatim",
      dayId: trip.days[day]!.id,
    });
  }
  console.log(
    `Seeded "${seedTrip.name}" (${seedPlaces.length} stops over ${trip.days.length} days): ${trip.trip.id}`,
  );
}
close();
