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
  rating?: number; // 0-5 scale
  priceLevel?: number; // 1-4 ($ to $$$$)
  placeId?: string; // Google Place ID, when sourced from Google Places — enables the rich Place UI Kit card
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

export type TransportMode = "auto" | "scooter" | "trasporto_pubblico" | "bicicletta" | "a_piedi";

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  auto: "Automobile",
  scooter: "Scooter",
  trasporto_pubblico: "Trasporto pubblico",
  bicicletta: "Bicicletta",
  a_piedi: "A piedi",
};

/** Proposta AI non ancora approvata/scartata: candidati da rivedere prima che diventino POI veri. */
export interface AIPOIProposalItem {
  id: string; // id temporaneo, solo per selezione/rimozione lato UI
  name: string;
  category: POICategory;
  description: string;
  dayIndex: number; // 0-based, coerente con trip.itinerary
  slot: Slot;
  lat: number;
  lon: number;
  placeId?: string;
  rating?: number;
  priceLevel?: number;
}

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
  transportMode: TransportMode;
  participants: Participant[];
  itinerary: ItineraryDay[]; // index = day number (0-based)
  createdAt: string;
  shared?: boolean; // true once the admin has explicitly shared participant links
  aiCategories?: POICategory[]; // AI-curated categories for this destination, cached on first admin visit
  aiPoiProposal?: AIPOIProposalItem[]; // proposta AI pendente, in attesa di approvazione/scarto
  accommodationName?: string; // Casa/B&B/Hotel scelto in fase di creazione, mostrato come pin fisso sulla mappa
  accommodationLat?: number;
  accommodationLon?: number;
}

export type POIProvider = "osm" | "google";

export const POI_PROVIDER_LABELS: Record<POIProvider, string> = {
  osm: "OpenStreetMap (gratuito)",
  google: "Google Places",
};

export const DEFAULT_AI_POI_PROMPT_TEMPLATE =
  'Sei un travel agent esperto, conosci {{destinazione}} in ogni minimo particolare. Organizza un itinerario ideale di cose da fare, da vedere e dove mangiare per un totale di {{giorni}} giorni, tenendo conto che ci si sposterà con: {{mezzo}}. Vorrei una selezione mirata di luoghi che posso trovare su Google Maps da vedere, attività da fare o ristoranti, adatta alla durata della permanenza. Raggruppa le proposte in un itinerario giorno per giorno (mattina, pranzo, pomeriggio, cena, serata), tenendo conto della vicinanza geografica tra le tappe dello stesso giorno per minimizzare gli spostamenti.';

export interface AppSettings {
  poiProvider: POIProvider;
  googleApiKey?: string; // server-side, used for Places REST search
  googleMapsBrowserKey?: string; // client-side, loaded in the browser — must be HTTP-referrer restricted
  anthropicApiKey?: string;
  aiPoiPromptTemplate?: string;
  customMapId?: string; // Map ID vettoriale da Google Cloud Console con stile personalizzato (es. POI nascosti)
  landingHeroImageUrl?: string; // sfondo desktop
  landingHeroImageMobileUrl?: string; // sfondo mobile, opzionale — se assente usa quello desktop
  landingLogoUrl?: string;
  landingPayoffText?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  poiProvider: "osm",
};
