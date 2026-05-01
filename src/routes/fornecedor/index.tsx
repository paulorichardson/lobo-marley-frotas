import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFornecedorTipos } from "@/hooks/useFornecedorTipos";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wallet, CheckCircle2, Clock, CreditCard, Fuel, Wrench, FileSpreadsheet,
  AlertTriangle, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/fornecedor/")({
  head: () => ({ meta: [{ title: "Painel — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <FornecedorDashboard />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Lancamento = {
  id: string;
  tipo: "abastecimento" | "manutencao";
  data: string;
  veiculo: string;
  descricao: string;
  valor: number;
  status: string;
};

function FornecedorDashboard() {
  const { user } = useAuth();
  const { tipos, loading: loadingTipos, isPosto, isOficina, isPecas } = useFornecedorTipos();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ total: 0, aprovado: 0, pendente: 0, aReceber: 0 });
  const [recentes, setRecentes] = useState<Lancamento[]>([]);
  const [serieSemana, setSerieSemana] = useState<{ semana: string; valor: number }[]>([]);
  const [orcamentosVencendo, setOrcamentosVencendo] = useState<any[]>([]);
  const [aprovadosAguardando, setAprovadosAguardando] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        const inicioISO = inicioMes.toISOString();

        // Manutenções
        const { data: manuts } = await supabase
          .from("manutencoes")
          .select("id, descricao, valor_final, valor_previsto, valor_mao_obra, desconto, status, data_solicitacao, data_inicio, data_conclusao, validade_orcamento, data_aprovacao, veiculo_id")
          .eq("fornecedor_id", user.id)
          .gte("data_solicitacao", inicioISO)
          .order("data_solicitacao", { ascending: false });

        // Abastecimentos
        const { data: abasts } = await supabase
          .from("abastecimentos")
          .select("id, posto, valor_total, data_hora, veiculo_id")
          .eq("fornecedor_id", user.id)
          .gte("data_hora", inicioISO)
          .order("data_hora", { ascending: false });

        // Veículos para resolver placa/modelo
        const veicIds = Array.from(
          new Set([
            ...(manuts ?? []).map((m) => m.veiculo_id),
            ...(abasts ?? []).map((a) => a.veiculo_id),
          ]),
        ).filter(Boolean) as string[];
        const veicMap = new Map<string, { placa: string; modelo: string }>();
        if (veicIds.length > 0) {
          const { data: vs } = await supabase
            .from("veiculos")
            .select("id, placa, modelo")
            .in("id", veicIds);
          for (const v of vs ?? []) veicMap.set(v.id, { placa: v.placa, modelo: v.modelo });
        }

        // Pagamentos já recebidos para este fornecedor (mês)
        const allIds = [...(manuts ?? []).map((m) => m.id), ...(abasts ?? []).map((a) => a.id)];
        const pagosMap = new Map<string, number>();
        if (allIds.length > 0) {
          const { data: itens } = await supabase
            .from("pagamento_itens")
            .select("servico_id, valor_aplicado")
            .in("servico_id", allIds);
          for (const it of itens ?? []) {
            pagosMap.set(it.servico_id, (pagosMap.get(it.servico_id) ?? 0) + Number(it.valor_aplicado));
          }
        }

        // KPIs
        let total = 0, aprovado = 0, pendente = 0, aReceber = 0;
        for (const m of manuts ?? []) {
          const v = Number(m.valor_final ?? m.valor_previsto ?? 0);
          total += v;
          if (m.status === "Concluída" || m.status === "Aprovada" || m.status === "Em Execução") {
            aprovado += v;
            const pago = pagosMap.get(m.id) ?? 0;
            aReceber += Math.max(0, v - pago);
          } else if (m.status === "Aguardando Aprovação" || m.status === "Solicitada") {
            pendente += v;
          }
        }
        for (const a of abasts ?? []) {
          const v = Number(a.valor_total ?? 0);
          total += v;
          aprovado += v; // abastecimento já é executado
          const pago = pagosMap.get(a.id) ?? 0;
          aReceber += Math.max(0, v - pago);
        }
        setKpis({ total, aprovado, pendente, aReceber });

        // Últimos lançamentos
        const lst: Lancamento[] = [];
        for (const m of manuts ?? []) {
          lst.push({
            id: m.id,
            tipo: "manutencao",
            data: m.data_solicitacao,
            veiculo: veicMap.get(m.veiculo_id)?.placa ?? "—",
            descricao: m.descricao,
            valor: Number(m.valor_final ?? m.valor_previsto ?? 0),
            status: m.status,
          });
        }
        for (const a of abasts ?? []) {
          lst.push({
            id: a.id,
            tipo: "abastecimento",
            data: a.data_hora,
            veiculo: veicMap.get(a.veiculo_id)?.placa ?? "—",
            descricao: `Abastecimento ${a.posto ?? ""}`.trim(),
            valor: Number(a.valor_total ?? 0),
            status: "Concluída",
          });
        }
        lst.sort((a, b) => (b.data > a.data ? 1 : -1));
        setRecentes(lst.slice(0, 8));

        // Série por semana do mês
        const semanas = new Map<number, number>();
        for (const it of lst) {
          const d = new Date(it.data);
          const semana = Math.ceil(d.getDate() / 7);
          semanas.set(semana, (semanas.get(semana) ?? 0) + it.valor);
        }
        setSerieSemana(
          [1, 2, 3, 4, 5].map((s) => ({
            semana: `Sem ${s}`,
            valor: semanas.get(s) ?? 0,
          })),
        );

        // Alertas: orçamentos vencendo em <3 dias
        const hoje = new Date();
        const limite = new Date();
        limite.setDate(hoje.getDate() + 3);
        const venc = (manuts ?? []).filter(
          (m) =>
            m.status === "Aguardando Aprovação" &&
            m.validade_orcamento &&
            new Date(m.validade_orcamento) >= hoje &&
            new Date(m.validade_orcamento) <= limite,
        );
        setOrcamentosVencendo(venc);

        // Aprovados aguardando início
        const aguard = (manuts ?? []).filter(
          (m) => m.status === "Aprovada" && !m.data_inicio,
        );
        setAprovadosAguardando(aguard);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const tipoLabel = useMemo(() => {
    const labels: string[] = [];
    if (isPosto) labels.push("Posto");
    if (isOficina) labels.push("Oficina");
    if (isPecas) labels.push("Peças");
    return labels.join(" + ") || "Fornecedor";
  }, [isPosto, isOficina, isPecas]);

  if (loadingTipos || loading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Bom dia, fornecedor 👋</h1>
          <p className="text-sm text-muted-foreground">
            Modo: <Badge variant="outline">{tipoLabel}</Badge> • Resumo do mês atual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPosto && (
            <Button asChild size="sm"><Link to="/fornecedor/abastecer"><Fuel className="w-4 h-4 mr-1" /> Abastecer</Link></Button>
          )}
          {(isOficina || isPecas) && (
            <>
              <Button asChild size="sm"><Link to="/fornecedor/servico"><Wrench className="w-4 h-4 mr-1" /> Novo Serviço</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/fornecedor/orcamento"><FileSpreadsheet className="w-4 h-4 mr-1" /> Orçamento</Link></Button>
            </>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Wallet} label="Total no mês" value={BRL(kpis.total)} />
        <Kpi icon={CheckCircle2} label="Aprovado/concluído" value={BRL(kpis.aprovado)} color="emerald" />
        <Kpi icon={Clock} label="Aguardando" value={BRL(kpis.pendente)} color="amber" />
        <Kpi icon={CreditCard} label="A receber" value={BRL(kpis.aReceber)} color="rose" highlight />
      </div>

      {/* Alertas */}
      {(orcamentosVencendo.length > 0 || aprovadosAguardando.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {orcamentosVencendo.length > 0 && (
            <Card className="p-4 border-amber-500/40 bg-amber-500/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Orçamentos vencendo</p>
                  <p className="text-xs text-muted-foreground">
                    {orcamentosVencendo.length} orçamento(s) vencem nos próximos 3 dias.
                  </p>
                </div>
              </div>
            </Card>
          )}
          {aprovadosAguardando.length > 0 && (
            <Card className="p-4 border-blue-500/40 bg-blue-500/5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Serviços aprovados</p>
                  <p className="text-xs text-muted-foreground">
                    {aprovadosAguardando.length} aprovado(s) aguardando início.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Gráfico */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Lançamentos por semana</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serieSemana}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => BRL(v)} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Últimos lançamentos */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Últimos lançamentos</h3>
          <Button asChild size="sm" variant="ghost"><Link to="/fornecedor/historico">Ver tudo</Link></Button>
        </div>
        {recentes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento neste mês.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentes.map((r) => (
              <li key={`${r.tipo}-${r.id}`} className="py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {r.tipo === "abastecimento" ? <Fuel className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.data).toLocaleDateString("pt-BR")} • {r.veiculo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{BRL(r.valor)}</p>
                  <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, color, highlight,
}: {
  icon: any; label: string; value: string; color?: "emerald" | "amber" | "rose"; highlight?: boolean;
}) {
  const cls =
    color === "emerald" ? "text-emerald-600" :
    color === "amber" ? "text-amber-600" :
    color === "rose" ? "text-rose-600" : "";
  return (
    <Card className={`p-3 ${highlight ? "border-rose-500/40" : ""}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${cls || "text-muted-foreground"}`} />
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className={`text-lg md:text-xl font-bold mt-1 ${cls}`}>{value}</p>
    </Card>
  );
}
