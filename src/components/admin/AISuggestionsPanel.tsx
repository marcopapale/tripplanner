"use client";

import { useState } from "react";
import { POI, POI_CATEGORY_LABELS, POI_CATEGORY_DEFAULT_SLOTS } from "@/lib/types";
import { suggestActivities, ActivitySuggestion } from "@/app/actions/ai-actions";
import { addPOI } from "@/app/actions/poi-actions";
import { Card } from "@/components/ui/Card";

export function AISuggestionsPanel({
  tripId,
  onAdded,
}: {
  tripId: string;
  onAdded: (poi: POI) => void;
}) {
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    try {
      const results = await suggestActivities(tripId);
      setSuggestions(results);
      if (results.length === 0) {
        setError("Nessun suggerimento geolocalizzabile trovato. Riprova.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualcosa è andato storto.");
    }
    setLoading(false);
  }

  async function handleAdd(s: ActivitySuggestion) {
    const created = await addPOI({
      tripId,
      name: s.name,
      category: s.category,
      lat: s.lat,
      lon: s.lon,
      description: s.description,
      validSlots: POI_CATEGORY_DEFAULT_SLOTS[s.category],
    });
    onAdded(created);
    setAddedNames((prev) => new Set(prev).add(s.name));
  }

  return (
    <div className="space-y-2">
      <button
        disabled={loading}
        onClick={handleSuggest}
        className="w-full text-xs font-semibold text-sunset-dark bg-sand hover:bg-sand/70 rounded-full px-3 py-2 disabled:opacity-50"
      >
        {loading ? "Genero suggerimenti…" : "✨ Suggerisci attività con AI"}
      </button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {suggestions.length > 0 && (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {suggestions.map((s) => {
            const added = addedNames.has(s.name);
            return (
              <Card key={s.name} className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">{POI_CATEGORY_LABELS[s.category]}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                </div>
                <button
                  disabled={added}
                  onClick={() => handleAdd(s)}
                  className="text-xs font-semibold text-lagoon-dark hover:underline shrink-0 disabled:text-gray-300"
                >
                  {added ? "Aggiunto ✓" : "+ Aggiungi"}
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
