"use client";

import { useSyncExternalStore } from "react";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query, QueryClient } from "@tanstack/react-query";
import { createStore, del, get, set } from "idb-keyval";
import type { TripAggregate } from "@orbi/core";
import { api, unwrap } from "./api";
import { dayRouteKey, queryKeys } from "./queries";

/**
 * How long saved data is kept on the device. Must stay under ~24 days: it is also used as a timer
 * (query gcTime), and browsers fire timers above 2^31 ms immediately, which would drop restored data.
 */
export const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** Cache names used by public/sw.js (the service worker); cleared together with the saved data. */
const SW_CACHES = ["orbi-pages-v1", "orbi-tiles-v1"];

const CACHE_KEY = "orbi-query-cache";
const PREF_KEY = "orbi.offline";
const store = () => createStore("orbi-offline", "cache");

// --- Preference: save trips for offline use (on by default) -------------------------------------

const prefListeners = new Set<() => void>();
const readEnabled = () => {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
};

export function useOfflineEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      prefListeners.add(l);
      return () => prefListeners.delete(l);
    },
    readEnabled,
    () => true,
  );
}

export async function setOfflineEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, "off");
  } catch {
    // storage blocked: the choice lasts until reload
  }
  if (!on) await clearOfflineData();
  prefListeners.forEach((l) => l());
}

// --- Connection status --------------------------------------------------------------------------

export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("online", l);
      window.addEventListener("offline", l);
      return () => {
        window.removeEventListener("online", l);
        window.removeEventListener("offline", l);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

// --- Saved data (IndexedDB) ---------------------------------------------------------------------

/** Persists the TanStack Query cache to IndexedDB, only while saving for offline use is on. */
export const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  throttleTime: 1500,
  storage: {
    getItem: async (key) => (readEnabled() ? ((await get<string>(key, store())) ?? null) : null),
    setItem: async (key, value) => {
      if (readEnabled()) await set(key, value, store());
    },
    removeItem: async (key) => del(key, store()),
  },
});

/** Only trip data is worth keeping: trips, trip details, day routes and the map config. */
export function shouldPersist(query: Query): boolean {
  const root = query.queryKey[0];
  // Anything with data counts, including a query whose latest refresh failed (it keeps its old data):
  // requiring "success" would erase the saved copy at the next write after one failed refresh.
  return query.state.data !== undefined && (root === "trips" || root === "dayRoute" || root === "config");
}

/** Removes everything saved for offline use: query data and the service worker's page and tile caches. */
export async function clearOfflineData() {
  await del(CACHE_KEY, store()).catch(() => undefined);
  if (typeof caches !== "undefined") await Promise.all(SW_CACHES.map((name) => caches.delete(name)));
}

export async function storageUsedBytes(): Promise<number | null> {
  try {
    return (await navigator.storage?.estimate?.())?.usage ?? null;
  } catch {
    return null;
  }
}

/** Counts of what is currently saved (from the in-memory cache that gets persisted). */
export function savedSummary(client: QueryClient) {
  const trips = client.getQueryData<unknown[]>(queryKeys.trips)?.length ?? 0;
  const details = client
    .getQueryCache()
    .findAll({ queryKey: queryKeys.trips })
    .filter((q) => q.queryKey.length === 2 && q.state.data !== undefined).length;
  const routes = client
    .getQueryCache()
    .findAll({ queryKey: ["dayRoute"] })
    .filter((q) => q.state.status === "success").length;
  // The list may not be loaded yet on this page; a saved trip always counts.
  return { trips: Math.max(trips, details), details, routes };
}

/**
 * Saves a page for offline use: fetches its HTML and then the scripts, styles and fonts it refers to,
 * all through the service worker, which keeps them. Without the files, a saved page would open but
 * not run. Pages opened normally are kept by the worker as you use them; this is for pages not yet
 * visited. Files a page only loads later (for example the map library) are saved when it is opened.
 */
export async function warmPage(path: string) {
  const res = await fetch(path, { headers: { accept: "text/html" } }).catch(() => null);
  if (!res?.ok || res.redirected) return;
  const html = await res.text();
  const assets = new Set(
    Array.from(
      html.matchAll(/(?:\/_next\/)?(static\/(?:chunks|css|media)\/[^"'\\\s)]+?\.(?:js|css|woff2))/g),
      (m) => `/_next/${m[1]}`,
    ),
  );
  await Promise.all([...assets].map((url) => fetch(url).catch(() => undefined)));
}

/**
 * Downloads every trip (and its day routes and page) now, so trips that were never opened are also
 * available offline. Sequential on purpose: the routing service is rate limited.
 */
export async function saveAllTrips(client: QueryClient, onProgress: (done: number, total: number) => void) {
  const list = await client.fetchQuery({
    queryKey: queryKeys.trips,
    queryFn: async () => unwrap(await api().trips.$get()),
    staleTime: 0,
  });
  onProgress(0, list.length);
  for (const [i, summary] of list.entries()) {
    const trip: TripAggregate = await client.fetchQuery({
      queryKey: queryKeys.trip(summary.id),
      queryFn: async () => unwrap(await api().trips[":tripId"].$get({ param: { tripId: summary.id } })),
      staleTime: 0,
    });
    for (const day of trip.days) {
      if (day.items.length < 2) continue;
      await client
        .fetchQuery({
          queryKey: dayRouteKey(trip, day),
          queryFn: async () =>
            unwrap(await api().days[":id"].route.$get({ param: { id: day.id }, query: {} })),
          staleTime: 5 * 60_000,
        })
        // A day whose route cannot be calculated right now should not stop the others.
        .catch(() => undefined);
    }
    // Also keep the page itself, so opening the trip works offline (the service worker stores it).
    await warmPage(`/trips/${summary.id}`);
    onProgress(i + 1, list.length);
  }
  await warmPage("/trips");
}
