import { z } from "zod";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

const envSchema = z
  .object({
    ORBI_HOST: z.string().min(1).default("127.0.0.1"),
    ORBI_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
    /** libSQL URL: a local file (default) or a Turso database (libsql://<db>.turso.io). */
    ORBI_DATABASE_URL: z.string().min(1).default("file:./data/orbi.db"),
    /** Turso auth token (remote databases only). */
    ORBI_DATABASE_AUTH_TOKEN: z.string().min(1).optional(),
    /** Set by Vercel; a local file database would be lost there. */
    VERCEL: z.string().optional(),
    ORBI_API_TOKEN: z
      .string()
      .min(16, "must be at least 16 characters (generate one with: openssl rand -hex 24)")
      .optional(),
    ORBI_CORS_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        v
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      ),

    // Maps and geo services. Defaults are free public instances with fair-use limits (see ATTRIBUTIONS.md).
    MAP_STYLE_URL: z.url().default("https://tiles.openfreemap.org/styles/liberty"),
    MAP_ATTRIBUTION: z.string().default("OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors"),
    GEOCODER_PROVIDER: z.enum(["nominatim", "photon"]).default("nominatim"),
    GEOCODER_BASE_URL: z.url().default("https://nominatim.openstreetmap.org"),
    /** Optional search-as-you-type (Photon). Unset = submit-based search only. */
    PHOTON_BASE_URL: z.url().optional(),
    ROUTER_DRIVING_URL: z.url().default("https://routing.openstreetmap.de/routed-car"),
    ROUTER_WALKING_URL: z.url().default("https://routing.openstreetmap.de/routed-foot"),
    ROUTER_PROFILE: z.string().default("driving"),
    /** Identifies this ORBI install to public geo services, as their usage policies require. */
    GEO_USER_AGENT: z.string().min(5).optional(),
    GEO_CONTACT_EMAIL: z.email().optional(),
    /** Minimum gap between requests to one provider. Keep >= 1000 for public instances. */
    GEO_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1100),
    CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  })
  .superRefine((env, ctx) => {
    if (env.VERCEL && env.ORBI_DATABASE_URL.startsWith("file:")) {
      ctx.addIssue({
        code: "custom",
        path: ["ORBI_DATABASE_URL"],
        message:
          "Vercel's filesystem is temporary: use a Turso URL (libsql://...) with ORBI_DATABASE_AUTH_TOKEN",
      });
    }
    if (!LOOPBACK.has(env.ORBI_HOST) && !env.ORBI_API_TOKEN) {
      ctx.addIssue({
        code: "custom",
        path: ["ORBI_API_TOKEN"],
        message: `required when ORBI_HOST (${env.ORBI_HOST}) is reachable from other devices`,
      });
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

/** Parses server env, throwing a readable error listing every invalid variable. */
export function parseEnv(source: Record<string, string | undefined>): ApiEnv {
  // A blank value ("ORBI_API_TOKEN=" copied from .env.example) means "not set", not an empty string.
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid ORBI environment:\n${issues}`);
  }
  return result.data;
}
