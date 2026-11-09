import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "./client.ts";
import { createTrip, listTrips } from "./repo/trips.ts";

const dirs: string[] = [];
// Best effort: on Windows libSQL may hold the file briefly after close(); a leftover temp dir is harmless.
afterEach(() =>
  dirs.splice(0).forEach((d) => {
    try {
      rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      /* ignore */
    }
  }),
);

describe("openDb", () => {
  it("migrates a new file once, then reopens without re-migrating or backing up", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orbi-db-"));
    dirs.push(dir);
    const path = join(dir, "orbi.db");

    const first = await openDb({ url: `file:${path}` });
    await createTrip(first.db, { name: "Persisted", dayCount: 1 }, "local");
    expect(first.backupPath).toBeNull();
    first.close();

    const second = await openDb({ url: `file:${path}` });
    expect(second.backupPath).toBeNull();
    expect((await listTrips(second.db, "local")).map((t) => t.name)).toEqual(["Persisted"]);
    second.close();
  });
});
