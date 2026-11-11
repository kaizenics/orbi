"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layer,
  Map,
  Popup,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "@vis.gl/react-maplibre";
import { setWorkerUrl, type ExpressionSpecification, type StyleSpecification } from "maplibre-gl";
import { Layers } from "lucide-react";
import type { DayRoute, TripAggregate } from "@orbi/core";
import { bboxOf, buildMapFeatures, formatRouteTotals } from "@orbi/geo/utils";
import { dayColor } from "@orbi/theme";

interface TripMapProps {
  styleUrl: string | StyleSpecification;
  satellite: boolean;
  onToggleSatellite: () => void;
  data: TripAggregate;
  routes: ReadonlyMap<string, DayRoute>;
  dayIndex: number;
  selectedItemId: string | null;
  onSelectItem: (itemId: string, dayIndex: number) => void;
  routeLoading: boolean;
}

const LABEL_FONT = ["Noto Sans Bold"];
/** Extra bottom padding keeps stops clear of the route summary card. */
const FIT_PADDING = { top: 64, right: 64, bottom: 160, left: 64 };
/** Wide screens: stops must not hide under the floating side panels. */
const fitPadding = () =>
  typeof window !== "undefined" && window.innerWidth >= 1024
    ? { ...FIT_PADDING, left: 520, right: 460 }
    : FIT_PADDING;

// Copied to public/vendor by scripts/copy-maplibre-worker.mjs (MapLibre 6 cannot find it once bundled).
if (typeof window !== "undefined") setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export function TripMap({
  styleUrl,
  satellite,
  onToggleSatellite,
  data,
  routes,
  dayIndex,
  selectedItemId,
  onSelectItem,
  routeLoading,
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const features = useMemo(() => buildMapFeatures(data, routes, dayColor), [data, routes]);
  const day = data.days[dayIndex];
  const route = day ? routes.get(day.id) : undefined;

  // Fit the selected day (or the whole trip when the day is empty).
  const dayPoints = useMemo(() => {
    const pick = (i: number) =>
      features.stops.features
        .filter((f) => f.properties.dayIndex === i)
        .map((f) => ({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
    const own = pick(dayIndex);
    return own.length
      ? own
      : features.stops.features.map((f) => ({
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));
  }, [features, dayIndex]);

  useEffect(() => {
    const box = bboxOf(dayPoints);
    if (!box || !mapRef.current) return;
    mapRef.current.fitBounds(
      [
        [box[0], box[1]],
        [box[2], box[3]],
      ],
      { padding: fitPadding(), maxZoom: 16, duration: 600 },
    );
  }, [dayPoints]);

  useEffect(() => {
    const stop = features.stops.features.find((f) => f.properties.itemId === selectedItemId);
    if (stop && mapRef.current) mapRef.current.easeTo({ center: stop.geometry.coordinates, duration: 400 });
  }, [selectedItemId, features]);

  // The numbered marker under the pointer: its name, address and coordinates show in a card.
  const [hover, setHover] = useState<{
    itemId: string;
    name: string;
    address: string;
    lng: number;
    lat: number;
  } | null>(null);
  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const props = f?.properties as { itemId?: string; name?: string; address?: string } | undefined;
    if (!f || f.geometry.type !== "Point" || !props?.itemId) {
      setHover((h) => (h ? null : h));
      return;
    }
    const [lng, lat] = f.geometry.coordinates as [number, number];
    setHover((h) =>
      h?.itemId === props.itemId
        ? h
        : { itemId: props.itemId!, name: props.name ?? "", address: props.address ?? "", lng, lat },
    );
  };

  const onClick = (e: MapLayerMouseEvent) => {
    const props = e.features?.[0]?.properties as { itemId?: string; dayIndex?: number } | undefined;
    if (props?.itemId !== undefined && props.dayIndex !== undefined)
      onSelectItem(props.itemId, Number(props.dayIndex));
  };

  const isDay: ExpressionSpecification = ["==", ["get", "dayIndex"], dayIndex];
  const box = bboxOf(dayPoints);
  const unrouted = route?.totals.unroutedLegs ?? 0;

  return (
    <div className="relative h-full min-h-[50vh]">
      <Map
        ref={mapRef}
        mapStyle={styleUrl}
        initialViewState={
          box
            ? {
                bounds: [
                  [box[0], box[1]],
                  [box[2], box[3]],
                ],
                fitBoundsOptions: { padding: fitPadding(), maxZoom: 16 },
              }
            : { longitude: 123.9, latitude: 10.3, zoom: 11 }
        }
        style={{ position: "absolute", inset: 0 }}
        interactiveLayerIds={["stops-circle"]}
        onClick={onClick}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        cursor={hover ? "pointer" : "auto"}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {hover ? (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            // No fixed anchor: MapLibre opens the card on whichever side of the marker fits the view.
            offset={18}
            closeButton={false}
            closeOnClick={false}
            focusAfterOpen={false}
            className="stop-hover"
          >
            <p className="font-semibold">{hover.name}</p>
            {hover.address ? <p className="mt-0.5 text-muted-foreground">{hover.address}</p> : null}
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {hover.lat.toFixed(5)}, {hover.lng.toFixed(5)}
            </p>
          </Popup>
        ) : null}

        <Source id="legs" type="geojson" data={features.legs}>
          <Layer
            id="legs-casing"
            type="line"
            filter={["==", ["get", "routed"], true]}
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{
              "line-color": "#ffffff",
              "line-width": ["case", isDay, 8, 5],
              "line-opacity": ["case", isDay, 0.9, 0.4],
            }}
          />
          <Layer
            id="legs-routed"
            type="line"
            filter={["==", ["get", "routed"], true]}
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{
              "line-color": ["get", "color"],
              "line-width": ["case", isDay, 4.5, 3],
              "line-opacity": ["case", isDay, 1, 0.35],
            }}
          />
          <Layer
            id="legs-straight"
            type="line"
            filter={["==", ["get", "routed"], false]}
            paint={{
              "line-color": ["get", "color"],
              "line-width": 2.5,
              "line-dasharray": [2, 2],
              "line-opacity": ["case", isDay, 0.9, 0.3],
            }}
          />
        </Source>

        <Source id="stops" type="geojson" data={features.stops}>
          <Layer
            id="stops-circle"
            type="circle"
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": [
                "case",
                ["==", ["get", "itemId"], selectedItemId ?? ""],
                15,
                ["case", isDay, 12, 8],
              ],
              "circle-stroke-color": [
                "case",
                ["==", ["get", "itemId"], selectedItemId ?? ""],
                "#111111",
                "#ffffff",
              ],
              "circle-stroke-width": ["case", ["==", ["get", "itemId"], selectedItemId ?? ""], 3, 2],
              "circle-opacity": ["case", isDay, 1, 0.45],
              "circle-stroke-opacity": ["case", isDay, 1, 0.45],
            }}
          />
          <Layer
            id="stops-number"
            type="symbol"
            filter={isDay}
            layout={{
              "text-field": ["to-string", ["get", "number"]],
              "text-font": LABEL_FONT,
              "text-size": 12,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            }}
            paint={{ "text-color": "#ffffff" }}
          />
        </Source>
      </Map>

      {day ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-10 left-4 flex max-w-[calc(100%-2rem)] flex-col gap-1 rounded-lg border bg-card/95 px-4 py-3 text-sm shadow-sm lg:left-[488px]"
        >
          <span className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: dayColor(dayIndex) }}
            />
            Day {dayIndex + 1}
          </span>
          {day.items.some((i) => i.id.startsWith("preview-")) ? (
            <span className="text-muted-foreground">AI preview · routes are calculated after you apply.</span>
          ) : day.items.length < 2 ? (
            <span className="text-muted-foreground">Add two or more stops to see a route.</span>
          ) : routeLoading && !route ? (
            <span className="text-muted-foreground">Calculating route…</span>
          ) : route ? (
            <>
              <span className="text-muted-foreground">
                {formatRouteTotals(route.totals) ?? "No road route available"} ·{" "}
                {day.travelMode ?? data.trip.defaultTravelMode}
              </span>
              {unrouted ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <svg aria-hidden width="24" height="4">
                    <line
                      x1="0"
                      y1="2"
                      x2="24"
                      y2="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  </svg>
                  Straight line — not a road route ({unrouted} leg{unrouted > 1 ? "s" : ""}, not in totals)
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">Route unavailable.</span>
          )}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggleSatellite}
        aria-pressed={satellite}
        title={satellite ? "Show the map" : "Show satellite imagery"}
        className="map-style-toggle absolute top-[88px] right-2.5 z-10 inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-muted"
      >
        <Layers aria-hidden className="size-3.5" />
        {satellite ? "Map" : "Satellite"}
      </button>
    </div>
  );
}
