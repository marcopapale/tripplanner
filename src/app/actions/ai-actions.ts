"use server";

import { getTrips, getSettings, upsertTrip } from "@/lib/db";
import { geocodePlace } from "@/lib/geocode";
import { tripDayCount } from "@/lib/dates";
import { POICategory, OSM_SEARCH_CATEGORIES } from "@/lib/types";

export interface ActivitySuggestion {
  name: string;
  category: POICategory;
  description: string;
  lat: number;
  lon: number;
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

export async function suggestActivities(tripId: string): Promise<ActivitySuggestion[]> {
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Viaggio non trovato");

  const settings = await getSettings();
  if (!settings.anthropicApiKey) {
    throw new Error("Configura la chiave Anthropic in Impostazioni per usare i suggerimenti AI.");
  }

  const dayCount = tripDayCount(trip.startDate, trip.endDate);
  const targetCount = Math.min(Math.max(dayCount * 2, 6), 14);

  const { activities: raw } = await callClaudeTool<{
    activities: { name: string; category: string; description: string }[];
  }>(
    settings.anthropicApiKey,
    `Suggerisci circa ${targetCount} tra le migliori attività/luoghi da visitare a "${trip.destination}" per un viaggio di ${dayCount} giorni. Dai priorità in base al tipo di destinazione: se è una meta balneare/isola privilegia spiagge, punti panoramici e ristoranti; se è una città d'arte privilegia monumenti, musei, chiese e ristoranti; adatta il mix in autonomia in base al luogo reale. Usa nomi propri reali e riconoscibili (non generici), adatti a essere cercati su una mappa.`,
    "propose_activities",
    "Restituisce l'elenco di attività/luoghi suggeriti per il viaggio.",
    {
      type: "object",
      properties: {
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome proprio reale del luogo, cercabile su una mappa" },
              category: { type: "string", enum: OSM_SEARCH_CATEGORIES },
              description: { type: "string", description: "Massimo una frase, perché è consigliato" },
            },
            required: ["name", "category", "description"],
          },
        },
      },
      required: ["activities"],
    }
  );

  const geocoded = await Promise.all(
    (raw ?? []).map(async (a) => {
      const place = await geocodePlace(`${a.name}, ${trip.destination}`);
      if (!place) return null;
      const category = OSM_SEARCH_CATEGORIES.includes(a.category as POICategory)
        ? (a.category as POICategory)
        : "altro";
      const suggestion: ActivitySuggestion = {
        name: a.name,
        category,
        description: a.description,
        lat: place.lat,
        lon: place.lon,
      };
      return suggestion;
    })
  );

  return geocoded.filter((s): s is ActivitySuggestion => s !== null);
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
