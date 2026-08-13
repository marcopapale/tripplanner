import { POICategory, POI_CATEGORY_DEFAULT_SLOTS } from "./types";
import { MapBounds, DiscoveredPOI } from "./poiDiscovery";
import { boundsToCenterRadius } from "./mapMath";

/**
 * Foursquare Places API backed POI search. Unlike OpenStreetMap, it can
 * surface a rating (0-10) and a price tier (1-4) for venues, which is the
 * whole reason to offer it as an alternative provider — OSM simply has no
 * such data. Search is keyword-based (not category-ID based) to stay robust
 * without depending on Foursquare's internal category-ID taxonomy.
 *
 * Foursquare migrated off the old api.foursquare.com/v3 endpoints (which
 * now return HTTP 410 Gone) to a new base URL with Bearer auth and a
 * mandatory date-versioned header. See:
 * https://docs.foursquare.com/fsq-developers-places/reference/migration-guide
 */

const FSQ_SEARCH_URL = "https://places-api.foursquare.com/places/search";
const FSQ_API_VERSION = "2025-06-17";

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
  latitude?: number;
  longitude?: number;
  location?: { formatted_address?: string };
  rating?: number;
  price?: number;
}

function fsqHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "X-Places-Api-Version": FSQ_API_VERSION,
  };
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
  url.searchParams.set("fields", "name,latitude,longitude,location,rating,price");

  try {
    const res = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
    if (!res.ok) return [];
    const data = await res.json();
    const places: FsqPlace[] = Array.isArray(data.results) ? data.results : [];

    return places
      .filter((p) => p.name && p.latitude != null && p.longitude != null)
      .map((p) => ({
        name: p.name!,
        category,
        lat: p.latitude!,
        lon: p.longitude!,
        description: p.location?.formatted_address,
        validSlots: POI_CATEGORY_DEFAULT_SLOTS[category],
        rating: p.rating != null ? p.rating / 2 : undefined, // Foursquare uses 0-10, we normalize to 0-5
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
  url.searchParams.set("fields", "name,latitude,longitude,location,rating,price");

  const res = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
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
  const { lat, lon, radius } = boundsToCenterRadius(bounds, 100000);

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
