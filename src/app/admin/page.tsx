import { getTrips, getSettings } from "@/lib/db";
import { listAllPOIs } from "@/app/actions/poi-actions";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// Trips/POIs change via server actions (create, delete, assign…), so this
// page must render fresh on every request instead of being prerendered once
// at build time — otherwise deletions/edits wouldn't show up in production.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [trips, pois, settings] = await Promise.all([getTrips(), listAllPOIs(), getSettings()]);
  return (
    <AdminDashboard
      initialTrips={trips}
      initialPOIs={pois}
      poiProvider={settings.poiProvider}
      googleMapsBrowserKey={settings.googleMapsBrowserKey}
    />
  );
}
