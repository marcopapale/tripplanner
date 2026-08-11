import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";

export async function GET() {
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  let writeOk = false;
  let readOk = false;
  let error: string | null = null;

  if (blobConfigured) {
    try {
      await put("data/health-check.json", JSON.stringify({ ok: true, at: Date.now() }), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      writeOk = true;
      const result = await get("data/health-check.json", { access: "private", useCache: false });
      readOk = !!result?.stream;
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
