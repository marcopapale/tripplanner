import { promises as fs } from "fs";
import path from "path";
import { Trip, POI } from "./types";

/**
 * Storage layer isolated behind this module: today it reads/writes local
 * JSON files. On Vercel the filesystem is read-only in production, so this
 * is the only file to swap for Vercel Blob (or similar) before going live.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const TRIPS_FILE = path.join(DATA_DIR, "trips.json");
const POIS_FILE = path.join(DATA_DIR, "pois.json");

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON<T>(file: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function getTrips(): Promise<Trip[]> {
  return readJSON<Trip[]>(TRIPS_FILE, []);
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await writeJSON(TRIPS_FILE, trips);
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
  return readJSON<POI[]>(POIS_FILE, []);
}

export async function savePOIs(pois: POI[]): Promise<void> {
  await writeJSON(POIS_FILE, pois);
}
