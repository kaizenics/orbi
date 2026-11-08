import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;
/** A transaction handle; repositories accept either. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function openSqlite(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  if (path !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL");
  }
  return sqlite;
}

function pendingMigrationCount(sqlite: Database.Database): number {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    entries: unknown[];
  };
  const hasTable = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  const applied = hasTable
    ? (sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get() as { n: number }).n
    : 0;
  return journal.entries.length - applied;
}

export interface OpenDbOptions {
  /** Apply pending migrations (default true). */
  migrate?: boolean;
  /** Directory for pre-migration backups; defaults to `<db dir>/backups`. */
  backupDir?: string;
}

export interface OpenedDb {
  db: Db;
  close: () => void;
  backupPath: string | null;
}

/**
 * Opens (creating if needed) the SQLite database. Before applying migrations to an existing
 * database, writes a consistent copy with `VACUUM INTO` so a bad migration is recoverable.
 */
export function openDb(path: string, options: OpenDbOptions = {}): OpenedDb {
  const isNewFile = path === ":memory:" || !existsSync(path);
  const sqlite = openSqlite(path);
  const db = drizzle(sqlite, { schema });
  let backupPath: string | null = null;

  if (options.migrate !== false && pendingMigrationCount(sqlite) > 0) {
    if (!isNewFile) {
      const dir = options.backupDir ?? join(dirname(path), "backups");
      mkdirSync(dir, { recursive: true });
      backupPath = join(dir, `orbi-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
      sqlite.prepare("VACUUM INTO ?").run(backupPath);
    }
    migrate(db, { migrationsFolder });
  }

  return { db, close: () => sqlite.close(), backupPath };
}

/** Fresh in-memory database with migrations applied — one per test. */
export function createTestDb(): Db {
  return openDb(":memory:").db;
}
