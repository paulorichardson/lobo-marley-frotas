import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useJornadaAtiva } from "@/hooks/useJornada";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, ClipboardCheck, Fuel, Camera, Wrench, Map, History,
  Truck, Gauge, PlayCircle, StopCircle, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { StorageImage } from "@/components/veiculos/StorageImage";

export const Route = createFileRoute("/motorista/")({
  head: () => ({
    meta: [
      { title: "Meu Painel — Lobo Marley" },
      { name: "description", content: "Painel do motorista — jornada, checklist, abastecimento." },
    ],
  }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <MotoristaHome />
      </AppShell>
    </ProtectedRoute>
  ),
});

function MotoristaHome() {
  const { user } = useAuth();
  const { viagem, veiculo, loading } = useJornadaAtiva();
  const { naoLidas } = useNotificacoes();
  const [nome, setNome] = useState<string>("");
  const [osPendentes, setOsPendentes] = useState<any[]>([]);

  async function carregarOs() {
    if (!user) return;
    const { data } = await supabase
      .from("manutencoes")
      .select("id, numero_os, codigo_autorizacao, descricao, status, confirmada_pelo_solicitante")
      .eq("solicitado_por", user.id)
      .eq("status", "Concluída")
      .eq("confirmada_pelo_solicitante", false)
      .order("data_conclusao", { ascending: false });
    setOsPendentes(data ?? []);
  }

  async function confirmarResolvido(osId: string) {
    const { error } = await supabase
      .from("manutencoes")
      .update({ confirmada_pelo_solicitante: true })
      .eq("id", osId);
    if (error) return toast.error(error.message);
    toast.success("Obrigado pela confirmação!");
    carregarOs();
  }

  async function reabrirProblema(osId: string) {
    const { error } = await supabase
      .from("manutencoes")
      .update({
        status: "Em Andamento",
        observacoes: "Motorista reportou que o problema persiste",
      })
      .eq("id", osId);
    if (error) return toast.error(error.message);
    toast.success("Avisamos o gestor — o veículo voltará para revisão");
    carregarOs();
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle()
      .then(({ data }) => setNome((data as any)?.nome ?? user.email?.split("@")[0] ?? ""));
    carregarOs();
  }, [user]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  const inicioFmt = viagem ? new Date(viagem.data_saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Olá,</p>
          <p className="text-lg font-semibold">{nome || "Motorista"}</p>
        </div>
        <Link to="/motorista/notificacoes" className="relative">
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Link>
      </header>

      {/* Card de jornada */}
      {viagem && veiculo ? (
        <Card className="overflow-hidden border-success/40">
          <div className="bg-success/15 px-4 py-2 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-success" />
            <span className="text-xs font-semibold text-success uppercase tracking-wider">Jornada em andamento</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-md bg-secondary overflow-hidden shrink-0">
                {veiculo.foto_principal_url ? (
                  <StorageImage bucket="veiculos-fotos" path={veiculo.foto_principal_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Truck className="w-7 h-7 text-muted-foreground" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-base">{veiculo.placa}</p>
                <p className="text-sm text-muted-foreground truncate">{veiculo.marca} {veiculo.modelo}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {Number(viagem.km_saida ?? veiculo.km_atual).toLocaleString("pt-BR")} km</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {inicioFmt}</span>
                </div>
              </div>
            </div>
            <Button asChild size="lg" className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <Link to="/motorista/encerrar-jornada">
                <StopCircle className="w-5 h-5 mr-2" /> 🏁 Encerrar Jornada
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-center space-y-4 bg-secondary/40">
          <div>
            <Truck className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-2 font-medium">Nenhuma jornada ativa</p>
            <p className="text-xs text-muted-foreground">Selecione um veículo para começar</p>
          </div>
          <Button asChild size="lg" className="w-full bg-success hover:bg-success/90 text-success-foreground">
            <Link to="/motorista/iniciar-jornada">
              <PlayCircle className="w-5 h-5 mr-2" /> 🚗 Iniciar Jornada
            </Link>
          </Button>
        </Card>
      )}

      {/* OS aguardando confirmação do motorista */}
      {osPendentes.map((os) => (
        <Card key={os.id} className="p-4 border-warning/40 bg-warning/5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {os.numero_os} {os.codigo_autorizacao && `· ${os.codigo_autorizacao}`}
              </p>
              <p className="font-semibold text-sm">Veículo resolvido?</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{os.descricao}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => reabrirProblema(os.id)}>
              Ainda tem problema
            </Button>
            <Button size="sm" className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => confirmarResolvido(os.id)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Sim, resolvido
            </Button>
          </div>
        </Card>
      ))}

      {/* Atalhos */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Atalhos</p>
        <div className="grid grid-cols-2 gap-3">
          <Atalho to="/motorista/checklist" icon={ClipboardCheck} label="Checklist" tone="primary" />
          <Atalho to="/motorista/abastecimento" icon={Fuel} label="Abastecer" tone="success" />
          <Atalho to="/motorista/foto" icon={Camera} label="Enviar Foto" tone="accent" />
          <Atalho to="/motorista/solicitar" icon={Wrench} label="Manutenção" tone="warning" />
          <Atalho to="/motorista/viagem" icon={Map} label="Viagens" tone="primary" />
          <Atalho to="/motorista/historico" icon={History} label="Histórico" tone="accent" />
        </div>
      </div>
    </div>
  );
}

function Atalho({
  to, icon: Icon, label, tone,
}: { to: string; icon: any; label: string; tone: "primary" | "accent" | "success" | "warning" }) {
  const cls = {
    primary: "from-primary to-[var(--primary-glow)] text-primary-foreground",
    accent: "from-accent to-accent text-accent-foreground",
    success: "from-success to-success text-success-foreground",
    warning: "from-warning to-warning text-warning-foreground",
  }[tone];
  return (
    <Link
      to={to}
      className={`bg-gradient-to-br ${cls} rounded-xl p-4 flex flex-col gap-2 active:scale-[0.97] transition-transform shadow-[var(--shadow-card)] min-h-[100px]`}
    >
      <Icon className="w-6 h-6" />
      <span className="font-semibold text-sm">{label}</span>
    </Link>
  );
}
