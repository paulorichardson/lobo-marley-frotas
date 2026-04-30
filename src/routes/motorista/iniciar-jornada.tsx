import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Search, Truck, AlertTriangle, Loader2, Check,
  CircleAlert, CheckCircle2,
} from "lucide-react";
import { CameraInput } from "@/components/CameraInput";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { StorageImage } from "@/components/veiculos/StorageImage";
import { uploadFile, uploadDataUrl } from "@/lib/upload";
import { toast } from "sonner";

export const Route = createFileRoute("/motorista/iniciar-jornada")({
  head: () => ({ meta: [{ title: "Iniciar Jornada — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <IniciarJornada />
      </AppShell>
    </ProtectedRoute>
  ),
});

interface VeiculoLite {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  km_atual: number;
  status: string;
  foto_principal_url: string | null;
}

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

const FOTO_TIPOS = [
  { key: "frontal", label: "Frontal", required: true },
  { key: "traseira", label: "Traseira", required: false },
  { key: "lateral_esq", label: "Lateral Esq.", required: false },
  { key: "lateral_dir", label: "Lateral Dir.", required: false },
  { key: "interior", label: "Interior", required: false },
  { key: "danos", label: "Danos", required: false },
] as const;

function IniciarJornada() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 1
  const [veiculos, setVeiculos] = useState<VeiculoLite[]>([]);
  const [busca, setBusca] = useState("");
  const [veiculoSel, setVeiculoSel] = useState<VeiculoLite | null>(null);

  // Step 2
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    pneus_ok: true, freios_ok: true, luzes_ok: true, agua_ok: true,
    oleo_ok: true, combustivel_ok: true, documentos_ok: true, lataria_ok: true,
  });

  // Step 3
  const [kmAtual, setKmAtual] = useState("");
  const [fotoHodometro, setFotoHodometro] = useState<File | null>(null);

  // Step 4
  const [fotos, setFotos] = useState<Record<string, File | null>>({});
  const [observacoesVeiculo, setObservacoesVeiculo] = useState("");

  // Step 5
  const sigRef = useRef<SignaturePadHandle>(null);

  const [submitting, setSubmitting] = useState(false);

  // Carregar veículos disponíveis (motorista só vê o seu via RLS,
  // mas o gestor pode ter vinculado vários, ou o motorista pode ter sido vinculado a um único)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("veiculos")
      .select("id,placa,modelo,marca,km_atual,status,foto_principal_url")
      .eq("motorista_id", user.id)
      .order("placa")
      .then(({ data }) => setVeiculos((data ?? []) as any));
  }, [user]);

  // verificar se já existe jornada ativa
  useEffect(() => {
    if (!user) return;
    supabase.from("viagens").select("id").eq("motorista_id", user.id).is("data_chegada", null)
      .then(({ data }) => {
        if (data && data.length > 0) {
          toast.message("Você já tem uma jornada ativa");
          navigate({ to: "/motorista" });
        }
      });
  }, [user, navigate]);

  const veiculosFiltrados = veiculos.filter((v) =>
    !busca || v.placa.toLowerCase().includes(busca.toLowerCase()) || v.modelo.toLowerCase().includes(busca.toLowerCase())
  );

  const algumProblema = Object.values(checks).some((v) => !v);
  const kmValido = veiculoSel ? Number(kmAtual) >= Number(veiculoSel.km_atual) : false;

  function canAdvance(): boolean {
    if (step === 1) return !!veiculoSel;
    if (step === 2) return true;
    if (step === 3) return kmValido && !!fotoHodometro && Number(kmAtual) > 0;
    if (step === 4) return !!fotos["frontal"];
    if (step === 5) return sigRef.current ? !sigRef.current.isEmpty() : false;
    return true;
  }

  async function confirmar() {
    if (!user || !veiculoSel) return;
    setSubmitting(true);
    try {
      // 1. upload foto hodometro
      let fotoHodoUrl: string | null = null;
      if (fotoHodometro) fotoHodoUrl = await uploadFile("checklists-fotos", `${user.id}/${veiculoSel.id}`, fotoHodometro);

      // 2. upload assinatura
      const sigData = sigRef.current!.toDataURL();
      const sigPath = await uploadDataUrl("checklists-fotos", `${user.id}/${veiculoSel.id}/sig`, sigData);

      // 3. insert checklist
      const { data: checkData, error: checkErr } = await supabase
        .from("checklists")
        .insert({
          veiculo_id: veiculoSel.id,
          motorista_id: user.id,
          tipo: "saida",
          km_registrado: Number(kmAtual),
          ...checks,
          observacoes: observacoesVeiculo || null,
          foto_hodometro_url: fotoHodoUrl,
          assinatura_url: sigPath,
          status: algumProblema ? "pendente_revisao" : "aprovado_auto",
        })
        .select("id")
        .single();
      if (checkErr) throw checkErr;

      // 4. upload fotos do veículo
      for (const tipo of FOTO_TIPOS) {
        const f = fotos[tipo.key];
        if (!f) continue;
        const path = await uploadFile("veiculos-fotos", `${veiculoSel.id}/checklist`, f);
        await supabase.from("veiculo_fotos").insert({
          veiculo_id: veiculoSel.id,
          url: path,
          tipo: tipo.key,
          legenda: `Checklist saída — ${tipo.label}`,
          enviado_por: user.id,
        });
      }

      // 5. abrir viagem
      const { error: vErr } = await supabase.from("viagens").insert({
        veiculo_id: veiculoSel.id,
        motorista_id: user.id,
        km_saida: Number(kmAtual),
        data_saida: new Date().toISOString(),
      });
      if (vErr) throw vErr;

      // 6. atualizar status do veículo
      await supabase.from("veiculos").update({ status: "Em Uso" }).eq("id", veiculoSel.id);

      // 7. notificar gestores (best-effort)
      try {
        const { data: gestores } = await supabase
          .from("user_roles").select("user_id").eq("role", "gestor_frota");
        const msgs = (gestores ?? []).map((g: any) => ({
          para_id: g.user_id,
          titulo: algumProblema ? "⚠ Checklist com problemas" : "Jornada iniciada",
          mensagem: `${veiculoSel.placa} — ${algumProblema ? "itens reportados" : "saída ok"}`,
          tipo: algumProblema ? "warning" : "info",
          link: `/gestor/checklists`,
        }));
        if (msgs.length) await supabase.from("notificacoes").insert(msgs);
      } catch { /* ignore */ }

      toast.success("Jornada iniciada!");
      navigate({ to: "/motorista" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao iniciar jornada");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/motorista"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Passo {step} de {totalSteps}</p>
          <h1 className="font-semibold">Iniciar Jornada</h1>
        </div>
      </div>
      <Progress value={(step / totalSteps) * 100} />

      {step === 1 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Selecionar veículo</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por placa ou modelo" className="pl-9" />
          </div>
          {veiculosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum veículo vinculado a você. Aguarde o gestor.</p>
          ) : (
            <div className="space-y-2">
              {veiculosFiltrados.map((v) => {
                const sel = veiculoSel?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVeiculoSel(v)}
                    className={`w-full flex gap-3 p-3 rounded-md border-2 transition text-left ${sel ? "border-accent bg-accent/10" : "border-border bg-secondary/40"}`}
                  >
                    <div className="w-16 h-16 rounded bg-secondary overflow-hidden shrink-0">
                      {v.foto_principal_url
                        ? <StorageImage bucket="veiculos-fotos" path={v.foto_principal_url} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center"><Truck className="w-6 h-6 text-muted-foreground" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold">{v.placa}</p>
                      <p className="text-sm text-muted-foreground truncate">{v.marca} {v.modelo}</p>
                      <p className="text-xs text-muted-foreground">{v.km_atual.toLocaleString("pt-BR")} km</p>
                    </div>
                    {sel && <Check className="w-5 h-5 text-accent self-center" />}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {step === 2 && veiculoSel && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Checklist de Saída — <span className="font-mono">{veiculoSel.placa}</span></h2>
          <div className="space-y-2">
            {CHECK_ITEMS.map((it) => {
              const v = checks[it.key];
              return (
                <label
                  key={it.key}
                  className={`flex items-center gap-3 p-3 rounded-md border-2 cursor-pointer ${v ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}
                  style={{ minHeight: 64 }}
                >
                  {v ? <CheckCircle2 className="w-5 h-5 text-success" /> : <CircleAlert className="w-5 h-5 text-destructive" />}
                  <span className="flex-1 text-sm font-medium">{it.label}</span>
                  <Switch checked={v} onCheckedChange={(c) => setChecks((p) => ({ ...p, [it.key]: c }))} />
                </label>
              );
            })}
          </div>
          {algumProblema && (
            <div className="bg-warning/15 border border-warning/40 rounded-md p-3 flex items-start gap-2 text-warning-foreground">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
              <p className="text-xs">⚠ Problemas serão reportados ao gestor.</p>
            </div>
          )}
        </Card>
      )}

      {step === 3 && veiculoSel && (
        <Card className="p-4 space-y-4">
          <h2 className="font-medium">KM e Hodômetro</h2>
          <div className="space-y-2">
            <Label htmlFor="km">KM atual</Label>
            <Input
              id="km" type="number" inputMode="numeric"
              value={kmAtual} onChange={(e) => setKmAtual(e.target.value)}
              placeholder={String(veiculoSel.km_atual)}
              className="text-3xl h-16 font-bold tracking-wider"
            />
            <p className="text-xs text-muted-foreground">Último registrado: {veiculoSel.km_atual.toLocaleString("pt-BR")} km</p>
            {kmAtual && !kmValido && (
              <p className="text-xs text-destructive">KM precisa ser ≥ {veiculoSel.km_atual}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Foto do hodômetro</Label>
            <CameraInput label="Hodômetro" required onChange={setFotoHodometro} />
          </div>
        </Card>
      )}

      {step === 4 && veiculoSel && (
        <Card className="p-4 space-y-4">
          <h2 className="font-medium">Estado do veículo</h2>
          <p className="text-xs text-muted-foreground">Frontal é obrigatória. As demais ajudam a documentar o estado atual.</p>
          <div className="grid grid-cols-2 gap-3">
            {FOTO_TIPOS.map((t) => (
              <CameraInput
                key={t.key}
                label={t.label}
                required={t.required}
                onChange={(f) => setFotos((p) => ({ ...p, [t.key]: f }))}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações sobre o veículo</Label>
            <Textarea id="obs" value={observacoesVeiculo} onChange={(e) => setObservacoesVeiculo(e.target.value)} placeholder="Riscos, amassados, ruídos..." rows={3} />
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Assinatura</h2>
          <p className="text-xs text-muted-foreground">Declaro que o veículo foi vistoriado conforme itens acima.</p>
          <SignaturePad ref={sigRef} />
        </Card>
      )}

      {step === 6 && veiculoSel && (
        <Card className="p-4 space-y-4">
          <h2 className="font-medium">Confirmação</h2>
          <div className="space-y-2 text-sm">
            <Linha label="Veículo" valor={`${veiculoSel.placa} — ${veiculoSel.modelo}`} />
            <Linha label="KM" valor={`${Number(kmAtual).toLocaleString("pt-BR")} km`} />
            <Linha label="Itens OK" valor={`${Object.values(checks).filter(Boolean).length} de ${CHECK_ITEMS.length}`} />
            <Linha label="Itens com problema" valor={String(Object.values(checks).filter((v) => !v).length)} />
            <Linha label="Fotos enviadas" valor={String(Object.values(fotos).filter(Boolean).length)} />
          </div>
          {algumProblema && (
            <div className="bg-warning/15 border border-warning/40 rounded-md p-3 text-xs">
              ⚠ Este checklist tem itens marcados como problema. O gestor será notificado.
            </div>
          )}
          <Button
            type="button" size="lg" className="w-full bg-success hover:bg-success/90 text-success-foreground"
            disabled={submitting} onClick={confirmar}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            ✅ Confirmar saída
          </Button>
        </Card>
      )}

      {/* Botões nav */}
      <div className="flex gap-2 sticky bottom-20 md:bottom-2">
        {step > 1 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        )}
        {step < totalSteps && (
          <Button className="flex-1" onClick={() => canAdvance() ? setStep((s) => s + 1) : toast.error("Preencha os campos obrigatórios")} disabled={submitting}>
            Avançar <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
