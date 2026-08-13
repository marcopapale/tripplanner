import { notFound } from "next/navigation";
import Link from "next/link";
import { getTripForOrganizer } from "@/app/actions/trip-actions";
import { Card } from "@/components/ui/Card";
import { formatDateRange } from "@/lib/dates";
import { TripCustomizePanel } from "@/components/TripCustomizePanel";

export default async function PersonalizzaViaggioPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await getTripForOrganizer(tripId);
  if (!trip) notFound();

  return (
    <main className="flex-1 bg-gradient-to-b from-sky to-white">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
        <div className="text-center">
          <span className="inline-block rounded-full bg-lagoon/10 text-lagoon-dark text-xs font-semibold px-3 py-1 mb-4">
            Viaggio creato 🎉
          </span>
          <h1 className="text-2xl font-bold mb-1">Personalizza il tuo viaggio</h1>
          <p className="text-gray-500">
            {trip.title || trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
          </p>
        </div>

        <TripCustomizePanel initialTrip={trip} />

        <Card className="p-6 text-center space-y-3">
          <p className="text-sm text-gray-600">
            Quando hai finito, vai al Gestionale per completare il programma: potrai poi condividere
            i link di accesso con i {trip.participants.length}{" "}
            {trip.participants.length === 1 ? "partecipante" : "partecipanti"}.
          </p>
          <Link
            href={`/admin?trip=${trip.id}`}
            className="inline-block rounded-full bg-sunset text-white text-sm font-semibold px-6 py-2.5 hover:bg-sunset-dark transition-colors"
          >
            Vai al Gestionale Viaggi →
          </Link>
        </Card>
      </div>
    </main>
  );
}
