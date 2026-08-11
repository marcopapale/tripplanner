import L from "leaflet";
import { POICategory } from "./types";

const CATEGORY_COLOR: Record<POICategory, string> = {
  spiaggia: "#14b8a6",
  ristorante: "#ff6b4a",
  cultura: "#8b5cf6",
  intrattenimento: "#ec4899",
  natura: "#22c55e",
  shopping: "#f59e0b",
  altro: "#6b7280",
};

const CATEGORY_EMOJI: Record<POICategory, string> = {
  spiaggia: "🏖️",
  ristorante: "🍽️",
  cultura: "🏛️",
  intrattenimento: "🎉",
  natura: "🌿",
  shopping: "🛍️",
  altro: "📍",
};

export function poiIcon(category: POICategory): L.DivIcon {
  const color = CATEGORY_COLOR[category];
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid white;font-size:14px;">${CATEGORY_EMOJI[category]}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

export function destinationIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:#ff6b4a;width:16px;height:16px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
