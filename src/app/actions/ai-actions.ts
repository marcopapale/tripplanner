"use server";

import { nanoid } from "nanoid";
import { getTrips, getSettings, upsertTrip } from "@/lib/db";
import { geocodePlace } from "@/lib/geocode";
import { findPlaceByText } from "@/lib/googlePlacesPOI";
import { haversineDistanceMeters } from "@/lib/mapMath";
import { tripDayCount, formatDayLabel } from "@/lib/dates";
import {
  POICategory,
  OSM_SEARCH_CATEGORIES,
  AIPOIProposalItem,
  Slot,
  SLOTS,
  SLOT_LABELS,
  TRANSPORT_MODE_LABELS,
  DEFAULT_AI_POI_PROMPT_TEMPLATE,
  Trip,
  AppSettings,
} from "@/lib/types";

// Oltre questa distanza dal punto geocodificato della destinazione, un
// risultato è quasi certamente un match sbagliato del geocoder/Places (nome
// omonimo altrove) piuttosto che un vero POI del viaggio — va scartato.
const MAX_POI_DISTANCE_METERS = 150_000;

interface ResolvedPlace {
  lat: number;
  lon: number;
  placeId?: string;
  rating?: number;
  priceLevel?: number;
}

async function resolvePlace(
  name: string,
  trip: Trip,
  settings: AppSettings
): Promise<ResolvedPlace | null> {
  let place: ResolvedPlace | null = null;
  if (settings.poiProvider === "google" && settings.googleApiKey) {
    const found = await findPlaceByText(`${name}, ${trip.destination}`, settings.googleApiKey);
    if (found) place = found;
  }
  if (!place) {
    const geocoded = await geocodePlace(`${name}, ${trip.destination}`);
    if (geocoded) place = geocoded;
  }
  if (!place) {
    console.log(`[AI proposal] "${name}": nessun risultato dal geocoder/Places, scartato`);
    return null;
  }

  const distance = haversineDistanceMeters(trip.lat, trip.lon, place.lat, place.lon);
  if (distance > MAX_POI_DISTANCE_METERS) {
    console.log(
      `[AI proposal] "${name}": trovato a ${Math.round(distance / 1000)}km dalla destinazione, oltre il limite di ${MAX_POI_DISTANCE_METERS / 1000}km, scartato`
    );
    return null;
  }

  return place;
}

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

async function callClaudeTool<T>(
  apiKey: string,
  userPrompt: string,
  toolName: string,
  toolDescription: string,
  inputSchema: Record<string, unknown>
): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: userPrompt }],
      tools: [{ name: toolName, description: toolDescription, input_schema: inputSchema }],
      tool_choice: { type: "tool", name: toolName },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find((b: { type: string }) => b.type === "tool_use") as
    | { input?: T }
    | undefined;
  if (!toolUse?.input) throw new Error("Risposta AI non valida.");
  return toolUse.input;
}

function buildPrompt(template: string, destination: string, dayCount: number, transportMode: string) {
  return template
    .replaceAll("{{destinazione}}", destination)
    .replaceAll("{{giorni}}", String(dayCount))
    .replaceAll("{{mezzo}}", transportMode);
}

/**
 * Generates a curated basket of AI POI suggestions for a trip, grouped by
 * day/slot, and stores them as a pending proposal on the trip for the admin
 * to review and approve/discard — nothing is added to the catalog or
 * itinerary here.
 */
export async function generateAIPOIProposal(
  tripId: string,
  extraNotes?: string
): Promise<AIPOIProposalItem[]> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Viaggio non trovato");

  const settings = await getSettings();
  if (!settings.anthropicApiKey) {
    throw new Error("Configura la chiave Anthropic in Impostazioni per generare la proposta AI.");
  }

  const dayCount = tripDayCount(trip.startDate, trip.endDate);
  const targetCount = Math.min(Math.max(dayCount * 3, 6), 18);
  const template = settings.aiPoiPromptTemplate || DEFAULT_AI_POI_PROMPT_TEMPLATE;
  const transportLabel = TRANSPORT_MODE_LABELS[trip.transportMode] ?? "non specificato";
  let prompt = buildPrompt(template, trip.destination, dayCount, transportLabel);
  prompt += ` Proponi un piccolo paniere mirato di circa ${targetCount} tappe in totale, senza esagerare — devono poter essere valutate una per una.`;
  if (extraNotes?.trim()) {
    prompt += `\n\nSpecifiche aggiuntive di cui tenere conto: ${extraNotes.trim()}`;
  }

  const { items: raw } = await callClaudeTool<{
    items: { name: string; category: string; description: string; dayIndex: number; slot: string }[];
  }>(
    settings.anthropicApiKey,
    prompt,
    "propose_itinerary",
    "Restituisce l'elenco di tappe proposte per il viaggio, raggruppate per giorno e slot.",
    {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome proprio reale del luogo, cercabile su Google Maps" },
              category: { type: "string", enum: OSM_SEARCH_CATEGORIES },
              description: { type: "string", description: "Massimo una frase, perché è consigliato" },
              dayIndex: { type: "integer", description: `Giorno del viaggio, da 1 a ${dayCount}` },
              slot: { type: "string", enum: SLOTS },
            },
            required: ["name", "category", "description", "dayIndex", "slot"],
          },
        },
      },
      required: ["items"],
    }
  );

  const resolved = await Promise.all(
    (raw ?? []).map(async (item) => {
      const category = OSM_SEARCH_CATEGORIES.includes(item.category as POICategory)
        ? (item.category as POICategory)
        : "altro";
      const slot = SLOTS.includes(item.slot as Slot) ? (item.slot as Slot) : "pomeriggio";
      const dayIndex = Math.min(Math.max(Math.round(item.dayIndex) - 1, 0), trip.itinerary.length - 1);

      const place = await resolvePlace(item.name, trip, settings);
      if (!place) return null;

      const proposal: AIPOIProposalItem = {
        id: nanoid(10),
        name: item.name,
        category,
        description: item.description,
        dayIndex,
        slot,
        lat: place.lat,
        lon: place.lon,
        placeId: place.placeId,
        rating: place.rating,
        priceLevel: place.priceLevel,
      };
      return proposal;
    })
  );

  const proposal = resolved.filter((p): p is AIPOIProposalItem => p !== null);
  console.log(
    `[AI proposal] Claude ha proposto ${raw?.length ?? 0} tappe, risolte con successo: ${proposal.length}`
  );
  trip.aiPoiProposal = proposal;
  await upsertTrip(trip);
  return proposal;
}

/**
 * Generates one alternative suggestion for each given (day, slot) gap — used
 * when the admin approves a proposal but leaves some slots without an
 * approved suggestion and asks for more ideas just for those. Appends to any
 * existing pending proposal rather than replacing it.
 */
export async function generateAIPOIProposalForSlots(
  tripId: string,
  gaps: { dayIndex: number; slot: Slot }[],
  extraNotes?: string
): Promise<AIPOIProposalItem[]> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Viaggio non trovato");
  if (gaps.length === 0) return trip.aiPoiProposal ?? [];

  const settings = await getSettings();
  if (!settings.anthropicApiKey) {
    throw new Error("Configura la chiave Anthropic in Impostazioni per generare la proposta AI.");
  }

  const transportLabel = TRANSPORT_MODE_LABELS[trip.transportMode] ?? "non specificato";
  const dayCount = tripDayCount(trip.startDate, trip.endDate);
  const gapsDescription = gaps
    .map(
      (g) => `Giorno ${g.dayIndex + 1} (${formatDayLabel(trip.startDate, g.dayIndex)}) — ${SLOT_LABELS[g.slot]}`
    )
    .join("; ");

  let prompt = `Sei un travel agent esperto, conosci ${trip.destination} in ogni minimo particolare. Il viaggio dura ${dayCount} giorni, ci si sposta con: ${transportLabel}. L'admin non ha approvato le proposte precedenti per questi momenti dell'itinerario: ${gapsDescription}. Suggerisci esattamente un'alternativa valida per ciascuno di questi momenti, nello stesso ordine in cui sono elencati, cercabile su Google Maps.`;
  if (extraNotes?.trim()) {
    prompt += `\n\nSpecifiche aggiuntive di cui tenere conto: ${extraNotes.trim()}`;
  }

  interface RawAltItem {
    name: string;
    category: string;
    description: string;
  }

  const { items: raw } = await callClaudeTool<{ items: RawAltItem[] }>(
    settings.anthropicApiKey,
    prompt,
    "propose_alternatives",
    "Restituisce un'alternativa per ciascuno dei momenti richiesti, nello stesso ordine.",
    {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome proprio reale del luogo, cercabile su Google Maps" },
              category: { type: "string", enum: OSM_SEARCH_CATEGORIES },
              description: { type: "string", description: "Massimo una frase, perché è consigliato" },
            },
            required: ["name", "category", "description"],
          },
        },
      },
      required: ["items"],
    }
  );

  const pairs = gaps
    .map((gap, i) => ({ gap, item: (raw ?? [])[i] }))
    .filter((p): p is { gap: { dayIndex: number; slot: Slot }; item: RawAltItem } => Boolean(p.item));

  const resolved = await Promise.all(
    pairs.map(async ({ gap, item }) => {
      const category = OSM_SEARCH_CATEGORIES.includes(item.category as POICategory)
        ? (item.category as POICategory)
        : "altro";
      const place = await resolvePlace(item.name, trip, settings);
      if (!place) return null;

      const proposal: AIPOIProposalItem = {
        id: nanoid(10),
        name: item.name,
        category,
        description: item.description,
        dayIndex: gap.dayIndex,
        slot: gap.slot,
        lat: place.lat,
        lon: place.lon,
        placeId: place.placeId,
        rating: place.rating,
        priceLevel: place.priceLevel,
      };
      return proposal;
    })
  );

  const newItems = resolved.filter((p): p is AIPOIProposalItem => p !== null);
  trip.aiPoiProposal = [...(trip.aiPoiProposal ?? []), ...newItems];
  await upsertTrip(trip);
  return trip.aiPoiProposal;
}

/**
 * Returns the AI-curated category shortlist for a trip's destination,
 * computing and caching it on the trip the first time it's requested so
 * repeat visits to the admin panel don't re-call the AI.
 */
export async function getTripCategories(tripId: string): Promise<POICategory[]> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Viaggio non trovato");

  if (trip.aiCategories && trip.aiCategories.length > 0) {
    return trip.aiCategories;
  }

  const settings = await getSettings();
  if (!settings.anthropicApiKey) {
    // No AI configured: fall back to a sensible generic default, don't cache it.
    return ["ristorante", "monumento"];
  }

  try {
    const { categories } = await callClaudeTool<{ categories: string[] }>(
      settings.anthropicApiKey,
      `La destinazione del viaggio è "${trip.destination}". Tra queste categorie di punti di interesse — ${OSM_SEARCH_CATEGORIES.join(", ")} — scegli quelle più rilevanti per questo luogo specifico (es. una meta balneare/isola privilegia spiaggia, natura, ristorante; una città d'arte privilegia monumento, chiesa, museo, ristorante; adatta in autonomia). Restituisci solo le categorie scelte, in ordine di rilevanza, minimo 2 massimo 5.`,
      "select_categories",
      "Restituisce le categorie di POI più rilevanti per la destinazione.",
      {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: { type: "string", enum: OSM_SEARCH_CATEGORIES },
          },
        },
        required: ["categories"],
      }
    );
    const valid = (categories ?? []).filter((c): c is POICategory =>
      OSM_SEARCH_CATEGORIES.includes(c as POICategory)
    );
    if (valid.length === 0) return ["ristorante", "monumento"];

    trip.aiCategories = valid;
    await upsertTrip(trip);
    return valid;
  } catch {
    return ["ristorante", "monumento"];
  }
}
