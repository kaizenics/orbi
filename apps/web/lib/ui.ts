/** Stacks a shadcn <Label> over its control (applied with cn, so it overrides Label's row layout). */
export const labelClass = "flex flex-col items-stretch gap-1.5 text-xs font-medium text-muted-foreground";

/** "1500" (pesos as typed) → minor units, or null for an empty field. */
export function parseMoney(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Empty form field → null, otherwise the trimmed string. */
export const textOrNull = (value: FormDataEntryValue | null) => String(value ?? "").trim() || null;
