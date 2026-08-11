import { POI, POICategory, POI_CATEGORY_DEFAULT_SLOTS } from "./types";
import { nanoid } from "nanoid";

/**
 * Automatic POI suggestion for a destination: queries OpenStreetMap's
 * Overpass API for notable beaches, restaurants, attractions and nightlife
 * around the trip coordinates, so the admin panel opens with a ready-made
 * shortlist instead of an empty catalog.
 */

// Public Overpass instances are shared and occasionally overloaded/timeout;
// try a couple of mirrors before giving up so trip creation isn't blocked.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function categoryFromTags(tags: Record<string, string>): POICategory {
  if (tags.natural === "beach" || tags.leisure === "beach_resort") return "spiaggia";
  if (tags.amenity === "restaurant" || tags.amenity === "cafe") return "ristorante";
  if (tags.amenity === "bar" || tags.amenity === "nightclub") return "intrattenimento";
  if (tags.historic || tags.tourism === "museum" || tags.tourism === "gallery")
    return "cultura";
  if (tags.leisure === "park" || tags.natural) return "natura";
  if (tags.shop) return "shopping";
  if (tags.tourism === "attraction" || tags.tourism === "viewpoint") return "cultura";
  return "altro";
}

export async function discoverPOIs(lat: number, lon: number): Promise<Omit<POI, "id">[]> {
  const query = `
    [out:json][timeout:20];
    (
      node["tourism"~"attraction|museum|gallery|viewpoint"](around:6000,${lat},${lon});
      node["natural"="beach"](around:8000,${lat},${lon});
      node["leisure"~"beach_resort|park"](around:8000,${lat},${lon});
      node["amenity"~"restaurant|cafe|bar|nightclub"](around:4000,${lat},${lon});
      node["historic"](around:6000,${lat},${lon});
    );
    out body 50;
  `;

  for (const url of OVERPASS_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) continue;
      const data = await res.json();
      if (!Array.isArray(data.elements)) continue;

      const seen = new Set<string>();
      const results: Omit<POI, "id">[] = [];
      for (const el of data.elements) {
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
        if (results.length >= 30) break;
      }
      if (results.length > 0) return results;
    } catch {
      // try next mirror
    }
  }
  return [];
}

export function toPOIs(discovered: Omit<POI, "id">[]): POI[] {
  return discovered.map((d) => ({ ...d, id: nanoid(10) }));
}
