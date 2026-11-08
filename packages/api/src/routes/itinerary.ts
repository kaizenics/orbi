import { Hono } from "hono";
import { z } from "zod";
import {
  createItemInputSchema,
  idSchema,
  moveItemInputSchema,
  reorderDayInputSchema,
  updateDayInputSchema,
  updateDestinationInputSchema,
  updateItemInputSchema,
} from "@orbi/core";
import {
  createItem,
  deleteDestination,
  deleteItem,
  moveItem,
  reorderDay,
  updateDay,
  updateDestination,
  updateItem,
  type Db,
} from "@orbi/db";
import { expectedRevision } from "../http/revision.ts";
import { validate } from "../http/validate.ts";

const idParam = validate("param", z.object({ id: idSchema }));

export function destinationRoutes(db: Db) {
  return new Hono()
    .patch("/:id", idParam, validate("json", updateDestinationInputSchema), (c) => {
      const { value, revision } = updateDestination(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    })
    .delete("/:id", idParam, (c) => {
      const { revision } = deleteDestination(db, c.req.valid("param").id, expectedRevision(c));
      return c.json({ data: null, revision });
    });
}

export function dayRoutes(db: Db) {
  return new Hono()
    .patch("/:id", idParam, validate("json", updateDayInputSchema), (c) => {
      const { value, revision } = updateDay(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    })
    .post("/:id/items", idParam, validate("json", createItemInputSchema), (c) => {
      const { value, revision } = createItem(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision }, 201);
    })
    .put("/:id/order", idParam, validate("json", reorderDayInputSchema), (c) => {
      const { value, revision } = reorderDay(
        db,
        c.req.valid("param").id,
        c.req.valid("json").itemIds,
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    });
}

export function itemRoutes(db: Db) {
  return new Hono()
    .patch("/:id", idParam, validate("json", updateItemInputSchema), (c) => {
      const { value, revision } = updateItem(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    })
    .delete("/:id", idParam, (c) => {
      const { revision } = deleteItem(db, c.req.valid("param").id, expectedRevision(c));
      return c.json({ data: null, revision });
    })
    .post("/:id/move", idParam, validate("json", moveItemInputSchema), (c) => {
      const { value, revision } = moveItem(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    });
}
