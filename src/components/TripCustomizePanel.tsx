"use client";

import { useState } from "react";
import { Trip } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { AIPOIProposalReview } from "@/components/admin/AIPOIProposalReview";

export function TripCustomizePanel({ initialTrip }: { initialTrip: Trip }) {
  const [trip, setTrip] = useState(initialTrip);
  const pending = trip.aiPoiProposal?.length ?? 0;

  return (
    <Card className="p-6 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-1">
          {pending > 0 ? "Proposta AI pronta da rivedere" : "Nessuna proposta AI da rivedere"}
        </h2>
        <p className="text-xs text-gray-500">
          {pending > 0
            ? "Seleziona le tappe che vuoi tenere: verranno aggiunte al catalogo e messe nel giorno/fascia oraria proposti. Non convince? Puoi rigenerarla aggiungendo note."
            : "Nessuna tappa proposta al momento (o l'AI non è configurata nelle Impostazioni). Puoi generarne una qui sotto, oppure aggiungere POI a mano dal Gestionale."}
        </p>
      </div>
      <AIPOIProposalReview trip={trip} onTripUpdated={setTrip} showRegenerate />
    </Card>
  );
}
