/*
 * ORBI service worker: lets the app open offline.
 *  - App files (/_next/static, fonts, images): cache first.
 *  - Pages: network first; the last version seen is used when offline.
 *  - Map tiles and styles you have viewed: kept (up to a limit) so those maps still draw offline.
 * Never cached: /api and /auth (live data and sign-in). Trip data itself is saved by the app
 * (IndexedDB), not here. Cache names are listed in apps/web/lib/offline.ts.
 */
const STATIC = "orbi-static-v1";
const PAGES = "orbi-pages-v1";
const TILES = "orbi-tiles-v1";
const KEEP = [STATIC, PAGES, TILES];
const MAX_TILES = 1500;
const MAP_HOSTS = ["tiles.openfreemap.org", "server.arcgisonline.com"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

/** Keeps the cache from growing forever: drops the oldest entries beyond the limit. */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** Shows the saved copy at once and refreshes it in the background. */
async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trim(cache, max);
      }
      return response;
    })
    .catch(() => undefined);
  return hit ?? (await refresh) ?? Response.error();
}

const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · ORBI</title>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;text-align:center">
<div><h1 style="font-size:1.5rem;margin:0 0 .5rem">You're offline</h1>
<p style="margin:0 0 1rem;color:#666">This page isn't saved on this device yet. Open it once while online.</p>
<button onclick="location.reload()" style="padding:.6rem 1.2rem;border-radius:999px;border:0;background:#111;color:#fff;font:inherit;cursor:pointer">Try again</button></div>`;

async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // Redirects (for example to the sign-in page) and errors are never saved as a page.
    if (response.ok && !response.redirected) cache.put(new URL(request.url).pathname, response.clone());
    return response;
  } catch {
    const path = new URL(request.url).pathname;
    const saved =
      (await cache.match(path)) ??
      // A trip that was never opened: show the saved trips list instead of an error.
      (path.startsWith("/trips/") ? await cache.match("/trips") : undefined);
    return saved ?? new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (MAP_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, TILES, MAX_TILES));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname === "/sw.js")
    return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/vendor/") ||
    url.pathname.startsWith("/landing/")
  ) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  const wantsHtml =
    request.mode === "navigate" || (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsHtml) event.respondWith(page(request));
});
