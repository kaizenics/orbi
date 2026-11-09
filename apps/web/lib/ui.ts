export const inputClass =
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
export const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50";
export const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50";
export const labelClass = "flex flex-col gap-1 text-xs font-medium text-muted-foreground";

/** "1500" (pesos as typed) → minor units, or null for an empty field. */
export function parseMoney(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Empty form field → null, otherwise the trimmed string. */
export const textOrNull = (value: FormDataEntryValue | null) => String(value ?? "").trim() || null;
