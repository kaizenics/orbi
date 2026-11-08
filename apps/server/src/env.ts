import { z } from "zod";

const envSchema = z.object({
  ORBI_HOST: z.string().min(1).default("127.0.0.1"),
  ORBI_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
});

export type ServerEnv = z.infer<typeof envSchema>;

/** Parses server env, throwing a readable error listing every invalid variable. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid ORBI server environment:\n${issues}`);
  }
  return result.data;
}
