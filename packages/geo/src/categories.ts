import type { DestinationCategory } from "@orbi/core";

/** Maps OSM key/value (e.g. tourism/museum) to an ORBI category. */
export function categoryFromOsm(key: string | undefined, value: string | undefined): DestinationCategory {
  const k = key ?? "";
  const v = value ?? "";
  if (k === "historic" || ["museum", "monument", "memorial", "castle", "ruins", "fort"].includes(v))
    return "history";
  if (["restaurant", "cafe", "fast_food", "food_court", "marketplace", "bakery", "bar", "pub"].includes(v))
    return "food";
  if (v === "beach" || v === "beach_resort") return "beach";
  if (["hotel", "hostel", "guest_house", "motel", "resort", "apartment"].includes(v)) return "lodging";
  if (k === "natural" || ["park", "nature_reserve", "garden", "viewpoint", "peak", "waterfall"].includes(v))
    return "nature";
  if (k === "shop" || ["mall", "department_store", "supermarket"].includes(v)) return "shopping";
  if (["aerodrome", "bus_station", "ferry_terminal", "station", "terminal"].includes(v)) return "transport";
  if (["theme_park", "zoo", "aquarium", "sports_centre", "dive_centre"].includes(v)) return "activity";
  if (k === "tourism" || v === "place_of_worship" || v === "attraction") return "attraction";
  return "other";
}
