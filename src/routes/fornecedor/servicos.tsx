import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Loader2, Truck, Plus, Wallet, Clock } from "lucide-react";

export const Route = createFileRoute("/fornecedor/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <ServicosPage />
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
  valor_final: number | null;
  valor_previsto: number | null;
  valor_mao_obra: number | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  data_solicitacao: string;
  avaliacao_estrelas: number | null;
}

function ServicosPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("execucao");
  const [items, setItems] = useState<Manut[]>([]);
  const [pecasMap, setPecasMap] = useState<Record<string, number>>({});
  const [pagosMap, setPagosMap] = useState<Record<string, { valor: number; data: string }>>({});
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
      .in("status", ["Aprovada", "Em Andamento", "Concluída"])
      .order("data_solicitacao", { ascending: false })
      .limit(200);
    const list = (data ?? []) as any as Manut[];
    setItems(list);

    const ids = list.map((m) => m.id);
    if (ids.length) {
      const [{ data: pecas }, { data: pgItens }] = await Promise.all([
        supabase.from("manutencao_pecas").select("manutencao_id, quantidade, valor_unitario").in("manutencao_id", ids),
        supabase.from("pagamento_itens").select("servico_id, valor_aplicado, pagamento_id").in("servico_id", ids),
      ]);
      const pm: Record<string, number> = {};
      (pecas ?? []).forEach((p: any) => {
        pm[p.manutencao_id] = (pm[p.manutencao_id] ?? 0) + Number(p.quantidade) * Number(p.valor_unitario);
      });
      setPecasMap(pm);

      const pagIds = Array.from(new Set((pgItens ?? []).map((p: any) => p.pagamento_id)));
      let pagsMap: Record<string, string> = {};
      if (pagIds.length) {
        const { data: pgs } = await supabase
          .from("pagamentos_fornecedor")
          .select("id, data_pagamento")
          .in("id", pagIds);
        (pgs ?? []).forEach((p: any) => { pagsMap[p.id] = p.data_pagamento; });
      }
      const pago: Record<string, { valor: number; data: string }> = {};
      (pgItens ?? []).forEach((it: any) => {
        const cur = pago[it.servico_id] ?? { valor: 0, data: "" };
        pago[it.servico_id] = { valor: cur.valor + Number(it.valor_aplicado), data: pagsMap[it.pagamento_id] || cur.data };
      });
      setPagosMap(pago);
    }

    const veicIds = Array.from(new Set(list.map((m) => m.veiculo_id).filter(Boolean)));
    if (veicIds.length) {
      const { data: vs } = await supabase
        .from("veiculos").select("id, placa, marca, modelo").in("id", veicIds as string[]);
      const map: Record<string, any> = {};
      (vs ?? []).forEach((v) => { map[v.id] = { placa: v.placa, marca: v.marca, modelo: v.modelo }; });
      setVeiculosMap(map);
    }
    const empIds = Array.from(new Set(list.map((m) => m.empresa_id).filter(Boolean) as string[]));
    if (empIds.length) {
      const { data: es } = await supabase.from("empresas").select("id, razao_social, nome_fantasia").in("id", empIds);
      const map: Record<string, string> = {};
      (es ?? []).forEach((e: any) => { map[e.id] = e.nome_fantasia || e.razao_social; });
      setEmpresasMap(map);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [user]);

  function valorServico(m: Manut) {
    return Number(m.valor_final) || ((pecasMap[m.id] ?? 0) + Number(m.valor_mao_obra || 0)) || Number(m.valor_previsto || 0);
  }

  const execucao = items.filter((m) => ["Aprovada", "Em Andamento"].includes(m.status));
  const concluidos = items.filter((m) => m.status === "Concluída" && m.avaliacao_estrelas);
  const aguardandoConf = items.filter((m) => m.status === "Concluída" && !m.avaliacao_estrelas);

  const lista = tab === "execucao" ? execucao : tab === "concluidos" ? concluidos : aguardandoConf;

  function CardServ({ m }: { m: Manut }) {
    const v = veiculosMap[m.veiculo_id];
    const empresa = m.empresa_id ? empresasMap[m.empresa_id] : null;
    const total = valorServico(m);
    const pago = pagosMap[m.id];
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <Badge variant="outline">{m.tipo}</Badge>
              <Badge variant={m.status === "Concluída" ? "default" : "secondary"}>{m.status}</Badge>
              {m.status === "Concluída" && !m.avaliacao_estrelas && (
                <Badge className="bg-amber-500 text-white">Aguardando confirmação do gestor</Badge>
              )}
            </div>
            <p className="font-semibold flex items-center gap-1">
              <Truck className="w-3 h-3" />{v?.placa} · {v?.marca} {v?.modelo}
            </p>
            {empresa && <p className="text-xs text-muted-foreground">🏢 {empresa}</p>}
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{m.descricao}</p>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              {m.data_inicio && <span>Início: {new Date(m.data_inicio).toLocaleDateString("pt-BR")}</span>}
              {m.data_conclusao && <span>Conclusão: {new Date(m.data_conclusao).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold">{BRL(total)}</p>
            {pago && pago.valor > 0 ? (
              <Badge className="bg-emerald-500 text-white mt-1"><Wallet className="w-3 h-3 mr-1" />Pago</Badge>
            ) : (
              <Badge variant="outline" className="mt-1"><Clock className="w-3 h-3 mr-1" />A receber</Badge>
            )}
            {pago && (
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(pago.data).toLocaleDateString("pt-BR")}</p>
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
            <CheckCircle2 className="w-6 h-6" /> Serviços
          </h1>
          <p className="text-sm text-muted-foreground">Serviços aprovados, em execução e concluídos.</p>
        </div>
        <Button asChild>
          <Link to="/fornecedor/servico"><Plus className="w-4 h-4 mr-2" />Lançar Serviço</Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="execucao">Em Execução {execucao.length > 0 && <Badge variant="secondary" className="ml-1">{execucao.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="aguardando">Aguardando Confirmação {aguardandoConf.length > 0 && <Badge variant="secondary" className="ml-1">{aguardandoConf.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto py-8" /> :
            lista.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhum item.</Card>
            ) : lista.map((m) => <CardServ key={m.id} m={m} />)
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}
