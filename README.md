# Trip Planner

Webapp per organizzare viaggi di gruppo: crei un viaggio con destinazione, date e partecipanti, e ottieni una pagina con mappa OpenStreetMap e itinerario giorno per giorno (Mattina / Pranzo / Pomeriggio / Cena / Serata).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Leaflet / React-Leaflet** con tile OpenStreetMap
- **Storage**: file JSON locali in `data/` (nessun database) — vedi `src/lib/db.ts`
- Suggerimento automatico dei POI (spiagge, ristoranti, attrazioni) tramite **Overpass API** (OpenStreetMap), vedi `src/lib/poiDiscovery.ts`

## Sviluppo locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Accesso admin

L'area `/admin` (gestione POI e itinerari) è protetta da password. Imposta `ADMIN_PASSWORD` in un file `.env.local` (default: `admin123`, da cambiare prima del deploy).

## Nota importante per il deploy su Vercel

Il filesystem di Vercel è **read-only in produzione** (eccetto `/tmp`, che è temporaneo), quindi la scrittura su file JSON locali funziona in sviluppo ma **non persiste in produzione**. Tutto l'accesso ai dati passa da un unico modulo (`src/lib/db.ts`): prima del deploy reale, sostituire la sua implementazione con [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (restano comunque semplici file JSON, non un database relazionale) senza toccare il resto del codice.

## Partecipanti

Ogni partecipante riceve un link personale (`/trip/[token]`) generato alla creazione del viaggio — nessuna registrazione o login richiesti.
