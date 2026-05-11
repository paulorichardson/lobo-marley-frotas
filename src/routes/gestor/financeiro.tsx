import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { exportarXLSX } from "@/lib/export-xlsx";
import { Download, Printer, TrendingUp, Wrench, Fuel, Truck } from "lucide-react";

export const Route = createFileRoute("/gestor/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["gestor_frota", "admin"]}>
      <AppShell>
        <FinanceiroGestor />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroGestor() {
  const hoje = new Date();
  const [mes, setMes] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`,
  );
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [manut, setManut] = useState<any[]>([]);
  const [abast, setAbast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ano, m] = mes.split("-").map(Number);
      const ini = new Date(ano, m - 1, 1).toISOString();
      const fim = new Date(ano, m, 0, 23, 59, 59).toISOString();

      const [v, ma, ab] = await Promise.all([
        supabase.from("veiculos").select("id, placa, modelo, marca, setor, km_atual"),
        supabase
          .from("manutencoes")
          .select("veiculo_id, valor_final, valor_previsto, criado_em")
          .gte("criado_em", ini)
          .lte("criado_em", fim),
        supabase
          .from("abastecimentos")
          .select("veiculo_id, valor_total, litros, km_atual, data_hora")
          .gte("data_hora", ini)
          .lte("data_hora", fim),
      ]);
      setVeiculos(v.data ?? []);
      setManut(ma.data ?? []);
      setAbast(ab.data ?? []);
      setLoading(false);
    })();
  }, [mes]);

  const { totalManut, totalAbast, totalLitros, ranking, porSetor } = useMemo(() => {
    const veicMap: Record<string, any> = {};
    veiculos.forEach((v) => (veicMap[v.id] = v));

    let tm = 0,
      ta = 0,
      tl = 0;
    const acc: Record<
      string,
      { veiculo: any; manut: number; abast: number; litros: number; total: number }
    > = {};

    manut.forEach((mm) => {
      const valor = Number(mm.valor_final || mm.valor_previsto || 0);
      tm += valor;
      const v = veicMap[mm.veiculo_id];
      if (!v) return;
      const g = (acc[v.id] ??= { veiculo: v, manut: 0, abast: 0, litros: 0, total: 0 });
      g.manut += valor;
      g.total += valor;
    });
    abast.forEach((a) => {
      const valor = Number(a.valor_total || 0);
      const lit = Number(a.litros || 0);
      ta += valor;
      tl += lit;
      const v = veicMap[a.veiculo_id];
      if (!v) return;
      const g = (acc[v.id] ??= { veiculo: v, manut: 0, abast: 0, litros: 0, total: 0 });
      g.abast += valor;
      g.litros += lit;
      g.total += valor;
    });

    const rk = Object.values(acc).sort((a, b) => b.total - a.total);

    const set: Record<string, { setor: string; total: number; veic: number }> = {};
    rk.forEach((g) => {
      const s = g.veiculo.setor || "Sem setor";
      const ss = (set[s] ??= { setor: s, total: 0, veic: 0 });
      ss.total += g.total;
      ss.veic++;
    });

    return {
      totalManut: tm,
      totalAbast: ta,
      totalLitros: tl,
      ranking: rk,
      porSetor: Object.values(set).sort((a, b) => b.total - a.total),
    };
  }, [veiculos, manut, abast]);

  const top5 = ranking.slice(0, 5);
  const totalGeral = totalManut + totalAbast;
  const maxSetor = Math.max(1, ...porSetor.map((s) => s.total));

  function exportar() {
    exportarXLSX(
      ranking.map((g) => ({
        Placa: g.veiculo.placa,
        Veiculo: `${g.veiculo.marca} ${g.veiculo.modelo}`,
        Setor: g.veiculo.setor || "-",
        Manutencao: g.manut,
        Combustivel: g.abast,
        Litros: g.litros,
        Total: g.total,
      })),
      "Financeiro",
      `lobomarley_financeiro_gestor_${mes}`,
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4 print:p-2">
      <header className="flex flex-wrap items-end gap-3 justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Custos consolidados, ranking por veículo e setor
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">Período</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
          <Button onClick={exportar} disabled={!ranking.length}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </header>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icon={TrendingUp} label="Total do mês" value={BRL(totalGeral)} accent />
            <KPI icon={Wrench} label="Manutenção" value={BRL(totalManut)} />
            <KPI icon={Fuel} label="Combustível" value={BRL(totalAbast)} sub={`${totalLitros.toFixed(0)} L`} />
            <KPI icon={Truck} label="Veículos com gasto" value={ranking.length.toString()} />
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">🏆 Top 5 veículos com maior gasto</h3>
            {top5.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="space-y-2">
                {top5.map((g, i) => {
                  const pct = (g.total / (top5[0]?.total || 1)) * 100;
                  return (
                    <div key={g.veiculo.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {i + 1}. {g.veiculo.placa} — {g.veiculo.marca} {g.veiculo.modelo}
                        </span>
                        <span className="font-bold">{BRL(g.total)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded">
                        <div
                          className="h-full bg-primary rounded"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Manutenção {BRL(g.manut)} · Combustível {BRL(g.abast)} ({g.litros.toFixed(0)}L)
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">🏛️ Gasto por setor</h3>
            {porSetor.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="space-y-2">
                {porSetor.map((s) => (
                  <div key={s.setor} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {s.setor} <span className="text-muted-foreground">({s.veic} veíc.)</span>
                      </span>
                      <span className="font-bold">{BRL(s.total)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded">
                      <div
                        className="h-full bg-accent rounded"
                        style={{ width: `${(s.total / maxSetor) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Detalhamento por veículo</h3>
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3">Placa</th>
                      <th className="text-left py-2 pr-3">Veículo</th>
                      <th className="text-left py-2 pr-3">Setor</th>
                      <th className="text-right py-2 pr-3">Manutenção</th>
                      <th className="text-right py-2 pr-3">Combustível</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((g) => (
                      <tr key={g.veiculo.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{g.veiculo.placa}</td>
                        <td className="py-2 pr-3">
                          {g.veiculo.marca} {g.veiculo.modelo}
                        </td>
                        <td className="py-2 pr-3">{g.veiculo.setor || "-"}</td>
                        <td className="py-2 pr-3 text-right">{BRL(g.manut)}</td>
                        <td className="py-2 pr-3 text-right">{BRL(g.abast)}</td>
                        <td className="py-2 text-right font-semibold">{BRL(g.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2">
                      <td colSpan={3} className="py-2 pr-3">
                        Total geral
                      </td>
                      <td className="py-2 pr-3 text-right">{BRL(totalManut)}</td>
                      <td className="py-2 pr-3 text-right">{BRL(totalAbast)}</td>
                      <td className="py-2 text-right">{BRL(totalGeral)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-4 ${accent ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <p className="text-xl md:text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
