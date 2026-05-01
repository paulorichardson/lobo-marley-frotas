import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, CheckCircle2, XCircle, Clock, Loader2, FileText, Package } from "lucide-react";
import { toast } from "sonner";
import { notifyUser } from "@/lib/notify";
import { useAuth } from "@/hooks/useAuth";

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
  validade_orcamento: string | null;
  data_solicitacao: string;
  oficina_nome: string | null;
  observacoes: string | null;
}

function ManutencoesGestor() {
  const { user } = useAuth();
  const [tab, setTab] = useState("pendentes");
  const [items, setItems] = useState<Manut[]>([]);
  const [loading, setLoading] = useState(true);
  const [veiculosMap, setVeiculosMap] = useState<Record<string, { placa: string; modelo: string }>>({});
  const [pecasMap, setPecasMap] = useState<Record<string, Array<{ descricao: string; quantidade: number; valor_unitario: number }>>>({});
  const [detalhe, setDetalhe] = useState<Manut | null>(null);
  const [recusaOpen, setRecusaOpen] = useState<Manut | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [acao, setAcao] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("manutencoes")
      .select("*")
      .order("data_solicitacao", { ascending: false })
      .limit(200);
    const list = (data ?? []) as any as Manut[];
    setItems(list);

    const veiculoIds = Array.from(new Set(list.map((m) => m.veiculo_id)));
    if (veiculoIds.length) {
      const { data: vs } = await supabase
        .from("veiculos")
        .select("id, placa, modelo")
        .in("id", veiculoIds);
      const map: Record<string, { placa: string; modelo: string }> = {};
      (vs ?? []).forEach((v) => { map[v.id] = { placa: v.placa, modelo: v.modelo }; });
      setVeiculosMap(map);
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
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  // Realtime: quando fornecedor cria/atualiza orçamento, recarregar
  useEffect(() => {
    const ch = supabase
      .channel("manut-gestor")
      .on("postgres_changes", { event: "*", schema: "public", table: "manutencoes" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const pendentes = items.filter((i) => ["Solicitada", "Orçamento Enviado"].includes(i.status));
  const aprovadas = items.filter((i) => ["Aprovada", "Em Andamento"].includes(i.status));
  const concluidas = items.filter((i) => i.status === "Concluída");
  const recusadas = items.filter((i) => i.status === "Recusada");

  async function aprovar(m: Manut) {
    if (!user) return;
    setAcao(true);
    try {
      const { error } = await supabase
        .from("manutencoes")
        .update({
          status: "Aprovada",
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
        })
        .eq("id", m.id);
      if (error) throw error;
      if (m.fornecedor_id) {
        await notifyUser({
          userId: m.fornecedor_id,
          titulo: "Orçamento aprovado",
          mensagem: `${veiculosMap[m.veiculo_id]?.placa || ""} • ${m.descricao}`,
          tipo: "sucesso",
          link: "/fornecedor/historico",
        });
      }
      toast.success("Orçamento aprovado");
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
          titulo: "Orçamento recusado",
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

  function totalManut(m: Manut) {
    const pecas = (pecasMap[m.id] ?? []).reduce((s, p) => s + Number(p.quantidade) * Number(p.valor_unitario), 0);
    return pecas + Number(m.valor_mao_obra || 0);
  }

  const lista = tab === "pendentes" ? pendentes
    : tab === "aprovadas" ? aprovadas
    : tab === "concluidas" ? concluidas : recusadas;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="w-6 h-6" /> Manutenções
        </h1>
        <p className="text-sm text-muted-foreground">Aprove ou recuse orçamentos enviados pelos fornecedores.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="pendentes">
            Pendentes {pendentes.length > 0 && <Badge variant="secondary" className="ml-2">{pendentes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
          <TabsTrigger value="recusadas">Recusadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
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
              return (
                <Card key={m.id} className="p-4 hover:bg-muted/30 cursor-pointer" onClick={() => setDetalhe(m)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{m.tipo}</Badge>
                        <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                        {m.prioridade !== "Normal" && <Badge variant="destructive">{m.prioridade}</Badge>}
                        {validadeExp && <Badge variant="destructive">Orçamento expirado</Badge>}
                      </div>
                      <p className="font-semibold mt-1">{v?.placa} · {v?.modelo}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(m.data_solicitacao).toLocaleDateString("pt-BR")}
                        {m.oficina_nome && ` · ${m.oficina_nome}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{BRL(total)}</p>
                      {(pecasMap[m.id]?.length ?? 0) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Package className="w-3 h-3 inline mr-1" />{pecasMap[m.id].length} peça(s)
                        </p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detalhe && (() => {
            const v = veiculosMap[detalhe.veiculo_id];
            const pecas = pecasMap[detalhe.id] ?? [];
            const totalPecas = pecas.reduce((s, p) => s + Number(p.quantidade) * Number(p.valor_unitario), 0);
            const total = totalPecas + Number(detalhe.valor_mao_obra || 0);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{detalhe.tipo} · {v?.placa}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={statusVariant(detalhe.status)}>{detalhe.status}</Badge>
                    <Badge variant="outline">{detalhe.prioridade}</Badge>
                  </div>
                  <Section label="Veículo">{v?.placa} · {v?.modelo}</Section>
                  <Section label="Oficina">{detalhe.oficina_nome || "—"}</Section>
                  <Section label="Descrição">{detalhe.descricao}</Section>
                  {detalhe.diagnostico && <Section label="Diagnóstico">{detalhe.diagnostico}</Section>}
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
                  <div className="bg-muted rounded p-3 space-y-1">
                    <div className="flex justify-between"><span>Peças</span><span className="font-mono">{BRL(totalPecas)}</span></div>
                    <div className="flex justify-between"><span>Mão de obra</span><span className="font-mono">{BRL(Number(detalhe.valor_mao_obra || 0))}</span></div>
                    <div className="flex justify-between text-base font-bold border-t pt-1"><span>Total</span><span>{BRL(total)}</span></div>
                  </div>
                  {detalhe.validade_orcamento && (
                    <p className="text-xs text-muted-foreground">
                      Validade: {new Date(detalhe.validade_orcamento).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  {detalhe.observacoes && <Section label="Observações">{detalhe.observacoes}</Section>}
                </div>
                {["Solicitada", "Orçamento Enviado"].includes(detalhe.status) && (
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { setRecusaOpen(detalhe); }} disabled={acao}>
                      <XCircle className="w-4 h-4 mr-2" /> Recusar
                    </Button>
                    <Button onClick={() => aprovar(detalhe)} disabled={acao}>
                      {acao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Aprovar
                    </Button>
                  </DialogFooter>
                )}
              </>
            );
          })()}
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
    </div>
  );
}

function statusVariant(s: string): any {
  if (["Aprovada", "Concluída"].includes(s)) return "default";
  if (s === "Recusada") return "destructive";
  if (s === "Em Andamento") return "secondary";
  return "outline";
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}
