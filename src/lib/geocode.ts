export interface GeocodeResult {
  lat: number;
  lon: number;
}

const USER_AGENT = "trip-planner-app (https://github.com/marcopapale/tripplanner)";

/** Geocodes a query string; returns null if nothing is found (no fallback). */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function geocodeDestination(destination: string): Promise<GeocodeResult> {
  const result = await geocodePlace(destination);
  return result ?? { lat: 41.9028, lon: 12.4964 }; // fallback: Roma
}
