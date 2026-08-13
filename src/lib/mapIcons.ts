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

export const CATEGORY_EMOJI: Record<POICategory, string> = {
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
