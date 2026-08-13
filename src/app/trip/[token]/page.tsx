import { notFound } from "next/navigation";
import { getTripByToken } from "@/app/actions/trip-actions";
import { listPOIsForTrip } from "@/app/actions/poi-actions";
import { getSettings } from "@/lib/db";
import { TripView } from "@/components/TripView";

export default async function TripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getTripByToken(token);
  if (!trip) notFound();

  const [pois, settings] = await Promise.all([listPOIsForTrip(trip.id), getSettings()]);

  return <TripView trip={trip} pois={pois} googleMapsBrowserKey={settings.googleMapsBrowserKey} />;
}
