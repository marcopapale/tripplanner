import { notFound } from "next/navigation";
import { getTripByToken } from "@/app/actions/trip-actions";
import { listPOIsForTrip } from "@/app/actions/poi-actions";
import { TripView } from "@/components/TripView";

export default async function TripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getTripByToken(token);
  if (!trip) notFound();

  const pois = await listPOIsForTrip(trip.id);

  return <TripView trip={trip} pois={pois} />;
}
