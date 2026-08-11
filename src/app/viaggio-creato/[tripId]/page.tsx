import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getTripForOrganizer } from "@/app/actions/trip-actions";
import { Card } from "@/components/ui/Card";
import { CopyLink } from "@/components/CopyLink";
import { formatDateRange } from "@/lib/dates";

export default async function TripCreatedPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await getTripForOrganizer(tripId);
  if (!trip) notFound();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <main className="flex-1 bg-gradient-to-b from-sky to-white">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
        <div className="text-center">
          <span className="inline-block rounded-full bg-lagoon/10 text-lagoon-dark text-xs font-semibold px-3 py-1 mb-4">
            Viaggio creato 🎉
          </span>
          <h1 className="text-2xl font-bold mb-1">{trip.destination}</h1>
          <p className="text-gray-500">{formatDateRange(trip.startDate, trip.endDate)}</p>
        </div>

        <Card className="p-6">
          <h2 className="font-semibold text-sm text-gray-700 mb-4">
            Link di accesso per i partecipanti
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Invia a ciascuno il proprio link personale: nessuna registrazione richiesta.
          </p>
          <ul className="space-y-3">
            {trip.participants.map((p) => {
              const url = `${origin}/trip/${p.token}`;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-sand/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{url}</p>
                  </div>
                  <CopyLink url={url} />
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="text-center text-sm text-gray-500">
          <Link href="/admin" className="text-sunset-dark font-semibold hover:underline">
            Vai al gestionale POI →
          </Link>
        </div>
      </div>
    </main>
  );
}
