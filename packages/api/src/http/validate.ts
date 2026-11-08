import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { problem } from "./problem.ts";

/** zValidator that answers with a 400 problem+json listing every invalid field. */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return problem(c, 400, "bad_request", {
        detail: `Invalid ${target}`,
        errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
  });
