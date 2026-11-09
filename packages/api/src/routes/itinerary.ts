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
    .patch("/:id", idParam, validate("json", updateDestinationInputSchema), async (c) => {
      const { value, revision } = await updateDestination(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    })
    .delete("/:id", idParam, async (c) => {
      const { revision } = await deleteDestination(db, c.req.valid("param").id, expectedRevision(c));
      return c.json({ data: null, revision });
    });
}

export function dayRoutes(db: Db) {
  return new Hono()
    .patch("/:id", idParam, validate("json", updateDayInputSchema), async (c) => {
      const { value, revision } = await updateDay(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    })
    .post("/:id/items", idParam, validate("json", createItemInputSchema), async (c) => {
      const { value, revision } = await createItem(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision }, 201);
    })
    .put("/:id/order", idParam, validate("json", reorderDayInputSchema), async (c) => {
      const { value, revision } = await reorderDay(
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
    .patch("/:id", idParam, validate("json", updateItemInputSchema), async (c) => {
      const { value, revision } = await updateItem(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    })
    .delete("/:id", idParam, async (c) => {
      const { revision } = await deleteItem(db, c.req.valid("param").id, expectedRevision(c));
      return c.json({ data: null, revision });
    })
    .post("/:id/move", idParam, validate("json", moveItemInputSchema), async (c) => {
      const { value, revision } = await moveItem(
        db,
        c.req.valid("param").id,
        c.req.valid("json"),
        expectedRevision(c),
      );
      return c.json({ data: value, revision });
    });
}
