import { getAppSettings } from "@/app/actions/settings-actions";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();
  return <SettingsPanel initialSettings={settings} />;
}
