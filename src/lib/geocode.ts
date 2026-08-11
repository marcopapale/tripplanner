export interface GeocodeResult {
  lat: number;
  lon: number;
}

export async function geocodeDestination(
  destination: string
): Promise<GeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      destination
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "trip-planner-app" },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch {
    // fall through to default
  }
  return { lat: 41.9028, lon: 12.4964 }; // fallback: Roma
}
