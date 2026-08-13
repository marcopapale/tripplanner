"use client";

import { useEffect, useState } from "react";
import { Trip, AIPOIProposalItem, Slot, SLOTS, SLOT_LABELS } from "@/lib/types";
import {
  resolveAIPOIProposalItems,
  regenerateAIPOIProposal,
  requestAIAlternativesForGaps,
} from "@/app/actions/trip-actions";
import { formatDayLabel } from "@/lib/dates";
import { CATEGORY_EMOJI } from "@/lib/mapIcons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreatingTripOverlay } from "@/components/CreatingTripOverlay";

interface Gap {
  dayIndex: number;
  slot: Slot;
}

interface GapPrompt {
  approveIds: string[];
  dismissIds: string[];
  gaps: Gap[];
}

export function AIPOIProposalReview({
  trip,
  onTripUpdated,
  showRegenerate = true,
}: {
  trip: Trip;
  onTripUpdated: (trip: Trip) => void;
  /** Nel Gestionale la rigenerazione è disabilitata: è uno step riservato a "Personalizza il tuo viaggio". */
  showRegenerate?: boolean;
}) {
  const items = trip.aiPoiProposal ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [resolving, setResolving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [gapPrompt, setGapPrompt] = useState<GapPrompt | null>(null);
  const [gapNotes, setGapNotes] = useState("");
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

  async function doResolve(approveIds: string[], dismissIds: string[]) {
    setResolving(true);
    const updated = await resolveAIPOIProposalItems(trip.id, approveIds, dismissIds);
    onTripUpdated(updated);
    setResolving(false);
  }

  async function handleDiscardOne(id: string) {
    await doResolve([], [id]);
  }

  function computeGaps(approveItems: AIPOIProposalItem[], dismissItems: AIPOIProposalItem[]): Gap[] {
    const filledKeys = new Set(approveItems.map((i) => `${i.dayIndex}|${i.slot}`));
    const gapsMap = new Map<string, Gap>();
    for (const item of dismissItems) {
      const key = `${item.dayIndex}|${item.slot}`;
      if (!filledKeys.has(key)) gapsMap.set(key, { dayIndex: item.dayIndex, slot: item.slot });
    }
    return [...gapsMap.values()];
  }

  async function handleApproveSelected() {
    const approveItems = items.filter((i) => selected.has(i.id));
    const dismissItems = items.filter((i) => !selected.has(i.id));
    const gaps = showRegenerate ? computeGaps(approveItems, dismissItems) : [];
    if (gaps.length === 0) {
      await doResolve(
        approveItems.map((i) => i.id),
        dismissItems.map((i) => i.id)
      );
      return;
    }
    setGapPrompt({
      approveIds: approveItems.map((i) => i.id),
      dismissIds: dismissItems.map((i) => i.id),
      gaps,
    });
  }

  async function handleGapPromptSkip() {
    if (!gapPrompt) return;
    await doResolve(gapPrompt.approveIds, gapPrompt.dismissIds);
    setGapPrompt(null);
    setGapNotes("");
  }

  async function handleGapPromptRequest() {
    if (!gapPrompt) return;
    setGenerating(true);
    setError(null);
    try {
      await resolveAIPOIProposalItems(trip.id, gapPrompt.approveIds, gapPrompt.dismissIds);
      const updated = await requestAIAlternativesForGaps(trip.id, gapPrompt.gaps, gapNotes || undefined);
      onTripUpdated(updated);
      setGapPrompt(null);
      setGapNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualcosa è andato storto.");
    }
    setGenerating(false);
  }

  async function handleRegenerate() {
    setGenerating(true);
    setError(null);
    try {
      const updated = await regenerateAIPOIProposal(trip.id, notes || undefined);
      onTripUpdated(updated);
      setNotes("");
      setShowNotes(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualcosa è andato storto.");
    }
    setGenerating(false);
  }

  const byDay = new Map<number, AIPOIProposalItem[]>();
  for (const item of items) {
    if (!byDay.has(item.dayIndex)) byDay.set(item.dayIndex, []);
    byDay.get(item.dayIndex)!.push(item);
  }
  const dayIndexes = [...byDay.keys()].sort((a, b) => a - b);

  if (gapPrompt) {
    return (
      <div className="space-y-3">
        {generating && <CreatingTripOverlay />}
        <Card className="p-4 space-y-3 border-sunset/30 bg-sand/30">
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {gapPrompt.gaps.length === 1
                ? "Un momento dell'itinerario resterà senza proposta approvata"
                : `${gapPrompt.gaps.length} momenti dell'itinerario resteranno senza proposta approvata`}
            </p>
            <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
              {gapPrompt.gaps.map((g) => (
                <li key={`${g.dayIndex}-${g.slot}`}>
                  Giorno {g.dayIndex + 1} · {formatDayLabel(trip.startDate, g.dayIndex)} —{" "}
                  {SLOT_LABELS[g.slot]}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-500">
            Vuoi che l&apos;AI proponga delle alternative per questi momenti?
          </p>
          <textarea
            value={gapNotes}
            onChange={(e) => setGapNotes(e.target.value)}
            placeholder="Note per l'AI su cosa vorresti in questi momenti (opzionale)…"
            rows={2}
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 transition bg-white"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={handleGapPromptRequest}
              disabled={generating || resolving}
              className="flex-1 py-2"
            >
              Sì, chiedi alternative
            </Button>
            <Button
              variant="ghost"
              onClick={handleGapPromptSkip}
              disabled={generating || resolving}
              className="py-2"
            >
              No, procedi senza
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {generating && <CreatingTripOverlay />}
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">
          {showRegenerate
            ? "Nessuna proposta AI disponibile al momento. Puoi generarne una nuova qui sotto."
            : "Nessuna proposta AI in sospeso."}
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

      {showRegenerate && (
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
                disabled={generating}
                className="flex-1 py-2"
              >
                🔁 Rigenera proposta
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
      )}
    </div>
  );
}
