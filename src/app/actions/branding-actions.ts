"use server";

import { isAdmin } from "@/app/actions/admin-actions";
import { saveUploadedImage } from "@/lib/uploadImage";

export async function uploadBrandingImage(
  formData: FormData,
  field: "hero" | "heroMobile" | "logo"
): Promise<string> {
  if (!(await isAdmin())) throw new Error("Non autorizzato.");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Nessun file ricevuto.");

  return saveUploadedImage(file, field);
}
