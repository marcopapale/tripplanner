import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { USE_BLOB } from "./db";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Immagini di branding (logo, sfondo landing) — le vedono visitatori
 * anonimi, ma lo store Blob collegato a questo progetto è configurato come
 * "private" (impostazione fissata alla creazione dello store, non
 * modificabile: `put()` con `access:"public"` fallisce con "Cannot use
 * public access on a private store"). Scriviamo quindi come private (stesso
 * meccanismo già usato per i JSON di dati) e le serviamo pubblicamente
 * tramite il proxy `src/app/api/branding/[filename]/route.ts`, che fa `get()`
 * lato server e ne inoltra lo stream — pattern raccomandato da Vercel per
 * gli store privati. Il file arriva già ridimensionato dal browser
 * (`ImageUploadField` in `SettingsPanel.tsx`) — Vercel impone comunque un
 * limite fisso di 4.5MB sul body delle funzioni serverless indipendente da
 * `bodySizeLimit` di Next, quindi senza compressione lato client un file
 * fotografico originale rischierebbe di superarlo.
 */
export async function saveUploadedImage(file: File, prefix: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Il file deve essere un'immagine.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Immagine troppo grande: massimo 8MB.");
  }

  const ext = EXT_BY_MIME[file.type] ?? "jpg";
  const filename = `${prefix}-${nanoid(10)}.${ext}`;

  if (USE_BLOB) {
    await put(`uploads/${filename}`, file, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: file.type,
    });
    return `/api/branding/${filename}`;
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
