"use server";

import { nanoid } from "nanoid";
import { getPOIs, savePOIs, getTrips, upsertTrip, getSettings } from "@/lib/db";
import { POI, POICategory, POI_CATEGORY_DEFAULT_SLOTS, Slot } from "@/lib/types";
import { searchPOIsInBounds, MapBounds } from "@/lib/poiDiscovery";
import { searchFoursquarePOIsInBounds } from "@/lib/foursquarePOI";
import { searchGooglePOIsInBounds } from "@/lib/googlePlacesPOI";

export interface NewPOIInput {
  tripId: string;
  name: string;
  category: POICategory;
  lat: number;
  lon: number;
  description?: string;
  validSlots: Slot[];
  rating?: number;
  priceLevel?: number;
}

export async function addPOI(input: NewPOIInput): Promise<POI> {
  const pois = await getPOIs();
  const poi: POI = {
    id: nanoid(10),
    tripId: input.tripId,
    name: input.name,
    category: input.category,
    lat: input.lat,
    lon: input.lon,
    description: input.description,
    validSlots: input.validSlots.length ? input.validSlots : POI_CATEGORY_DEFAULT_SLOTS[input.category],
    rating: input.rating,
    priceLevel: input.priceLevel,
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

/** All POIs across every trip (admin use only — always filter by tripId before showing to a trip's page). */
export async function listAllPOIs(): Promise<POI[]> {
  return getPOIs();
}

export async function listPOIsForTrip(tripId: string): Promise<POI[]> {
  const pois = await getPOIs();
  return pois.filter((p) => p.tripId === tripId);
}

export async function searchAreaPOIs(
  bounds: MapBounds,
  categories: POICategory[]
): Promise<Omit<POI, "id" | "tripId">[]> {
  const settings = await getSettings();
  if (settings.poiProvider === "foursquare" && settings.foursquareApiKey) {
    return searchFoursquarePOIsInBounds(bounds, categories, settings.foursquareApiKey);
  }
  if (settings.poiProvider === "google" && settings.googleApiKey) {
    return searchGooglePOIsInBounds(bounds, categories, settings.googleApiKey);
  }
  return searchPOIsInBounds(bounds, categories);
}

function isSamePlace(a: { name: string; lat: number; lon: number }, b: POI): boolean {
  const sameName = a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  const closeBy = Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lon - b.lon) < 0.0005;
  return sameName && closeBy;
}

/** Adds a POI found via map search, reusing an existing catalog entry for the same trip if it already matches. */
export async function findOrCreatePOI(input: NewPOIInput): Promise<POI> {
  const pois = await getPOIs();
  const existing = pois.find((p) => p.tripId === input.tripId && isSamePlace(input, p));
  if (existing) return existing;
  return addPOI(input);
}
