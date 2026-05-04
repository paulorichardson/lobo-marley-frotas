import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Wrench, AlertCircle, FileSignature } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AlertasVencimento } from "@/components/veiculos/AlertasVencimento";

export const Route = createFileRoute("/gestor/")({
  head: () => ({ meta: [{ title: "Gestor de Frota — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <GestorDashboard />
      </AppShell>
    </ProtectedRoute>
  ),
});

function GestorDashboard() {
  const { empresaId } = useAuth();
  const [stats, setStats] = useState({ total: 0, ativos: 0, manutencao: 0, solicitacoes: 0, orcAprov: 0, urgentes: 0 });
  const [contrato, setContrato] = useState<{ valor_global: number; numero_contrato: string | null; data_fim: string | null } | null>(null);
  const [consumido, setConsumido] = useState(0);

  useEffect(() => {
    (async () => {
      const [t, a, m, s, o, u] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact", head: true }),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Ativo"),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Em Manutenção"),
        supabase.from("manutencoes").select("id", { count: "exact", head: true }).in("status", ["Solicitada", "Orçamento Enviado"]),
        supabase.from("manutencoes").select("id", { count: "exact", head: true }).eq("status", "Orçamento Enviado"),
        supabase.from("manutencoes").select("id", { count: "exact", head: true }).eq("prioridade", "Urgente").not("status", "in", "(Concluída,Recusada)"),
      ]);
      setStats({
        total: t.count ?? 0,
        ativos: a.count ?? 0,
        manutencao: m.count ?? 0,
        solicitacoes: s.count ?? 0,
        orcAprov: o.count ?? 0,
        urgentes: u.count ?? 0,
      });

      if (empresaId) {
        const { data: c } = await supabase
          .from("contratos_clientes")
          .select("valor_global, numero_contrato, data_fim")
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .maybeSingle();
        setContrato(c ? { ...c, valor_global: Number(c.valor_global ?? 0) } : null);

        // gestor vê só o valor faturado (não o lucro)
        const { data: ms } = await supabase
          .from("manutencoes")
          .select("valor_final")
          .eq("empresa_id", empresaId)
          .eq("status", "Concluída");
        setConsumido((ms ?? []).reduce((acc, r: any) => acc + Number(r.valor_final || 0), 0));
      }
    })();
  }, [empresaId]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Frota</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos veículos</p>
        </div>
        <Button asChild>
          <Link to="/gestor/veiculos">
            <Plus className="w-4 h-4 mr-2" /> Novo veículo
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Mini label="Total de veículos" value={stats.total} icon={Truck} />
        <Mini label="Ativos" value={stats.ativos} icon={Truck} tone="success" />
        <Mini label="Em manutenção" value={stats.manutencao} icon={Wrench} tone="warning" />
        <Mini label="Solicitações abertas" value={stats.solicitacoes} icon={AlertCircle} />
        <Link to="/gestor/manutencoes" className="contents">
          <Mini label="🟠 Orçamentos aguardando aprovação" value={stats.orcAprov} icon={Wrench} tone="warning" />
        </Link>
        <Link to="/gestor/manutencoes" className="contents">
          <Mini label="🔴 Urgentes" value={stats.urgentes} icon={AlertCircle} tone="destructive" />
        </Link>
      </div>

      <AlertasVencimento />

      {contrato && contrato.valor_global > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSignature className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">
              Saldo do contrato {contrato.numero_contrato ? `· ${contrato.numero_contrato}` : ""}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Valor global</p>
              <p className="font-bold">R$ {contrato.valor_global.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumido</p>
              <p className="font-bold">R$ {consumido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`font-bold ${contrato.valor_global - consumido < 0 ? "text-destructive" : "text-success"}`}>
                R$ {(contrato.valor_global - consumido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, (consumido / contrato.valor_global) * 100)}%` }}
            />
          </div>
          {contrato.data_fim && (
            <p className="text-xs text-muted-foreground text-right mt-2">
              Vigência até {new Date(contrato.data_fim).toLocaleDateString("pt-BR")}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone?: string }) {
  const toneClass: Record<string, string> = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <Icon className={`w-4 h-4 ${tone ? toneClass[tone] : "text-primary"}`} />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </Card>
  );
}
