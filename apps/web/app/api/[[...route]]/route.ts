import { Hono } from "hono";
import { createAppFromEnv, parseEnv } from "@orbi/api";
import packageJson from "../../../package.json";

// The ORBI API served by Next.js itself (e.g. on Vercel, with Turso as the database).
// Built once per server instance; the database connection is reused across requests.
export const runtime = "nodejs";
// AI drafts can take a while (Vercel Hobby allows up to 300 s).
export const maxDuration = 300;

let api: Promise<Hono> | undefined;
const getApi = () =>
  (api ??= createAppFromEnv(parseEnv(process.env), { version: packageJson.version, log: console.log }).then(
    ({ app }) => new Hono().route("/api", app),
  ));

const handler = async (request: Request) => (await getApi()).fetch(request);
export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
