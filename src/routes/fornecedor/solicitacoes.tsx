import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Megaphone, Loader2, FileSpreadsheet, XCircle, Clock, Truck } from "lucide-react";
import { toast } from "sonner";
import { notifyEmpresaGestores } from "@/lib/notify";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fornecedor/solicitacoes")({
  head: () => ({ meta: [{ title: "Solicitações — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <SolicitacoesPage />
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
  empresa_id: string | null;
  tipo: string;
  descricao: string;
  prioridade: string;
  status: string;
  valor_maximo_autorizado: number | null;
  prazo_esperado: string | null;
  data_solicitacao: string;
  enviado_para_rede: boolean | null;
  total_orcamentos_recebidos: number | null;
  observacoes: string | null;
}

function tempo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function urgenciaCls(p: string) {
  if (p === "Urgente") return "bg-red-500 text-white";
  if (p === "Alta") return "bg-orange-500 text-white";
  if (p === "Normal") return "bg-yellow-500 text-black";
  return "bg-emerald-500 text-white";
}

function SolicitacoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("diretas");
  const [diretas, setDiretas] = useState<Manut[]>([]);
  const [rede, setRede] = useState<Manut[]>([]);
  const [respondidas, setRespondidas] = useState<Manut[]>([]);
  const [veiculosMap, setVeiculosMap] = useState<Record<string, { placa: string; modelo: string; marca: string; foto: string | null }>>({});
  const [empresasMap, setEmpresasMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [recusaOpen, setRecusaOpen] = useState<Manut | null>(null);
  const [motivo, setMotivo] = useState("");
  const [acao, setAcao] = useState(false);

  async function carregar() {
    if (!user) return;
    setLoading(true);

    // Diretas: minhas solicitações pendentes (sem orçamento)
    const { data: diretasData } = await supabase
      .from("manutencoes")
      .select("*")
      .eq("fornecedor_id", user.id)
      .in("status", ["Solicitada"])
      .is("solicitacao_pai_id", null)
      .order("data_solicitacao", { ascending: false });

    // Da rede: enviadas para a rede e ainda abertas
    const { data: redeData } = await supabase
      .from("manutencoes")
      .select("*")
      .eq("enviado_para_rede", true)
      .eq("status", "Solicitada")
      .is("solicitacao_pai_id", null)
      .order("data_solicitacao", { ascending: false })
      .limit(100);

    // Respondidas: orçamentos que enviei (status Orçamento Enviado, Aprovada, Recusada)
    const { data: respData } = await supabase
      .from("manutencoes")
      .select("*")
      .eq("fornecedor_id", user.id)
      .in("status", ["Orçamento Enviado", "Aprovada", "Recusada", "Em Andamento", "Concluída"])
      .order("data_solicitacao", { ascending: false })
      .limit(50);

    setDiretas((diretasData ?? []) as any);
    setRede((redeData ?? []) as any);
    setRespondidas((respData ?? []) as any);

    const all = [...(diretasData ?? []), ...(redeData ?? []), ...(respData ?? [])];
    const veicIds = Array.from(new Set(all.map((m) => m.veiculo_id).filter(Boolean)));
    const empresaIds = Array.from(new Set(all.map((m) => m.empresa_id).filter(Boolean) as string[]));

    if (veicIds.length) {
      const { data: vs } = await supabase
        .from("veiculos")
        .select("id, placa, modelo, marca, foto_principal_url")
        .in("id", veicIds as string[]);
      const map: Record<string, any> = {};
      (vs ?? []).forEach((v) => { map[v.id] = { placa: v.placa, modelo: v.modelo, marca: v.marca, foto: v.foto_principal_url }; });
      setVeiculosMap(map);
    }
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

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("forn-solic")
      .on("postgres_changes", { event: "*", schema: "public", table: "manutencoes" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function recusar() {
    if (!recusaOpen || !user) return;
    if (!motivo.trim()) { toast.error("Informe o motivo"); return; }
    setAcao(true);
    try {
      // Para solicitação direta (não rede), marca como Recusada.
      // Para rede, o fornecedor não recusa a solicitação inteira — apenas ignora. Aqui só direta.
      const { error } = await supabase
        .from("manutencoes")
        .update({
          status: "Recusada",
          observacoes: `${recusaOpen.observacoes ? recusaOpen.observacoes + " | " : ""}Recusa do fornecedor: ${motivo}`,
        })
        .eq("id", recusaOpen.id);
      if (error) throw error;
      if (recusaOpen.empresa_id) {
        await notifyEmpresaGestores({
          empresaId: recusaOpen.empresa_id,
          titulo: "Fornecedor recusou solicitação",
          mensagem: motivo,
          tipo: "alerta",
        });
      }
      toast.success("Recusa registrada");
      setRecusaOpen(null); setMotivo("");
      carregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAcao(false);
    }
  }

  function abrirOrcamento(m: Manut) {
    navigate({ to: "/fornecedor/orcamento", search: { solicitacaoId: m.id } as any });
  }

  function CardSolic({ m, isRede, isResp }: { m: Manut; isRede?: boolean; isResp?: boolean }) {
    const v = veiculosMap[m.veiculo_id];
    const empresa = m.empresa_id ? empresasMap[m.empresa_id] : null;
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          {v?.foto ? (
            <img src={v.foto} alt="" className="w-14 h-14 rounded object-cover" />
          ) : (
            <div className="w-14 h-14 rounded bg-muted flex items-center justify-center">
              <Truck className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", urgenciaCls(m.prioridade))}>
                {m.prioridade}
              </span>
              <Badge variant="outline">{m.tipo}</Badge>
              {isRede && <Badge className="bg-amber-500 text-white"><Megaphone className="w-3 h-3 mr-1" />Aberta p/ rede</Badge>}
              {isResp && <Badge variant="secondary">{m.status}</Badge>}
            </div>
            <p className="font-semibold">{v?.placa} · {v?.marca} {v?.modelo}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {empresa && <span>🏢 {empresa}</span>}
              <span><Clock className="w-3 h-3 inline mr-0.5" />{tempo(m.data_solicitacao)}</span>
              {m.prazo_esperado && <span>📅 prazo {new Date(m.prazo_esperado).toLocaleDateString("pt-BR")}</span>}
              {m.valor_maximo_autorizado && <span>💰 até {BRL(m.valor_maximo_autorizado)}</span>}
              {isRede && (m.total_orcamentos_recebidos ?? 0) > 0 && (
                <span>📊 {m.total_orcamentos_recebidos} orçamento(s) enviado(s)</span>
              )}
            </div>
          </div>
        </div>
        {!isResp && (
          <div className="flex gap-2 mt-3">
            <Button className="flex-1 h-11" onClick={() => abrirOrcamento(m)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Enviar Orçamento
            </Button>
            {!isRede && (
              <Button variant="outline" className="h-11" onClick={() => setRecusaOpen(m)}>
                <XCircle className="w-4 h-4 mr-1" /> Recusar
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" /> Solicitações
        </h1>
        <p className="text-sm text-muted-foreground">Solicitações que vieram para você.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="diretas">
            Diretas {diretas.length > 0 && <Badge variant="secondary" className="ml-1">{diretas.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rede">
            Da Rede {rede.length > 0 && <Badge variant="secondary" className="ml-1">{rede.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="respondidas">Respondidas</TabsTrigger>
        </TabsList>

        <TabsContent value="diretas" className="space-y-3 mt-4">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto py-8" /> : diretas.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhuma solicitação direta.</Card>
          ) : diretas.map((m) => <CardSolic key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="rede" className="space-y-3 mt-4">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto py-8" /> : rede.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhuma solicitação aberta na rede.</Card>
          ) : rede.map((m) => <CardSolic key={m.id} m={m} isRede />)}
        </TabsContent>
        <TabsContent value="respondidas" className="space-y-3 mt-4">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto py-8" /> : respondidas.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhuma resposta enviada ainda.</Card>
          ) : respondidas.map((m) => <CardSolic key={m.id} m={m} isResp />)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!recusaOpen} onOpenChange={(o) => !o && setRecusaOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar solicitação</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Motivo da recusa (será enviado ao gestor)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={recusar} disabled={acao}>
              {acao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
