"use server";

import { getSettings, saveSettings } from "@/lib/db";
import { AppSettings } from "@/lib/types";
import { testFoursquareConnection } from "@/lib/foursquarePOI";

export async function getAppSettings(): Promise<AppSettings> {
  return getSettings();
}

export async function updateAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...input };
  await saveSettings(next);
  return next;
}

export async function testFoursquareKey(apiKey: string) {
  return testFoursquareConnection(apiKey);
}
