import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/app/actions/admin-actions";
import { ALLOWED_IMAGE_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploadImage";

/**
 * Genera i token per l'upload diretto da browser a Vercel Blob (bypassa il
 * limite di 4.5MB sul body delle funzioni serverless — vedi uploadImage.ts).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isAdmin())) throw new Error("Non autorizzato.");
        return {
          allowedContentTypes: ALLOWED_IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload fallito." },
      { status: 400 }
    );
  }
}
