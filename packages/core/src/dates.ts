const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(date: string): number {
  if (!ISO_DATE.test(date)) throw new RangeError(`Invalid ISO date: ${date}`);
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid ISO date: ${date}`);
  }
  return ms;
}

/** Calendar-date arithmetic on YYYY-MM-DD strings (no timezone involvement). */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Inclusive number of days from start to end, e.g. 2026-01-01..2026-01-03 → 3. */
export function daysBetweenInclusive(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1;
}

export function isValidIsoDate(date: string): boolean {
  try {
    toUtc(date);
    return true;
  } catch {
    return false;
  }
}
