import type { StyleSpecification } from "maplibre-gl";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

/**
 * Satellite imagery with place names and borders on top (Esri World Imagery, keyless).
 * shortcut: Esri's public tiles allow fair, attributed use; for heavy or commercial traffic,
 * switch to an Esri/ArcGIS developer key or another imagery provider.
 */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    imagery: {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    labels: {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "imagery", type: "raster", source: "imagery" },
    { id: "labels", type: "raster", source: "labels" },
  ],
};
