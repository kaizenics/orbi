// MapLibre GL JS 6 locates its web worker relative to its own module URL, which no longer exists
// once Next bundles it. We serve the worker as a static file instead (public/vendor, git-ignored)
// and the map calls setWorkerUrl("/vendor/maplibre-gl-worker.mjs").
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs");
mkdirSync("public/vendor", { recursive: true });
copyFileSync(source, "public/vendor/maplibre-gl-worker.mjs");
