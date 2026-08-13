"use server";

import { nanoid } from "nanoid";
import { getTrips, getSettings, upsertTrip } from "@/lib/db";
import { geocodePlace } from "@/lib/geocode";
import { findPlaceByText } from "@/lib/googlePlacesPOI";
import { tripDayCount } from "@/lib/dates";
import {
  POICategory,
  OSM_SEARCH_CATEGORIES,
  AIPOIProposalItem,
  Slot,
  SLOTS,
  TRANSPORT_MODE_LABELS,
  DEFAULT_AI_POI_PROMPT_TEMPLATE,
} from "@/lib/types";

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

      let place: { lat: number; lon: number; placeId?: string; rating?: number; priceLevel?: number } | null =
        null;
      if (settings.poiProvider === "google" && settings.googleApiKey) {
        const found = await findPlaceByText(`${item.name}, ${trip.destination}`, settings.googleApiKey);
        if (found) place = found;
      }
      if (!place) {
        const geocoded = await geocodePlace(`${item.name}, ${trip.destination}`);
        if (geocoded) place = geocoded;
      }
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
  trip.aiPoiProposal = proposal;
  await upsertTrip(trip);
  return proposal;
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
