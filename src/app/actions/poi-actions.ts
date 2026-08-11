"use server";

import { nanoid } from "nanoid";
import { getPOIs, savePOIs, getTrips, upsertTrip } from "@/lib/db";
import { POI, POICategory, POI_CATEGORY_DEFAULT_SLOTS, Slot } from "@/lib/types";

export interface NewPOIInput {
  name: string;
  category: POICategory;
  lat: number;
  lon: number;
  description?: string;
  validSlots: Slot[];
}

export async function addPOI(input: NewPOIInput): Promise<POI> {
  const pois = await getPOIs();
  const poi: POI = {
    id: nanoid(10),
    name: input.name,
    category: input.category,
    lat: input.lat,
    lon: input.lon,
    description: input.description,
    validSlots: input.validSlots.length ? input.validSlots : POI_CATEGORY_DEFAULT_SLOTS[input.category],
  };
  await savePOIs([...pois, poi]);
  return poi;
}

export async function deletePOI(poiId: string): Promise<void> {
  const pois = await getPOIs();
  await savePOIs(pois.filter((p) => p.id !== poiId));

  // Also remove it from any trip itineraries it was assigned to.
  const trips = await getTrips();
  for (const trip of trips) {
    let changed = false;
    for (const day of trip.itinerary) {
      for (const slot of Object.keys(day) as Slot[]) {
        if (day[slot].includes(poiId)) {
          day[slot] = day[slot].filter((id) => id !== poiId);
          changed = true;
        }
      }
    }
    if (changed) await upsertTrip(trip);
  }
}

export async function listPOIs(): Promise<POI[]> {
  return getPOIs();
}
