"use client";

import { useEffect } from "react";
import { useOfflineEnabled, warmPage } from "@/lib/offline";

/**
 * Registers the service worker (public/sw.js) so the app opens offline, and removes it when the
 * user turns "Save trips for offline use" off. Production only: in development it would serve stale
 * bundles and fight hot reloading.
 */
export function ServiceWorker() {
  const enabled = useOfflineEnabled();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (enabled) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        // Once the worker is active, fetch My Trips through it so that page is saved too, even if it
        // was opened before the worker existed. (Signed-out visitors get a redirect, which is not saved.)
        .then(() => navigator.serviceWorker.ready)
        .then(() => Promise.all([warmPage("/trips"), warmPage("/settings")]))
        .catch(() => undefined);
    } else
      void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
  }, [enabled]);
  return null;
}
