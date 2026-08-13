"use server";

import { getTrips, getSettings } from "@/lib/db";
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Suggerisci circa ${targetCount} tra le migliori attività/luoghi da visitare a "${trip.destination}" per un viaggio di ${dayCount} giorni. Dai priorità in base al tipo di destinazione: se è una meta balneare/isola privilegia spiagge, punti panoramici e ristoranti; se è una città d'arte privilegia monumenti, musei, chiese e ristoranti; adatta il mix in autonomia in base al luogo reale. Usa nomi propri reali e riconoscibili (non generici), adatti a essere cercati su una mappa.`,
        },
      ],
      tools: [
        {
          name: "propose_activities",
          description: "Restituisce l'elenco di attività/luoghi suggeriti per il viaggio.",
          input_schema: {
            type: "object",
            properties: {
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Nome proprio reale del luogo, cercabile su una mappa",
                    },
                    category: {
                      type: "string",
                      enum: OSM_SEARCH_CATEGORIES,
                    },
                    description: {
                      type: "string",
                      description: "Massimo una frase, perché è consigliato",
                    },
                  },
                  required: ["name", "category", "description"],
                },
              },
            },
            required: ["activities"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "propose_activities" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find((b: { type: string }) => b.type === "tool_use") as
    | { input?: { activities?: { name: string; category: string; description: string }[] } }
    | undefined;
  const raw = toolUse?.input?.activities ?? [];

  const geocoded = await Promise.all(
    raw.map(async (a) => {
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
