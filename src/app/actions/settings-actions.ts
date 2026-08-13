"use server";

import { getSettings, saveSettings } from "@/lib/db";
import { AppSettings } from "@/lib/types";
import { testGoogleConnection } from "@/lib/googlePlacesPOI";

export async function getAppSettings(): Promise<AppSettings> {
  return getSettings();
}

export async function updateAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...input };
  await saveSettings(next);
  return next;
}

export async function testGoogleKey(apiKey: string) {
  return testGoogleConnection(apiKey);
}
