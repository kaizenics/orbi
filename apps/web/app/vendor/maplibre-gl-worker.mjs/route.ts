import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Resolved from the app directory at runtime (Turbopack rewrites require.resolve to virtual paths);
// pnpm links every direct dependency into apps/web/node_modules.
const workerPath = join(process.cwd(), "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");

/**
 * Serves MapLibre GL JS's web worker from the installed package. MapLibre 6 locates its worker
 * relative to its own module URL, which no longer exists once Turbopack bundles it; the map
 * component calls setWorkerUrl() with this route instead.
 */
export async function GET() {
  return new Response(await readFile(workerPath), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
