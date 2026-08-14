import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { USE_BLOB } from "./db";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Percorso usato dalla server action `uploadBrandingImage` (dev locale, o
 * fallback per file piccoli). Vercel impone un limite fisso di 4.5MB sul
 * body delle funzioni serverless indipendente da `bodySizeLimit` di Next —
 * per questo il caricamento da browser in produzione passa invece per
 * `@vercel/blob/client` (upload diretto al bucket, vedi
 * `src/app/api/branding-upload/route.ts` e `ImageUploadField` in
 * `SettingsPanel.tsx`), che non transita da questa funzione.
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
    const blob = await put(`uploads/${filename}`, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: file.type,
    });
    return blob.url;
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
