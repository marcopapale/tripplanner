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
  | "spiaggia"
  | "ristorante"
  | "cultura"
  | "intrattenimento"
  | "natura"
  | "shopping"
  | "altro";

export const POI_CATEGORY_LABELS: Record<POICategory, string> = {
  spiaggia: "Spiaggia",
  ristorante: "Ristorante",
  cultura: "Cultura",
  intrattenimento: "Intrattenimento",
  natura: "Natura",
  shopping: "Shopping",
  altro: "Altro",
};

export const POI_CATEGORY_DEFAULT_SLOTS: Record<POICategory, Slot[]> = {
  spiaggia: ["mattina", "pomeriggio"],
  ristorante: ["pranzo", "cena"],
  cultura: ["mattina", "pomeriggio"],
  intrattenimento: ["serata"],
  natura: ["mattina", "pomeriggio"],
  shopping: ["pomeriggio"],
  altro: ["mattina", "pomeriggio", "serata"],
};

export interface POI {
  id: string;
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

export interface Trip {
  id: string;
  destination: string;
  lat: number;
  lon: number;
  startDate: string; // ISO date (yyyy-MM-dd)
  endDate: string; // ISO date (yyyy-MM-dd)
  participants: Participant[];
  itinerary: ItineraryDay[]; // index = day number (0-based)
  createdAt: string;
}
