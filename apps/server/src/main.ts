import { serve } from "@hono/node-server";
import { createApp } from "@orbi/api";
import { readFileSync } from "node:fs";
import { parseEnv } from "./env.ts";

const env = parseEnv(process.env);
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const server = serve(
  { fetch: createApp({ version }).fetch, hostname: env.ORBI_HOST, port: env.ORBI_PORT },
  (info) => {
    console.log(`ORBI server listening on http://${info.address}:${info.port}`);
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
