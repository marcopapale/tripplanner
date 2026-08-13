"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { POI, SLOT_LABELS, Slot } from "@/lib/types";
import { poiIcon, destinationIcon } from "@/lib/mapIcons";

interface MapMarker {
  poi: POI;
  slots: Slot[];
}

const OVERVIEW_ZOOM = 11;

function FitView({
  centerLat,
  centerLon,
  markers,
}: {
  centerLat: number;
  centerLon: number;
  markers: MapMarker[];
}) {
  const map = useMap();
  useEffect(() => {
    // Guards against a Leaflet timing issue where fitBounds/setView is
    // called before the container has a measured size (e.g. right after
    // mount inside a flex/grid layout), which throws reading '_leaflet_pos'.
    map.invalidateSize();
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.poi.lat, m.poi.lon] as [number, number]));
      bounds.extend([centerLat, centerLon]);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: OVERVIEW_ZOOM + 2 });
    } else {
      map.setView([centerLat, centerLon], OVERVIEW_ZOOM);
    }
  }, [markers, centerLat, centerLon, map]);
  return null;
}

export function MapView({
  centerLat,
  centerLon,
  destinationName,
  markers,
}: {
  centerLat: number;
  centerLon: number;
  destinationName: string;
  markers: MapMarker[];
}) {
  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={OVERVIEW_ZOOM}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <FitView centerLat={centerLat} centerLon={centerLon} markers={markers} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.length === 0 && (
        <Marker position={[centerLat, centerLon]} icon={destinationIcon()}>
          <Popup>{destinationName}</Popup>
        </Marker>
      )}
      {markers.map(({ poi, slots }) => (
        <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={poiIcon(poi.category)}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{poi.name}</p>
              {(poi.rating || poi.priceLevel) && (
                <p className="text-gray-500 text-xs">
                  {poi.rating && <span>⭐ {poi.rating.toFixed(1)} </span>}
                  {poi.priceLevel && <span>{"$".repeat(poi.priceLevel)}</span>}
                </p>
              )}
              {poi.description && <p className="text-gray-500">{poi.description}</p>}
              {slots.length > 0 && (
                <p className="text-xs text-lagoon-dark mt-1">
                  {slots.map((s) => SLOT_LABELS[s]).join(" · ")}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
