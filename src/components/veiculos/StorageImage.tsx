import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  bucket: string;
  path: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

export function StorageImage({ bucket, path, alt = "", className, fallbackClassName }: Props) {
  const url = useSignedUrl(bucket, path);
  if (!path || !url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/30 text-muted-foreground", className, fallbackClassName)}>
        <Truck className="w-1/3 h-1/3 opacity-60" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
