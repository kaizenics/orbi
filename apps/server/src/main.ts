import { serve } from "@hono/node-server";
import { createAppFromEnv, parseEnv } from "@orbi/api";
import { readFileSync } from "node:fs";

const env = parseEnv(process.env);
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};
const { app, close } = await createAppFromEnv(env, { version, log: (message) => console.log(message) });

const server = serve({ fetch: app.fetch, hostname: env.ORBI_HOST, port: env.ORBI_PORT }, (info) => {
  console.log(
    `ORBI server listening on http://${info.address}:${info.port}${env.ORBI_API_TOKEN ? " (token required)" : ""}`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(() => {
      close();
      process.exit(0);
    }),
  );
}
