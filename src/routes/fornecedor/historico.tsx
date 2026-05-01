import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Fuel, Wrench, FileSpreadsheet, Eye, Loader2, ListChecks } from "lucide-react";

export const Route = createFileRoute("/fornecedor/historico")({
  head: () => ({ meta: [{ title: "Histórico — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <HistoricoPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Item = {
  key: string;
  id: string;
  tipoLanc: "abastecimento" | "manutencao";
  data: string;
  veiculoLabel: string;
  veiculo_id: string | null;
  descricao: string;
  valor: number;
  status: string;
  motivo: string | null;
  raw: any;
};

function statusVariant(s: string): { variant: any; cor: string } {
  if (s === "Concluída") return { variant: "default", cor: "bg-emerald-500/15 text-emerald-700" };
  if (s === "Aprovada") return { variant: "secondary", cor: "bg-blue-500/15 text-blue-700" };
  if (s === "Em Execução") return { variant: "secondary", cor: "bg-orange-500/15 text-orange-700" };
  if (s === "Aguardando Aprovação") return { variant: "outline", cor: "bg-amber-500/15 text-amber-700" };
  if (s === "Reprovada") return { variant: "destructive", cor: "bg-rose-500/15 text-rose-700" };
  return { variant: "outline", cor: "" };
}

function periodoToRange(p: string): { ini: string; fim: string } {
  const hoje = new Date();
  const fim = new Date(hoje);
  let ini = new Date(hoje);
  if (p === "este_mes") {
    ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  } else if (p === "mes_passado") {
    ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    fim.setDate(0);
  } else if (p === "3m") {
    ini.setMonth(hoje.getMonth() - 3);
  }
  return { ini: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

function HistoricoPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"todos" | "abast" | "serv" | "orc_pend" | "orc_resp">("todos");
  const [periodo, setPeriodo] = useState("3m");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [placaBusca, setPlacaBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [detalhe, setDetalhe] = useState<Item | null>(null);
  const [pecasDetalhe, setPecasDetalhe] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { ini, fim } = periodoToRange(periodo);
      const iniISO = `${ini}T00:00:00`;
      const fimISO = `${fim}T23:59:59`;

      const [{ data: manuts }, { data: abasts }] = await Promise.all([
        supabase
          .from("manutencoes")
          .select("*")
          .eq("fornecedor_id", user.id)
          .gte("data_solicitacao", iniISO)
          .lte("data_solicitacao", fimISO)
          .order("data_solicitacao", { ascending: false }),
        supabase
          .from("abastecimentos")
          .select("*")
          .eq("fornecedor_id", user.id)
          .gte("data_hora", iniISO)
          .lte("data_hora", fimISO)
          .order("data_hora", { ascending: false }),
      ]);

      const veicIds = Array.from(new Set([
        ...(manuts ?? []).map((m) => m.veiculo_id),
        ...(abasts ?? []).map((a) => a.veiculo_id),
      ])).filter(Boolean) as string[];
      const veicMap = new Map<string, { placa: string; modelo: string }>();
      if (veicIds.length > 0) {
        const { data: vs } = await supabase
          .from("veiculos")
          .select("id, placa, modelo")
          .in("id", veicIds);
        for (const v of vs ?? []) veicMap.set(v.id, { placa: v.placa, modelo: v.modelo });
      }

      const lst: Item[] = [];
      for (const m of manuts ?? []) {
        const v = veicMap.get(m.veiculo_id);
        lst.push({
          key: `m-${m.id}`,
          id: m.id,
          tipoLanc: "manutencao",
          data: m.data_solicitacao,
          veiculo_id: m.veiculo_id,
          veiculoLabel: v ? `${v.placa} • ${v.modelo}` : "—",
          descricao: m.descricao,
          valor: Number(m.valor_final ?? m.valor_previsto ?? 0),
          status: m.status,
          motivo: m.observacoes?.includes("Reprovado:") ? m.observacoes : null,
          raw: m,
        });
      }
      for (const a of abasts ?? []) {
        const v = a.veiculo_id ? veicMap.get(a.veiculo_id) : undefined;
        lst.push({
          key: `a-${a.id}`,
          id: a.id,
          tipoLanc: "abastecimento",
          data: a.data_hora,
          veiculo_id: a.veiculo_id,
          veiculoLabel: v ? `${v.placa} • ${v.modelo}` : "—",
          descricao: `Abastecimento ${a.posto ?? ""} • ${a.litros}L`,
          valor: Number(a.valor_total ?? 0),
          status: "Concluída",
          motivo: null,
          raw: a,
        });
      }
      lst.sort((a, b) => (b.data > a.data ? 1 : -1));
      setItems(lst);
      setLoading(false);
    })();
  }, [user, periodo]);

  const filtrados = useMemo(() => {
    let r = items;
    if (tab === "abast") r = r.filter((i) => i.tipoLanc === "abastecimento");
    if (tab === "serv") r = r.filter((i) => i.tipoLanc === "manutencao" && (i.status === "Concluída" || i.status === "Em Execução" || i.status === "Aprovada"));
    if (tab === "orc_pend") r = r.filter((i) => i.status === "Aguardando Aprovação");
    if (tab === "orc_resp") r = r.filter((i) => i.tipoLanc === "manutencao" && (i.status === "Aprovada" || i.status === "Reprovada"));
    if (statusFiltro !== "todos") r = r.filter((i) => i.status === statusFiltro);
    if (placaBusca.trim()) {
      const q = placaBusca.toUpperCase();
      r = r.filter((i) => i.veiculoLabel.toUpperCase().includes(q));
    }
    return r;
  }, [items, tab, statusFiltro, placaBusca]);

  const totais = useMemo(() => {
    let total = 0, aprovado = 0, pendente = 0;
    for (const i of filtrados) {
      total += i.valor;
      if (i.status === "Aguardando Aprovação") pendente += i.valor;
      else if (i.status === "Concluída" || i.status === "Aprovada" || i.status === "Em Execução") aprovado += i.valor;
    }
    return { total, aprovado, pendente };
  }, [filtrados]);

  async function abrirDetalhe(it: Item) {
    setDetalhe(it);
    setPecasDetalhe([]);
    if (it.tipoLanc === "manutencao") {
      const { data } = await supabase
        .from("manutencao_pecas")
        .select("*")
        .eq("manutencao_id", it.id);
      setPecasDetalhe(data ?? []);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListChecks className="w-6 h-6" /> Histórico
        </h1>
        <p className="text-sm text-muted-foreground">Lançamentos realizados no período.</p>
      </header>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total lançado</p>
          <p className="text-lg font-bold">{BRL(totais.total)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Aprovado</p>
          <p className="text-lg font-bold text-emerald-600">{BRL(totais.aprovado)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="text-lg font-bold text-amber-600">{BRL(totais.pendente)}</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="este_mes">Este mês</SelectItem>
                <SelectItem value="mes_passado">Mês passado</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Aguardando Aprovação">Aguardando</SelectItem>
                <SelectItem value="Aprovada">Aprovado</SelectItem>
                <SelectItem value="Em Execução">Em execução</SelectItem>
                <SelectItem value="Concluída">Concluído</SelectItem>
                <SelectItem value="Reprovada">Reprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buscar veículo</Label>
            <Input value={placaBusca} onChange={(e) => setPlacaBusca(e.target.value)} placeholder="Placa ou modelo" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="abast">Abastecimentos</TabsTrigger>
            <TabsTrigger value="serv">Serviços</TabsTrigger>
            <TabsTrigger value="orc_pend">Orç. Pendentes</TabsTrigger>
            <TabsTrigger value="orc_resp">Orç. Respondidos</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtrados.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sem lançamentos.</p>
            ) : (
              <ul className="space-y-2">
                {filtrados.map((i) => {
                  const sv = statusVariant(i.status);
                  const Icon = i.tipoLanc === "abastecimento" ? Fuel
                    : i.status === "Aguardando Aprovação" ? FileSpreadsheet
                    : Wrench;
                  return (
                    <li key={i.key}>
                      <Card className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{i.descricao}</p>
                            <Badge variant={sv.variant} className="text-[10px]">{i.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(i.data).toLocaleString("pt-BR")} • {i.veiculoLabel}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-semibold">{BRL(i.valor)}</p>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => abrirDetalhe(i)}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                          </Button>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do lançamento</DialogTitle>
            <DialogDescription>{detalhe?.descricao}</DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <Field label="Data" value={new Date(detalhe.data).toLocaleString("pt-BR")} />
              <Field label="Veículo" value={detalhe.veiculoLabel} />
              <Field label="Status" value={detalhe.status} />
              <Field label="Valor" value={BRL(detalhe.valor)} mono />

              {detalhe.tipoLanc === "manutencao" && (
                <>
                  <Field label="Tipo" value={detalhe.raw.tipo} />
                  {detalhe.raw.diagnostico && <Field label="Diagnóstico" value={detalhe.raw.diagnostico} multiline />}
                  {detalhe.raw.servico_executado && <Field label="Serviço executado" value={detalhe.raw.servico_executado} multiline />}
                  {detalhe.raw.os_oficina && <Field label="Nº OS" value={detalhe.raw.os_oficina} />}
                  {detalhe.raw.km_na_manutencao != null && <Field label="KM" value={String(detalhe.raw.km_na_manutencao)} />}
                  {detalhe.raw.validade_orcamento && <Field label="Validade orçamento" value={new Date(detalhe.raw.validade_orcamento).toLocaleDateString("pt-BR")} />}
                  {detalhe.raw.aprovado_nome && <Field label="Aprovado por" value={detalhe.raw.aprovado_nome} />}

                  {pecasDetalhe.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Peças</p>
                      <ul className="border rounded-md divide-y">
                        {pecasDetalhe.map((p) => (
                          <li key={p.id} className="p-2 flex justify-between text-xs">
                            <span>{p.descricao} ({p.quantidade}x {BRL(Number(p.valor_unitario))})</span>
                            <span className="font-mono">{BRL(p.quantidade * Number(p.valor_unitario))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detalhe.raw.valor_mao_obra != null && <Field label="Mão de obra" value={BRL(Number(detalhe.raw.valor_mao_obra))} mono />}
                  {detalhe.raw.desconto != null && <Field label="Desconto" value={BRL(Number(detalhe.raw.desconto))} mono />}
                </>
              )}

              {detalhe.tipoLanc === "abastecimento" && (
                <>
                  <Field label="Combustível" value={detalhe.raw.combustivel ?? "—"} />
                  <Field label="Litros" value={`${detalhe.raw.litros} L`} />
                  <Field label="R$ por litro" value={BRL(Number(detalhe.raw.valor_litro))} mono />
                  <Field label="KM" value={String(detalhe.raw.km_atual)} />
                </>
              )}

              {detalhe.raw.observacoes && <Field label="Observações" value={detalhe.raw.observacoes} multiline />}
              {detalhe.raw.comprovante_url && (
                <p className="text-xs text-muted-foreground">Comprovante anexado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, multiline, mono }: { label: string; value: string; multiline?: boolean; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`col-span-2 ${mono ? "font-mono" : ""} ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}
