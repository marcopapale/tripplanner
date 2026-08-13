"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTrip } from "@/app/actions/trip-actions";
import { TransportMode, TRANSPORT_MODE_LABELS } from "@/lib/types";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CreatingTripOverlay } from "@/components/CreatingTripOverlay";

interface ParticipantRow {
  firstName: string;
  lastName: string;
  email: string;
}

function emptyParticipant(): ParticipantRow {
  return { firstName: "", lastName: "", email: "" };
}

export function TripForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [transportMode, setTransportMode] = useState<TransportMode>("auto");
  const [participants, setParticipants] = useState<ParticipantRow[]>([emptyParticipant()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCount(count: number) {
    const n = Math.max(1, Math.min(30, count));
    setParticipants((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(emptyParticipant());
      while (next.length > n) next.pop();
      return next;
    });
  }

  function updateParticipant(index: number, field: keyof ParticipantRow, value: string) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!destination || !startDate || !endDate) {
      setError("Compila destinazione e date.");
      return;
    }
    if (endDate < startDate) {
      setError("La data di fine non può precedere quella di inizio.");
      return;
    }
    if (participants.some((p) => !p.firstName || !p.lastName || !p.email)) {
      setError("Compila nome, cognome ed email per ogni partecipante.");
      return;
    }
    setLoading(true);
    try {
      const { tripId } = await createTrip({
        destination,
        startDate,
        endDate,
        transportMode,
        participants,
      });
      router.push(`/personalizza-viaggio/${tripId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Errore: ${err.message}`
          : "Qualcosa è andato storto. Riprova."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {loading && <CreatingTripOverlay />}
      <Card className="p-6 space-y-4">
        <div>
          <Label>Destinazione</Label>
          <Input
            placeholder="Es. Palermo, Sicilia"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data inizio</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Data fine</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label>Mezzo di trasporto</Label>
          <select
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportMode)}
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 transition bg-white"
          >
            {Object.entries(TRANSPORT_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Numero partecipanti</Label>
          <select
            value={participants.length}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 transition bg-white"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700">Partecipanti</h3>
        <div className="space-y-3">
          {participants.map((p, i) => (
            <div key={i} className="grid grid-cols-3 gap-3">
              <Input
                placeholder="Nome"
                value={p.firstName}
                onChange={(e) => updateParticipant(i, "firstName", e.target.value)}
                required
              />
              <Input
                placeholder="Cognome"
                value={p.lastName}
                onChange={(e) => updateParticipant(i, "lastName", e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={p.email}
                onChange={(e) => updateParticipant(i, "email", e.target.value)}
                required
              />
            </div>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 px-2">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full py-3">
        {loading ? "Creazione in corso…" : "Crea viaggio"}
      </Button>
    </form>
  );
}
