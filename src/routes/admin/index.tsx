import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Truck, Wrench, AlertTriangle, DollarSign } from "lucide-react";
import { AlertasVencimento } from "@/components/veiculos/AlertasVencimento";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <AdminDashboard />
      </AppShell>
    </ProtectedRoute>
  ),
});

function AdminDashboard() {
  const [stats, setStats] = useState({ veiculos: 0, manutencoes: 0, custoMes: 0, alertas: 0, vencimentos: 0 });

  useEffect(() => {
    (async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const limite = new Date();
      limite.setDate(limite.getDate() + 30);
      const limiteStr = limite.toISOString().slice(0, 10);

      const [v, m, ab, mn, ds, alertasFin, venc] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Ativo"),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Em Manutenção"),
        supabase.from("abastecimentos").select("valor_total").gte("data_hora", inicioMes.toISOString()),
        supabase.from("manutencoes").select("valor_final").gte("criado_em", inicioMes.toISOString()),
        supabase.from("despesas").select("valor").gte("data_despesa", inicioMes.toISOString().slice(0, 10)),
        supabase.from("manutencoes").select("id", { count: "exact", head: true }).in("status_financeiro", ["alerta", "prejuizo"]),
        supabase.from("veiculos").select("id", { count: "exact", head: true })
          .or(`vencimento_licenciamento.lte.${limiteStr},vencimento_ipva.lte.${limiteStr},vencimento_seguro.lte.${limiteStr}`),
      ]);

      const custo =
        (ab.data?.reduce((s, r: any) => s + Number(r.valor_total || 0), 0) ?? 0) +
        (mn.data?.reduce((s, r: any) => s + Number(r.valor_final || 0), 0) ?? 0) +
        (ds.data?.reduce((s, r: any) => s + Number(r.valor || 0), 0) ?? 0);

      setStats({
        veiculos: v.count ?? 0,
        manutencoes: m.count ?? 0,
        custoMes: custo,
        alertas: alertasFin.count ?? 0,
        vencimentos: venc.count ?? 0,
      });
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Visão geral da frota</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Veículos ativos" value={stats.veiculos} icon={Truck} tone="primary" />
        <Stat label="Em manutenção" value={stats.manutencoes} icon={Wrench} tone="warning" />
        <Stat
          label="Custo do mês"
          value={stats.custoMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          icon={DollarSign}
          tone="success"
        />
        <Stat label="OS em alerta/prejuízo" value={stats.alertas} icon={AlertTriangle} tone="destructive" />
        <Stat label="Docs vencendo (30d)" value={stats.vencimentos} icon={AlertTriangle} tone="warning" />
      </div>

      <AlertasVencimento />

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Use o menu lateral para acessar Clientes, Financeiro, Configurações e Relatórios.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: string }) {
  const toneClass: Record<string, string> = {
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <Icon className={`w-4 h-4 ${toneClass[tone]}`} />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </Card>
  );
}
