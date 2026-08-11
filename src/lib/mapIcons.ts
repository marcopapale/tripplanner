import L from "leaflet";
import { POICategory } from "./types";

export const CATEGORY_COLOR: Record<POICategory, string> = {
  monumento: "#8b5cf6",
  chiesa: "#6366f1",
  museo: "#a855f7",
  spiaggia: "#14b8a6",
  natura: "#22c55e",
  ristorante: "#ff6b4a",
  aperitivo: "#f59e0b",
  vita_notturna: "#ec4899",
  shopping: "#0ea5e9",
  altro: "#6b7280",
};

const CATEGORY_EMOJI: Record<POICategory, string> = {
  monumento: "🗿",
  chiesa: "⛪",
  museo: "🏛️",
  spiaggia: "🏖️",
  natura: "🌿",
  ristorante: "🍽️",
  aperitivo: "🍹",
  vita_notturna: "🎉",
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

/** Lighter dashed-outline marker for OSM search results not yet saved to the catalog. */
export function poiIconUnsaved(category: POICategory): L.DivIcon {
  const color = CATEGORY_COLOR[category];
  return L.divIcon({
    className: "",
    html: `<div style="background:white;width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);border:2px dashed ${color};font-size:12px;">${CATEGORY_EMOJI[category]}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
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
