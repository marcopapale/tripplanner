import { POICategory, POI_CATEGORY_DEFAULT_SLOTS } from "./types";
import { MapBounds, DiscoveredPOI } from "./poiDiscovery";

/**
 * Foursquare Places API (v3) backed POI search. Unlike OpenStreetMap, it can
 * surface a rating (0-10) and a price tier (1-4) for venues, which is the
 * whole reason to offer it as an alternative provider — OSM simply has no
 * such data. Search is keyword-based (not category-ID based) to stay robust
 * without depending on Foursquare's internal category-ID taxonomy.
 */

const FSQ_SEARCH_URL = "https://api.foursquare.com/v3/places/search";

const CATEGORY_QUERY: Partial<Record<POICategory, string>> = {
  monumento: "monument landmark",
  chiesa: "church",
  museo: "museum",
  spiaggia: "beach",
  natura: "park",
  ristorante: "restaurant",
  aperitivo: "bar",
  vita_notturna: "nightclub",
  shopping: "shopping mall",
};

interface FsqPlace {
  name?: string;
  categories?: { name: string }[];
  geocodes?: { main?: { latitude: number; longitude: number } };
  location?: { formatted_address?: string };
  rating?: number;
  price?: number;
}

function boundsToCenterRadius(bounds: MapBounds): { lat: number; lon: number; radius: number } {
  const lat = (bounds.north + bounds.south) / 2;
  const lon = (bounds.east + bounds.west) / 2;
  const R = 6371000; // meters
  const dLat = ((bounds.north - lat) * Math.PI) / 180;
  const dLon = ((bounds.east - lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { lat, lon, radius: Math.min(Math.max(radius, 500), 100000) };
}

async function searchByQuery(
  apiKey: string,
  lat: number,
  lon: number,
  radius: number,
  query: string,
  category: POICategory
): Promise<DiscoveredPOI[]> {
  const url = new URL(FSQ_SEARCH_URL);
  url.searchParams.set("ll", `${lat},${lon}`);
  url.searchParams.set("radius", String(Math.round(radius)));
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "30");
  url.searchParams.set("fields", "name,geocodes,categories,location,rating,price");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const places: FsqPlace[] = Array.isArray(data.results) ? data.results : [];

    return places
      .filter((p) => p.name && p.geocodes?.main)
      .map((p) => ({
        name: p.name!,
        category,
        lat: p.geocodes!.main!.latitude,
        lon: p.geocodes!.main!.longitude,
        description: p.location?.formatted_address,
        validSlots: POI_CATEGORY_DEFAULT_SLOTS[category],
        rating: p.rating,
        priceLevel: p.price,
      }));
  } catch {
    return [];
  }
}

/** Raw diagnostic call used by the settings page to verify what the API key actually returns. */
export async function testFoursquareConnection(
  apiKey: string
): Promise<{ ok: boolean; status: number; sample: unknown }> {
  const url = new URL(FSQ_SEARCH_URL);
  url.searchParams.set("ll", "41.9028,12.4964"); // Roma, as a known reference point
  url.searchParams.set("radius", "3000");
  url.searchParams.set("query", "restaurant");
  url.searchParams.set("limit", "3");
  url.searchParams.set("fields", "name,geocodes,categories,location,rating,price");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, sample: body };
}

export async function searchFoursquarePOIsInBounds(
  bounds: MapBounds,
  categories: POICategory[],
  apiKey: string
): Promise<DiscoveredPOI[]> {
  const { lat, lon, radius } = boundsToCenterRadius(bounds);

  const batches = await Promise.all(
    categories
      .filter((c) => CATEGORY_QUERY[c])
      .map((c) => searchByQuery(apiKey, lat, lon, radius, CATEGORY_QUERY[c]!, c))
  );

  const seen = new Set<string>();
  const results: DiscoveredPOI[] = [];
  for (const batch of batches) {
    for (const poi of batch) {
      const key = poi.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(poi);
    }
  }
  return results;
}
