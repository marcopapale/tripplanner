"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { checkTripAccessCode } from "@/app/actions/trip-actions";

const DEFAULT_PAYOFF = "Organizza il prossimo viaggio di gruppo";

export function LandingHero({
  heroImageUrl,
  logoUrl,
  payoffText,
}: {
  heroImageUrl?: string;
  logoUrl?: string;
  payoffText?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setChecking(true);
    setError(null);
    const valid = await checkTripAccessCode(trimmed);
    if (valid) {
      router.push(`/trip/${trimmed}`);
      return;
    }
    setError("Codice non valido, controlla e riprova.");
    setChecking(false);
  }

  return (
    <main className="relative flex-1 min-h-screen overflow-hidden bg-gradient-to-br from-sunset to-lagoon">
      {heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover animate-ken-burns"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/70" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center text-white">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Trip Planner" className="h-16 w-auto mb-4 drop-shadow" />
        ) : (
          <h1 className="text-3xl font-bold tracking-tight mb-2 drop-shadow">Trip Planner</h1>
        )}
        <p className="text-white/90 mb-10 max-w-md drop-shadow">
          {payoffText || DEFAULT_PAYOFF}
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm flex flex-col sm:flex-row gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Inserisci il codice del tuo viaggio"
            className="flex-1 rounded-full border border-white/30 bg-white/10 backdrop-blur px-5 py-3 text-sm text-white placeholder-white/60 outline-none focus:border-white/60 focus:ring-2 focus:ring-white/20 transition"
          />
          <button
            type="submit"
            disabled={checking || !code.trim()}
            className="rounded-full bg-white text-gray-900 text-sm font-semibold px-6 py-3 hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {checking ? "Verifica…" : "Vai al tuo viaggio"}
          </button>
        </form>
        {error && <p className="text-sm text-white mt-3 bg-red-500/40 rounded-full px-4 py-1.5">{error}</p>}
      </div>

      <Link
        href="/admin"
        className="absolute bottom-5 right-6 z-10 text-xs text-white/60 hover:text-white/90 transition-colors"
      >
        Admin Access
      </Link>
    </main>
  );
}
