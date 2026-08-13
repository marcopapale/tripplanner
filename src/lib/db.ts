import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import { Trip, POI, AppSettings, DEFAULT_SETTINGS } from "./types";

/**
 * Storage layer isolated behind this module: still just JSON, no database.
 * Locally (no BLOB_READ_WRITE_TOKEN) it reads/writes files under /data.
 * On Vercel, production's filesystem is read-only, so once a Blob store is
 * connected (which injects BLOB_READ_WRITE_TOKEN) it transparently switches
 * to Vercel Blob, storing the same JSON under the same relative paths.
 */

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

if (!USE_BLOB && process.env.VERCEL) {
  console.warn(
    "[db] BLOB_READ_WRITE_TOKEN non impostato: sto usando il filesystem locale, che su Vercel in produzione è read-only. Collega uno Storage Blob al progetto e fai un redeploy."
  );
}

const DATA_DIR = path.join(process.cwd(), "data");
const TRIPS_FILE = path.join(DATA_DIR, "trips.json");
const POIS_FILE = path.join(DATA_DIR, "pois.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const TRIPS_BLOB_PATH = "data/trips.json";
const POIS_BLOB_PATH = "data/pois.json";
const SETTINGS_BLOB_PATH = "data/settings.json";

async function readLocalJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeLocalJSON<T>(file: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

async function readBlobJSON<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result?.stream) return fallback;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeBlobJSON<T>(pathname: string, data: T): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function readJSON<T>(localFile: string, blobPath: string, fallback: T): Promise<T> {
  return USE_BLOB ? readBlobJSON(blobPath, fallback) : readLocalJSON(localFile, fallback);
}

async function writeJSON<T>(localFile: string, blobPath: string, data: T): Promise<void> {
  return USE_BLOB ? writeBlobJSON(blobPath, data) : writeLocalJSON(localFile, data);
}

export async function getTrips(): Promise<Trip[]> {
  return readJSON<Trip[]>(TRIPS_FILE, TRIPS_BLOB_PATH, []);
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await writeJSON(TRIPS_FILE, TRIPS_BLOB_PATH, trips);
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const trips = await getTrips();
  return trips.find((t) => t.id === id);
}

export async function getTripByParticipantToken(
  token: string
): Promise<Trip | undefined> {
  const trips = await getTrips();
  return trips.find((t) => t.participants.some((p) => p.token === token));
}

export async function upsertTrip(trip: Trip): Promise<void> {
  const trips = await getTrips();
  const idx = trips.findIndex((t) => t.id === trip.id);
  if (idx >= 0) trips[idx] = trip;
  else trips.push(trip);
  await saveTrips(trips);
}

export async function getPOIs(): Promise<POI[]> {
  return readJSON<POI[]>(POIS_FILE, POIS_BLOB_PATH, []);
}

export async function savePOIs(pois: POI[]): Promise<void> {
  await writeJSON(POIS_FILE, POIS_BLOB_PATH, pois);
}

export async function getSettings(): Promise<AppSettings> {
  return readJSON<AppSettings>(SETTINGS_FILE, SETTINGS_BLOB_PATH, DEFAULT_SETTINGS);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJSON(SETTINGS_FILE, SETTINGS_BLOB_PATH, settings);
}
