"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Trip,
  POI,
  POICategory,
  POIProvider,
  POI_CATEGORY_LABELS,
  POI_CATEGORY_DEFAULT_SLOTS,
  SLOTS,
  SLOT_LABELS,
  Slot,
} from "@/lib/types";
import { assignPOI, unassignPOI } from "@/app/actions/trip-actions";
import { addPOI, deletePOI, listAllPOIs, findOrCreatePOI } from "@/app/actions/poi-actions";
import { adminLogout } from "@/app/actions/admin-actions";
import { formatDateRange, formatDayLabel } from "@/lib/dates";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TripDetailsPanel } from "@/components/admin/TripDetailsPanel";
import { AIPOIProposalReview } from "@/components/admin/AIPOIProposalReview";

const POIMapSearch = dynamic(
  () => import("@/components/admin/POIMapSearch").then((m) => m.POIMapSearch),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] rounded-3xl border border-gray-100 flex items-center justify-center text-sm text-gray-400">
        Caricamento mappa…
      </div>
    ),
  }
);

export function AdminDashboard({
  initialTrips,
  initialPOIs,
  poiProvider,
  googleMapsBrowserKey,
}: {
  initialTrips: Trip[];
  initialPOIs: POI[];
  poiProvider: POIProvider;
  googleMapsBrowserKey?: string;
}) {
  const [trips, setTrips] = useState(initialTrips);
  const [pois, setPois] = useState(initialPOIs);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    initialTrips[0]?.id ?? null
  );
  const [selectedDay, setSelectedDay] = useState(0);
  const [showAddPOI, setShowAddPOI] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;
  const day = selectedTrip?.itinerary[selectedDay];

  function updateTripItinerary(
    tripId: string,
    dayIndex: number,
    slot: Slot,
    updater: (ids: string[]) => string[]
  ) {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        const itinerary = t.itinerary.map((d, i) =>
          i === dayIndex ? { ...d, [slot]: updater(d[slot]) } : d
        );
        return { ...t, itinerary };
      })
    );
  }

  async function doAssign(tripId: string, dayIndex: number, slot: Slot, poiId: string) {
    updateTripItinerary(tripId, dayIndex, slot, (ids) =>
      ids.includes(poiId) ? ids : [...ids, poiId]
    );
    await assignPOI(tripId, dayIndex, slot, poiId);
  }

  async function handleAssign(slot: Slot, poiId: string) {
    if (!selectedTrip || !poiId) return;
    await doAssign(selectedTrip.id, selectedDay, slot, poiId);
  }

  async function handleUnassign(slot: Slot, poiId: string) {
    if (!selectedTrip) return;
    updateTripItinerary(selectedTrip.id, selectedDay, slot, (ids) =>
      ids.filter((id) => id !== poiId)
    );
    await unassignPOI(selectedTrip.id, selectedDay, slot, poiId);
  }

  async function handleAssignExisting(poi: POI, dayIndex: number, slots: Slot[]) {
    if (!selectedTrip) return;
    for (const slot of slots) {
      await doAssign(selectedTrip.id, dayIndex, slot, poi.id);
    }
  }

  async function handleAddAndAssign(
    input: Omit<POI, "id" | "tripId">,
    dayIndex: number,
    slots: Slot[]
  ): Promise<POI> {
    if (!selectedTrip) throw new Error("Nessun viaggio selezionato");
    const poi = await findOrCreatePOI({ ...input, tripId: selectedTrip.id });
    setPois((prev) => (prev.some((p) => p.id === poi.id) ? prev : [...prev, poi]));
    for (const slot of slots) {
      await doAssign(selectedTrip.id, dayIndex, slot, poi.id);
    }
    return poi;
  }

  function handleTripUpdated(updated: Trip) {
    setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleAIProposalUpdated(updated: Trip) {
    handleTripUpdated(updated);
    // L'approvazione può aver creato nuovi POI lato server: risincronizza il catalogo locale.
    setPois(await listAllPOIs());
  }

  function handleTripDeleted(tripId: string) {
    setTrips((prev) => {
      const next = prev.filter((t) => t.id !== tripId);
      setSelectedTripId(next[0]?.id ?? null);
      return next;
    });
    setPois((prev) => prev.filter((p) => p.tripId !== tripId));
    setSelectedDay(0);
  }

  async function handleDeletePOI(poiId: string) {
    setPois((prev) => prev.filter((p) => p.id !== poiId));
    setTrips((prev) =>
      prev.map((t) => ({
        ...t,
        itinerary: t.itinerary.map((d) => {
          const next = { ...d };
          for (const s of SLOTS) next[s] = next[s].filter((id) => id !== poiId);
          return next;
        }),
      }))
    );
    await deletePOI(poiId);
  }

  const tripPOIs = useMemo(
    () => (selectedTrip ? pois.filter((p) => p.tripId === selectedTrip.id) : []),
    [pois, selectedTrip]
  );
  const poiById = useMemo(() => new Map(tripPOIs.map((p) => [p.id, p])), [tripPOIs]);

  return (
    <main className="flex-1 bg-gradient-to-b from-sky to-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold">Gestionale Viaggi</h1>
          <div className="flex items-center gap-4">
            <Link href="/admin/settings" className="text-xs text-gray-400 hover:text-gray-600">
              ⚙️ Impostazioni
            </Link>
            <form action={adminLogout}>
              <button className="text-xs text-gray-400 hover:text-gray-600">Esci</button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {trips.length === 0 ? (
          <Card className="p-8 text-center text-sm text-gray-400">
            Nessun viaggio creato ancora.
          </Card>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trips.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTripId(t.id);
                    setSelectedDay(0);
                  }}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-left text-sm transition-colors ${
                    selectedTripId === t.id
                      ? "bg-sunset text-white"
                      : "bg-white border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold">{t.title || t.destination}</div>
                  <div className="text-xs opacity-75">
                    {formatDateRange(t.startDate, t.endDate)}
                  </div>
                </button>
              ))}
            </div>

            {selectedTrip && (
              <div className="space-y-4">
                <details className="rounded-3xl bg-white border border-gray-100 p-4">
                  <summary className="text-xs font-bold uppercase tracking-wide text-gray-400 cursor-pointer">
                    Dettagli viaggio e partecipanti
                  </summary>
                  <div className="mt-3">
                    <TripDetailsPanel
                      key={selectedTrip.id}
                      trip={selectedTrip}
                      origin={origin}
                      onTripUpdated={handleTripUpdated}
                      onTripDeleted={handleTripDeleted}
                    />
                  </div>
                </details>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedTrip.itinerary.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(i)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        selectedDay === i
                          ? "bg-lagoon text-white"
                          : "bg-white border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      Giorno {i + 1}{" "}
                      <span className="opacity-70 text-xs ml-1">
                        {formatDayLabel(selectedTrip.startDate, i)}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid md:grid-cols-5 gap-6">
                  <div className="md:col-span-3 space-y-2">
                    <h2 className="text-sm font-bold text-gray-700">
                      Cerca POI sulla mappa — assegnali a Giorno {selectedDay + 1}
                    </h2>
                    <POIMapSearch
                      key={selectedTrip.id}
                      trip={selectedTrip}
                      catalogPOIs={tripPOIs}
                      selectedDay={selectedDay}
                      poiProvider={poiProvider}
                      googleMapsBrowserKey={googleMapsBrowserKey}
                      onAssignExisting={handleAssignExisting}
                      onAddAndAssign={handleAddAndAssign}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    {SLOTS.map((slot) => {
                      const assignedIds = day?.[slot] ?? [];
                      const available = tripPOIs.filter(
                        (p) => p.validSlots.includes(slot) && !assignedIds.includes(p.id)
                      );
                      return (
                        <Card key={slot} className="p-4">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                            {SLOT_LABELS[slot]}
                          </h3>
                          <ul className="space-y-1.5 mb-2">
                            {assignedIds.map((id) => {
                              const poi = poiById.get(id);
                              if (!poi) return null;
                              return (
                                <li
                                  key={id}
                                  className="flex items-center justify-between gap-2 text-sm bg-sand/60 rounded-xl px-3 py-1.5"
                                >
                                  {poi.name}
                                  <button
                                    onClick={() => handleUnassign(slot, id)}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    ×
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          <select
                            value=""
                            onChange={(e) => handleAssign(slot, e.target.value)}
                            className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2 outline-none focus:border-lagoon"
                          >
                            <option value="">+ Aggiungi POI dal catalogo…</option>
                            {available.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </Card>
                      );
                    })}

                    <details className="rounded-3xl bg-white border border-gray-100 p-4">
                      <summary className="text-xs font-bold uppercase tracking-wide text-gray-400 cursor-pointer">
                        Catalogo di questo viaggio ({tripPOIs.length}) e strumenti avanzati
                      </summary>
                      <div className="mt-3 space-y-3">
                        <AIPOIProposalReview
                          trip={selectedTrip}
                          onTripUpdated={handleAIProposalUpdated}
                        />

                        <button
                          onClick={() => setShowAddPOI((v) => !v)}
                          className="text-xs font-semibold text-sunset-dark hover:underline"
                        >
                          {showAddPOI ? "Chiudi form manuale" : "+ Aggiungi POI manualmente"}
                        </button>

                        {showAddPOI && (
                          <AddPOIForm
                            defaultLat={selectedTrip.lat}
                            defaultLon={selectedTrip.lon}
                            onAdd={async (input) => {
                              const created = await addPOI({ ...input, tripId: selectedTrip.id });
                              setPois((prev) => [...prev, created]);
                              setShowAddPOI(false);
                            }}
                          />
                        )}

                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                          {tripPOIs.map((poi) => (
                            <Card
                              key={poi.id}
                              className="p-3 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{poi.name}</p>
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                  {POI_CATEGORY_LABELS[poi.category]}
                                  {poi.rating && <span>· ⭐ {poi.rating.toFixed(1)}</span>}
                                  {poi.priceLevel && <span>{"$".repeat(poi.priceLevel)}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeletePOI(poi.id)}
                                className="text-xs text-red-400 hover:text-red-600 shrink-0"
                              >
                                Rimuovi
                              </button>
                            </Card>
                          ))}
                          {tripPOIs.length === 0 && (
                            <p className="text-sm text-gray-300">Nessun POI per questo viaggio.</p>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function AddPOIForm({
  defaultLat,
  defaultLon,
  onAdd,
}: {
  defaultLat: number;
  defaultLon: number;
  onAdd: (input: {
    name: string;
    category: POICategory;
    lat: number;
    lon: number;
    description?: string;
    validSlots: Slot[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<POICategory>("altro");
  const [lat, setLat] = useState(defaultLat);
  const [lon, setLon] = useState(defaultLon);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Card className="p-4 space-y-3">
      <div>
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Categoria</Label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as POICategory)}
          className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-lagoon"
        >
          {Object.entries(POI_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Lat</Label>
          <Input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value))}
          />
        </div>
        <div>
          <Label>Lon</Label>
          <Input
            type="number"
            step="any"
            value={lon}
            onChange={(e) => setLon(parseFloat(e.target.value))}
          />
        </div>
      </div>
      <div>
        <Label>Descrizione (opzionale)</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button
        type="button"
        disabled={!name || saving}
        onClick={async () => {
          setSaving(true);
          await onAdd({
            name,
            category,
            lat,
            lon,
            description: description || undefined,
            validSlots: POI_CATEGORY_DEFAULT_SLOTS[category],
          });
          setSaving(false);
        }}
        className="w-full py-2"
      >
        {saving ? "Salvataggio…" : "Aggiungi al catalogo"}
      </Button>
    </Card>
  );
}
