"use client";

import { useState } from "react";
import Link from "next/link";
import { AppSettings, POIProvider, POI_PROVIDER_LABELS, DEFAULT_AI_POI_PROMPT_TEMPLATE } from "@/lib/types";
import { updateAppSettings, testGoogleKey } from "@/app/actions/settings-actions";
import { uploadBrandingImage } from "@/app/actions/branding-actions";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const PROVIDERS: POIProvider[] = ["osm", "google"];

const PROVIDER_DESCRIPTIONS: Record<POIProvider, string> = {
  osm: "Gratuito, nessuna chiave richiesta. Nessun rating o fascia di prezzo.",
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

function ImageUploadField({
  label,
  value,
  onChange,
  field,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  field: "hero" | "heroMobile" | "logo";
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `upload-${field}`;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = await uploadBrandingImage(formData, field);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={label}
            className="h-16 w-16 rounded-xl object-cover border border-gray-200"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-[10px] text-center px-1">
            Nessuna immagine
          </div>
        )}
        <div>
          <label
            htmlFor={inputId}
            className="cursor-pointer text-xs font-semibold text-lagoon-dark bg-lagoon/10 hover:bg-lagoon/20 rounded-full px-3 py-1.5 inline-block"
          >
            {uploading ? "Caricamento…" : value ? "Cambia immagine" : "Carica immagine"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="ml-2 text-xs text-gray-400 hover:text-red-500"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function SettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [poiProvider, setPoiProvider] = useState<POIProvider>(initialSettings.poiProvider);
  const [googleApiKey, setGoogleApiKey] = useState(initialSettings.googleApiKey ?? "");
  const [googleMapsBrowserKey, setGoogleMapsBrowserKey] = useState(
    initialSettings.googleMapsBrowserKey ?? ""
  );
  const [customMapId, setCustomMapId] = useState(initialSettings.customMapId ?? "");
  const [landingHeroImageUrl, setLandingHeroImageUrl] = useState(
    initialSettings.landingHeroImageUrl ?? ""
  );
  const [landingHeroImageMobileUrl, setLandingHeroImageMobileUrl] = useState(
    initialSettings.landingHeroImageMobileUrl ?? ""
  );
  const [landingLogoUrl, setLandingLogoUrl] = useState(initialSettings.landingLogoUrl ?? "");
  const [landingPayoffText, setLandingPayoffText] = useState(
    initialSettings.landingPayoffText ?? ""
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialSettings.anthropicApiKey ?? "");
  const [aiPoiPromptTemplate, setAiPoiPromptTemplate] = useState(
    initialSettings.aiPoiPromptTemplate || DEFAULT_AI_POI_PROMPT_TEMPLATE
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function handleSave() {
    setSaving(true);
    await updateAppSettings({
      poiProvider,
      googleApiKey,
      googleMapsBrowserKey,
      customMapId,
      landingHeroImageUrl,
      landingHeroImageMobileUrl,
      landingLogoUrl,
      landingPayoffText,
      anthropicApiKey,
      aiPoiPromptTemplate,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await testGoogleKey(googleApiKey);
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
                  <p className="text-xs text-gray-500 mt-0.5">{PROVIDER_DESCRIPTIONS[p]}</p>
                </button>
              ))}
            </div>
          </div>

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
                onClick={handleTest}
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
            <h2 className="text-sm font-bold text-gray-700 mb-1">Landing page</h2>
            <p className="text-xs text-gray-500 mb-3">
              Immagine di sfondo, logo e payoff mostrati nella home pubblica del servizio, da cui
              chi non ha il link diretto può inserire il proprio codice viaggio.
            </p>
          </div>

          <ImageUploadField
            label="Immagine di sfondo (desktop)"
            value={landingHeroImageUrl}
            onChange={setLandingHeroImageUrl}
            field="hero"
            hint="Mostrata a schermo intero con un leggero effetto Ken Burns. Se vuota, viene usato un gradiente del brand."
          />

          <ImageUploadField
            label="Immagine di sfondo (mobile)"
            value={landingHeroImageMobileUrl}
            onChange={setLandingHeroImageMobileUrl}
            field="heroMobile"
            hint="Usata sotto ai 768px di larghezza, idealmente in verticale. Se vuota, viene usata l'immagine desktop."
          />

          <ImageUploadField
            label="Logo"
            value={landingLogoUrl}
            onChange={setLandingLogoUrl}
            field="logo"
            hint="Mostrato al centro della landing, sopra il payoff. Se vuoto, viene usato il nome testuale."
          />

          <div>
            <Label>Payoff</Label>
            <Input
              placeholder="Organizza il prossimo viaggio di gruppo"
              value={landingPayoffText}
              onChange={(e) => setLandingPayoffText(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">Mappe</h2>
            <p className="text-xs text-gray-500 mb-3">
              Impostazioni relative alle mappe Google Maps usate nel Gestionale e nelle pagine
              viaggio condivise.
            </p>
          </div>

          <div>
            <Label>Google Maps JavaScript API Key</Label>
            <Input
              type="password"
              placeholder="Incolla qui la tua API key"
              value={googleMapsBrowserKey}
              onChange={(e) => setGoogleMapsBrowserKey(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Chiave usata per mostrare la mappa nel browser (visibile nel codice della pagina).
              Diversa da quella usata per la ricerca POI qui sopra: questa deve essere ristretta
              per "Siti web" al tuo dominio (es. <code>*.vercel.app</code>) nella Google Cloud
              Console — l'altra invece non va ristretta per dominio, viene chiamata dal server.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <Label>Map ID personalizzato (stile mappa)</Label>
            <Input
              placeholder="Es. 8f2a1b3c4d5e6f70"
              value={customMapId}
              onChange={(e) => setCustomMapId(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Opzionale. Permette di usare uno stile mappa personalizzato — ad esempio per
              nascondere le icone e le etichette dei punti di interesse nativi di Google, che
              altrimenti si sovrappongono ai nostri pin colorati. Lasciando vuoto questo campo la
              mappa usa lo stile demo di Google (icone POI native visibili).
            </p>
            <details className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              <summary className="cursor-pointer font-semibold text-gray-600">
                Come creare e configurare un Map ID
              </summary>
              <ol className="list-decimal list-inside space-y-1.5 mt-2">
                <li>
                  Vai su{" "}
                  <a
                    href="https://console.cloud.google.com/google/maps-apis/studio/maps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lagoon-dark underline"
                  >
                    Google Cloud Console → Maps Management → Map IDs
                  </a>{" "}
                  del progetto collegato alla tua API key.
                </li>
                <li>
                  Crea un nuovo Map ID: piattaforma <strong>JavaScript</strong>, rendering{" "}
                  <strong>Vector</strong> (obbligatorio — i nostri pin colorati richiedono la
                  mappa vettoriale).
                </li>
                <li>Copia l'ID generato e incollalo qui sopra, poi salva le impostazioni.</li>
                <li>
                  Nella stessa pagina, apri o crea uno <strong>Stile mappa</strong> e associalo a
                  questo Map ID.
                </li>
                <li>
                  Nell'editor dello stile, disattiva il layer{" "}
                  <strong>"Points of interest"</strong> (icone ed etichette) per nascondere i POI
                  nativi di Google. Da qui potrai in futuro personalizzare anche colori e tema
                  della mappa.
                </li>
              </ol>
            </details>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-1">AI — Proposta itinerario POI</h2>
            <p className="text-xs text-gray-500 mb-3">
              Usa Claude per proporre, alla creazione di ogni viaggio, un piccolo paniere di POI
              raggruppati per giorno e fascia oraria, in base a destinazione, durata e mezzo di
              trasporto. L'admin rivede sempre la proposta prima che qualcosa venga aggiunto.
            </p>
            <Label>Anthropic API Key</Label>
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label>Prompt utilizzato per generare la proposta</Label>
            <textarea
              value={aiPoiPromptTemplate}
              onChange={(e) => setAiPoiPromptTemplate(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 transition bg-white font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Placeholder disponibili: <code>{"{{destinazione}}"}</code>,{" "}
              <code>{"{{giorni}}"}</code>, <code>{"{{mezzo}}"}</code> (mezzo di trasporto scelto in
              fase di creazione del viaggio). Quando si rigenera una proposta dal Gestionale
              aggiungendo note libere, queste vengono accodate automaticamente al prompt.
            </p>
          </div>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="py-2.5">
          {saving ? "Salvataggio…" : saved ? "Salvato ✓" : "Salva impostazioni"}
        </Button>
      </div>
    </main>
  );
}
