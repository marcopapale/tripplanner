"use server";

import { nanoid } from "nanoid";
import {
  getTrips,
  saveTrips,
  upsertTrip,
  getTripByParticipantToken,
  getPOIs,
  savePOIs,
} from "@/lib/db";
import { generateToken } from "@/lib/token";
import { geocodeDestination } from "@/lib/geocode";
import { discoverPOIs, toPOIs } from "@/lib/poiDiscovery";
import { tripDayCount } from "@/lib/dates";
import { Trip, ItineraryDay, Slot, Participant, DEFAULT_ACCENT_COLOR } from "@/lib/types";

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
    accentColor: DEFAULT_ACCENT_COLOR,
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

  // Auto-discover POI suggestions for this trip's destination, scoped to
  // this trip only (fire-and-forget-ish, but awaited so the admin panel is
  // populated as soon as the trip exists).
  try {
    const allPOIs = await getPOIs();
    const discovered = await discoverPOIs(lat, lon);
    const fresh = dedupeAgainstTrip(discovered, allPOIs, trip.id);
    if (fresh.length > 0) {
      await savePOIs([...allPOIs, ...toPOIs(fresh, trip.id)]);
    }
  } catch {
    // POI discovery is best-effort; trip creation must not fail because of it.
  }

  return { tripId: trip.id };
}

function dedupeAgainstTrip(
  discovered: Awaited<ReturnType<typeof discoverPOIs>>,
  allPOIs: Awaited<ReturnType<typeof getPOIs>>,
  tripId: string
) {
  const existingNames = new Set(
    allPOIs.filter((p) => p.tripId === tripId).map((p) => p.name.toLowerCase())
  );
  return discovered.filter((p) => !existingNames.has(p.name.toLowerCase()));
}

export async function refreshPOIDiscovery(tripId: string): Promise<number> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");

  const allPOIs = await getPOIs();
  const discovered = await discoverPOIs(trip.lat, trip.lon);
  const fresh = dedupeAgainstTrip(discovered, allPOIs, tripId);
  if (fresh.length > 0) {
    await savePOIs([...allPOIs, ...toPOIs(fresh, tripId)]);
  }
  return fresh.length;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const trips = await getTrips();
  await saveTrips(trips.filter((t) => t.id !== tripId));

  // POIs are scoped to a trip; drop the ones that belonged only to it.
  const pois = await getPOIs();
  const remaining = pois.filter((p) => p.tripId !== tripId);
  if (remaining.length !== pois.length) await savePOIs(remaining);
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

export interface TripDetailsInput {
  title?: string;
  subtitle?: string;
  accentColor?: string;
}

export async function updateTripDetails(
  tripId: string,
  details: TripDetailsInput
): Promise<void> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  trip.title = details.title || undefined;
  trip.subtitle = details.subtitle || undefined;
  trip.accentColor = details.accentColor || DEFAULT_ACCENT_COLOR;
  await upsertTrip(trip);
}

export async function addParticipant(
  tripId: string,
  participant: { firstName: string; lastName: string; email: string }
): Promise<Participant> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  const newParticipant: Participant = {
    id: nanoid(8),
    firstName: participant.firstName,
    lastName: participant.lastName,
    email: participant.email,
    token: generateToken(),
  };
  trip.participants.push(newParticipant);
  await upsertTrip(trip);
  return newParticipant;
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
