"use client";

import { useEffect, useState } from "react";
import { Trip, AIPOIProposalItem, SLOTS, SLOT_LABELS } from "@/lib/types";
import { resolveAIPOIProposalItems, regenerateAIPOIProposal } from "@/app/actions/trip-actions";
import { formatDayLabel } from "@/lib/dates";
import { CATEGORY_EMOJI } from "@/lib/mapIcons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function AIPOIProposalReview({
  trip,
  onTripUpdated,
}: {
  trip: Trip;
  onTripUpdated: (trip: Trip) => void;
}) {
  const items = trip.aiPoiProposal ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [resolving, setResolving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(items.map((i) => i.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.aiPoiProposal]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDiscardOne(id: string) {
    setResolving(true);
    const updated = await resolveAIPOIProposalItems(trip.id, [], [id]);
    onTripUpdated(updated);
    setResolving(false);
  }

  async function handleApproveSelected() {
    setResolving(true);
    const approveIds = items.filter((i) => selected.has(i.id)).map((i) => i.id);
    const dismissIds = items.filter((i) => !selected.has(i.id)).map((i) => i.id);
    const updated = await resolveAIPOIProposalItems(trip.id, approveIds, dismissIds);
    onTripUpdated(updated);
    setResolving(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const updated = await regenerateAIPOIProposal(trip.id, notes || undefined);
      onTripUpdated(updated);
      setNotes("");
      setShowNotes(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualcosa è andato storto.");
    }
    setRegenerating(false);
  }

  const byDay = new Map<number, AIPOIProposalItem[]>();
  for (const item of items) {
    if (!byDay.has(item.dayIndex)) byDay.set(item.dayIndex, []);
    byDay.get(item.dayIndex)!.push(item);
  }
  const dayIndexes = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nessuna proposta AI disponibile al momento. Puoi generarne una nuova qui sotto.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {dayIndexes.map((dayIndex) => {
              const dayItems = byDay.get(dayIndex)!;
              return (
                <div key={dayIndex}>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                    Giorno {dayIndex + 1} · {formatDayLabel(trip.startDate, dayIndex)}
                  </h3>
                  <div className="space-y-2">
                    {SLOTS.filter((slot) => dayItems.some((i) => i.slot === slot)).map((slot) => (
                      <div key={slot}>
                        <p className="text-[11px] font-semibold text-gray-400 mb-1">
                          {SLOT_LABELS[slot]}
                        </p>
                        <div className="space-y-1.5">
                          {dayItems
                            .filter((i) => i.slot === slot)
                            .map((item) => (
                              <Card key={item.id} className="p-3 flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={selected.has(item.id)}
                                  onChange={() => toggle(item.id)}
                                  className="mt-1 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">
                                    {CATEGORY_EMOJI[item.category]} {item.name}
                                    {item.rating && (
                                      <span className="text-xs text-gray-400 font-normal">
                                        {" "}
                                        · ⭐ {item.rating.toFixed(1)}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                </div>
                                <button
                                  onClick={() => handleDiscardOne(item.id)}
                                  disabled={resolving}
                                  className="text-gray-300 hover:text-red-500 shrink-0 text-sm"
                                  title="Scarta"
                                >
                                  ✕
                                </button>
                              </Card>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={handleApproveSelected}
            disabled={resolving || selected.size === 0}
            className="w-full py-2.5"
          >
            {resolving ? "Aggiungo…" : `Aggiungi le ${selected.size} selezionate`}
          </Button>
        </>
      )}

      <div className="pt-1">
        {showNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specifiche aggiuntive di cui tenere conto (opzionale)…"
              rows={3}
              className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 transition bg-white"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 py-2"
              >
                {regenerating ? "Rigenero…" : "🔁 Rigenera proposta"}
              </Button>
              <Button variant="ghost" onClick={() => setShowNotes(false)} className="py-2">
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-xs font-semibold text-lagoon-dark hover:underline"
          >
            Non convince? Rigenera la proposta AI →
          </button>
        )}
      </div>
    </div>
  );
}
