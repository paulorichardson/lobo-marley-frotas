import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, CheckCircle2, Clock, Receipt, Loader2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/fornecedor/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Fornecedor" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <FinanceiroFornecedor />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Servico = {
  id: string;
  tipo: "manutencao" | "abastecimento" | "despesa";
  descricao: string;
  data: string;
  valor: number;
  pago: number;
  saldo: number;
};

type Pagamento = {
  id: string;
  data_pagamento: string;
  valor: number;
  forma_pagamento: string;
  observacoes: string | null;
  comprovante_url: string | null;
  itens_count: number;
};

function ComprovanteLink({ path }: { path: string | null }) {
  const url = useSignedUrl("comprovantes", path);
  if (!path) return <span className="text-muted-foreground text-xs">—</span>;
  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-accent hover:underline inline-flex items-center gap-1 text-xs"
    >
      Ver <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function FinanceiroFornecedor() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const today = new Date();
  const [dataIni, setDataIni] = useState(
    new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10),
  );
  const [dataFim, setDataFim] = useState(today.toISOString().slice(0, 10));

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dataIni, dataFim]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const ini = `${dataIni}T00:00:00`;
      const fim = `${dataFim}T23:59:59`;

      // Manutenções concluídas do fornecedor
      const { data: manuts } = await supabase
        .from("manutencoes")
        .select("id, descricao, data_conclusao, criado_em, valor_final, status")
        .eq("fornecedor_id", user.id)
        .eq("status", "Concluída")
        .gte("data_conclusao", ini)
        .lte("data_conclusao", fim);

      // Abastecimentos do fornecedor
      const { data: abasts } = await supabase
        .from("abastecimentos")
        .select("id, posto, data_hora, valor_total, litros, combustivel")
        .eq("fornecedor_id", user.id)
        .gte("data_hora", ini)
        .lte("data_hora", fim);

      // Despesas lançadas pelo fornecedor
      const { data: desps } = await supabase
        .from("despesas")
        .select("id, descricao, tipo, data_despesa, valor")
        .eq("lancado_por", user.id)
        .gte("data_despesa", dataIni)
        .lte("data_despesa", dataFim);

      const lista: Servico[] = [
        ...(manuts ?? []).map((m: any) => ({
          id: m.id,
          tipo: "manutencao" as const,
          descricao: m.descricao || "Manutenção",
          data: m.data_conclusao || m.criado_em,
          valor: Number(m.valor_final || 0),
          pago: 0,
          saldo: 0,
        })),
        ...(abasts ?? []).map((a: any) => ({
          id: a.id,
          tipo: "abastecimento" as const,
          descricao: `${a.combustivel ?? "Comb."} • ${Number(a.litros).toFixed(1)}L${a.posto ? " • " + a.posto : ""}`,
          data: a.data_hora,
          valor: Number(a.valor_total || 0),
          pago: 0,
          saldo: 0,
        })),
        ...(desps ?? []).map((d: any) => ({
          id: d.id,
          tipo: "despesa" as const,
          descricao: `${d.tipo}${d.descricao ? " — " + d.descricao : ""}`,
          data: d.data_despesa,
          valor: Number(d.valor || 0),
          pago: 0,
          saldo: 0,
        })),
      ];

      // Pagamentos do fornecedor (todos para cálculo de saldo correto)
      const { data: pags } = await supabase
        .from("pagamentos_fornecedor")
        .select("id, data_pagamento, valor, forma_pagamento, observacoes, comprovante_url")
        .eq("fornecedor_id", user.id)
        .order("data_pagamento", { ascending: false });

      const pagIds = (pags ?? []).map((p) => p.id);
      const { data: itens } = pagIds.length
        ? await supabase
            .from("pagamento_itens")
            .select("pagamento_id, tipo_servico, servico_id, valor_aplicado")
            .in("pagamento_id", pagIds)
        : { data: [] as any[] };

      // Aplica pagamentos aos serviços
      const idx = new Map<string, Servico>();
      for (const s of lista) idx.set(`${s.tipo}:${s.id}`, s);
      for (const it of itens ?? []) {
        const key = `${it.tipo_servico}:${it.servico_id}`;
        const s = idx.get(key);
        if (s) s.pago += Number(it.valor_aplicado || 0);
      }
      for (const s of lista) s.saldo = Math.max(0, s.valor - s.pago);
      lista.sort((a, b) => (a.data < b.data ? 1 : -1));
      setServicos(lista);

      // Conta itens por pagamento p/ exibir
      const counts = new Map<string, number>();
      for (const it of itens ?? []) {
        counts.set(it.pagamento_id, (counts.get(it.pagamento_id) ?? 0) + 1);
      }
      // Filtra pagamentos no intervalo selecionado para exibir
      setPagamentos(
        (pags ?? [])
          .filter((p) => p.data_pagamento >= dataIni && p.data_pagamento <= dataFim)
          .map((p) => ({
            id: p.id,
            data_pagamento: p.data_pagamento,
            valor: Number(p.valor || 0),
            forma_pagamento: p.forma_pagamento,
            observacoes: p.observacoes,
            comprovante_url: p.comprovante_url,
            itens_count: counts.get(p.id) ?? 0,
          })),
      );
    } finally {
      setLoading(false);
    }
  }

  const kpis = useMemo(() => {
    const total = servicos.reduce((a, s) => a + s.valor, 0);
    const pago = servicos.reduce((a, s) => a + s.pago, 0);
    const saldo = servicos.reduce((a, s) => a + s.saldo, 0);
    return { total, pago, saldo };
  }, [servicos]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus serviços e pagamentos no período.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={<Receipt className="w-4 h-4" />} label="Total no período" value={BRL(kpis.total)} />
        <Kpi icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="Recebido" value={BRL(kpis.pago)} tone="emerald" />
        <Kpi
          icon={<Clock className="w-4 h-4 text-destructive" />}
          label="A receber"
          value={BRL(kpis.saldo)}
          tone={kpis.saldo > 0 ? "destructive" : "muted"}
        />
      </div>

      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </Card>
      ) : (
        <Tabs defaultValue="servicos">
          <TabsList>
            <TabsTrigger value="servicos">Serviços ({servicos.length})</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos recebidos ({pagamentos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="servicos" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Nenhum serviço no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    servicos.map((s) => {
                      const status =
                        s.saldo === 0
                          ? { label: "Pago", cls: "bg-emerald-600/15 text-emerald-500" }
                          : s.pago > 0
                            ? { label: "Parcial", cls: "bg-amber-600/15 text-amber-500" }
                            : { label: "Em aberto", cls: "bg-destructive/15 text-destructive" };
                      return (
                        <TableRow key={`${s.tipo}-${s.id}`}>
                          <TableCell className="text-xs">
                            {new Date(s.data).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {s.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate">{s.descricao}</TableCell>
                          <TableCell className="text-right">{BRL(s.valor)}</TableCell>
                          <TableCell className="text-right text-emerald-500">{BRL(s.pago)}</TableCell>
                          <TableCell className="text-right font-semibold">{BRL(s.saldo)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${status.cls}`}>
                              {status.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pagamentos" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Nenhum pagamento recebido no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagamentos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">
                          {new Date(p.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{p.forma_pagamento}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                          {p.observacoes || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">{p.itens_count}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-500">
                          {BRL(p.valor)}
                        </TableCell>
                        <TableCell>
                          <ComprovanteLink path={p.comprovante_url} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Kpi({
  icon, label, value, tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "emerald" | "destructive" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-500"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold mt-2 ${toneCls}`}>{value}</p>
    </Card>
  );
}
