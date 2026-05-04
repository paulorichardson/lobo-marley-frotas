import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSpreadsheet, Loader2, Truck, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fornecedor/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <OrcamentosPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Manut {
  id: string;
  veiculo_id: string;
  empresa_id: string | null;
  tipo: string;
  descricao: string;
  status: string;
  valor_previsto: number | null;
  valor_mao_obra: number | null;
  validade_orcamento: string | null;
  data_solicitacao: string;
  data_aprovacao: string | null;
  observacoes: string | null;
}

function OrcamentosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("aguardando");
  const [items, setItems] = useState<Manut[]>([]);
  const [pecasMap, setPecasMap] = useState<Record<string, number>>({});
  const [veiculosMap, setVeiculosMap] = useState<Record<string, { placa: string; marca: string; modelo: string }>>({});
  const [empresasMap, setEmpresasMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function carregar() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("manutencoes")
      .select("*")
      .eq("fornecedor_id", user.id)
      .in("status", ["Orçamento Enviado", "Aprovada", "Recusada", "Em Andamento", "Concluída"])
      .order("data_solicitacao", { ascending: false })
      .limit(200);
    const list = (data ?? []) as any as Manut[];
    setItems(list);

    const ids = list.map((m) => m.id);
    if (ids.length) {
      const { data: pecas } = await supabase
        .from("manutencao_pecas")
        .select("manutencao_id, quantidade, valor_unitario")
        .in("manutencao_id", ids);
      const pm: Record<string, number> = {};
      (pecas ?? []).forEach((p: any) => {
        pm[p.manutencao_id] = (pm[p.manutencao_id] ?? 0) + Number(p.quantidade) * Number(p.valor_unitario);
      });
      setPecasMap(pm);
    }

    const veicIds = Array.from(new Set(list.map((m) => m.veiculo_id).filter(Boolean)));
    if (veicIds.length) {
      const { data: vs } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo")
        .in("id", veicIds as string[]);
      const map: Record<string, any> = {};
      (vs ?? []).forEach((v) => { map[v.id] = { placa: v.placa, marca: v.marca, modelo: v.modelo }; });
      setVeiculosMap(map);
    }
    const empresaIds = Array.from(new Set(list.map((m) => m.empresa_id).filter(Boolean) as string[]));
    if (empresaIds.length) {
      const { data: es } = await supabase
        .from("empresas")
        .select("id, razao_social, nome_fantasia")
        .in("id", empresaIds);
      const map: Record<string, string> = {};
      (es ?? []).forEach((e: any) => { map[e.id] = e.nome_fantasia || e.razao_social; });
      setEmpresasMap(map);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [user]);

  function totalOrc(m: Manut) {
    return (pecasMap[m.id] ?? 0) + Number(m.valor_mao_obra || 0) || Number(m.valor_previsto || 0);
  }

  const aguardando = items.filter((m) => m.status === "Orçamento Enviado" && (!m.validade_orcamento || new Date(m.validade_orcamento) >= new Date()));
  const aprovados = items.filter((m) => ["Aprovada", "Em Andamento", "Concluída"].includes(m.status));
  const reprovados = items.filter((m) => m.status === "Recusada");
  const vencidos = items.filter((m) => m.status === "Orçamento Enviado" && m.validade_orcamento && new Date(m.validade_orcamento) < new Date());

  const lista = tab === "aguardando" ? aguardando
    : tab === "aprovados" ? aprovados
    : tab === "reprovados" ? reprovados : vencidos;

  function CardOrc({ m }: { m: Manut }) {
    const v = veiculosMap[m.veiculo_id];
    const empresa = m.empresa_id ? empresasMap[m.empresa_id] : null;
    const total = totalOrc(m);
    const validade = m.validade_orcamento ? new Date(m.validade_orcamento) : null;
    const diasRestantes = validade ? Math.ceil((validade.getTime() - Date.now()) / 86400000) : null;
    const motivoRecusa = m.observacoes?.match(/Recusa:\s*([^|]+)/i)?.[1]?.trim();
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <Badge variant="outline">{m.tipo}</Badge>
              <Badge variant={m.status === "Aprovada" ? "default" : m.status === "Recusada" ? "destructive" : "secondary"}>
                {m.status}
              </Badge>
              {validade && diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3 && m.status === "Orçamento Enviado" && (
                <Badge className="bg-red-600 text-white">Vence em {diasRestantes}d</Badge>
              )}
            </div>
            <p className="font-semibold flex items-center gap-1">
              <Truck className="w-3 h-3" />{v?.placa} · {v?.marca} {v?.modelo}
            </p>
            {empresa && <p className="text-xs text-muted-foreground">🏢 {empresa}</p>}
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{m.descricao}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enviado {new Date(m.data_solicitacao).toLocaleDateString("pt-BR")}
              {validade && ` · Validade ${validade.toLocaleDateString("pt-BR")}`}
            </p>
            {motivoRecusa && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs">
                <strong className="text-red-700 dark:text-red-300">Motivo:</strong> {motivoRecusa}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold">{BRL(total)}</p>
            {m.status === "Aprovada" && (
              <Button size="sm" className="mt-2" onClick={() => navigate({ to: "/fornecedor/servico" })}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar Concluído
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6" /> Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhe os orçamentos enviados.</p>
        </div>
        <Button asChild>
          <Link to="/fornecedor/orcamento" search={{ solicitacaoId: "" }}><Plus className="w-4 h-4 mr-2" />Novo Orçamento</Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="aguardando">Aguardando {aguardando.length > 0 && <Badge variant="secondary" className="ml-1">{aguardando.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="aprovados">Aprovados</TabsTrigger>
          <TabsTrigger value="reprovados">Reprovados</TabsTrigger>
          <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto py-8" /> :
            lista.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhum item.</Card>
            ) : lista.map((m) => <CardOrc key={m.id} m={m} />)
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}
