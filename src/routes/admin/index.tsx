import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Truck, Wrench, AlertTriangle, DollarSign } from "lucide-react";

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
  const [stats, setStats] = useState({ veiculos: 0, manutencoes: 0, custoMes: 0, alertas: 0 });

  useEffect(() => {
    (async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [v, m, ab, mn, ds] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Ativo"),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Em Manutenção"),
        supabase.from("abastecimentos").select("valor_total").gte("data_hora", inicioMes.toISOString()),
        supabase.from("manutencoes").select("valor_final").gte("criado_em", inicioMes.toISOString()),
        supabase.from("despesas").select("valor").gte("data_despesa", inicioMes.toISOString().slice(0, 10)),
      ]);

      const custo =
        (ab.data?.reduce((s, r: any) => s + Number(r.valor_total || 0), 0) ?? 0) +
        (mn.data?.reduce((s, r: any) => s + Number(r.valor_final || 0), 0) ?? 0) +
        (ds.data?.reduce((s, r: any) => s + Number(r.valor || 0), 0) ?? 0);

      setStats({
        veiculos: v.count ?? 0,
        manutencoes: m.count ?? 0,
        custoMes: custo,
        alertas: 0,
      });
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Visão geral da frota</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Veículos ativos" value={stats.veiculos} icon={Truck} tone="primary" />
        <Stat label="Em manutenção" value={stats.manutencoes} icon={Wrench} tone="warning" />
        <Stat
          label="Custo do mês"
          value={stats.custoMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          icon={DollarSign}
          tone="success"
        />
        <Stat label="Alertas" value={stats.alertas} icon={AlertTriangle} tone="destructive" />
      </div>

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Relatórios detalhados, gráficos e gestão financeira serão implementados nas próximas iterações.
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
