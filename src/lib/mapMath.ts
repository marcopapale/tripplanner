import { MapBounds } from "./poiDiscovery";

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundsToCenterRadius(
  bounds: MapBounds,
  maxRadius: number
): { lat: number; lon: number; radius: number } {
  const lat = (bounds.north + bounds.south) / 2;
  const lon = (bounds.east + bounds.west) / 2;
  const R = 6371000; // meters
  const dLat = ((bounds.north - lat) * Math.PI) / 180;
  const dLon = ((bounds.east - lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { lat, lon, radius: Math.min(Math.max(radius, 500), maxRadius) };
}
