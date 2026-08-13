"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trip,
  POI,
  POICategory,
  POIProvider,
  POI_PROVIDER_LABELS,
  POI_CATEGORY_LABELS,
  POI_CATEGORY_DEFAULT_SLOTS,
  OSM_SEARCH_CATEGORIES,
  SLOT_LABELS,
  Slot,
} from "@/lib/types";
import { MapBounds } from "@/lib/poiDiscovery";
import { searchAreaPOIs } from "@/app/actions/poi-actions";
import { getTripCategories } from "@/app/actions/ai-actions";
import { formatDayLabel } from "@/lib/dates";
import { CATEGORY_COLOR, CATEGORY_EMOJI } from "@/lib/mapIcons";
import { loadGoogleMapsLibraries } from "@/lib/googleMapsLoader";
import { PlaceDetailsCard } from "@/components/PlaceDetailsCard";

interface SearchResult {
  tempId: string;
  name: string;
  category: POICategory;
  lat: number;
  lon: number;
  description?: string;
  rating?: number;
  priceLevel?: number;
  placeId?: string;
}

type Selected =
  | { kind: "catalog"; poi: POI }
  | { kind: "result"; result: SearchResult };

function RatingBadge({ rating, priceLevel }: { rating?: number; priceLevel?: number }) {
  if (!rating && !priceLevel) return null;
  return (
    <p className="text-xs text-gray-500 flex items-center gap-1.5">
      {rating && <span>⭐ {rating.toFixed(1)}</span>}
      {priceLevel && <span>{"$".repeat(priceLevel)}</span>}
    </p>
  );
}

function AssignForm({
  name,
  category,
  rating,
  priceLevel,
  placeId,
  trip,
  defaultDay,
  onConfirm,
}: {
  name: string;
  category: POICategory;
  rating?: number;
  priceLevel?: number;
  placeId?: string;
  trip: Trip;
  defaultDay: number;
  onConfirm: (dayIndex: number, slots: Slot[]) => Promise<void>;
}) {
  const availableSlots = POI_CATEGORY_DEFAULT_SLOTS[category];
  const [day, setDay] = useState(defaultDay);
  const [slots, setSlots] = useState<Set<Slot>>(new Set([availableSlots[0]]));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function toggleSlot(s: Slot) {
    setSlots((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {placeId ? (
        <PlaceDetailsCard placeId={placeId} />
      ) : (
        <>
          <p className="text-sm font-semibold">{name}</p>
          <RatingBadge rating={rating} priceLevel={priceLevel} />
        </>
      )}

      {done ? (
        <p className="text-sm font-medium text-lagoon-dark">Aggiunto ✓</p>
      ) : (
        <>
          <select
            value={day}
            onChange={(e) => setDay(parseInt(e.target.value, 10))}
            className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1.5"
          >
            {trip.itinerary.map((_, i) => (
              <option key={i} value={i}>
                Giorno {i + 1} · {formatDayLabel(trip.startDate, i)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1">
            {availableSlots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSlot(s)}
                className={`text-[11px] rounded-full px-2 py-1 border ${
                  slots.has(s)
                    ? "bg-sunset text-white border-sunset"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={saving || slots.size === 0}
            onClick={async () => {
              setSaving(true);
              await onConfirm(day, Array.from(slots));
              setSaving(false);
              setDone(true);
            }}
            className="w-full text-xs font-semibold bg-lagoon text-white rounded-lg px-2 py-1.5 disabled:opacity-50"
          >
            {saving ? "Aggiungo…" : "Aggiungi al giorno"}
          </button>
        </>
      )}
    </div>
  );
}

export function POIMapSearch({
  trip,
  catalogPOIs,
  selectedDay,
  poiProvider,
  googleMapsBrowserKey,
  onAssignExisting,
  onAddAndAssign,
}: {
  trip: Trip;
  catalogPOIs: POI[];
  selectedDay: number;
  poiProvider: POIProvider;
  googleMapsBrowserKey?: string;
  onAssignExisting: (poi: POI, dayIndex: number, slots: Slot[]) => Promise<void>;
  onAddAndAssign: (
    result: Omit<POI, "id" | "tripId">,
    dayIndex: number,
    slots: Slot[]
  ) => Promise<POI>;
}) {
  const [selectedCategories, setSelectedCategories] = useState<Set<POICategory>>(new Set());
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const gRef = useRef<typeof google | null>(null);
  const markerObjsRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // AI curates which category filters are relevant for this destination the
  // first time the trip's map is opened (cached on the trip afterward).
  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    getTripCategories(trip.id)
      .then((cats) => {
        if (!cancelled) setSelectedCategories(new Set(cats));
      })
      .catch(() => {
        if (!cancelled) setSelectedCategories(new Set(["ristorante", "monumento"]));
      })
      .finally(() => !cancelled && setCategoriesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [trip.id]);

  function toggleCategory(c: POICategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  // Above this span (~roughly a metro area), searches get slow/heavy and,
  // for paid providers, expensive — ask the admin to zoom in instead.
  const MAX_SPAN_DEGREES = 0.6;

  const runSearch = useCallback(async () => {
    if (!bounds || selectedCategories.size === 0) return;
    const span = Math.max(bounds.north - bounds.south, bounds.east - bounds.west);
    if (span > MAX_SPAN_DEGREES) {
      setSearchMsg("Zoom sulla mappa più vicino alla zona da esplorare per cercare i POI");
      return;
    }
    setSearching(true);
    setSearchMsg(null);
    const found = await searchAreaPOIs(bounds, Array.from(selectedCategories));
    setResults(found.map((f, i) => ({ ...f, tempId: `${Date.now()}-${i}` })));
    setSearchMsg(found.length === 0 ? "Nessun POI trovato in quest'area" : null);
    setSearching(false);
  }, [bounds, selectedCategories]);

  const catalogKeys = useMemo(
    () => new Set(catalogPOIs.map((p) => `${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`)),
    [catalogPOIs]
  );
  const visibleResults = results.filter(
    (r) => !catalogKeys.has(`${r.name.toLowerCase()}|${r.lat.toFixed(4)}|${r.lon.toFixed(4)}`)
  );

  // --- Google Map bootstrap ---
  useEffect(() => {
    if (!googleMapsBrowserKey) return;
    let cancelled = false;
    loadGoogleMapsLibraries(googleMapsBrowserKey, ["maps", "marker", "places"])
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        gRef.current = g;
        const map = new g.maps.Map(containerRef.current, {
          center: { lat: trip.lat, lng: trip.lon },
          zoom: 14,
          mapId: "DEMO_MAP_ID",
          gestureHandling: "cooperative",
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        // clickableIcons:false disabilita i click su TUTTA la mappa vettoriale
        // (bug noto con mapId): blocchiamo solo il popup nativo delle icone POI.
        map.addListener("click", (e: google.maps.MapMouseEvent & { placeId?: string }) => {
          if (e.placeId) {
            e.stop();
          }
        });
        const updateBounds = () => {
          const b = map.getBounds();
          if (!b) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          setBounds({ north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() });
        };
        map.addListener("idle", updateBounds);
        updateBounds();
        setMapReady(true);
      })
      .catch(() => !cancelled && setMapError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMapsBrowserKey, trip.id]);

  // --- Markers: catalog POIs + search results ---
  useEffect(() => {
    const g = gRef.current;
    const map = mapRef.current;
    if (!mapReady || !g || !map) return;

    markerObjsRef.current.forEach((m) => (m.map = null));
    markerObjsRef.current = [];

    for (const poi of catalogPOIs) {
      const el = document.createElement("div");
      el.style.cssText =
        `width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;` +
        `justify-content:center;font-size:14px;border:2px solid white;` +
        `box-shadow:0 2px 6px rgba(0,0,0,.25);background:${CATEGORY_COLOR[poi.category]}`;
      el.textContent = CATEGORY_EMOJI[poi.category];
      const marker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: poi.lat, lng: poi.lon },
        title: poi.name,
        content: el,
      });
      marker.addEventListener("gmp-click", () => setSelected({ kind: "catalog", poi }));
      markerObjsRef.current.push(marker);
    }

    for (const r of visibleResults) {
      const el = document.createElement("div");
      el.style.cssText =
        `width:24px;height:24px;border-radius:9999px;display:flex;align-items:center;` +
        `justify-content:center;font-size:12px;background:white;` +
        `border:2px dashed ${CATEGORY_COLOR[r.category]};box-shadow:0 2px 6px rgba(0,0,0,.15)`;
      el.textContent = CATEGORY_EMOJI[r.category];
      const marker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: r.lat, lng: r.lon },
        title: r.name,
        content: el,
      });
      marker.addEventListener("gmp-click", () => setSelected({ kind: "result", result: r }));
      markerObjsRef.current.push(marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, catalogPOIs, visibleResults]);

  const providerColor =
    poiProvider === "foursquare" ? "#F04077" : poiProvider === "google" ? "#4285F4" : "#0d9488";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1"
          style={{ background: `${providerColor}1a`, color: providerColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: providerColor }} />
          Provider: {POI_PROVIDER_LABELS[poiProvider]}
        </span>
        <a href="/admin/settings" className="text-[11px] text-gray-400 hover:text-gray-600">
          Cambia →
        </a>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {categoriesLoading && (
          <span className="text-[11px] text-gray-400">✨ l&apos;AI sta scegliendo le categorie…</span>
        )}
        {OSM_SEARCH_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggleCategory(c)}
            className="text-[11px] rounded-full px-2.5 py-1 border transition-colors"
            style={
              selectedCategories.has(c)
                ? { background: CATEGORY_COLOR[c], color: "white", borderColor: CATEGORY_COLOR[c] }
                : { background: "white", color: "#6b7280", borderColor: "#e5e7eb" }
            }
          >
            {POI_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={searching || !bounds || selectedCategories.size === 0}
        onClick={runSearch}
        className="w-full text-xs font-semibold text-lagoon-dark bg-lagoon/10 hover:bg-lagoon/20 rounded-full px-3 py-2 disabled:opacity-50"
      >
        {searching ? "Ricerca in corso…" : "🔎 Cerca POI in quest'area"}
      </button>
      {searchMsg && <p className="text-xs text-gray-400 text-center">{searchMsg}</p>}

      <div className="relative rounded-3xl overflow-hidden border border-gray-100 h-[420px]">
        {!googleMapsBrowserKey ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-gray-400 text-center px-6">
            Mappa non configurata: aggiungi la Google Maps API Key nelle{" "}
            <a href="/admin/settings" className="underline">
              Impostazioni
            </a>
            .
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-full w-full" />
            {!mapReady && !mapError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 bg-white/60">
                Caricamento mappa…
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 bg-white/80 px-4 text-center">
                Impossibile caricare Google Maps. Controlla la chiave nelle Impostazioni.
              </div>
            )}
            {selected && (
              <div className="absolute left-2 bottom-2 z-10 w-[min(320px,90%)] max-h-[85%] overflow-y-auto rounded-2xl bg-white shadow-lg border border-gray-100 p-3">
                <button
                  onClick={() => setSelected(null)}
                  className="float-right text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
                {selected.kind === "catalog" ? (
                  <AssignForm
                    name={selected.poi.name}
                    category={selected.poi.category}
                    rating={selected.poi.rating}
                    priceLevel={selected.poi.priceLevel}
                    placeId={selected.poi.placeId}
                    trip={trip}
                    defaultDay={selectedDay}
                    onConfirm={(day, slots) => onAssignExisting(selected.poi, day, slots)}
                  />
                ) : (
                  <AssignForm
                    name={selected.result.name}
                    category={selected.result.category}
                    rating={selected.result.rating}
                    priceLevel={selected.result.priceLevel}
                    placeId={selected.result.placeId}
                    trip={trip}
                    defaultDay={selectedDay}
                    onConfirm={(day, slots) =>
                      onAddAndAssign(
                        {
                          name: selected.result.name,
                          category: selected.result.category,
                          lat: selected.result.lat,
                          lon: selected.result.lon,
                          description: selected.result.description,
                          validSlots: POI_CATEGORY_DEFAULT_SLOTS[selected.result.category],
                          rating: selected.result.rating,
                          priceLevel: selected.result.priceLevel,
                          placeId: selected.result.placeId,
                        },
                        day,
                        slots
                      ).then(() => {})
                    }
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-400 text-center">
        Marker pieni = già nel catalogo · Marker tratteggiati = trovati ora, non ancora aggiunti
      </p>
    </div>
  );
}
