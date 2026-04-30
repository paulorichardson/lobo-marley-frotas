import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraInputProps {
  label: string;
  required?: boolean;
  onChange: (file: File | null) => void;
  className?: string;
}

export function CameraInput({ label, required, onChange, className }: CameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  function handleFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    if (f) {
      setPreview(URL.createObjectURL(f));
      onChange(f);
    } else {
      setPreview(null);
      onChange(null);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative rounded-md overflow-hidden border-2 border-success/40">
          <img src={preview} alt={label} className="w-full h-32 object-cover" />
          <div className="absolute top-1 right-1 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-7 w-7"
              onClick={() => handleFile(null)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="absolute bottom-1 left-1 bg-success/90 text-success-foreground text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <Check className="w-3 h-3" /> {label}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn("w-full h-24 flex flex-col gap-1", required && !file && "border-warning/50")}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs">{label}{required && " *"}</span>
        </Button>
      )}
    </div>
  );
}
