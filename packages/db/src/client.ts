import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

export type Db = LibSQLDatabase<typeof schema>;
/** A transaction handle; repositories accept either. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export interface OpenDbOptions {
  /** libSQL URL: "file:./data/orbi.db" (local), "libsql://<db>.turso.io" (Turso) or ":memory:". */
  url: string;
  /** Turso auth token (remote databases only). */
  authToken?: string;
  /**
   * Apply pending migrations on open. Defaults to true for local files and false for remote
   * databases, which are migrated explicitly with `pnpm --filter @orbi/db db:migrate`.
   */
  migrate?: boolean;
}

export interface OpenedDb {
  db: Db;
  client: Client;
  close: () => void;
  backupPath: string | null;
}

const isLocal = (url: string) => url === ":memory:" || url.startsWith("file:");
const localPath = (url: string) => url.replace(/^file:/, "");

async function pendingMigrationCount(client: Client): Promise<number> {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    entries: unknown[];
  };
  const table = await client.execute(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  );
  if (table.rows.length === 0) return journal.entries.length;
  const applied = await client.execute("SELECT count(*) AS n FROM __drizzle_migrations");
  return journal.entries.length - Number(applied.rows[0]?.n ?? 0);
}

/**
 * Opens the database. For local files, pending migrations run after a consistent copy is written
 * with VACUUM INTO, so a bad migration is recoverable (Turso keeps its own point-in-time backups).
 */
export async function openDb(options: OpenDbOptions): Promise<OpenedDb> {
  const local = isLocal(options.url);
  if (local && options.url !== ":memory:") mkdirSync(dirname(localPath(options.url)), { recursive: true });
  const client = createClient({ url: options.url, authToken: options.authToken });
  await client.execute("PRAGMA foreign_keys = ON");
  if (local && options.url !== ":memory:") await client.execute("PRAGMA journal_mode = WAL");
  const db = drizzle(client, { schema });

  let backupPath: string | null = null;
  if ((options.migrate ?? local) && (await pendingMigrationCount(client)) > 0) {
    const hasData =
      (await client.execute("SELECT 1 FROM sqlite_master WHERE name = 'trips'")).rows.length > 0;
    if (local && options.url !== ":memory:" && hasData) {
      const dir = join(dirname(localPath(options.url)), "backups");
      mkdirSync(dir, { recursive: true });
      backupPath = join(dir, `orbi-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
      await client.execute({ sql: "VACUUM INTO ?", args: [backupPath] });
    }
    await migrate(db, { migrationsFolder });
  }

  return { db, client, close: () => client.close(), backupPath };
}

/** Fresh in-memory database with migrations applied — one per test. */
export async function createTestDb(): Promise<Db> {
  return (await openDb({ url: ":memory:" })).db;
}
