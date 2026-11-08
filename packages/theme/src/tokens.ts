/**
 * Token values needed as plain strings (e.g. MapLibre paint properties, which cannot read CSS variables).
 * Keep in sync with theme.css — tokens.test.ts enforces it.
 */
export const colors = {
  canvas: "#FBFBFA",
  surface: "#FFFFFF",
  ink: "#111111",
  inkMuted: "#787774",
  border: "#EAEAEA",
  accent: "#1F6C9F",
} as const;

/**
 * Route/marker colour per itinerary day (cycled). Okabe–Ito colour-blind-safe palette
 * without yellow (insufficient contrast on light maps), plus charcoal.
 * Colour is never the only signal: markers also carry the stop number and day label.
 */
export const dayColors = [
  "#0072B2", // blue
  "#D55E00", // vermillion
  "#009E73", // bluish green
  "#CC79A7", // reddish purple
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#2F3437", // charcoal
] as const;

export function dayColor(dayIndex: number): string {
  const n = dayColors.length;
  return dayColors[((dayIndex % n) + n) % n] as string;
}
