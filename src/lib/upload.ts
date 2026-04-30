import { supabase } from "@/integrations/supabase/client";

export async function uploadFile(
  bucket: string,
  pathPrefix: string,
  file: File | Blob,
  ext = "jpg",
): Promise<string> {
  const filename = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(filename, file, {
    upsert: false,
    contentType: file instanceof File ? file.type : `image/${ext}`,
  });
  if (error) throw error;
  return filename;
}

export async function uploadDataUrl(
  bucket: string,
  pathPrefix: string,
  dataUrl: string,
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadFile(bucket, pathPrefix, blob, "png");
}
