import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Wrench, AlertCircle } from "lucide-react";

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
  const [stats, setStats] = useState({ total: 0, ativos: 0, manutencao: 0, solicitacoes: 0 });

  useEffect(() => {
    (async () => {
      const [t, a, m, s] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact", head: true }),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Ativo"),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "Em Manutenção"),
        supabase.from("solicitacoes").select("id", { count: "exact", head: true }).eq("status", "Aberta"),
      ]);
      setStats({
        total: t.count ?? 0,
        ativos: a.count ?? 0,
        manutencao: m.count ?? 0,
        solicitacoes: s.count ?? 0,
      });
    })();
  }, []);

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Mini label="Total" value={stats.total} icon={Truck} />
        <Mini label="Ativos" value={stats.ativos} icon={Truck} tone="success" />
        <Mini label="Em manutenção" value={stats.manutencao} icon={Wrench} tone="warning" />
        <Mini label="Solicitações abertas" value={stats.solicitacoes} icon={AlertCircle} tone="destructive" />
      </div>

      <Card className="p-6 text-center">
        <Truck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">Cadastro completo de veículos em breve</h3>
        <p className="text-sm text-muted-foreground">
          Listagem com fotos, vinculação de motoristas e gestão de manutenções na próxima iteração.
        </p>
      </Card>
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
