import { getTrips } from "@/lib/db";
import { listPOIs } from "@/app/actions/poi-actions";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const [trips, pois] = await Promise.all([getTrips(), listPOIs()]);
  return <AdminDashboard initialTrips={trips} initialPOIs={pois} />;
}
