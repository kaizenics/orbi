import { v7 } from "uuid";

/** Time-ordered UUIDv7: index-friendly, creatable on any device, portable to Postgres `uuid`. */
export function newId(): string {
  return v7();
}
