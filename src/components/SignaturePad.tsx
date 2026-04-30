import { useRef, useImperativeHandle, forwardRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(
  function SignaturePad({ height = 200 }, ref) {
    const padRef = useRef<SignatureCanvas | null>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toDataURL: () => padRef.current?.toDataURL("image/png") ?? "",
      clear: () => padRef.current?.clear(),
    }));

    return (
      <div className="space-y-2">
        <div
          className="bg-white rounded-md border-2 border-border overflow-hidden touch-none"
          style={{ height }}
        >
          <SignatureCanvas
            ref={(r) => { padRef.current = r; }}
            penColor="#0f2942"
            canvasProps={{
              className: "w-full h-full",
              style: { width: "100%", height: "100%" },
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => padRef.current?.clear()}
          className="w-full"
        >
          <Eraser className="w-4 h-4 mr-2" /> Limpar assinatura
        </Button>
      </div>
    );
  },
);
