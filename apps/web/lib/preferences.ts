"use client";

import { useSyncExternalStore } from "react";
import { formatClock } from "@orbi/core";
import { formatDistance } from "@orbi/geo/utils";

/** Display preferences, kept per browser (like the theme and the AI key). */
export interface Preferences {
  timeFormat: "24h" | "12h";
  distanceUnit: "metric" | "imperial";
  /** Map colours: follow the app theme, or always light / always dark. */
  mapStyle: "auto" | "light" | "dark" | "satellite";
  /** Clocks on My Trips (IANA names); null = automatic (you + upcoming trips). */
  timezones: string[] | null;
}

export const MAX_TIMEZONES = 5;

const isTimeZone = (zone: unknown): zone is string => {
  if (typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const DEFAULTS: Preferences = {
  timeFormat: "24h",
  distanceUnit: "metric",
  mapStyle: "auto",
  timezones: null,
};
const STORAGE_KEY = "orbi.preferences";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Preferences = DEFAULTS;

function read(): Preferences {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULTS;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const saved = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
      // Only known values survive, so an old or edited entry can never break rendering.
      cached = {
        timeFormat: saved.timeFormat === "12h" ? "12h" : "24h",
        distanceUnit: saved.distanceUnit === "imperial" ? "imperial" : "metric",
        mapStyle: (["light", "dark", "satellite"] as const).find((m) => m === saved.mapStyle) ?? "auto",
        timezones: Array.isArray(saved.timezones)
          ? [...new Set(saved.timezones.filter(isTimeZone))].slice(0, MAX_TIMEZONES)
          : null,
      };
    } catch {
      cached = DEFAULTS;
    }
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [key]: value }));
  } catch {
    return; // storage blocked: keep the defaults
  }
  listeners.forEach((l) => l());
}

/** "14:30" or "2:30 PM" for minutes after midnight (keeps the "+1" next-day marker). */
export function clockIn(format: Preferences["timeFormat"], min: number): string {
  const text = formatClock(min);
  if (format === "24h") return text;
  const [hhmm, nextDay] = text.split(" ");
  const [h, m] = hhmm!.split(":").map(Number);
  const twelve = `${h! % 12 || 12}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
  return nextDay ? `${twelve} ${nextDay}` : twelve;
}

export function distanceIn(unit: Preferences["distanceUnit"], meters: number): string {
  if (unit === "metric") return formatDistance(meters);
  const miles = meters / 1609.344;
  return miles < 0.1
    ? `${Math.round((meters * 3.28084) / 10) * 10} ft`
    : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** Time and distance formatters that follow the user's settings. */
export function useFormatters() {
  const p = usePreferences();
  return {
    clock: (min: number) => clockIn(p.timeFormat, min),
    distance: (m: number) => distanceIn(p.distanceUnit, m),
  };
}
