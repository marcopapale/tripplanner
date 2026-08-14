import { getSettings } from "@/lib/db";
import { LandingHero } from "@/components/LandingHero";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  return (
    <LandingHero
      heroImageUrl={settings.landingHeroImageUrl}
      heroImageMobileUrl={settings.landingHeroImageMobileUrl}
      logoUrl={settings.landingLogoUrl}
      payoffText={settings.landingPayoffText}
    />
  );
}
