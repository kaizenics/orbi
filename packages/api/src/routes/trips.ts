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
import { validate } from "../http/validate.ts";

const tripParam = validate("param", z.object({ tripId: idSchema }));

export function tripRoutes(db: Db) {
  return new Hono()
    .get("/", (c) => c.json(listTrips(db)))
    .post("/", validate("json", createTripInputSchema), (c) =>
      c.json(createTrip(db, c.req.valid("json")), 201),
    )
    .post("/import", validate("json", tripExportSchema), (c) =>
      c.json(importTrip(db, c.req.valid("json")), 201),
    )
    .get("/:tripId", tripParam, (c) => c.json(getTripAggregate(db, c.req.valid("param").tripId)))
    .patch("/:tripId", tripParam, validate("json", updateTripInputSchema), (c) =>
      c.json(updateTrip(db, c.req.valid("param").tripId, c.req.valid("json"), expectedRevision(c))),
    )
    .delete("/:tripId", tripParam, (c) => {
      deleteTrip(db, c.req.valid("param").tripId, expectedRevision(c));
      return c.body(null, 204);
    })
    .put("/:tripId/preferences", tripParam, validate("json", tripPreferencesSchema), (c) =>
      c.json(putPreferences(db, c.req.valid("param").tripId, c.req.valid("json"), expectedRevision(c))),
    )
    .post("/:tripId/destinations", tripParam, validate("json", createDestinationInputSchema), (c) => {
      const { value, revision } = createDestination(
        db,
        c.req.valid("param").tripId,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision }, 201);
    })
    .get("/:tripId/export", tripParam, (c) => {
      const file = exportTrip(db, c.req.valid("param").tripId);
      const slug =
        file.data.trip.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "trip";
      c.header("Content-Disposition", `attachment; filename="${slug}.orbi.json"`);
      return c.json(file);
    });
}
