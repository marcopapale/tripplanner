import { TripForm } from "@/components/TripForm";

export default function Home() {
  return (
    <main className="flex-1 bg-gradient-to-b from-sky to-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <span className="inline-block rounded-full bg-sand text-sunset-dark text-xs font-semibold px-3 py-1 mb-4">
            Trip Planner
          </span>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Organizza il prossimo viaggio di gruppo
          </h1>
          <p className="text-gray-500">
            Destinazione, date e partecipanti: crea il viaggio e ottieni subito i link di accesso.
          </p>
        </div>
        <TripForm />
      </div>
    </main>
  );
}
