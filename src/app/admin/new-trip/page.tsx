import Link from "next/link";
import { getSettings } from "@/lib/db";
import { TripForm } from "@/components/TripForm";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const settings = await getSettings();
  return (
    <main className="flex-1 bg-gradient-to-b from-sky to-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold">Nuovo viaggio</h1>
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600">
            ← Torna al Gestionale
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <span className="inline-block rounded-full bg-sand text-sunset-dark text-xs font-semibold px-3 py-1 mb-4">
            Trip Planner
          </span>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            Organizza il prossimo viaggio di gruppo
          </h2>
          <p className="text-gray-500">
            Destinazione, date e partecipanti: crea il viaggio, poi completa il programma e
            condividilo quando è pronto.
          </p>
        </div>
        <TripForm googleMapsBrowserKey={settings.googleMapsBrowserKey} />
      </div>
    </main>
  );
}
