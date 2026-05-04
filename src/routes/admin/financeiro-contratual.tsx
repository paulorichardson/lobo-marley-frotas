import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { TrendingUp, AlertTriangle, DollarSign, Loader2, Crown } from "lucide-react";

export const Route = createFileRoute("/admin/financeiro-contratual")({
  head: () => ({ meta: [{ title: "Financeiro Contratual — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <Page />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Page() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ bruto: 0, liquido: 0, custo: 0, lucro: 0, margem: 0, prejuizo: 0 });
  const [os, setOs] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data: ms } = await supabase
      .from("manutencoes")
      .select("id, numero_os, empresa_id, status, status_financeiro, valor_bruto_pecas, valor_bruto_servicos, valor_liquido_faturavel, custo_fornecedor, lucro_bruto, margem_percentual, criado_em, fornecedor_id")
      .order("criado_em", { ascending: false })
      .limit(200);

    let bruto = 0, liquido = 0, custo = 0, lucro = 0, prejuizo = 0;
    (ms ?? []).forEach((m: any) => {
      bruto += Number(m.valor_bruto_pecas || 0) + Number(m.valor_bruto_servicos || 0);
      liquido += Number(m.valor_liquido_faturavel || 0);
      custo += Number(m.custo_fornecedor || 0);
      lucro += Number(m.lucro_bruto || 0);
      if (m.status_financeiro === "prejuizo") prejuizo += 1;
    });
    const margem = liquido > 0 ? (lucro / liquido) * 100 : 0;
    setKpi({ bruto, liquido, custo, lucro, margem, prejuizo });
    setOs(ms ?? []);

    const ids = Array.from(new Set((ms ?? []).map((m: any) => m.empresa_id).filter(Boolean)));
    if (ids.length) {
      const { data: emp } = await supabase.from("empresas").select("id, razao_social, nome_fantasia").in("id", ids);
      const map: Record<string, string> = {};
      (emp ?? []).forEach((e: any) => { map[e.id] = e.nome_fantasia || e.razao_social; });
      setEmpresas(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Crown className="w-7 h-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Motor financeiro contratual</h1>
          <p className="text-sm text-muted-foreground">Visão exclusiva do Admin Lobo Marley · margens, lucros e alertas</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI titulo="Faturado" valor={BRL(kpi.liquido)} icon={<DollarSign />} cor="text-primary" />
        <KPI titulo="Lucro bruto" valor={BRL(kpi.lucro)} icon={<TrendingUp />} cor={kpi.lucro >= 0 ? "text-emerald-500" : "text-rose-500"} />
        <KPI titulo="Margem média" valor={`${kpi.margem.toFixed(1)}%`} icon={<TrendingUp />} cor="text-accent" />
        <KPI titulo="OS em prejuízo" valor={String(kpi.prejuizo)} icon={<AlertTriangle />} cor="text-rose-500" />
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Últimas OS — visão financeira</h2>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {os.map((m) => {
                  const bruto = Number(m.valor_bruto_pecas || 0) + Number(m.valor_bruto_servicos || 0);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.numero_os ?? m.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{empresas[m.empresa_id] ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">{BRL(bruto)}</TableCell>
                      <TableCell className="text-right text-xs">{BRL(Number(m.valor_liquido_faturavel || 0))}</TableCell>
                      <TableCell className="text-right text-xs">{BRL(Number(m.custo_fornecedor || 0))}</TableCell>
                      <TableCell className={`text-right text-xs font-semibold ${Number(m.lucro_bruto || 0) < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                        {BRL(Number(m.lucro_bruto || 0))}
                      </TableCell>
                      <TableCell className="text-right text-xs">{Number(m.margem_percentual || 0).toFixed(1)}%</TableCell>
                      <TableCell>
                        <StatusBadge s={m.status_financeiro} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="text-center">
        <Button asChild variant="outline">
          <Link to="/admin/financeiro">Ir para faturamento de clientes</Link>
        </Button>
      </div>
    </div>
  );
}

function KPI({ titulo, valor, icon, cor }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase text-muted-foreground">{titulo}</p>
        <div className={cor}>{icon}</div>
      </div>
      <p className="text-xl md:text-2xl font-bold">{valor}</p>
    </Card>
  );
}

function StatusBadge({ s }: { s: string | null }) {
  const map: Record<string, { v: any; c: string; l: string }> = {
    lucrativa: { v: "default", c: "bg-emerald-500", l: "Lucrativa" },
    alerta: { v: "default", c: "bg-amber-500", l: "Alerta" },
    prejuizo: { v: "destructive", c: "", l: "Prejuízo" },
    faturada: { v: "default", c: "bg-blue-500", l: "Faturada" },
    pendente: { v: "secondary", c: "", l: "Pendente" },
  };
  const m = map[s ?? "pendente"] ?? map.pendente;
  return <Badge variant={m.v} className={m.c + " text-white"}>{m.l}</Badge>;
}
