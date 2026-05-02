import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { CameraInput } from "@/components/CameraInput";
import { SignaturePad } from "@/components/SignaturePad";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Circle, Gauge, Lightbulb, Droplets, Fuel,
    FileText, Car, Wrench
} from "lucide-react";

export const Route = createFileRoute("/motorista/checklist")({
    component: ChecklistPage,
});

const ITENS = [
  { key: "pneus", label: "Pneus", icon: Circle },
  { key: "freios", label: "Freios", icon: Gauge },
  { key: "luzes", label: "Luzes", icon: Lightbulb },
  { key: "agua", label: "Agua", icon: Droplets },
  { key: "oleo", label: "Oleo", icon: Droplets },
  { key: "combustivel", label: "Combustivel", icon: Fuel },
  { key: "documentos", label: "Documentos", icon: FileText },
  { key: "lataria", label: "Lataria", icon: Car },
  ];

function ChecklistPage() {
    const { user, empresaId } = useAuth();
    const [km, setKm] = useState("");
    const [obs, setObs] = useState("");
    const [fotoHodometro, setFotoHodometro] = useState<File | null>(null);
    const [assinatura, setAssinatura] = useState<string | null>(null);
    const [itens, setItens] = useState<Record<string, boolean>>(
          Object.fromEntries(ITENS.map((i) => [i.key, true]))
        );
    const [loading, setLoading] = useState(false);
    const [tipo, setTipo] = useState<"saida" | "retorno">("saida");

  const toggle = (key: string) =>
        setItens((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!km) { toast.error("KM obrigatorio"); return; }
        if (!fotoHodometro) { toast.error("Foto do hodometro obrigatoria"); return; }
        if (!assinatura) { toast.error("Assinatura obrigatoria"); return; }

      setLoading(true);
        try {
                let fotoUrl: string | null = null;
                if (fotoHodometro) {
                          const path = `checklists/${user?.id}/${Date.now()}.jpg`;
                          const { error: upErr } = await supabase.storage
                            .from("fotos")
                            .upload(path, fotoHodometro);
                          if (upErr) throw upErr;
                          const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(path);
                          fotoUrl = urlData.publicUrl;
                }

          const { error } = await supabase.from("checklists").insert({
                    motorista_id: user?.id,
                    empresa_id: empresaId,
                    tipo,
                    km_atual: Number(km),
                    pneus_ok: itens.pneus,
                    freios_ok: itens.freios,
                    luzes_ok: itens.luzes,
                    agua_ok: itens.agua,
                    oleo_ok: itens.oleo,
                    combustivel_ok: itens.combustivel,
                    documentos_ok: itens.documentos,
                    lataria_ok: itens.lataria,
                    foto_hodometro: fotoUrl,
                    assinatura_base64: assinatura,
                    observacoes: obs,
          });
                if (error) throw error;
                toast.success("Checklist enviado com sucesso!");
                setKm(""); setObs(""); setFotoHodometro(null); setAssinatura(null);
        } catch (err: unknown) {
                toast.error("Erro ao enviar checklist");
        } finally {
                setLoading(false);
        }
  }

  return (
        <ProtectedRoute roles={["motorista"]}>
                <AppShell title="Checklist do Veiculo">
                        <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24">
                                  <div className="flex gap-3">
                                    {(["saida", "retorno"] as const).map((t) => (
                        <button
                                          key={t}
                                          type="button"
                                          onClick={() => setTipo(t)}
                                          className={`flex-1 py-3 rounded-xl font-semibold capitalize text-sm ${
                                                              tipo === t
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-muted text-muted-foreground"
                                          }`}
                                        >
                          {t === "saida" ? "Saida" : "Retorno"}
                        </button>
                      ))}
                                  </div>
                        
                                  <div className="grid grid-cols-2 gap-3">
                                    {ITENS.map(({ key, label, icon: Icon }) => (
                        <div
                                          key={key}
                                          className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                                                              itens[key] ? "border-green-500 bg-green-50" : "border-red-400 bg-red-50"
                                          }`}
                                        >
                                        <div className="flex items-center gap-2">
                                                          <Icon size={20} className={itens[key] ? "text-green-600" : "text-red-500"} />
                                                          <span className="text-sm font-medium">{label}</span>
                                        </div>
                                        <Switch checked={itens[key]} onCheckedChange={() => toggle(key)} />
                        </div>
                      ))}
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">KM Atual *</Label>
                                              <Input
                                                              type="number"
                                                              value={km}
                                                              onChange={(e) => setKm(e.target.value)}
                                                              placeholder="Ex: 45230"
                                                              required
                                                              className="mt-1 text-lg h-12"
                                                            />
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Foto do Hodometro *</Label>
                                              <CameraInput
                                                              label="Tirar foto do hodometro"
                                                              onChange={setFotoHodometro}
                                                              required
                                                            />
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Observacoes</Label>
                                              <Textarea
                                                              value={obs}
                                                              onChange={(e) => setObs(e.target.value)}
                                                              placeholder="Descreva problemas ou observacoes..."
                                                              className="mt-1"
                                                              rows={3}
                                                            />
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Assinatura do Motorista *</Label>
                                              <SignaturePad onSave={setAssinatura} />
                                  </div>
                        
                                  <Button
                                                type="submit"
                                                className="w-full h-14 text-lg font-bold"
                                                disabled={loading}
                                              >
                                    {loading ? "Enviando..." : "Enviar Checklist"}
                                  </Button>
                        </form>
                </AppShell>
        </ProtectedRoute>
  );
}
export { ChecklistPage as EmBreve };
