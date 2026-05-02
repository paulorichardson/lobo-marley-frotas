import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { CameraInput } from "@/components/CameraInput";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { useAuth } from "@/hooks/useAuth";
import { useJornadaAtiva } from "@/hooks/useJornada";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyEmpresaGestores } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Circle, Gauge, Lightbulb, Droplets, Fuel, FileText, Car,
} from "lucide-react";

export const Route = createFileRoute("/motorista/checklist")({
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <ChecklistPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const ITENS = [
  { key: "pneus", label: "Pneus", icon: Circle },
  { key: "freios", label: "Freios", icon: Gauge },
  { key: "luzes", label: "Luzes", icon: Lightbulb },
  { key: "agua", label: "Água", icon: Droplets },
  { key: "oleo", label: "Óleo", icon: Droplets },
  { key: "combustivel", label: "Combustível", icon: Fuel },
  { key: "documentos", label: "Documentos", icon: FileText },
  { key: "lataria", label: "Lataria", icon: Car },
] as const;

function ChecklistPage() {
  const { user, empresaId } = useAuth();
  const { viagem, veiculo: veiculoJornada } = useJornadaAtiva();
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [km, setKm] = useState("");
  const [obs, setObs] = useState("");
  const [fotoHodometro, setFotoHodometro] = useState<File | null>(null);
  const [itens, setItens] = useState<Record<string, boolean>>(
    Object.fromEntries(ITENS.map((i) => [i.key, true])),
  );
  const [loading, setLoading] = useState(false);
  // Tipo automático com base em jornada ativa, mas o motorista pode trocar
  const [tipo, setTipo] = useState<"saida" | "retorno">("saida");
  const sigRef = useRef<SignaturePadHandle | null>(null);

  // Resolve o veículo: se houver viagem ativa, é dela; senão busca pelo motorista
  useEffect(() => {
    if (veiculoJornada?.id) {
      setVeiculoId(veiculoJornada.id);
      setTipo("retorno");
      return;
    }
    if (!user) return;
    supabase
      .from("veiculos")
      .select("id")
      .eq("motorista_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setVeiculoId(data.id);
      });
    setTipo("saida");
  }, [user, veiculoJornada?.id, viagem?.id]);

  const toggle = (key: string) =>
    setItens((p) => ({ ...p, [key]: !p[key] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !empresaId) {
      toast.error("Sessão sem empresa vinculada");
      return;
    }
    if (!veiculoId) {
      toast.error("Nenhum veículo vinculado ao motorista");
      return;
    }
    if (!km) return toast.error("KM obrigatório");
    if (!fotoHodometro) return toast.error("Foto do hodômetro obrigatória");
    if (sigRef.current?.isEmpty() ?? true) {
      return toast.error("Assinatura obrigatória");
    }

    setLoading(true);
    try {
      // Upload foto hodômetro
      const fotoPath = `${user.id}/${Date.now()}_hodometro.jpg`;
      const { error: upErr } = await supabase.storage
        .from("checklists-fotos")
        .upload(fotoPath, fotoHodometro);
      if (upErr) throw upErr;
      const fotoUrl = supabase.storage
        .from("checklists-fotos")
        .getPublicUrl(fotoPath).data.publicUrl;

      // Upload assinatura
      const sigDataUrl = sigRef.current!.toDataURL();
      const sigBlob = await (await fetch(sigDataUrl)).blob();
      const sigPath = `${user.id}/${Date.now()}_assinatura.png`;
      const { error: sigErr } = await supabase.storage
        .from("checklists-fotos")
        .upload(sigPath, sigBlob, { contentType: "image/png" });
      if (sigErr) throw sigErr;
      const sigUrl = supabase.storage
        .from("checklists-fotos")
        .getPublicUrl(sigPath).data.publicUrl;

      const { error } = await supabase.from("checklists").insert({
        motorista_id: user.id,
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        tipo,
        km_registrado: Number(km),
        pneus_ok: itens.pneus,
        freios_ok: itens.freios,
        luzes_ok: itens.luzes,
        agua_ok: itens.agua,
        oleo_ok: itens.oleo,
        combustivel_ok: itens.combustivel,
        documentos_ok: itens.documentos,
        lataria_ok: itens.lataria,
        foto_hodometro_url: fotoUrl,
        assinatura_url: sigUrl,
        observacoes: obs || null,
        status: "pendente",
      });
      if (error) throw error;

      await notifyEmpresaGestores({
        empresaId,
        titulo: "Novo checklist recebido",
        mensagem: `Checklist de ${tipo} enviado pelo motorista.`,
        tipo: "info",
      });

      toast.success("Checklist enviado com sucesso!");
      setKm("");
      setObs("");
      setFotoHodometro(null);
      sigRef.current?.clear();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar checklist");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-1">Checklist do veículo</h1>
        <p className="text-sm text-muted-foreground">
          Tipo detectado automaticamente: <strong className="capitalize">{tipo}</strong>
        </p>
      </div>

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
            {t === "saida" ? "Saída" : "Retorno"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ITENS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className={`flex items-center justify-between p-4 rounded-xl border-2 ${
              itens[key]
                ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                : "border-red-400 bg-red-50 dark:bg-red-950/20"
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
        <Label className="font-semibold">KM atual *</Label>
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
        <Label className="font-semibold">Foto do hodômetro *</Label>
        <CameraInput label="Tirar foto do hodômetro" onChange={setFotoHodometro} required />
      </div>

      <div>
        <Label className="font-semibold">Observações</Label>
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Descreva problemas ou observações..."
          className="mt-1"
          rows={3}
        />
      </div>

      <div>
        <Label className="font-semibold">Assinatura do motorista *</Label>
        <SignaturePad ref={sigRef} />
      </div>

      <Button
        type="submit"
        className="w-full h-14 text-lg font-bold"
        disabled={loading || !veiculoId}
      >
        {loading ? "Enviando..." : "Enviar checklist"}
      </Button>
    </form>
  );
}
