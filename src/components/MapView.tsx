"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { POI, SLOT_LABELS, Slot } from "@/lib/types";
import { poiIcon, destinationIcon } from "@/lib/mapIcons";

interface MapMarker {
  poi: POI;
  slots: Slot[];
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon]);
  }, [lat, lon, map]);
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
      zoom={13}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <Recenter lat={centerLat} lon={centerLon} />
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
