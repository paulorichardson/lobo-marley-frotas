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
import { Printer, Download, FileDown } from "lucide-react";
import { exportarXLSX } from "@/lib/export-xlsx";
import { toast } from "sonner";

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

      <SigaTcmExport setores={setores} mesPadrao={mes} />
    </div>
  );
}

function SigaTcmExport({ setores, mesPadrao }: { setores: string[]; mesPadrao: string }) {
  const hoje = new Date();
  const [anoMes, ano0] = mesPadrao.split("-");
  const [mesSel, setMesSel] = useState(ano0 || String(hoje.getMonth() + 1).padStart(2, "0"));
  const [anoSel, setAnoSel] = useState(anoMes || String(hoje.getFullYear()));
  const [setor, setSetor] = useState("todos");
  const [tipo, setTipo] = useState<"frota" | "abast" | "ambos">("ambos");
  const [gerando, setGerando] = useState(false);

  function baixar(conteudo: string, nome: string) {
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
  }

  function gerarFrota(linhas: any[]): string {
    return linhas.map((v) => [
      (v.cnpj_prefeitura || "").replace(/\D/g, ""),
      (v.secretaria || "NAO_INFORMADO").toUpperCase(),
      (v.placa || "").replace("-", ""),
      (v.marca || "").toUpperCase(),
      (v.modelo || "").toUpperCase(),
      v.ano || "",
      (v.combustivel || "FLEX").toUpperCase(),
    ].join("|")).join("\r\n");
  }

  function gerarAbast(linhas: any[]): string {
    return linhas.map((a) => [
      (a.cnpj_prefeitura || "").replace(/\D/g, ""),
      a.data,
      (a.placa || "").replace("-", ""),
      (a.cpf_motorista || "").replace(/\D/g, ""),
      (a.secretaria || "NAO_INFORMADO").toUpperCase(),
      (a.combustivel || "FLEX").toUpperCase(),
      String(a.litros ?? "0").replace(".", ","),
      String(a.valor_litro ?? "0").replace(".", ","),
      a.ticket || "",
    ].join("|")).join("\r\n");
  }

  async function gerar() {
    setGerando(true);
    try {
      const ano = Number(anoSel); const mes = Number(mesSel);
      const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fimMes = new Date(ano, mes, 0).getDate();
      const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimMes).padStart(2, "0")} 23:59:59`;
      const setorSafe = setor === "todos" ? "TODAS" : setor.toUpperCase().replace(/\s+/g, "_");
      const sufixo = `${String(mes).padStart(2, "0")}_${ano}_${setorSafe}.txt`;

      let total = 0;

      if (tipo === "frota" || tipo === "ambos") {
        let q = supabase.from("vw_siga_frota" as any).select("*");
        if (setor !== "todos") q = q.eq("setor_veiculo", setor);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) {
          toast.warning("Nenhum veículo encontrado para o filtro");
        } else {
          baixar(gerarFrota(data), `FROTA_${sufixo}`);
          total += data.length;
        }
      }

      if (tipo === "abast" || tipo === "ambos") {
        let q = supabase
          .from("vw_siga_abastecimentos" as any)
          .select("*")
          .gte("data_hora", ini)
          .lte("data_hora", fim)
          .order("data_hora");
        if (setor !== "todos") q = q.eq("setor_veiculo", setor);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) {
          toast.warning("Nenhum abastecimento no período");
        } else {
          baixar(gerarAbast(data), `ABAST_${sufixo}`);
          total += data.length;
        }
      }

      if (total > 0) toast.success(`Arquivo SIGA-TCM gerado (${total} registros)`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar arquivo");
    } finally {
      setGerando(false);
    }
  }

  const meses = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <Card className="p-5 space-y-4 border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/10 no-print">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            🏛️ Exportação SIGA-TCM
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">TCM/BA</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gera arquivos no padrão do Tribunal de Contas dos Municípios da Bahia para prestação de contas.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Mês</Label>
          <Select value={mesSel} onValueChange={setMesSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ano</Label>
          <Input type="number" value={anoSel} onChange={(e) => setAnoSel(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Secretaria / Setor</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as secretarias</SelectItem>
              {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Tipo de exportação</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant={tipo === "frota" ? "default" : "outline"} onClick={() => setTipo("frota")}>🚗 Frota</Button>
          <Button type="button" variant={tipo === "abast" ? "default" : "outline"} onClick={() => setTipo("abast")}>⛽ Abastecimentos</Button>
          <Button type="button" variant={tipo === "ambos" ? "default" : "outline"} onClick={() => setTipo("ambos")}>📦 Ambos</Button>
        </div>
      </div>

      <Button onClick={gerar} disabled={gerando} className="w-full">
        <FileDown className="w-4 h-4 mr-2" />
        {gerando ? "Gerando..." : "Gerar Arquivo SIGA-TCM"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Quando o veículo não tem setor preenchido, o sistema usa o código padrão da empresa.
      </p>
    </Card>
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
