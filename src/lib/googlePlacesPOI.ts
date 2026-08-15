import { POICategory, POI_CATEGORY_DEFAULT_SLOTS } from "./types";
import { MapBounds, DiscoveredPOI } from "./poiDiscovery";
import { boundsToCenterRadius } from "./mapMath";

/**
 * Google Places API (New) — Nearby Search + Text Search. Rating/price are
 * included in a tier with a real free monthly allowance (1,000 calls/month
 * on the Enterprise+Atmosphere SKU, plus a $300 trial credit for new
 * accounts).
 */

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK =
  "places.id,places.displayName,places.location,places.rating,places.priceLevel,places.formattedAddress,places.photos";

/**
 * Costruisce l'URL della foto usando la chiave *browser* (mai quella server,
 * che non è ristretta per referrer e non va esposta in un <img src> lato
 * client). Se la chiave browser non è configurata, niente foto — fallback
 * gestito lato UI.
 */
function photoUrlFor(place: GooglePlace, browserKey?: string): string | undefined {
  const photoName = place.photos?.[0]?.name;
  if (!photoName || !browserKey) return undefined;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=480&key=${browserKey}`;
}

const CATEGORY_TYPES: Partial<Record<POICategory, string[]>> = {
  monumento: ["monument", "historical_landmark", "historical_place"],
  chiesa: ["church"],
  museo: ["museum"],
  spiaggia: ["beach"],
  natura: ["park", "scenic_spot"],
  ristorante: ["restaurant"],
  aperitivo: ["bar"],
  vita_notturna: ["night_club"],
  shopping: ["shopping_mall"],
};

const PRICE_LEVEL_MAP: Record<string, number | undefined> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  rating?: number;
  priceLevel?: string;
  photos?: { name: string }[];
}

async function searchByType(
  apiKey: string,
  browserKey: string | undefined,
  lat: number,
  lon: number,
  radius: number,
  types: string[],
  category: POICategory
): Promise<DiscoveredPOI[]> {
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lon }, radius },
        },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const places: GooglePlace[] = Array.isArray(data.places) ? data.places : [];

    return places
      .filter((p) => p.displayName?.text && p.location?.latitude != null)
      .map((p) => ({
        name: p.displayName!.text!,
        category,
        lat: p.location!.latitude!,
        lon: p.location!.longitude!,
        description: p.formattedAddress,
        validSlots: POI_CATEGORY_DEFAULT_SLOTS[category],
        rating: p.rating,
        priceLevel: p.priceLevel ? PRICE_LEVEL_MAP[p.priceLevel] : undefined,
        placeId: p.id,
        photoUrl: photoUrlFor(p, browserKey),
      }));
  } catch {
    return [];
  }
}

export interface TextSearchResult {
  name: string;
  lat: number;
  lon: number;
  placeId: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
}

/** Resolves a free-text place name (e.g. an AI suggestion) to a real Google Place. */
export async function findPlaceByText(
  query: string,
  apiKey: string,
  browserKey?: string
): Promise<TextSearchResult | null> {
  try {
    const res = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const place: GooglePlace | undefined = Array.isArray(data.places) ? data.places[0] : undefined;
    if (!place?.id || !place.displayName?.text || place.location?.latitude == null) return null;
    return {
      name: place.displayName.text,
      lat: place.location.latitude,
      lon: place.location.longitude!,
      placeId: place.id,
      rating: place.rating,
      priceLevel: place.priceLevel ? PRICE_LEVEL_MAP[place.priceLevel] : undefined,
      photoUrl: photoUrlFor(place, browserKey),
    };
  } catch {
    return null;
  }
}

/** Raw diagnostic call used by the settings page to verify what the API key actually returns. */
export async function testGoogleConnection(
  apiKey: string
): Promise<{ ok: boolean; status: number; sample: unknown }> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["restaurant"],
      maxResultCount: 3,
      locationRestriction: {
        circle: { center: { latitude: 41.9028, longitude: 12.4964 }, radius: 3000 },
      },
    }),
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

export async function searchGooglePOIsInBounds(
  bounds: MapBounds,
  categories: POICategory[],
  apiKey: string,
  browserKey?: string
): Promise<DiscoveredPOI[]> {
  const { lat, lon, radius } = boundsToCenterRadius(bounds, 50000);

  const batches = await Promise.all(
    categories
      .filter((c) => CATEGORY_TYPES[c])
      .map((c) => searchByType(apiKey, browserKey, lat, lon, radius, CATEGORY_TYPES[c]!, c))
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

/**
 * Recupera la foto per un placeId già noto (backfill per POI catalogati
 * prima che questo campo esistesse, o creati senza passare dai percorsi
 * che già la popolano). Chiamata "una tantum": il chiamante è responsabile
 * di salvare il risultato sul POI così le volte successive non serve rifare
 * la chiamata.
 */
export async function fetchPlacePhotoUrl(
  placeId: string,
  apiKey: string,
  browserKey?: string
): Promise<string | undefined> {
  if (!browserKey) return undefined;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "photos",
      },
    });
    if (!res.ok) return undefined;
    const place: GooglePlace = await res.json();
    return photoUrlFor(place, browserKey);
  } catch {
    return undefined;
  }
}
