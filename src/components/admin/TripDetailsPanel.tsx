"use client";

import { useState } from "react";
import { Trip, Participant, DEFAULT_ACCENT_COLOR } from "@/lib/types";
import { updateTripDetails, addParticipant, deleteTrip, markTripShared } from "@/app/actions/trip-actions";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyLink } from "@/components/CopyLink";

export function TripDetailsPanel({
  trip,
  origin,
  onTripUpdated,
  onTripDeleted,
}: {
  trip: Trip;
  origin: string;
  onTripUpdated: (trip: Trip) => void;
  onTripDeleted: (tripId: string) => void;
}) {
  const [title, setTitle] = useState(trip.title ?? "");
  const [subtitle, setSubtitle] = useState(trip.subtitle ?? "");
  const [accentColor, setAccentColor] = useState(trip.accentColor ?? DEFAULT_ACCENT_COLOR);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [addingParticipant, setAddingParticipant] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    await markTripShared(trip.id);
    onTripUpdated({ ...trip, shared: true });
    setSharing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteTrip(trip.id);
    onTripDeleted(trip.id);
  }

  async function handleSave() {
    setSaving(true);
    await updateTripDetails(trip.id, { title, subtitle, accentColor });
    onTripUpdated({ ...trip, title: title || undefined, subtitle: subtitle || undefined, accentColor });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleAddParticipant() {
    if (!firstName || !lastName || !email) return;
    setAddingParticipant(true);
    const participant: Participant = await addParticipant(trip.id, { firstName, lastName, email });
    onTripUpdated({ ...trip, participants: [...trip.participants, participant] });
    setFirstName("");
    setLastName("");
    setEmail("");
    setAddingParticipant(false);
    setShowAddParticipant(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Titolo del viaggio</Label>
          <Input
            placeholder={trip.destination}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <Label>Colore accento</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-[38px] w-12 rounded-lg border border-gray-200 cursor-pointer"
            />
            <Input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>
      <div>
        <Label>Sottotitolo</Label>
        <Input
          placeholder="Una breve descrizione del viaggio"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />
      </div>
      <Button onClick={handleSave} disabled={saving} className="py-2">
        {saving ? "Salvataggio…" : saved ? "Salvato ✓" : "Salva dettagli"}
      </Button>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Partecipanti ({trip.participants.length})
          </h3>
          <button
            onClick={() => setShowAddParticipant((v) => !v)}
            className="text-xs font-semibold text-sunset-dark hover:underline"
          >
            {showAddParticipant ? "Chiudi" : "+ Aggiungi partecipante"}
          </button>
        </div>

        {trip.shared ? (
          <p className="text-xs text-lagoon-dark font-medium mb-2">
            ✓ Condiviso — i partecipanti hanno accesso ai loro link
          </p>
        ) : (
          <Card className="p-3 mb-3 space-y-2 bg-sand/40">
            <p className="text-xs text-gray-500">
              I link non sono ancora stati condivisi. Completa prima il programma del viaggio,
              poi condividili con i partecipanti.
            </p>
            <Button onClick={handleShare} disabled={sharing} className="w-full py-2 text-sm">
              {sharing ? "Condivisione…" : "📤 Condividi con partecipanti"}
            </Button>
          </Card>
        )}

        {showAddParticipant && (
          <Card className="p-3 mb-2 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input placeholder="Cognome" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddParticipant}
              disabled={addingParticipant || !firstName || !lastName || !email}
              className="w-full py-1.5 text-xs"
            >
              {addingParticipant ? "Aggiungo…" : "Crea link di accesso"}
            </Button>
          </Card>
        )}

        <ul className="space-y-2">
          {trip.participants.map((p) => {
            const url = `${origin}/trip/${p.token}`;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-sand/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>
                {trip.shared ? (
                  <CopyLink url={url} />
                ) : (
                  <span className="text-xs text-gray-300">🔒 in attesa</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="pt-2 border-t border-gray-100">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-semibold text-red-400 hover:text-red-600"
          >
            Elimina viaggio
          </button>
        ) : (
          <div className="rounded-2xl bg-red-50 p-3 space-y-2">
            <p className="text-xs text-red-700">
              Eliminare definitivamente <strong>{trip.title || trip.destination}</strong>? Verranno
              rimossi anche i link dei partecipanti e i POI di questo viaggio. Azione irreversibile.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs py-1.5"
              >
                {deleting ? "Eliminazione…" : "Sì, elimina"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="text-xs py-1.5"
              >
                Annulla
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
