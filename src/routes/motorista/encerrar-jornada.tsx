import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJornadaAtiva } from "@/hooks/useJornada";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, AlertTriangle, Loader2, CheckCircle2, CircleAlert, Flag } from "lucide-react";
import { CameraInput } from "@/components/CameraInput";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { uploadFile, uploadDataUrl } from "@/lib/upload";
import { toast } from "sonner";

export const Route = createFileRoute("/motorista/encerrar-jornada")({
  head: () => ({ meta: [{ title: "Encerrar Jornada — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <EncerrarJornada />
      </AppShell>
    </ProtectedRoute>
  ),
});

const CHECK_ITEMS = [
  { key: "pneus_ok", label: "Pneus calibrados" },
  { key: "freios_ok", label: "Freios funcionando" },
  { key: "luzes_ok", label: "Luzes e faróis" },
  { key: "agua_ok", label: "Nível de água" },
  { key: "oleo_ok", label: "Nível de óleo" },
  { key: "combustivel_ok", label: "Combustível suficiente" },
  { key: "documentos_ok", label: "Documentos no veículo" },
  { key: "lataria_ok", label: "Lataria sem danos novos" },
] as const;
type CheckKey = typeof CHECK_ITEMS[number]["key"];

function EncerrarJornada() {
  const { user } = useAuth();
  const { viagem, veiculo, loading, refresh } = useJornadaAtiva();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [kmChegada, setKmChegada] = useState("");
  const [fotoHodo, setFotoHodo] = useState<File | null>(null);

  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    pneus_ok: true, freios_ok: true, luzes_ok: true, agua_ok: true,
    oleo_ok: true, combustivel_ok: true, documentos_ok: true, lataria_ok: true,
  });
  const [obs, setObs] = useState("");

  const sigRef = useRef<SignaturePadHandle>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!viagem || !veiculo) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <Card className="p-6 text-center space-y-3">
          <p>Nenhuma jornada ativa.</p>
          <Button asChild><Link to="/motorista">Voltar</Link></Button>
        </Card>
      </div>
    );
  }

  const kmSaida = Number(viagem.km_saida ?? 0);
  const kmValido = Number(kmChegada) > kmSaida;
  const percorrido = kmValido ? Number(kmChegada) - kmSaida : 0;
  const algumProblema = Object.values(checks).some((v) => !v);

  function canAdvance(): boolean {
    if (step === 1) return kmValido && !!fotoHodo;
    if (step === 2) return true;
    if (step === 3) return sigRef.current ? !sigRef.current.isEmpty() : false;
    return true;
  }

  async function confirmar() {
    if (!user || !viagem || !veiculo) return;
    setSubmitting(true);
    try {
      const fotoHodoUrl = fotoHodo ? await uploadFile("checklists-fotos", `${user.id}/${veiculo.id}`, fotoHodo) : null;
      const sigPath = await uploadDataUrl("checklists-fotos", `${user.id}/${veiculo.id}/sig`, sigRef.current!.toDataURL());

      // checklist retorno
      await supabase.from("checklists").insert({
        veiculo_id: veiculo.id,
        motorista_id: user.id,
        tipo: "retorno",
        km_registrado: Number(kmChegada),
        ...checks,
        observacoes: obs || null,
        foto_hodometro_url: fotoHodoUrl,
        assinatura_url: sigPath,
        status: algumProblema ? "pendente_revisao" : "aprovado_auto",
      });

      // encerrar viagem
      await supabase.from("viagens").update({
        data_chegada: new Date().toISOString(),
        km_chegada: Number(kmChegada),
        km_percorrido: percorrido,
        observacoes: obs || null,
      }).eq("id", viagem.id);

      // veículo livre + km
      await supabase.from("veiculos").update({ status: "Ativo", km_atual: Number(kmChegada) }).eq("id", veiculo.id);

      // notificar gestores
      try {
        const { data: gestores } = await supabase.from("user_roles").select("user_id").eq("role", "gestor_frota");
        const msgs = (gestores ?? []).map((g: any) => ({
          para_id: g.user_id,
          titulo: algumProblema ? "⚠ Retorno com problemas" : "Jornada encerrada",
          mensagem: `${veiculo.placa} — ${percorrido.toLocaleString("pt-BR")} km percorridos`,
          tipo: algumProblema ? "warning" : "info",
          link: "/gestor/checklists",
        }));
        if (msgs.length) await supabase.from("notificacoes").insert(msgs);
      } catch { /* ignore */ }

      toast.success("Jornada encerrada!");
      refresh();
      navigate({ to: "/motorista" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao encerrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/motorista"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Passo {step} de {totalSteps}</p>
          <h1 className="font-semibold">Encerrar Jornada — <span className="font-mono">{veiculo.placa}</span></h1>
        </div>
      </div>
      <Progress value={(step / totalSteps) * 100} />

      {step === 1 && (
        <Card className="p-4 space-y-4">
          <h2 className="font-medium">KM Final</h2>
          <div className="space-y-2">
            <Label htmlFor="km">KM de chegada</Label>
            <Input
              id="km" type="number" inputMode="numeric"
              value={kmChegada} onChange={(e) => setKmChegada(e.target.value)}
              placeholder={String(kmSaida)}
              className="text-3xl h-16 font-bold tracking-wider"
            />
            <p className="text-xs text-muted-foreground">KM de saída: {kmSaida.toLocaleString("pt-BR")} km</p>
            {kmChegada && !kmValido && <p className="text-xs text-destructive">KM precisa ser maior que {kmSaida}</p>}
          </div>

          {kmValido && (
            <Card className="p-4 bg-accent/10 border-accent/40 text-center">
              <p className="text-xs uppercase tracking-wider text-accent">KM percorridos</p>
              <p className="text-3xl font-bold">{percorrido.toLocaleString("pt-BR")} km</p>
            </Card>
          )}

          <div>
            <Label className="mb-2 block">Foto do hodômetro final</Label>
            <CameraInput label="Hodômetro final" required onChange={setFotoHodo} />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Checklist de Retorno</h2>
          <div className="space-y-2">
            {CHECK_ITEMS.map((it) => {
              const v = checks[it.key];
              return (
                <label key={it.key} className={`flex items-center gap-3 p-3 rounded-md border-2 cursor-pointer ${v ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`} style={{ minHeight: 64 }}>
                  {v ? <CheckCircle2 className="w-5 h-5 text-success" /> : <CircleAlert className="w-5 h-5 text-destructive" />}
                  <span className="flex-1 text-sm font-medium">{it.label}</span>
                  <Switch checked={v} onCheckedChange={(c) => setChecks((p) => ({ ...p, [it.key]: c }))} />
                </label>
              );
            })}
          </div>
          {algumProblema && (
            <div className="bg-warning/15 border border-warning/40 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
              <p className="text-xs">Itens marcados como problema serão reportados ao gestor.</p>
            </div>
          )}
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Como foi a viagem?" />
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Resumo e assinatura</h2>
          <div className="space-y-1 text-sm bg-secondary/40 rounded-md p-3">
            <Linha label="Veículo" valor={`${veiculo.placa} — ${veiculo.modelo}`} />
            <Linha label="KM percorridos" valor={`${percorrido.toLocaleString("pt-BR")} km`} />
            <Linha label="Itens OK" valor={`${Object.values(checks).filter(Boolean).length} de ${CHECK_ITEMS.length}`} />
          </div>
          <SignaturePad ref={sigRef} />
          <Button size="lg" className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={submitting} onClick={confirmar}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Flag className="w-4 h-4 mr-2" /> 🏁 Encerrar Jornada
          </Button>
        </Card>
      )}

      <div className="flex gap-2 sticky bottom-20 md:bottom-2">
        {step > 1 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        )}
        {step < totalSteps && (
          <Button className="flex-1" onClick={() => canAdvance() ? setStep((s) => s + 1) : toast.error("Preencha os campos obrigatórios")}>
            Avançar <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{valor}</span></div>;
}
