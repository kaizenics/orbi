import { Hono } from "hono";
import { z } from "zod";
import {
  createDestinationInputSchema,
  createTripInputSchema,
  idSchema,
  tripExportSchema,
  tripPreferencesSchema,
  updateTripInputSchema,
} from "@orbi/core";
import {
  createDestination,
  createTrip,
  deleteTrip,
  exportTrip,
  getTripAggregate,
  importTrip,
  listTrips,
  putPreferences,
  updateTrip,
  type Db,
} from "@orbi/db";
import { expectedRevision } from "../http/revision.ts";
import { ownerOf } from "../http/owner.ts";
import { validate } from "../http/validate.ts";

const tripParam = validate("param", z.object({ tripId: idSchema }));

export function tripRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listTrips(db, ownerOf(c))))
    .post("/", validate("json", createTripInputSchema), async (c) =>
      c.json(await createTrip(db, c.req.valid("json"), ownerOf(c)), 201),
    )
    .post("/import", validate("json", tripExportSchema), async (c) =>
      c.json(await importTrip(db, c.req.valid("json"), ownerOf(c)), 201),
    )
    .get("/:tripId", tripParam, async (c) => c.json(await getTripAggregate(db, c.req.valid("param").tripId)))
    .patch("/:tripId", tripParam, validate("json", updateTripInputSchema), async (c) =>
      c.json(await updateTrip(db, c.req.valid("param").tripId, c.req.valid("json"), expectedRevision(c))),
    )
    .delete("/:tripId", tripParam, async (c) => {
      await deleteTrip(db, c.req.valid("param").tripId, expectedRevision(c));
      return c.body(null, 204);
    })
    .put("/:tripId/preferences", tripParam, validate("json", tripPreferencesSchema), async (c) =>
      c.json(await putPreferences(db, c.req.valid("param").tripId, c.req.valid("json"), expectedRevision(c))),
    )
    .post("/:tripId/destinations", tripParam, validate("json", createDestinationInputSchema), async (c) => {
      const { value, revision } = await createDestination(
        db,
        c.req.valid("param").tripId,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision }, 201);
    })
    .get("/:tripId/export", tripParam, async (c) => {
      const file = await exportTrip(db, c.req.valid("param").tripId);
      const slug =
        file.data.trip.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "trip";
      c.header("Content-Disposition", `attachment; filename="${slug}.orbi.json"`);
      return c.json(file);
    });
}
