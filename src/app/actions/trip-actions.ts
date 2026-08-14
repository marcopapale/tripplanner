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
import { generateAIPOIProposal, generateAIPOIProposalForSlots } from "@/app/actions/ai-actions";
import { findOrCreatePOI } from "@/app/actions/poi-actions";
import { tripDayCount } from "@/lib/dates";
import {
  Trip,
  ItineraryDay,
  Slot,
  Participant,
  TransportMode,
  DEFAULT_ACCENT_COLOR,
  POI_CATEGORY_DEFAULT_SLOTS,
} from "@/lib/types";

export interface CreateTripInput {
  destination: string;
  startDate: string;
  endDate: string;
  transportMode: TransportMode;
  participants: { firstName: string; lastName: string; email: string }[];
}

function emptyDay(): ItineraryDay {
  return { mattina: [], pranzo: [], pomeriggio: [], cena: [], serata: [] };
}

export async function createTrip(
  input: CreateTripInput
): Promise<{ tripId: string; hasAIProposal: boolean }> {
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
    transportMode: input.transportMode,
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

  // Genera subito una proposta AI di POI (mai automaticamente inseriti in
  // itinerario: l'admin la rivede e approva esplicitamente). Best-effort: la
  // creazione del viaggio non deve mai fallire per un problema col servizio AI.
  let hasAIProposal = false;
  try {
    const proposal = await generateAIPOIProposal(trip.id);
    hasAIProposal = proposal.length > 0;
  } catch {
    // niente proposta pronta: l'admin potrà rigenerarla dal Gestionale.
  }

  return { tripId: trip.id, hasAIProposal };
}

/** Approva (aggiunge al catalogo + assegna a giorno/slot) e/o scarta item della proposta AI pendente. */
export async function resolveAIPOIProposalItems(
  tripId: string,
  approveIds: string[],
  dismissIds: string[]
): Promise<Trip> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");

  const proposal = trip.aiPoiProposal ?? [];
  const toApprove = proposal.filter((item) => approveIds.includes(item.id));

  for (const item of toApprove) {
    const poi = await findOrCreatePOI({
      tripId,
      name: item.name,
      category: item.category,
      lat: item.lat,
      lon: item.lon,
      description: item.description,
      validSlots: POI_CATEGORY_DEFAULT_SLOTS[item.category],
      rating: item.rating,
      priceLevel: item.priceLevel,
      placeId: item.placeId,
    });
    const day = trip.itinerary[item.dayIndex];
    if (day && !day[item.slot].includes(poi.id)) day[item.slot].push(poi.id);
  }

  const resolvedIds = new Set([...approveIds, ...dismissIds]);
  trip.aiPoiProposal = proposal.filter((item) => !resolvedIds.has(item.id));
  await upsertTrip(trip);
  return trip;
}

export async function regenerateAIPOIProposal(tripId: string, notes?: string): Promise<Trip> {
  await generateAIPOIProposal(tripId, notes);
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  return trip;
}

/** Chiede all'AI un'alternativa per ciascuno dei giorno/slot indicati, in aggiunta all'eventuale proposta pendente. */
export async function requestAIAlternativesForGaps(
  tripId: string,
  gaps: { dayIndex: number; slot: Slot }[],
  notes?: string
): Promise<Trip> {
  await generateAIPOIProposalForSlots(tripId, gaps, notes);
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  return trip;
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

export async function checkTripAccessCode(code: string): Promise<boolean> {
  const trip = await getTripByParticipantToken(code.trim());
  return !!trip;
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

export async function markTripShared(tripId: string): Promise<void> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");
  trip.shared = true;
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
