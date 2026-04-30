import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Fuel, Map, Wrench, Truck, Gauge, AlertTriangle, Calendar } from "lucide-react";

export const Route = createFileRoute("/motorista/")({
  head: () => ({
    meta: [
      { title: "Meu Veículo — Lobo Marley" },
      { name: "description", content: "Painel do motorista — checklist, abastecimento e viagens." },
    ],
  }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <MotoristaDashboard />
      </AppShell>
    </ProtectedRoute>
  ),
});

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  cor: string | null;
  km_atual: number;
  status: string;
  foto_principal_url: string | null;
  vencimento_licenciamento: string | null;
  vencimento_ipva: string | null;
  km_proxima_revisao: number | null;
}

function MotoristaDashboard() {
  const { user } = useAuth();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklistHoje, setChecklistHoje] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: v } = await supabase
        .from("veiculos")
        .select("*")
        .eq("motorista_id", user.id)
        .maybeSingle();
      setVeiculo(v as any);

      if (v) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("checklists")
          .select("id", { count: "exact", head: true })
          .eq("veiculo_id", v.id)
          .eq("motorista_id", user.id)
          .gte("data_hora", hoje.toISOString());
        setChecklistHoje((count ?? 0) > 0);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!veiculo) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center space-y-3">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum veículo vinculado</h2>
          <p className="text-sm text-muted-foreground">
            Aguarde o gestor de frota vincular um veículo a você.
          </p>
        </Card>
      </div>
    );
  }

  const alertas = computarAlertas(veiculo);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <header>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Meu veículo</p>
        <h1 className="text-2xl font-bold">{veiculo.modelo}</h1>
      </header>

      {/* Card do veículo */}
      <Card className="overflow-hidden">
        <div
          className="h-32 bg-cover bg-center bg-secondary flex items-end p-4"
          style={
            veiculo.foto_principal_url
              ? { backgroundImage: `url(${veiculo.foto_principal_url})` }
              : { background: "var(--gradient-primary)" }
          }
        >
          <div className="bg-background/85 backdrop-blur px-3 py-1.5 rounded-md">
            <span className="font-mono font-bold tracking-wider">{veiculo.placa}</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{veiculo.marca} • {veiculo.modelo}</p>
              {veiculo.cor && <p className="text-xs text-muted-foreground">{veiculo.cor}</p>}
            </div>
            <Badge variant={veiculo.status === "Ativo" ? "default" : "secondary"}>
              {veiculo.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Gauge className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Hodômetro:</span>
            <span className="font-semibold">{veiculo.km_atual.toLocaleString("pt-BR")} km</span>
          </div>
        </div>
      </Card>

      {/* Status do checklist de hoje */}
      <Card className={`p-4 flex items-center gap-3 ${checklistHoje ? "border-success/40" : "border-warning/40"}`}>
        <ClipboardCheck className={`w-6 h-6 ${checklistHoje ? "text-success" : "text-warning"}`} />
        <div className="flex-1">
          <p className="font-medium text-sm">
            {checklistHoje ? "Checklist de hoje feito ✓" : "Checklist de hoje pendente"}
          </p>
          <p className="text-xs text-muted-foreground">
            {checklistHoje ? "Bom trabalho!" : "Faça antes de iniciar o uso do veículo"}
          </p>
        </div>
        {!checklistHoje && (
          <Button asChild size="sm" variant="default">
            <Link to="/motorista/checklist">Fazer</Link>
          </Button>
        )}
      </Card>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card className="p-4 space-y-2 border-warning/40 bg-warning/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <p className="font-medium text-sm">Atenção</p>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {alertas.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Ações grandes */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard to="/motorista/checklist" icon={ClipboardCheck} label="Checklist" tone="primary" />
        <ActionCard to="/motorista/viagem" icon={Map} label="Viagem" tone="accent" />
        <ActionCard to="/motorista/abastecimento" icon={Fuel} label="Abastecer" tone="success" />
        <ActionCard to="/motorista/solicitar" icon={Wrench} label="Manutenção" tone="warning" />
      </div>
    </div>
  );
}

function ActionCard({
  to, icon: Icon, label, tone,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "primary" | "accent" | "success" | "warning";
}) {
  const toneClass = {
    primary: "from-primary to-[var(--primary-glow)] text-primary-foreground",
    accent: "from-accent to-accent text-accent-foreground",
    success: "from-success to-success text-success-foreground",
    warning: "from-warning to-warning text-warning-foreground",
  }[tone];

  return (
    <Link
      to={to}
      className={`bg-gradient-to-br ${toneClass} rounded-xl p-5 flex flex-col gap-3 active:scale-[0.98] transition-transform shadow-[var(--shadow-card)] min-h-[110px]`}
    >
      <Icon className="w-7 h-7" />
      <span className="font-semibold text-base">{label}</span>
    </Link>
  );
}

function computarAlertas(v: Veiculo): string[] {
  const out: string[] = [];
  const hoje = new Date();
  const em30 = new Date(); em30.setDate(em30.getDate() + 30);

  if (v.vencimento_licenciamento) {
    const d = new Date(v.vencimento_licenciamento);
    if (d <= em30) out.push(`Licenciamento vence em ${d.toLocaleDateString("pt-BR")}`);
  }
  if (v.vencimento_ipva) {
    const d = new Date(v.vencimento_ipva);
    if (d <= em30) out.push(`IPVA vence em ${d.toLocaleDateString("pt-BR")}`);
  }
  if (v.km_proxima_revisao && v.km_atual >= v.km_proxima_revisao - 500) {
    out.push(`Revisão prevista em ${v.km_proxima_revisao.toLocaleString("pt-BR")} km`);
  }
  return out;
}
