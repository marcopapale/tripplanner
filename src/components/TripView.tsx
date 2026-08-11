"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Trip, POI, SLOTS, SLOT_LABELS, Slot } from "@/lib/types";
import {
  daysUntilStart,
  tripStatus,
  currentDayIndex,
  formatDateRange,
  formatDayLabel,
} from "@/lib/dates";
import { Card } from "@/components/ui/Card";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
      Caricamento mappa…
    </div>
  ),
});

export function TripView({ trip, pois }: { trip: Trip; pois: POI[] }) {
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

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{trip.destination}</h1>
            <p className="text-xs text-gray-500">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {status === "upcoming" && (
              <div className="rounded-full bg-sand px-4 py-1.5 text-xs font-semibold text-sunset-dark">
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

            <div className="flex -space-x-2">
              {trip.participants.map((p) => (
                <div
                  key={p.id}
                  title={`${p.firstName} ${p.lastName}`}
                  className="h-8 w-8 rounded-full bg-lagoon text-white text-xs font-semibold flex items-center justify-center border-2 border-white"
                >
                  {p.firstName[0]}
                  {p.lastName[0]}
                </div>
              ))}
            </div>
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
                selectedDay === i
                  ? "bg-sunset text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              Giorno {i + 1}
              <span className="ml-1.5 opacity-70 text-xs">
                {formatDayLabel(trip.startDate, i)}
              </span>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-4 flex-1 min-h-[420px]">
          <Card className="md:col-span-3 overflow-hidden p-0 min-h-[320px]">
            <MapView
              centerLat={trip.lat}
              centerLon={trip.lon}
              destinationName={trip.destination}
              markers={markers}
            />
          </Card>

          <div className="md:col-span-2 space-y-3 overflow-y-auto max-h-[600px] pr-1">
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
                    <ul className="space-y-2">
                      {poiIds.map((id) => {
                        const poi = poiById.get(id);
                        if (!poi) return null;
                        return (
                          <li key={id} className="text-sm font-medium flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-lagoon" />
                            {poi.name}
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
