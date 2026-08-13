export type Slot = "mattina" | "pranzo" | "pomeriggio" | "cena" | "serata";

export const SLOTS: Slot[] = ["mattina", "pranzo", "pomeriggio", "cena", "serata"];

export const SLOT_LABELS: Record<Slot, string> = {
  mattina: "Mattina",
  pranzo: "Pranzo",
  pomeriggio: "Pomeriggio",
  cena: "Cena",
  serata: "Serata",
};

export type POICategory =
  | "monumento"
  | "chiesa"
  | "museo"
  | "spiaggia"
  | "natura"
  | "ristorante"
  | "aperitivo"
  | "vita_notturna"
  | "shopping"
  | "altro";

export const POI_CATEGORY_LABELS: Record<POICategory, string> = {
  monumento: "Monumento",
  chiesa: "Chiesa",
  museo: "Museo",
  spiaggia: "Spiaggia",
  natura: "Natura",
  ristorante: "Ristorante",
  aperitivo: "Aperitivo",
  vita_notturna: "Vita notturna",
  shopping: "Shopping",
  altro: "Altro",
};

export const POI_CATEGORY_DEFAULT_SLOTS: Record<POICategory, Slot[]> = {
  monumento: ["mattina", "pomeriggio"],
  chiesa: ["mattina", "pomeriggio"],
  museo: ["mattina", "pomeriggio"],
  spiaggia: ["mattina", "pomeriggio"],
  natura: ["mattina", "pomeriggio"],
  ristorante: ["pranzo", "cena"],
  aperitivo: ["pomeriggio", "serata"],
  vita_notturna: ["serata"],
  shopping: ["pomeriggio"],
  altro: ["mattina", "pomeriggio", "serata"],
};

/** Categories offered as map-search filters (excludes "altro", which is manual-only). */
export const OSM_SEARCH_CATEGORIES: POICategory[] = [
  "monumento",
  "chiesa",
  "museo",
  "spiaggia",
  "natura",
  "ristorante",
  "aperitivo",
  "vita_notturna",
  "shopping",
];

export interface POI {
  id: string;
  tripId: string;
  name: string;
  category: POICategory;
  lat: number;
  lon: number;
  description?: string;
  validSlots: Slot[];
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  token: string;
}

export type ItineraryDay = Record<Slot, string[]>; // slot -> poi ids

export const DEFAULT_ACCENT_COLOR = "#ff6b4a";

export interface Trip {
  id: string;
  destination: string;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  lat: number;
  lon: number;
  startDate: string; // ISO date (yyyy-MM-dd)
  endDate: string; // ISO date (yyyy-MM-dd)
  participants: Participant[];
  itinerary: ItineraryDay[]; // index = day number (0-based)
  createdAt: string;
  shared?: boolean; // true once the admin has explicitly shared participant links
}
