import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download } from "lucide-react";
import { exportarXLSX } from "@/lib/export-xlsx";

export const Route = createFileRoute("/gestor/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <RelatoriosGestor />
      </AppShell>
    </ProtectedRoute>
  ),
});

function RelatoriosGestor() {
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [setorFiltro, setSetorFiltro] = useState("todos");
  const [dados, setDados] = useState<any[]>([]);
  const [setores, setSetores] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [ano, m] = mes.split("-").map(Number);
      const ini = new Date(ano, m - 1, 1).toISOString();
      const fim = new Date(ano, m, 0, 23, 59, 59).toISOString();
      const fimDate = fim.slice(0, 10);
      const iniDate = ini.slice(0, 10);

      const { data: vs } = await supabase.from("veiculos").select("id, placa, setor, modelo");
      const veicMap: Record<string, any> = {};
      const setoresSet = new Set<string>();
      (vs ?? []).forEach((v: any) => { veicMap[v.id] = v; if (v.setor) setoresSet.add(v.setor); });
      setSetores(Array.from(setoresSet).sort());

      const [{ data: mans }, { data: abs }] = await Promise.all([
        supabase.from("manutencoes").select("veiculo_id, valor_final").gte("criado_em", ini).lte("criado_em", fim),
        supabase.from("abastecimentos").select("veiculo_id, valor_total, litros").gte("data_hora", ini).lte("data_hora", fim),
      ]);

      const grupos: Record<string, { setor: string; veiculos: Set<string>; os: number; abast: number; litros: number; cm: number; cc: number }> = {};
      (mans ?? []).forEach((mn: any) => {
        const v = veicMap[mn.veiculo_id]; if (!v) return;
        const s = v.setor || "Sem setor";
        const g = (grupos[s] ??= { setor: s, veiculos: new Set(), os: 0, abast: 0, litros: 0, cm: 0, cc: 0 });
        g.veiculos.add(v.id); g.os++; g.cm += Number(mn.valor_final || 0);
      });
      (abs ?? []).forEach((a: any) => {
        const v = veicMap[a.veiculo_id]; if (!v) return;
        const s = v.setor || "Sem setor";
        const g = (grupos[s] ??= { setor: s, veiculos: new Set(), os: 0, abast: 0, litros: 0, cm: 0, cc: 0 });
        g.veiculos.add(v.id); g.abast++; g.litros += Number(a.litros || 0); g.cc += Number(a.valor_total || 0);
      });

      const out = Object.values(grupos)
        .filter((g) => setorFiltro === "todos" || g.setor === setorFiltro)
        .map((g) => ({ ...g, qtdVeiculos: g.veiculos.size, total: g.cm + g.cc }))
        .sort((a, b) => b.total - a.total);
      setDados(out);
    })();
  }, [mes, setorFiltro]);

  const totalGeral = useMemo(() => dados.reduce((s, d) => s + d.total, 0), [dados]);
  const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function exportar() {
    exportarXLSX(
      dados.map((d) => ({
        Setor: d.setor, Veiculos: d.qtdVeiculos, OS: d.os,
        Abastecimentos: d.abast, Litros: d.litros,
        "Custo Manutencao": d.cm, "Custo Combustivel": d.cc, Total: d.total,
      })),
      "Relatorio", `lobomarley_relatorio_${mes}`,
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 print:p-2">
      <header className="flex flex-wrap items-end gap-3 justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold">Relatórios por Setor</h1>
          <p className="text-sm text-muted-foreground">Custos consolidados por secretaria/setor</p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">Período</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={setorFiltro} onValueChange={setSetorFiltro}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
          <Button onClick={exportar}><Download className="w-4 h-4 mr-2" /> Exportar Excel</Button>
        </div>
      </header>

      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">Lobo Marley — Relatório por Setor</h2>
        <p className="text-sm">Período: {mes}</p>
      </div>

      {dados.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Sem dados no período.</Card>
      ) : (
        <div className="space-y-3">
          {dados.map((d) => (
            <Card key={d.setor} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">🏛️ {d.setor}</h3>
                <span className="text-lg font-bold">{BRL(d.total)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <Info l="Veículos" v={d.qtdVeiculos} />
                <Info l="OS" v={d.os} />
                <Info l="Abastecimentos" v={`${d.abast} (${d.litros.toFixed(0)}L)`} />
                <Info l="Manutenção" v={BRL(d.cm)} />
                <Info l="Combustível" v={BRL(d.cc)} />
              </div>
            </Card>
          ))}
          <Card className="p-4 bg-primary/5">
            <div className="flex justify-between items-center">
              <span className="font-bold">TOTAL GERAL</span>
              <span className="text-xl font-bold">{BRL(totalGeral)}</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Info({ l, v }: { l: string; v: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase">{l}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
