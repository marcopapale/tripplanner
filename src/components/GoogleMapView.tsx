"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsLibraries } from "@/lib/googleMapsLoader";
import { PlaceDetailsCard } from "@/components/PlaceDetailsCard";
import { POI, SLOT_LABELS, Slot } from "@/lib/types";

interface MapMarker {
  poi: POI;
  slots: Slot[];
}

export function GoogleMapView({
  apiKey,
  centerLat,
  centerLon,
  destinationName,
  markers,
}: {
  apiKey: string;
  centerLat: number;
  centerLon: number;
  destinationName: string;
  markers: MapMarker[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const gRef = useRef<typeof google | null>(null);
  const markerObjsRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<MapMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsLibraries(apiKey, ["maps", "marker", "places"])
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        gRef.current = g;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: { lat: centerLat, lng: centerLon },
          zoom: 12,
          mapId: "DEMO_MAP_ID",
          gestureHandling: "cooperative",
          streetViewControl: false,
          fullscreenControl: false,
        });
        setReady(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const g = gRef.current;
    const map = mapRef.current;
    if (!ready || !g || !map) return;

    markerObjsRef.current.forEach((m) => (m.map = null));
    markerObjsRef.current = [];

    if (markers.length === 0) {
      map.setCenter({ lat: centerLat, lng: centerLon });
      map.setZoom(11);
      const destinationMarker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: centerLat, lng: centerLon },
        title: destinationName,
      });
      markerObjsRef.current.push(destinationMarker);
      return;
    }

    const bounds = new g.maps.LatLngBounds();
    for (const entry of markers) {
      const marker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: entry.poi.lat, lng: entry.poi.lon },
        title: entry.poi.name,
      });
      marker.addEventListener("gmp-click", () => setSelected(entry));
      markerObjsRef.current.push(marker);
      bounds.extend({ lat: entry.poi.lat, lng: entry.poi.lon });
    }
    bounds.extend({ lat: centerLat, lng: centerLon });
    map.fitBounds(bounds, 48);
  }, [ready, markers, centerLat, centerLon, destinationName]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-3xl overflow-hidden" />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 bg-white/60 rounded-3xl">
          Caricamento mappa…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 bg-white/80 rounded-3xl px-4 text-center">
          Impossibile caricare Google Maps. Controlla la chiave nelle Impostazioni.
        </div>
      )}

      {selected && (
        <div className="absolute left-2 bottom-2 z-10 w-[min(320px,90%)] max-h-[80%] overflow-y-auto rounded-2xl bg-white shadow-lg border border-gray-100 p-3">
          <button
            onClick={() => setSelected(null)}
            className="float-right text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
          {selected.poi.placeId ? (
            <PlaceDetailsCard placeId={selected.poi.placeId} />
          ) : (
            <div>
              <p className="font-semibold text-sm">{selected.poi.name}</p>
              {selected.poi.description && (
                <p className="text-xs text-gray-500">{selected.poi.description}</p>
              )}
            </div>
          )}
          {selected.slots.length > 0 && (
            <p className="text-xs text-lagoon-dark mt-1 clear-both">
              {selected.slots.map((s) => SLOT_LABELS[s]).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
