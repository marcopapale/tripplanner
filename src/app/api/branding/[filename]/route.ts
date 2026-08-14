import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

/**
 * Serve pubblicamente le immagini di branding caricate su uno store Blob
 * privato (vedi commento in uploadImage.ts). Nessun controllo di auth qui
 * di proposito: sono asset destinati a essere visti da chiunque visiti la
 * landing (sfondo, logo), non contenuti riservati — lo store è privato solo
 * perché è così che è stato creato lo store collegato al progetto.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const result = await get(`uploads/${filename}`, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
