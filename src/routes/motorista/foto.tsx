import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJornadaAtiva } from "@/hooks/useJornada";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { CameraInput } from "@/components/CameraInput";
import { uploadFile } from "@/lib/upload";
import { toast } from "sonner";

export const Route = createFileRoute("/motorista/foto")({
  head: () => ({ meta: [{ title: "Enviar Foto — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <EnviarFoto />
      </AppShell>
    </ProtectedRoute>
  ),
});

function EnviarFoto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { veiculo: veiculoAtivo } = useJornadaAtiva();
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [tipo, setTipo] = useState("geral");
  const [foto, setFoto] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const [km, setKm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("veiculos").select("id,placa,modelo").eq("motorista_id", user.id)
      .then(({ data }) => setVeiculos(data ?? []));
  }, [user]);

  useEffect(() => {
    if (veiculoAtivo?.id) setVeiculoId(veiculoAtivo.id);
    else if (veiculos[0]?.id && !veiculoId) setVeiculoId(veiculos[0].id);
  }, [veiculoAtivo, veiculos, veiculoId]);

  async function enviar() {
    if (!user || !veiculoId || !foto) {
      toast.error("Selecione veículo e tire a foto");
      return;
    }
    setSubmitting(true);
    try {
      const path = await uploadFile("veiculos-fotos", `${veiculoId}/avulso`, foto);
      await supabase.from("veiculo_fotos").insert({
        veiculo_id: veiculoId,
        url: path,
        tipo,
        legenda: obs || null,
        enviado_por: user.id,
      });
      toast.success("Foto enviada!");
      navigate({ to: "/motorista" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/motorista"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <h1 className="font-semibold flex items-center gap-2"><Camera className="w-5 h-5" /> Enviar foto</h1>
      </div>

      <Card className="p-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Veículo</Label>
          <Select value={veiculoId} onValueChange={setVeiculoId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {veiculos.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dano">Dano</SelectItem>
              <SelectItem value="hodometro">Hodômetro</SelectItem>
              <SelectItem value="abastecimento">Abastecimento</SelectItem>
              <SelectItem value="geral">Geral</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CameraInput label="Tirar foto" required onChange={setFoto} />

        <div className="space-y-1.5">
          <Label>KM (opcional)</Label>
          <Input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Observação</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
        </div>

        <Button size="lg" className="w-full" onClick={enviar} disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Enviar
        </Button>
      </Card>
    </div>
  );
}
