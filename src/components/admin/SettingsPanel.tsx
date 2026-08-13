"use client";

import { useState } from "react";
import Link from "next/link";
import { AppSettings, POIProvider, POI_PROVIDER_LABELS } from "@/lib/types";
import {
  updateAppSettings,
  testFoursquareKey,
  testGoogleKey,
} from "@/app/actions/settings-actions";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const PROVIDERS: POIProvider[] = ["osm", "foursquare", "google"];

const PROVIDER_DESCRIPTIONS: Record<POIProvider, string> = {
  osm: "Gratuito, nessuna chiave richiesta. Nessun rating o fascia di prezzo.",
  foursquare:
    "Ricerca base gratuita, ma rating e prezzo sono un dato \"Premium\" a pagamento (senza credito gratuito).",
  google:
    "Rating e prezzo inclusi in un piano con 1.000 chiamate gratuite/mese + credito di prova. Richiede account Google Cloud con fatturazione.",
};

interface TestResult {
  ok: boolean;
  status: number;
  places: { name: string; rating?: number; price?: number }[];
  errorMessage?: string;
}

function parseTestResult(res: { ok: boolean; status: number; sample: unknown }): TestResult {
  const sample = res.sample as {
    results?: { name: string; rating?: number; price?: number }[];
    places?: { displayName?: { text?: string }; rating?: number; priceLevel?: string }[];
    message?: string;
    error?: { message?: string };
    raw?: string;
  };
  const places =
    sample.results ??
    sample.places?.map((p) => ({
      name: p.displayName?.text ?? "?",
      rating: p.rating,
      price: p.priceLevel ? p.priceLevel.replace("PRICE_LEVEL_", "") : undefined,
    })) ??
    [];
  return {
    ok: res.ok,
    status: res.status,
    places: places as { name: string; rating?: number; price?: number }[],
    errorMessage: sample.message ?? sample.error?.message ?? sample.raw,
  };
}

function TestResultCard({ result, provider }: { result: TestResult; provider: POIProvider }) {
  return (
    <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs space-y-1">
      <p className="font-semibold">
        {result.ok ? `HTTP ${result.status} ✓` : `Errore HTTP ${result.status}`}
      </p>
      {!result.ok && result.errorMessage && <p className="text-red-500">{result.errorMessage}</p>}
      {result.places.length === 0 ? (
        result.ok && <p className="text-gray-500">Nessun risultato restituito.</p>
      ) : (
        <>
          <ul className="space-y-0.5">
            {result.places.map((p, i) => (
              <li key={i} className="text-gray-600">
                {p.name} — rating: {p.rating ?? "assente"} · price: {p.price ?? "assente"}
              </li>
            ))}
          </ul>
          {result.places.every((p) => p.rating == null && p.price == null) && (
            <p className="text-gray-400 mt-1">
              Rating e prezzo non sono presenti nella risposta: probabilmente il piano di{" "}
              {POI_PROVIDER_LABELS[provider]} associato a questa chiave non include questi campi.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function SettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [poiProvider, setPoiProvider] = useState<POIProvider>(initialSettings.poiProvider);
  const [foursquareApiKey, setFoursquareApiKey] = useState(initialSettings.foursquareApiKey ?? "");
  const [googleApiKey, setGoogleApiKey] = useState(initialSettings.googleApiKey ?? "");
  const [googleMapsBrowserKey, setGoogleMapsBrowserKey] = useState(
    initialSettings.googleMapsBrowserKey ?? ""
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function handleSave() {
    setSaving(true);
    await updateAppSettings({
      poiProvider,
      foursquareApiKey,
      googleApiKey,
      googleMapsBrowserKey,
      anthropicApiKey,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function handleTest(provider: "foursquare" | "google") {
    setTesting(true);
    setTestResult(null);
    const res =
      provider === "foursquare"
        ? await testFoursquareKey(foursquareApiKey)
        : await testGoogleKey(googleApiKey);
    setTestResult(parseTestResult(res));
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
            <div className="grid sm:grid-cols-3 gap-3">
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
                  <p className="text-xs text-gray-500 mt-0.5">{PROVIDER_DESCRIPTIONS[p]}</p>
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
                onClick={() => handleTest("foursquare")}
                disabled={testing || !foursquareApiKey}
                className="mt-2 text-xs font-semibold text-lagoon-dark bg-lagoon/10 hover:bg-lagoon/20 rounded-full px-3 py-1.5 disabled:opacity-50"
              >
                {testing ? "Test in corso…" : "🔍 Testa connessione (ristoranti a Roma)"}
              </button>
              {testResult && <TestResultCard result={testResult} provider="foursquare" />}
            </div>
          )}

          {poiProvider === "google" && (
            <div>
              <Label>Google Places API Key</Label>
              <Input
                type="password"
                placeholder="Incolla qui la tua API key"
                value={googleApiKey}
                onChange={(e) => setGoogleApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Dal tuo progetto Google Cloud, con "Places API (New)" abilitata.
              </p>
              <button
                type="button"
                onClick={() => handleTest("google")}
                disabled={testing || !googleApiKey}
                className="mt-2 text-xs font-semibold text-lagoon-dark bg-lagoon/10 hover:bg-lagoon/20 rounded-full px-3 py-1.5 disabled:opacity-50"
              >
                {testing ? "Test in corso…" : "🔍 Testa connessione (ristoranti a Roma)"}
              </button>
              {testResult && <TestResultCard result={testResult} provider="google" />}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">Mappa (Google Maps)</h2>
            <p className="text-xs text-gray-500 mb-3">
              Chiave usata per mostrare la mappa nel browser (visibile nel codice della pagina).
              Diversa da quella usata per la ricerca POI qui sopra: questa deve essere ristretta
              per "Siti web" al tuo dominio (es. <code>*.vercel.app</code>) nella Google Cloud
              Console — l'altra invece non va ristretta per dominio, viene chiamata dal server.
            </p>
            <Label>Google Maps JavaScript API Key</Label>
            <Input
              type="password"
              placeholder="Incolla qui la tua API key"
              value={googleMapsBrowserKey}
              onChange={(e) => setGoogleMapsBrowserKey(e.target.value)}
            />
          </div>
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
