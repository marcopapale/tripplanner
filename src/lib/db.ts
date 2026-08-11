import { promises as fs } from "fs";
import path from "path";
import { list, put } from "@vercel/blob";
import { Trip, POI } from "./types";

/**
 * Storage layer isolated behind this module: still just JSON, no database.
 * Locally (no BLOB_READ_WRITE_TOKEN) it reads/writes files under /data.
 * On Vercel, production's filesystem is read-only, so once a Blob store is
 * connected (which injects BLOB_READ_WRITE_TOKEN) it transparently switches
 * to Vercel Blob, storing the same JSON under the same relative paths.
 */

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const DATA_DIR = path.join(process.cwd(), "data");
const TRIPS_FILE = path.join(DATA_DIR, "trips.json");
const POIS_FILE = path.join(DATA_DIR, "pois.json");
const TRIPS_BLOB_PATH = "data/trips.json";
const POIS_BLOB_PATH = "data/pois.json";

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
    const { blobs } = await list({ prefix: pathname, limit: 1 });
    const blob = blobs.find((b) => b.pathname === pathname);
    if (!blob) return fallback;
    const res = await fetch(blob.url, { cache: "no-store" });
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function writeBlobJSON<T>(pathname: string, data: T): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: "public",
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
