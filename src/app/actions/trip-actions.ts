"use server";

import { nanoid } from "nanoid";
import {
  getTrips,
  upsertTrip,
  getTripByParticipantToken,
  getPOIs,
  savePOIs,
} from "@/lib/db";
import { generateToken } from "@/lib/token";
import { geocodeDestination } from "@/lib/geocode";
import { discoverPOIs, toPOIs } from "@/lib/poiDiscovery";
import { tripDayCount } from "@/lib/dates";
import { Trip, ItineraryDay, Slot } from "@/lib/types";

export interface CreateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  participants: { firstName: string; lastName: string; email: string }[];
}

function emptyDay(): ItineraryDay {
  return { mattina: [], pranzo: [], pomeriggio: [], cena: [], serata: [] };
}

export async function createTrip(
  input: CreateTripInput
): Promise<{ tripId: string }> {
  const { lat, lon } = await geocodeDestination(input.destination);

  const dayCount = tripDayCount(input.startDate, input.endDate);
  const itinerary: ItineraryDay[] = Array.from({ length: Math.max(dayCount, 1) }, emptyDay);

  const trip: Trip = {
    id: nanoid(10),
    destination: input.destination,
    lat,
    lon,
    startDate: input.startDate,
    endDate: input.endDate,
    participants: input.participants.map((p) => ({
      id: nanoid(8),
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      token: generateToken(),
    })),
    itinerary,
    createdAt: new Date().toISOString(),
  };

  await upsertTrip(trip);

  // Auto-discover POI suggestions for the destination (fire-and-forget-ish,
  // but awaited so the admin panel is populated as soon as the trip exists).
  try {
    const existing = await getPOIs();
    const discovered = discoverPOIs(lat, lon);
    const newOnes = await discovered;
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    const fresh = newOnes.filter((p) => !existingNames.has(p.name.toLowerCase()));
    if (fresh.length > 0) {
      await savePOIs([...existing, ...toPOIs(fresh)]);
    }
  } catch {
    // POI discovery is best-effort; trip creation must not fail because of it.
  }

  return { tripId: trip.id };
}

export async function refreshPOIDiscovery(tripId: string): Promise<number> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");

  const existing = await getPOIs();
  const discovered = await discoverPOIs(trip.lat, trip.lon);
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
  const fresh = discovered.filter((p) => !existingNames.has(p.name.toLowerCase()));
  if (fresh.length > 0) {
    await savePOIs([...existing, ...toPOIs(fresh)]);
  }
  return fresh.length;
}

export async function getTripForOrganizer(tripId: string): Promise<Trip | undefined> {
  const trips = await getTrips();
  return trips.find((t) => t.id === tripId);
}

export async function getTripByToken(token: string): Promise<Trip | undefined> {
  return getTripByParticipantToken(token);
}

export async function assignPOI(
  tripId: string,
  dayIndex: number,
  slot: Slot,
  poiId: string
): Promise<void> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  const day = trip.itinerary[dayIndex];
  if (!day) throw new Error("Invalid day");
  if (!day[slot].includes(poiId)) day[slot].push(poiId);
  await upsertTrip(trip);
}

export async function unassignPOI(
  tripId: string,
  dayIndex: number,
  slot: Slot,
  poiId: string
): Promise<void> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  const day = trip.itinerary[dayIndex];
  if (!day) throw new Error("Invalid day");
  day[slot] = day[slot].filter((id) => id !== poiId);
  await upsertTrip(trip);
}
