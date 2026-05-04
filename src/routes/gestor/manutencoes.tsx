import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Wrench, CheckCircle2, XCircle, Clock, Loader2, Plus, Megaphone, Package,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { notifyUser } from "@/lib/notify";
import { useAuth } from "@/hooks/useAuth";
import { NovaSolicitacaoModal, Estrelas } from "@/components/manutencoes/NovaSolicitacaoModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestor/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <ManutencoesGestor />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Manut {
  id: string;
  veiculo_id: string;
  fornecedor_id: string | null;
  tipo: string;
  descricao: string;
  diagnostico: string | null;
  status: string;
  prioridade: string;
  valor_previsto: number | null;
  valor_mao_obra: number | null;
  valor_maximo_autorizado: number | null;
  valor_final: number | null;
  validade_orcamento: string | null;
  prazo_esperado: string | null;
  data_solicitacao: string;
  data_aprovacao: string | null;
  data_conclusao: string | null;
  oficina_nome: string | null;
  observacoes: string | null;
  comprovante_url: string | null;
  nota_fiscal: string | null;
  enviado_para_rede: boolean | null;
  total_orcamentos_recebidos: number | null;
  aprovado_nome: string | null;
  avaliacao_estrelas: number | null;
  avaliacao_comentario: string | null;
  solicitacao_pai_id: string | null;
  numero_os: string | null;
  codigo_autorizacao: string | null;
  confirmada_pelo_solicitante: boolean | null;
}

function tempoDecorrido(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function urgenciaBadge(p: string) {
  const map: Record<string, { color: string; cls: string }> = {
    Urgente: { color: "🔴", cls: "bg-red-500 text-white" },
    Alta: { color: "🟠", cls: "bg-orange-500 text-white" },
    Normal: { color: "🟡", cls: "bg-yellow-500 text-black" },
    Baixa: { color: "🟢", cls: "bg-emerald-500 text-white" },
  };
  return map[p] ?? map.Normal;
}

function statusInfo(s: string) {
  if (s === "Solicitada") return { icon: "⏳", label: "Aguardando fornecedor" };
  if (s === "Orçamento Enviado" || s === "Aguardando Aprovação") return { icon: "📋", label: "Orçamento recebido" };
  if (s === "Aprovada") return { icon: "✅", label: "Aprovada — aguardando execução" };
  if (s === "Em Andamento") return { icon: "🔧", label: "Em execução" };
  if (s === "Concluída") return { icon: "🏁", label: "Concluída" };
  if (s === "Faturamento") return { icon: "🧾", label: "Enviada p/ faturamento" };
  if (s === "Recusada") return { icon: "❌", label: "Recusada" };
  if (s === "Cancelada") return { icon: "🚫", label: "Cancelada" };
  return { icon: "•", label: s };
}

function ManutencoesGestor() {
  const { user, empresaId } = useAuth();
  const [tab, setTab] = useState("pendentes");
  const [items, setItems] = useState<Manut[]>([]);
  const [loading, setLoading] = useState(true);
  const [veiculosMap, setVeiculosMap] = useState<Record<string, { placa: string; modelo: string; marca: string; foto: string | null }>>({});
  const [pecasMap, setPecasMap] = useState<Record<string, Array<{ descricao: string; quantidade: number; valor_unitario: number }>>>({});
  const [fornecedoresMap, setFornecedoresMap] = useState<Record<string, { nome: string; logo: string | null }>>({});
  const [orcamentosRedeMap, setOrcamentosRedeMap] = useState<Record<string, Manut[]>>({});
  const [detalhe, setDetalhe] = useState<Manut | null>(null);
  const [aprovaOpen, setAprovaOpen] = useState<Manut | null>(null);
  const [aprovaNome, setAprovaNome] = useState("");
  const [recusaOpen, setRecusaOpen] = useState<Manut | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [concluiOpen, setConcluiOpen] = useState<Manut | null>(null);
  const [estrelas, setEstrelas] = useState(5);
  const [comentarioAv, setComentarioAv] = useState("");
  const [acao, setAcao] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [filtroUrg, setFiltroUrg] = useState<string>("todos");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("manutencoes")
      .select("*")
      .order("data_solicitacao", { ascending: false })
      .limit(300);
    const list = (data ?? []) as any as Manut[];
    setItems(list);

    const veiculoIds = Array.from(new Set(list.map((m) => m.veiculo_id)));
    if (veiculoIds.length) {
      const { data: vs } = await supabase
        .from("veiculos")
        .select("id, placa, modelo, marca, foto_principal_url")
        .in("id", veiculoIds);
      const map: Record<string, any> = {};
      (vs ?? []).forEach((v) => { map[v.id] = { placa: v.placa, modelo: v.modelo, marca: v.marca, foto: v.foto_principal_url }; });
      setVeiculosMap(map);
    }

    const fornIds = Array.from(new Set(list.map((m) => m.fornecedor_id).filter(Boolean) as string[]));
    if (fornIds.length) {
      const { data: fs } = await supabase
        .from("fornecedores_cadastro")
        .select("user_id, razao_social, nome_fantasia, logo_url")
        .in("user_id", fornIds);
      const map: Record<string, any> = {};
      (fs ?? []).forEach((f: any) => {
        if (f.user_id) map[f.user_id] = { nome: f.nome_fantasia || f.razao_social, logo: f.logo_url };
      });
      setFornecedoresMap(map);
    }

    const ids = list.map((m) => m.id);
    if (ids.length) {
      const { data: pecas } = await supabase
        .from("manutencao_pecas")
        .select("manutencao_id, descricao, quantidade, valor_unitario")
        .in("manutencao_id", ids);
      const pm: typeof pecasMap = {};
      (pecas ?? []).forEach((p: any) => {
        (pm[p.manutencao_id] ??= []).push(p);
      });
      setPecasMap(pm);

      // Orçamentos da rede: agrupa filhos por solicitacao_pai_id
      const grupos: Record<string, Manut[]> = {};
      list.forEach((m) => {
        if (m.solicitacao_pai_id) {
          (grupos[m.solicitacao_pai_id] ??= []).push(m);
        }
      });
      setOrcamentosRedeMap(grupos);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  // Realtime: ao receber orçamento, recarregar
  useEffect(() => {
    const ch = supabase
      .channel("manut-gestor")
      .on("postgres_changes", { event: "*", schema: "public", table: "manutencoes" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Apenas solicitações principais (não filhas) na lista
  const principais = items.filter((m) => !m.solicitacao_pai_id);

  const aplicarFiltroUrg = (arr: Manut[]) =>
    filtroUrg === "todos" ? arr : arr.filter((m) => m.prioridade === filtroUrg);

  const pendentes = aplicarFiltroUrg(principais.filter((i) => ["Solicitada", "Orçamento Enviado"].includes(i.status)));
  const aprovadas = aplicarFiltroUrg(principais.filter((i) => ["Aprovada", "Em Andamento"].includes(i.status)));
  const concluidas = aplicarFiltroUrg(principais.filter((i) => i.status === "Concluída"));
  const recusadas = aplicarFiltroUrg(principais.filter((i) => i.status === "Recusada"));

  const aguardandoOrc = principais.filter((m) => m.status === "Orçamento Enviado").length;
  const urgentes = principais.filter((m) => m.prioridade === "Urgente" && !["Concluída", "Recusada"].includes(m.status)).length;

  async function aprovar(m: Manut, nome: string) {
    if (!user) return;
    if (!nome.trim()) { toast.error("Informe quem está aprovando"); return; }
    setAcao(true);
    try {
      const { error } = await supabase
        .from("manutencoes")
        .update({
          status: "Aprovada",
          aprovado_por: user.id,
          aprovado_nome: nome,
          data_aprovacao: new Date().toISOString(),
        })
        .eq("id", m.id);
      if (error) throw error;
      if (m.fornecedor_id) {
        await notifyUser({
          userId: m.fornecedor_id,
          titulo: "✅ Orçamento aprovado",
          mensagem: `${veiculosMap[m.veiculo_id]?.placa || ""} • ${m.descricao}`,
          tipo: "sucesso",
          link: "/fornecedor/historico",
        });
      }
      // Se faz parte de envio à rede, recusa os irmãos
      if (m.solicitacao_pai_id) {
        const irmaos = (orcamentosRedeMap[m.solicitacao_pai_id] ?? []).filter((x) => x.id !== m.id);
        for (const irm of irmaos) {
          await supabase
            .from("manutencoes")
            .update({
              status: "Recusada",
              observacoes: `${irm.observacoes ? irm.observacoes + " | " : ""}Outro fornecedor foi selecionado`,
            })
            .eq("id", irm.id);
          if (irm.fornecedor_id) {
            await notifyUser({
              userId: irm.fornecedor_id,
              titulo: "Orçamento não selecionado",
              mensagem: "Outro fornecedor foi escolhido para esta solicitação.",
              tipo: "info",
            });
          }
        }
      }
      toast.success("Orçamento aprovado");
      setAprovaOpen(null); setAprovaNome("");
      setDetalhe(null);
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAcao(false);
    }
  }

  async function recusar() {
    if (!recusaOpen || !user) return;
    if (!motivoRecusa.trim()) { toast.error("Informe o motivo"); return; }
    setAcao(true);
    try {
      const { error } = await supabase
        .from("manutencoes")
        .update({
          status: "Recusada",
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
          observacoes: `${recusaOpen.observacoes ? recusaOpen.observacoes + " | " : ""}Recusa: ${motivoRecusa}`,
        })
        .eq("id", recusaOpen.id);
      if (error) throw error;
      if (recusaOpen.fornecedor_id) {
        await notifyUser({
          userId: recusaOpen.fornecedor_id,
          titulo: "❌ Orçamento recusado",
          mensagem: motivoRecusa,
          tipo: "alerta",
          link: "/fornecedor/historico",
        });
      }
      toast.success("Orçamento recusado");
      setRecusaOpen(null);
      setMotivoRecusa("");
      setDetalhe(null);
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAcao(false);
    }
  }

  async function confirmarConclusao() {
    if (!concluiOpen || !user) return;
    setAcao(true);
    try {
      const { error } = await supabase
        .from("manutencoes")
        .update({
          avaliacao_estrelas: estrelas,
          avaliacao_comentario: comentarioAv || null,
        })
        .eq("id", concluiOpen.id);
      if (error) throw error;
      if (concluiOpen.fornecedor_id) {
        await notifyUser({
          userId: concluiOpen.fornecedor_id,
          titulo: "⭐ Você recebeu uma avaliação",
          mensagem: `${estrelas} estrelas — ${concluiOpen.descricao}`,
          tipo: "sucesso",
        });
      }
      toast.success("Conclusão confirmada");
      setConcluiOpen(null); setEstrelas(5); setComentarioAv("");
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAcao(false);
    }
  }

  async function enviarFaturamento(m: Manut) {
    const { error } = await supabase
      .from("manutencoes")
      .update({
        status: "Faturamento",
        data_envio_faturamento: new Date().toISOString(),
      })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("OS enviada para faturamento");
    carregar();
  }

  function totalManut(m: Manut) {
    const pecas = (pecasMap[m.id] ?? []).reduce((s, p) => s + Number(p.quantidade) * Number(p.valor_unitario), 0);
    return pecas + Number(m.valor_mao_obra || 0);
  }

  const lista = tab === "pendentes" ? pendentes
    : tab === "aprovadas" ? aprovadas
    : tab === "concluidas" ? concluidas : recusadas;

  const totalConcluidas = useMemo(
    () => concluidas.reduce((s, m) => s + (Number(m.valor_final) || totalManut(m) || 0), 0),
    [concluidas, pecasMap],
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6" /> Manutenções
          </h1>
          <p className="text-sm text-muted-foreground">Solicite, aprove e acompanhe manutenções da frota.</p>
        </div>
        <Button onClick={() => setNovaOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Solicitação
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Pendentes" value={pendentes.length} icon="⏳" />
        <KPI label="Aguardando aprovação" value={aguardandoOrc} icon="🟠" tone="warning" />
        <KPI label="Urgentes" value={urgentes} icon="🔴" tone="danger" />
        <KPI label="Em execução" value={aprovadas.length} icon="🔧" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="pendentes">
              Pendentes {pendentes.length > 0 && <Badge variant="secondary" className="ml-2">{pendentes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
            <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
            <TabsTrigger value="recusadas">Recusadas</TabsTrigger>
          </TabsList>
          <div className="flex gap-1">
            {["todos", "Urgente", "Alta", "Normal", "Baixa"].map((u) => (
              <Button key={u} size="sm" variant={filtroUrg === u ? "default" : "outline"} onClick={() => setFiltroUrg(u)}>
                {u === "todos" ? "Todas" : u}
              </Button>
            ))}
          </div>
        </div>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {tab === "concluidas" && concluidas.length > 0 && (
            <Card className="p-3 bg-primary/5">
              <p className="text-sm">Total no período: <span className="font-bold text-lg">{BRL(totalConcluidas)}</span></p>
            </Card>
          )}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : lista.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhum item.</Card>
          ) : (
            lista.map((m) => {
              const v = veiculosMap[m.veiculo_id];
              const total = totalManut(m) || Number(m.valor_previsto || 0);
              const validadeExp = m.validade_orcamento && new Date(m.validade_orcamento) < new Date();
              const ub = urgenciaBadge(m.prioridade);
              const si = statusInfo(m.status);
              const orcRede = m.enviado_para_rede ? (orcamentosRedeMap[m.id] ?? []) : [];
              const orcCount = orcRede.length;
              const fornNome = m.fornecedor_id
                ? fornecedoresMap[m.fornecedor_id]?.nome
                : m.oficina_nome || (m.enviado_para_rede ? "Rede" : "—");

              return (
                <Card key={m.id} className="p-4 hover:bg-muted/30 cursor-pointer" onClick={() => setDetalhe(m)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.numero_os && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {m.numero_os}
                          </span>
                        )}
                        {m.codigo_autorizacao && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
                            {m.codigo_autorizacao}
                          </span>
                        )}
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", ub.cls)}>{ub.color} {m.prioridade}</span>
                        <Badge variant="outline">{m.tipo}</Badge>
                        <Badge variant="secondary">{si.icon} {si.label}</Badge>
                        {m.enviado_para_rede && (
                          <Badge className="bg-blue-600 text-white"><Megaphone className="w-3 h-3 mr-1" /> Aberto p/ rede</Badge>
                        )}
                        {validadeExp && <Badge variant="destructive">Orçamento expirado</Badge>}
                        {m.aprovado_nome && <Badge variant="default">Aprovado por {m.aprovado_nome}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {v?.foto && <img src={v.foto} alt="" className="w-10 h-10 rounded object-cover" />}
                        <div className="min-w-0">
                          <p className="font-semibold">{v?.placa} · {v?.marca} {v?.modelo}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {tempoDecorrido(m.data_solicitacao)} · {fornNome}
                        {m.enviado_para_rede && ` · ${orcCount} orçamento(s) recebido(s)`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {total > 0 && <p className="text-lg font-bold">{BRL(total)}</p>}
                      {m.valor_maximo_autorizado && (
                        <p className="text-[10px] text-muted-foreground">máx {BRL(m.valor_maximo_autorizado)}</p>
                      )}
                      {(pecasMap[m.id]?.length ?? 0) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Package className="w-3 h-3 inline mr-1" />{pecasMap[m.id].length} peça(s)
                        </p>
                      )}
                      {m.status === "Orçamento Enviado" && !m.enviado_para_rede && (
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setRecusaOpen(m); }}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setAprovaOpen(m); }}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                        </div>
                      )}
                      {m.status === "Concluída" && !m.avaliacao_estrelas && (
                        <Button size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); setConcluiOpen(m); }}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar
                        </Button>
                      )}
                      {m.avaliacao_estrelas && (
                        <div className="flex justify-end mt-1">
                          <Estrelas valor={m.avaliacao_estrelas} readOnly />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detalhe && (() => {
            const v = veiculosMap[detalhe.veiculo_id];
            const pecas = pecasMap[detalhe.id] ?? [];
            const totalPecas = pecas.reduce((s, p) => s + Number(p.quantidade) * Number(p.valor_unitario), 0);
            const total = totalPecas + Number(detalhe.valor_mao_obra || 0);
            const orcRede = detalhe.enviado_para_rede ? (orcamentosRedeMap[detalhe.id] ?? []) : [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{detalhe.tipo} · {v?.placa}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">{statusInfo(detalhe.status).label}</Badge>
                    <Badge variant="outline">{detalhe.prioridade}</Badge>
                    {detalhe.enviado_para_rede && <Badge className="bg-blue-600 text-white">Aberto p/ rede</Badge>}
                  </div>
                  <Section label="Veículo">{v?.placa} · {v?.marca} {v?.modelo}</Section>
                  <Section label="Descrição">{detalhe.descricao}</Section>
                  {detalhe.diagnostico && <Section label="Diagnóstico do fornecedor">{detalhe.diagnostico}</Section>}
                  {detalhe.comprovante_url && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-1">Foto</p>
                      <img src={detalhe.comprovante_url} alt="" className="rounded max-h-48" />
                    </div>
                  )}

                  {/* Orçamentos da rede para comparar */}
                  {detalhe.enviado_para_rede && orcRede.length > 0 && (
                    <div>
                      <p className="font-semibold mb-2">Orçamentos recebidos ({orcRede.length})</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {orcRede.map((o) => {
                          const tot = (pecasMap[o.id] ?? []).reduce((s, p) => s + Number(p.quantidade) * Number(p.valor_unitario), 0) + Number(o.valor_mao_obra || 0);
                          const fName = o.fornecedor_id ? fornecedoresMap[o.fornecedor_id]?.nome : o.oficina_nome;
                          return (
                            <Card key={o.id} className="p-3">
                              <p className="font-semibold text-sm truncate">{fName}</p>
                              <p className="text-lg font-bold">{BRL(tot || Number(o.valor_previsto || 0))}</p>
                              {o.prazo_esperado && <p className="text-xs text-muted-foreground">Prazo: {new Date(o.prazo_esperado).toLocaleDateString("pt-BR")}</p>}
                              <Badge variant="secondary" className="mt-1">{o.status}</Badge>
                              {o.status === "Orçamento Enviado" && (
                                <Button size="sm" className="w-full mt-2" onClick={() => setAprovaOpen(o)}>
                                  ✅ Escolher
                                </Button>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Orçamento individual */}
                  {pecas.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">Peças</p>
                      <div className="border rounded">
                        {pecas.map((p, i) => (
                          <div key={i} className="flex justify-between p-2 border-b last:border-0 text-xs">
                            <span>{p.descricao} × {p.quantidade}</span>
                            <span className="font-mono">{BRL(p.quantidade * p.valor_unitario)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(total > 0 || detalhe.valor_mao_obra) && (
                    <div className="bg-muted rounded p-3 space-y-1">
                      <div className="flex justify-between"><span>Peças</span><span className="font-mono">{BRL(totalPecas)}</span></div>
                      <div className="flex justify-between"><span>Mão de obra</span><span className="font-mono">{BRL(Number(detalhe.valor_mao_obra || 0))}</span></div>
                      <div className="flex justify-between text-base font-bold border-t pt-1"><span>Total</span><span>{BRL(total)}</span></div>
                      {detalhe.valor_maximo_autorizado && (
                        <p className="text-xs text-muted-foreground">Máximo autorizado: {BRL(detalhe.valor_maximo_autorizado)}</p>
                      )}
                    </div>
                  )}
                  {detalhe.validade_orcamento && (
                    <p className="text-xs text-muted-foreground">
                      Validade do orçamento: {new Date(detalhe.validade_orcamento).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  {detalhe.observacoes && <Section label="Observações">{detalhe.observacoes}</Section>}
                  {detalhe.nota_fiscal && (
                    <Section label="Nota Fiscal">
                      <a href={detalhe.nota_fiscal} target="_blank" rel="noreferrer" className="text-primary underline">Abrir NF</a>
                    </Section>
                  )}
                  {detalhe.avaliacao_estrelas && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Sua avaliação</p>
                      <Estrelas valor={detalhe.avaliacao_estrelas} readOnly />
                      {detalhe.avaliacao_comentario && <p className="text-sm mt-1">{detalhe.avaliacao_comentario}</p>}
                    </div>
                  )}
                </div>
                {detalhe.status === "Orçamento Enviado" && !detalhe.enviado_para_rede && (
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setRecusaOpen(detalhe)} disabled={acao}>
                      <XCircle className="w-4 h-4 mr-2" /> Recusar
                    </Button>
                    <Button onClick={() => setAprovaOpen(detalhe)} disabled={acao}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
                    </Button>
                  </DialogFooter>
                )}
                {detalhe.status === "Concluída" && !detalhe.avaliacao_estrelas && (
                  <DialogFooter>
                    <Button onClick={() => setConcluiOpen(detalhe)}>
                      <Star className="w-4 h-4 mr-2" /> Confirmar conclusão e avaliar
                    </Button>
                  </DialogFooter>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Aprovação com nome do responsável */}
      <Dialog open={!!aprovaOpen} onOpenChange={(o) => !o && setAprovaOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar Orçamento</DialogTitle></DialogHeader>
          {aprovaOpen && (
            <div className="space-y-3">
              <p className="text-sm">
                Total: <span className="font-bold text-lg">{BRL(totalManut(aprovaOpen) || Number(aprovaOpen.valor_previsto || 0))}</span>
              </p>
              <div>
                <label className="text-sm">Autorizado por *</label>
                <Input value={aprovaNome} onChange={(e) => setAprovaNome(e.target.value)} placeholder="Seu nome completo" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprovaOpen(null)}>Cancelar</Button>
            <Button onClick={() => aprovaOpen && aprovar(aprovaOpen, aprovaNome)} disabled={acao}>
              {acao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recusa */}
      <Dialog open={!!recusaOpen} onOpenChange={(o) => !o && setRecusaOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar orçamento</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Motivo da recusa (será enviado ao fornecedor)"
            value={motivoRecusa}
            onChange={(e) => setMotivoRecusa(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={recusar} disabled={acao}>
              {acao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar conclusão + avaliação */}
      <Dialog open={!!concluiOpen} onOpenChange={(o) => !o && setConcluiOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Avaliar Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Sua avaliação</label>
              <Estrelas valor={estrelas} onChange={setEstrelas} />
            </div>
            <div>
              <label className="text-sm">Comentário (opcional)</label>
              <Textarea value={comentarioAv} onChange={(e) => setComentarioAv(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcluiOpen(null)}>Cancelar</Button>
            <Button onClick={confirmarConclusao} disabled={acao}>
              {acao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NovaSolicitacaoModal open={novaOpen} onClose={() => setNovaOpen(false)} onCreated={carregar} />
    </div>
  );
}

function KPI({ label, value, icon, tone }: { label: string; value: number; icon: string; tone?: "warning" | "danger" }) {
  return (
    <Card className={cn(
      "p-3",
      tone === "danger" && value > 0 && "border-red-500 bg-red-500/5",
      tone === "warning" && value > 0 && "border-orange-500 bg-orange-500/5",
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase">{label}</p>
        <span>{icon}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}
