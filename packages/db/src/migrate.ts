/**
 * Applies pending migrations, e.g. to Turso before deploying:
 *   ORBI_DATABASE_URL=libsql://<db>.turso.io ORBI_DATABASE_AUTH_TOKEN=<token> pnpm --filter @orbi/db db:migrate
 * (Local file databases are migrated automatically when the app opens them.)
 */
import { openDb } from "./client.ts";

const url = process.env.ORBI_DATABASE_URL;
if (!url) throw new Error("Set ORBI_DATABASE_URL (and ORBI_DATABASE_AUTH_TOKEN for Turso)");
const { close, backupPath } = await openDb({
  url,
  authToken: process.env.ORBI_DATABASE_AUTH_TOKEN,
  migrate: true,
});
console.log(
  `Migrations applied to ${url.replace(/\?.*$/, "")}${backupPath ? ` (backup: ${backupPath})` : ""}`,
);
close();
