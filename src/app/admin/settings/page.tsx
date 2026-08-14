import { getAppSettings } from "@/app/actions/settings-actions";
import { USE_BLOB } from "@/lib/db";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();
  return <SettingsPanel initialSettings={settings} useBlobUpload={USE_BLOB} />;
}
