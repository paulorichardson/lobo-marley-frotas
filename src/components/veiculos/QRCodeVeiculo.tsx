import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, QrCode } from "lucide-react";

interface Props {
  veiculoId: string;
  placa: string;
  modelo?: string;
}

export function QRCodeVeiculo({ veiculoId, placa, modelo }: Props) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = `${window.location.origin}/abastecer/${veiculoId}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: "H" })
      .then(setDataUrl)
      .catch(console.error);
  }, [open, url]);

  function baixar() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-${placa}.png`;
    a.click();
  }

  function imprimir() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR ${placa}</title>
      <style>body{font-family:system-ui;text-align:center;padding:40px;}
      h1{font-size:48px;margin:8px 0}h2{margin:4px 0;color:#555}
      img{width:380px;height:380px;margin:24px auto;display:block;border:1px solid #ddd;padding:12px}
      p{font-size:14px;color:#666}</style></head><body>
      <h1>${placa}</h1>${modelo ? `<h2>${modelo}</h2>` : ""}
      <img src="${dataUrl}" />
      <p>Escaneie para registrar abastecimento</p>
      <p style="font-size:11px">${url}</p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="w-4 h-4 mr-2" /> QR Code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code — {placa}</DialogTitle>
          </DialogHeader>
          <Card className="p-6 flex flex-col items-center gap-3">
            {dataUrl ? (
              <img src={dataUrl} alt="QR Code" className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 bg-muted animate-pulse rounded" />
            )}
            <p className="text-xs text-muted-foreground text-center break-all">{url}</p>
            <p className="text-sm text-center text-muted-foreground">
              Cole no para-brisa ou tampa do tanque. O frentista escaneia e registra direto pelo celular.
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={baixar} disabled={!dataUrl}>
              <Download className="w-4 h-4 mr-2" /> Baixar PNG
            </Button>
            <Button onClick={imprimir} disabled={!dataUrl}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </>
  );
}
