import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "./client.ts";
import { createTrip, listTrips } from "./repo/trips.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("openDb", () => {
  it("migrates a new file once, then reopens without re-migrating or backing up", () => {
    const dir = mkdtempSync(join(tmpdir(), "orbi-db-"));
    dirs.push(dir);
    const path = join(dir, "orbi.db");

    const first = openDb(path);
    createTrip(first.db, { name: "Persisted", dayCount: 1 });
    expect(first.backupPath).toBeNull();
    first.close();

    const second = openDb(path);
    expect(second.backupPath).toBeNull();
    expect(listTrips(second.db).map((t) => t.name)).toEqual(["Persisted"]);
    second.close();
  });
});
