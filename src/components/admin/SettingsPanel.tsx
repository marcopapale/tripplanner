"use client";

import { useState } from "react";
import Link from "next/link";
import { AppSettings, POIProvider, POI_PROVIDER_LABELS } from "@/lib/types";
import { updateAppSettings, testFoursquareKey } from "@/app/actions/settings-actions";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const PROVIDERS: POIProvider[] = ["osm", "foursquare"];

export function SettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [poiProvider, setPoiProvider] = useState<POIProvider>(initialSettings.poiProvider);
  const [foursquareApiKey, setFoursquareApiKey] = useState(initialSettings.foursquareApiKey ?? "");
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: number;
    places: { name: string; rating?: number; price?: number }[];
    errorMessage?: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    await updateAppSettings({ poiProvider, foursquareApiKey, anthropicApiKey });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await testFoursquareKey(foursquareApiKey);
    const sample = res.sample as {
      results?: { name: string; rating?: number; price?: number }[];
      message?: string;
      raw?: string;
    };
    setTestResult({
      ok: res.ok,
      status: res.status,
      places: sample.results ?? [],
      errorMessage: sample.message ?? sample.raw,
    });
    setTesting(false);
  }

  return (
    <main className="flex-1 bg-gradient-to-b from-sky to-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold">Impostazioni</h1>
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600">
            ← Torna al Gestionale
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">Provider ricerca POI</h2>
            <p className="text-xs text-gray-500 mb-3">
              Determina da dove vengono cercati i punti di interesse nella mappa del Gestionale.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPoiProvider(p)}
                  className={`text-left rounded-2xl border p-3 transition-colors ${
                    poiProvider === p
                      ? "border-sunset bg-sand/60"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-semibold">{POI_PROVIDER_LABELS[p]}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p === "osm"
                      ? "Gratuito, nessuna chiave richiesta. Nessun rating o fascia di prezzo."
                      : "Include rating e fascia di prezzo per i ristoranti. Richiede una API key gratuita."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {poiProvider === "foursquare" && (
            <div>
              <Label>Foursquare API Key</Label>
              <Input
                type="password"
                placeholder="Incolla qui la tua API key"
                value={foursquareApiKey}
                onChange={(e) => setFoursquareApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                La trovi nel tuo account Foursquare Developer, sezione "API Keys" del progetto.
              </p>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !foursquareApiKey}
                className="mt-2 text-xs font-semibold text-lagoon-dark bg-lagoon/10 hover:bg-lagoon/20 rounded-full px-3 py-1.5 disabled:opacity-50"
              >
                {testing ? "Test in corso…" : "🔍 Testa connessione (ristoranti a Roma)"}
              </button>

              {testResult && (
                <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs space-y-1">
                  <p className="font-semibold">
                    {testResult.ok ? `HTTP ${testResult.status} ✓` : `Errore HTTP ${testResult.status}`}
                  </p>
                  {!testResult.ok && testResult.errorMessage && (
                    <p className="text-red-500">{testResult.errorMessage}</p>
                  )}
                  {testResult.places.length === 0 ? (
                    testResult.ok && <p className="text-gray-500">Nessun risultato restituito.</p>
                  ) : (
                    <>
                      <ul className="space-y-0.5">
                        {testResult.places.map((p, i) => (
                          <li key={i} className="text-gray-600">
                            {p.name} — rating: {p.rating ?? "assente"} · price:{" "}
                            {p.price ?? "assente"}
                          </li>
                        ))}
                      </ul>
                      {testResult.places.every((p) => p.rating == null && p.price == null) && (
                        <p className="text-gray-400 mt-1">
                          Rating e prezzo non sono presenti nella risposta: probabilmente il tuo
                          piano Foursquare non include questi campi (sono dati "Premium").
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">AI — Suggerimenti attività</h2>
            <p className="text-xs text-gray-500 mb-3">
              Usa Claude per suggerire le attività principali da fare nella destinazione, in base
              alla durata del viaggio. Opzionale.
            </p>
            <Label>Anthropic API Key</Label>
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
            />
          </div>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="py-2.5">
          {saving ? "Salvataggio…" : saved ? "Salvato ✓" : "Salva impostazioni"}
        </Button>
      </div>
    </main>
  );
}
