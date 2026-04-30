import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; exp: number }>();

/** Gera URL assinada para arquivo em bucket privado. Cacheia por 1h. */
export function useSignedUrl(bucket: string, path: string | null | undefined) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!path) {
      setUrl("");
      return;
    }
    const key = `${bucket}|${path}`;
    const cached = cache.get(key);
    if (cached && cached.exp > Date.now()) {
      setUrl(cached.url);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (data?.signedUrl && active) {
        cache.set(key, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
        setUrl(data.signedUrl);
      }
    })();
    return () => { active = false; };
  }, [bucket, path]);

  return url;
}
