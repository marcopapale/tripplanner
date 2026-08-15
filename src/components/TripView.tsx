"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Trip, POI, POICategory, SLOTS, SLOT_LABELS, Slot, DEFAULT_ACCENT_COLOR, Participant } from "@/lib/types";
import { CATEGORY_COLOR, CATEGORY_EMOJI } from "@/lib/mapIcons";
import {
  daysUntilStart,
  tripStatus,
  currentDayIndex,
  formatDateRange,
  formatDayFullLabel,
} from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { backfillPoiPhoto } from "@/app/actions/poi-actions";

// Il rating ha senso solo per posti dove si mangia/beve — altrove (musei,
// monumenti...) è rumore, non un criterio con cui l'utente li sceglie.
const RATING_VISIBLE_CATEGORIES = new Set<POICategory>(["ristorante", "aperitivo", "vita_notturna"]);

function PoiThumbnail({
  poi,
  fallbackImageUrl,
}: {
  poi: POI;
  fallbackImageUrl?: string;
}) {
  const [photoUrl, setPhotoUrl] = useState(poi.photoUrl);
  const [stage, setStage] = useState<0 | 1 | 2>(poi.photoUrl ? 0 : fallbackImageUrl ? 1 : 2);

  // Backfill una tantum: POI catalogati prima che esistesse questo campo
  // hanno un placeId ma nessuna foto salvata — la recuperiamo al volo e
  // la persistiamo lato server, così le prossime visite non rifanno la chiamata.
  useEffect(() => {
    if (poi.photoUrl || !poi.placeId) return;
    let cancelled = false;
    backfillPoiPhoto(poi.id).then((url) => {
      if (cancelled || !url) return;
      setPhotoUrl(url);
      setStage(0);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poi.id, poi.placeId, poi.photoUrl]);

  const src = stage === 0 ? photoUrl : stage === 1 ? fallbackImageUrl : undefined;

  // Nessun arrotondamento/margine qui: l'immagine deve arrivare fino ai
  // bordi della card che la contiene (overflow-hidden + rounded lì).
  if (!src) {
    return (
      <div
        className="w-28 self-stretch shrink-0 flex items-center justify-center text-4xl"
        style={{ background: `${CATEGORY_COLOR[poi.category]}22` }}
      >
        {CATEGORY_EMOJI[poi.category]}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={poi.name}
      className="w-28 self-stretch shrink-0 object-cover bg-gray-100"
      onError={() => setStage((s) => (s === 0 && fallbackImageUrl ? 1 : 2))}
    />
  );
}

const GoogleMapView = dynamic(
  () => import("@/components/GoogleMapView").then((m) => m.GoogleMapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
        Caricamento mappa…
      </div>
    ),
  }
);

export function TripView({
  trip,
  pois,
  googleMapsBrowserKey,
  customMapId,
  currentToken,
  poiFallbackImageUrl,
}: {
  trip: Trip;
  pois: POI[];
  googleMapsBrowserKey?: string;
  customMapId?: string;
  currentToken?: string;
  poiFallbackImageUrl?: string;
}) {
  const status = tripStatus(trip.startDate, trip.endDate);
  const daysLeft = daysUntilStart(trip.startDate);
  const ongoingDay = currentDayIndex(trip.startDate, trip.endDate);

  const [selectedDay, setSelectedDay] = useState(ongoingDay ?? 0);

  const poiById = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);
  const day = trip.itinerary[selectedDay];

  const markers = useMemo(() => {
    if (!day) return [];
    const map = new Map<string, Slot[]>();
    for (const slot of SLOTS) {
      for (const poiId of day[slot]) {
        map.set(poiId, [...(map.get(poiId) ?? []), slot]);
      }
    }
    return Array.from(map.entries())
      .map(([poiId, slots]) => {
        const poi = poiById.get(poiId);
        return poi ? { poi, slots } : null;
      })
      .filter((m): m is { poi: POI; slots: Slot[] } => m !== null);
  }, [day, poiById]);

  const accent = trip.accentColor || DEFAULT_ACCENT_COLOR;

  return (
    <div
      className="flex-1 flex flex-col bg-white"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{trip.title || trip.destination}</h1>
            {trip.subtitle && <p className="text-sm text-gray-500">{trip.subtitle}</p>}
            <p className="text-xs text-gray-500">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {status === "upcoming" && (
              <div
                className="rounded-full px-4 py-1.5 text-xs font-semibold"
                style={{ background: `${accent}1a`, color: accent }}
              >
                {daysLeft === 0 ? "Si parte oggi! 🎉" : `Mancano ${daysLeft} giorni`}
              </div>
            )}
            {status === "ongoing" && (
              <div className="rounded-full bg-lagoon/10 px-4 py-1.5 text-xs font-semibold text-lagoon-dark">
                In viaggio · Giorno {(ongoingDay ?? 0) + 1}
              </div>
            )}
            {status === "past" && (
              <div className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-500">
                Viaggio concluso
              </div>
            )}

            <ParticipantsMenu participants={trip.participants} currentToken={currentToken} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full px-4 py-6 flex-1 flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {trip.itinerary.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedDay === i ? "text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              style={selectedDay === i ? { background: accent } : undefined}
            >
              Giorno {i + 1}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-4 flex-1 min-h-[420px]">
          <Card className="md:col-span-3 overflow-hidden p-0 min-h-[320px]">
            {googleMapsBrowserKey ? (
              <GoogleMapView
                apiKey={googleMapsBrowserKey}
                centerLat={trip.lat}
                centerLon={trip.lon}
                destinationName={trip.destination}
                markers={markers}
                mapId={customMapId}
                accommodationName={trip.accommodationName}
                accommodationLat={trip.accommodationLat}
                accommodationLon={trip.accommodationLon}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-gray-400 text-center px-4">
                Mappa non configurata: aggiungi la Google Maps API Key nelle Impostazioni.
              </div>
            )}
          </Card>

          <div className="md:col-span-2 space-y-3 overflow-y-auto max-h-[600px] pr-1">
            <p className="text-sm text-gray-500 px-1">
              Il programma per il{" "}
              <span className="font-semibold text-gray-700">
                Giorno {selectedDay + 1}, {formatDayFullLabel(trip.startDate, selectedDay)}
              </span>
            </p>
            {SLOTS.map((slot) => {
              const poiIds = day?.[slot] ?? [];
              return (
                <Card key={slot} className="p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                    {SLOT_LABELS[slot]}
                  </h3>
                  {poiIds.length === 0 ? (
                    <p className="text-sm text-gray-300">Nessuna tappa</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {poiIds.map((id) => {
                        const poi = poiById.get(id);
                        if (!poi) return null;
                        const showRating = RATING_VISIBLE_CATEGORIES.has(poi.category);
                        return (
                          <li
                            key={id}
                            className="flex items-stretch gap-0 min-h-[92px] bg-gray-50 rounded-2xl overflow-hidden"
                          >
                            <PoiThumbnail poi={poi} fallbackImageUrl={poiFallbackImageUrl} />
                            <div className="min-w-0 flex-1 py-2.5 px-3 flex flex-col justify-center">
                              <p className="text-sm font-semibold truncate">{poi.name}</p>
                              {poi.description && (
                                <p className="text-xs text-gray-400 truncate">{poi.description}</p>
                              )}
                              {showRating && (poi.rating || poi.priceLevel) && (
                                <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                                  {poi.rating && <span>⭐ {poi.rating.toFixed(1)}</span>}
                                  {poi.priceLevel && <span>{"$".repeat(poi.priceLevel)}</span>}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantsMenu({
  participants,
  currentToken,
}: {
  participants: Participant[];
  currentToken?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const me = participants.find((p) => p.token === currentToken);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => setOpen((v) => !v)} className="flex" aria-label="Mostra partecipanti">
        {/* Mobile: solo l'avatar dell'utente corrente, per non affollare l'header */}
        {me && (
          <div className="md:hidden h-8 w-8 rounded-full bg-sunset text-white text-xs font-semibold flex items-center justify-center border-2 border-white">
            {me.firstName[0]}
            {me.lastName[0]}
          </div>
        )}
        <div className={`-space-x-2 ${me ? "hidden md:flex" : "flex"}`}>
          {participants.map((p) => (
            <div
              key={p.id}
              className={`h-8 w-8 rounded-full text-white text-xs font-semibold flex items-center justify-center border-2 border-white ${
                p.token === currentToken ? "bg-sunset" : "bg-lagoon"
              }`}
            >
              {p.firstName[0]}
              {p.lastName[0]}
            </div>
          ))}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl bg-white border border-gray-100 shadow-lg p-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 px-2 py-1">
              Partecipanti ({participants.length})
            </p>
            <ul>
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-sand/60"
                >
                  <div
                    className={`h-7 w-7 shrink-0 rounded-full text-white text-[11px] font-semibold flex items-center justify-center ${
                      p.token === currentToken ? "bg-sunset" : "bg-lagoon"
                    }`}
                  >
                    {p.firstName[0]}
                    {p.lastName[0]}
                  </div>
                  <span className="text-sm font-medium truncate">
                    {p.firstName} {p.lastName}
                    {p.token === currentToken && (
                      <span className="text-sunset-dark font-semibold"> (Tu)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
        </div>
      )}
    </div>
  );
}
