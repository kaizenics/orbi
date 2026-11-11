const dayFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "Fri 11 Dec" for a YYYY-MM-DD calendar date (rendered in UTC so the date never shifts). */
export function formatDate(isoDate: string | null): string | null {
  return isoDate ? dayFormat.format(new Date(`${isoDate}T00:00:00Z`)) : null;
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Every ISO 4217 currency the runtime knows, as select options ("JPY · Japanese Yen"). */
const currencyNames = new Intl.DisplayNames("en", { type: "currency" });
export const CURRENCY_OPTIONS = Intl.supportedValuesOf("currency").map((code) => ({
  value: code,
  label: `${code} · ${currencyNames.of(code) ?? code}`,
}));

/** Short symbol for a currency code, e.g. "₱" for PHP, "¥" for JPY. */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    minor / 100,
  );
}
