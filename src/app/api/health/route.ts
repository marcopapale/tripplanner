import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export async function GET() {
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  let writeOk = false;
  let readOk = false;
  let error: string | null = null;

  if (blobConfigured) {
    try {
      await put("data/health-check.json", JSON.stringify({ ok: true, at: Date.now() }), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      writeOk = true;
      const { blobs } = await list({ prefix: "data/health-check.json", limit: 1 });
      readOk = blobs.length > 0;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    blobConfigured,
    writeOk,
    readOk,
    error,
    isVercel: !!process.env.VERCEL,
  });
}
