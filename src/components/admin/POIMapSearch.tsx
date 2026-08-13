"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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
import { formatDayLabel } from "@/lib/dates";
import { poiIcon, poiIconUnsaved, CATEGORY_COLOR } from "@/lib/mapIcons";

interface SearchResult {
  tempId: string;
  name: string;
  category: POICategory;
  lat: number;
  lon: number;
  description?: string;
  rating?: number;
  priceLevel?: number;
}

function RatingBadge({ rating, priceLevel }: { rating?: number; priceLevel?: number }) {
  if (!rating && !priceLevel) return null;
  return (
    <p className="text-xs text-gray-500 flex items-center gap-1.5">
      {rating && <span>⭐ {rating.toFixed(1)}</span>}
      {priceLevel && <span>{"$".repeat(priceLevel)}</span>}
    </p>
  );
}

function BoundsWatcher({ onChange }: { onChange: (b: MapBounds) => void }) {
  const map = useMap();
  useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    },
  });
  useEffect(() => {
    const b = map.getBounds();
    onChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

function AssignForm({
  name,
  category,
  rating,
  priceLevel,
  trip,
  defaultDay,
  onConfirm,
}: {
  name: string;
  category: POICategory;
  rating?: number;
  priceLevel?: number;
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

  if (done) {
    return <p className="text-sm font-medium text-lagoon-dark">Aggiunto ✓</p>;
  }

  return (
    <div className="space-y-2 min-w-[180px]">
      <p className="text-sm font-semibold">{name}</p>
      <RatingBadge rating={rating} priceLevel={priceLevel} />
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
    </div>
  );
}

export function POIMapSearch({
  trip,
  catalogPOIs,
  selectedDay,
  poiProvider,
  onAssignExisting,
  onAddAndAssign,
}: {
  trip: Trip;
  catalogPOIs: POI[];
  selectedDay: number;
  poiProvider: POIProvider;
  onAssignExisting: (poi: POI, dayIndex: number, slots: Slot[]) => Promise<void>;
  onAddAndAssign: (
    result: Omit<POI, "id" | "tripId">,
    dayIndex: number,
    slots: Slot[]
  ) => Promise<POI>;
}) {
  // Start with a light default selection so the first search is fast; admin
  // can toggle on more categories (each one adds Overpass query clauses).
  const [selectedCategories, setSelectedCategories] = useState<Set<POICategory>>(
    new Set<POICategory>(["ristorante", "monumento", "spiaggia"])
  );
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  const catalogKeys = useMemo(
    () => new Set(catalogPOIs.map((p) => `${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lon.toFixed(4)}`)),
    [catalogPOIs]
  );

  function toggleCategory(c: POICategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  // Above this span (~roughly a metro area), Overpass queries get slow/heavy
  // and prone to timeout — ask the admin to zoom in instead of firing them.
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
    setResults(
      found.map((f, i) => ({ ...f, tempId: `${Date.now()}-${i}` }))
    );
    setSearchMsg(found.length === 0 ? "Nessun POI trovato in quest'area" : null);
    setSearching(false);
  }, [bounds, selectedCategories]);

  const visibleResults = results.filter(
    (r) => !catalogKeys.has(`${r.name.toLowerCase()}|${r.lat.toFixed(4)}|${r.lon.toFixed(4)}`)
  );

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

      <div className="flex flex-wrap gap-1.5">
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

      <div className="rounded-3xl overflow-hidden border border-gray-100 h-[420px]">
        <MapContainer
          center={[trip.lat, trip.lon]}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <BoundsWatcher onChange={setBounds} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {catalogPOIs.map((poi) => (
            <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={poiIcon(poi.category)}>
              <Popup>
                <AssignForm
                  name={`${poi.name} (nel catalogo)`}
                  category={poi.category}
                  rating={poi.rating}
                  priceLevel={poi.priceLevel}
                  trip={trip}
                  defaultDay={selectedDay}
                  onConfirm={(day, slots) => onAssignExisting(poi, day, slots)}
                />
              </Popup>
            </Marker>
          ))}

          {visibleResults.map((r) => (
            <Marker key={r.tempId} position={[r.lat, r.lon]} icon={poiIconUnsaved(r.category)}>
              <Popup>
                <AssignForm
                  name={r.name}
                  category={r.category}
                  rating={r.rating}
                  priceLevel={r.priceLevel}
                  trip={trip}
                  defaultDay={selectedDay}
                  onConfirm={(day, slots) =>
                    onAddAndAssign(
                      {
                        name: r.name,
                        category: r.category,
                        lat: r.lat,
                        lon: r.lon,
                        description: r.description,
                        validSlots: POI_CATEGORY_DEFAULT_SLOTS[r.category],
                        rating: r.rating,
                        priceLevel: r.priceLevel,
                      },
                      day,
                      slots
                    ).then(() => {})
                  }
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <p className="text-[11px] text-gray-400 text-center">
        Marker pieni = già nel catalogo · Marker tratteggiati = trovati su OpenStreetMap, non ancora aggiunti
      </p>
    </div>
  );
}
