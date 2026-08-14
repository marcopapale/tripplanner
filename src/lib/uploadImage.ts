import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { USE_BLOB } from "./db";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Immagini di branding (logo, sfondo landing): a differenza dei JSON di dati
 * (privati), qui serve storage pubblico perché la landing la vedono
 * visitatori anonimi non autenticati.
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
