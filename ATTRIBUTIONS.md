# Attributions

ORBI is licensed under AGPL-3.0-or-later (see [LICENSE](./LICENSE)). It builds on the following
open-source software and open data. Run `pnpm licenses:check` to audit installed dependency licences.

## Map data and services

These apply from Phase 3 onwards, when maps, geocoding and routing are integrated.

| Source                                                                 | Licence / terms                                                                                 | Required attribution                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) data          | ODbL 1.0                                                                                        | "© OpenStreetMap contributors", visible on every map, linked to the copyright page     |
| [OpenFreeMap](https://openfreemap.org) tiles (default)                 | Free public instance, provided as-is                                                            | As provided in the map style (OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors) |
| [Nominatim](https://nominatim.org) (default geocoder)                  | GPL-2.0 software; [OSMF usage policy](https://operations.osmfoundation.org/policies/nominatim/) | Data attribution as for OpenStreetMap                                                  |
| [OSRM](https://project-osrm.org) via the FOSSGIS demo (default router) | BSD-2-Clause software; FOSSGIS usage terms                                                      | Data attribution as for OpenStreetMap                                                  |

Public instances are used politely: requests go through the ORBI server, are rate-limited (≤ 1 req/s),
cached, and sent with an identifying User-Agent. Self-hosting instructions arrive in Phase 6.

## Fonts

- [Geist](https://vercel.com/font) Sans and Mono, SIL Open Font License 1.1.

## AI models

ORBI does not ship model weights. Models pulled through Ollama carry their own licences (e.g.
Apache-2.0, Llama Community Licence, Gemma terms); check the licence of the model you configure.
