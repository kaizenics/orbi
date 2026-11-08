import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import type { DayRoute, TripAggregate } from "@orbi/core";
import { bboxOf, buildMapFeatures, formatRouteTotals } from "@orbi/geo/utils";
import { dayColor } from "@orbi/theme";

interface TripMapProps {
  styleUrl: string;
  data: TripAggregate;
  routes: ReadonlyMap<string, DayRoute>;
  dayIndex: number;
  selectedItemId: string | null;
  onSelectItem: (itemId: string, dayIndex: number) => void;
}

const PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

/** Native map (MapLibre Native). Same GeoJSON and layer semantics as the web map. */
export function TripMap({ styleUrl, data, routes, dayIndex, selectedItemId, onSelectItem }: TripMapProps) {
  const camera = useRef<CameraRef>(null);
  const features = useMemo(() => buildMapFeatures(data, routes, dayColor), [data, routes]);
  const day = data.days[dayIndex];
  const route = day ? routes.get(day.id) : undefined;
  const isDay = ["==", ["get", "dayIndex"], dayIndex] as ["==", ["get", string], number];
  const isSelected = ["==", ["get", "itemId"], selectedItemId ?? ""] as ["==", ["get", string], string];

  const box = useMemo(() => {
    const own = features.stops.features.filter((f) => f.properties.dayIndex === dayIndex);
    const pts = (own.length ? own : features.stops.features).map((f) => ({
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
    return bboxOf(pts);
  }, [features, dayIndex]);

  useEffect(() => {
    if (box) camera.current?.fitBounds(box, { padding: PADDING, duration: 600 });
  }, [box]);

  useEffect(() => {
    const stop = features.stops.features.find((f) => f.properties.itemId === selectedItemId);
    if (stop) camera.current?.easeTo({ center: stop.geometry.coordinates, duration: 400 });
  }, [selectedItemId, features]);

  return (
    <View className="flex-1">
      <Map mapStyle={styleUrl} style={{ flex: 1 }} attribution logo={false} compass={false}>
        <Camera
          ref={camera}
          initialViewState={box ? { bounds: box, padding: PADDING } : { center: [123.9, 10.3], zoom: 11 }}
        />
        <GeoJSONSource id="legs" data={features.legs}>
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
            paint={{ "line-color": ["get", "color"], "line-width": 2.5, "line-dasharray": [2, 2] }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id="stops"
          data={features.stops}
          onPress={(e) => {
            const props = e.nativeEvent.features[0]?.properties as
              { itemId?: string; dayIndex?: number } | undefined;
            if (props?.itemId !== undefined && props.dayIndex !== undefined)
              onSelectItem(props.itemId, Number(props.dayIndex));
          }}
        >
          <Layer
            id="stops-circle"
            type="circle"
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": ["case", isSelected, 15, ["case", isDay, 12, 8]],
              "circle-stroke-color": ["case", isSelected, "#111111", "#ffffff"],
              "circle-stroke-width": ["case", isSelected, 3, 2],
              "circle-opacity": ["case", isDay, 1, 0.45],
            }}
          />
          <Layer
            id="stops-number"
            type="symbol"
            filter={isDay}
            layout={{
              "text-field": ["to-string", ["get", "number"]],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            }}
            paint={{ "text-color": "#ffffff" }}
          />
        </GeoJSONSource>
      </Map>
      {route ? (
        <View className="absolute bottom-3 left-3 rounded-lg border border-border bg-card px-3 py-2">
          <Text className="text-xs text-foreground">
            Day {dayIndex + 1} · {formatRouteTotals(route.totals) ?? "No road route available"}
          </Text>
          {route.totals.unroutedLegs ? (
            <Text className="text-xs text-muted-foreground">
              Dashed = straight line, not a road route ({route.totals.unroutedLegs})
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
