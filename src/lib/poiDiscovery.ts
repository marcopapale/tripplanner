import { POI, POICategory, POI_CATEGORY_DEFAULT_SLOTS } from "./types";
import { nanoid } from "nanoid";

/**
 * OpenStreetMap-backed POI discovery: queries Overpass for real places
 * (beaches, restaurants, monuments, nightlife, …) so the admin panel can
 * suggest ready-made shortlists or let the admin search a specific map area.
 */

// Public Overpass instances are shared and occasionally overloaded/timeout;
// try a couple of mirrors before giving up so requests aren't blocked.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

interface OverpassElement {
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  for (const url of OVERPASS_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000);
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "trip-planner-app (https://github.com/marcopapale/tripplanner)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) continue;
      const data = await res.json();
      if (!Array.isArray(data.elements)) continue;
      return data.elements as OverpassElement[];
    } catch {
      // try next mirror
    }
  }
  return [];
}

function categoryFromTags(tags: Record<string, string>): POICategory {
  if (tags.amenity === "place_of_worship") return "chiesa";
  if (tags.tourism === "museum" || tags.tourism === "gallery") return "museo";
  if (tags.historic || tags.tourism === "attraction") return "monumento";
  if (tags.natural === "beach" || tags.leisure === "beach_resort") return "spiaggia";
  if (tags.leisure === "park" || tags.tourism === "viewpoint" || tags.natural) return "natura";
  if (tags.amenity === "restaurant" || tags.amenity === "cafe") return "ristorante";
  if (tags.amenity === "bar" || tags.amenity === "pub") return "aperitivo";
  if (tags.amenity === "nightclub") return "vita_notturna";
  if (tags.shop) return "shopping";
  return "altro";
}

type DiscoveredPOI = Omit<POI, "id" | "tripId">;

function elementsToPOIs(elements: OverpassElement[], limit: number): DiscoveredPOI[] {
  const seen = new Set<string>();
  const results: DiscoveredPOI[] = [];
  for (const el of elements) {
    const name = el.tags?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const category = categoryFromTags(el.tags ?? {});
    results.push({
      name,
      category,
      lat: el.lat,
      lon: el.lon,
      description: el.tags?.["addr:street"] || el.tags?.cuisine || undefined,
      validSlots: POI_CATEGORY_DEFAULT_SLOTS[category],
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function discoverPOIs(lat: number, lon: number): Promise<DiscoveredPOI[]> {
  const query = `
    [out:json][timeout:20];
    (
      node["tourism"~"attraction|museum|gallery|viewpoint"](around:6000,${lat},${lon});
      node["natural"="beach"](around:8000,${lat},${lon});
      node["leisure"~"beach_resort|park"](around:8000,${lat},${lon});
      node["amenity"~"restaurant|cafe|bar|pub|nightclub|place_of_worship"](around:4000,${lat},${lon});
      node["historic"](around:6000,${lat},${lon});
    );
    out body 50;
  `;
  const elements = await queryOverpass(query);
  return elementsToPOIs(elements, 30);
}

// Overpass tag selectors used when searching a specific map area by category.
const CATEGORY_OSM_SELECTORS: Partial<Record<POICategory, string[]>> = {
  monumento: [
    '["historic"~"monument|memorial|castle|ruins|fort|archaeological_site"]',
    '["tourism"="attraction"]',
  ],
  chiesa: ['["amenity"="place_of_worship"]'],
  museo: ['["tourism"~"museum|gallery"]'],
  spiaggia: ['["natural"="beach"]', '["leisure"="beach_resort"]'],
  natura: [
    '["leisure"="park"]',
    '["tourism"="viewpoint"]',
    '["natural"~"peak|cave_entrance|wood"]',
  ],
  ristorante: ['["amenity"~"restaurant|cafe"]'],
  aperitivo: ['["amenity"~"bar|pub"]'],
  vita_notturna: ['["amenity"="nightclub"]'],
  shopping: ['["shop"~"mall|department_store|gift|boutique"]'],
};

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export async function searchPOIsInBounds(
  bounds: MapBounds,
  categories: POICategory[]
): Promise<DiscoveredPOI[]> {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const clauses = categories
    .flatMap((c) => CATEGORY_OSM_SELECTORS[c] ?? [])
    .map((selector) => `node${selector}(${bbox});`)
    .join("\n");

  if (!clauses) return [];

  const query = `[out:json][timeout:20];(${clauses});out body 80;`;
  const elements = await queryOverpass(query);
  return elementsToPOIs(elements, 80);
}

export function toPOIs(discovered: DiscoveredPOI[], tripId: string): POI[] {
  return discovered.map((d) => ({ ...d, id: nanoid(10), tripId }));
}
