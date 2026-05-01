import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Eye, Check, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_FORNECIMENTO } from "@/lib/br-validators";

interface Cadastro {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  tipos_fornecimento: string[];
  telefone: string | null;
  whatsapp: string | null;
  cep: string | null; logradouro: string | null; numero: string | null;
  bairro: string | null; cidade: string | null; estado: string | null;
  banco: string | null; agencia: string | null; conta: string | null;
  tipo_conta: string | null; pix_chave: string | null; pix_tipo: string | null;
  responsavel_nome: string; responsavel_cpf: string | null; responsavel_cargo: string | null;
  email_login: string;
  status: "pendente" | "aprovado" | "reprovado";
  motivo_reprovacao: string | null;
  data_aprovacao: string | null;
  criado_em: string;
}

export function FornecedoresAdmin() {
  const [tab, setTab] = useState<"pendente" | "aprovado" | "reprovado">("pendente");
  const [items, setItems] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pendente: 0, aprovado: 0, reprovado: 0 });
  const [detail, setDetail] = useState<Cadastro | null>(null);
  const [reproveOf, setReproveOf] = useState<Cadastro | null>(null);
  const [motivo, setMotivo] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fornecedores_cadastro")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const all = (data ?? []) as Cadastro[];
    setItems(all);
    setCounts({
      pendente: all.filter((x) => x.status === "pendente").length,
      aprovado: all.filter((x) => x.status === "aprovado").length,
      reprovado: all.filter((x) => x.status === "reprovado").length,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((x) => x.status === tab);

  async function aprovar(c: Cadastro) {
    setActing(true);
    const { error } = await supabase.functions.invoke("aprovar-fornecedor", {
      body: { cadastro_id: c.id, acao: "aprovar" },
    });
    setActing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${c.razao_social} aprovado`);
    setDetail(null);
    load();
  }

  async function confirmReprove() {
    if (!reproveOf) return;
    if (motivo.trim().length < 3) { toast.error("Informe o motivo"); return; }
    setActing(true);
    const { error } = await supabase.functions.invoke("aprovar-fornecedor", {
      body: { cadastro_id: reproveOf.id, acao: "reprovar", motivo },
    });
    setActing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${reproveOf.razao_social} reprovado`);
    setReproveOf(null);
    setMotivo("");
    load();
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <p className="font-medium">Fornecedores Credenciados</p>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={load}>Atualizar</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <div className="px-4 pt-4">
          <TabsList>
            <TabsTrigger value="pendente">
              Pendentes {counts.pendente > 0 && <Badge variant="destructive" className="ml-2">{counts.pendente}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="aprovado">Aprovados ({counts.aprovado})</TabsTrigger>
            <TabsTrigger value="reprovado">Reprovados ({counts.reprovado})</TabsTrigger>
          </TabsList>
        </div>

        {(["pendente", "aprovado", "reprovado"] as const).map((s) => (
          <TabsContent key={s} value={s} className="p-4 pt-3 space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhum cadastro {s}.</div>
            ) : (
              filtered.map((c) => (
                <Card key={c.id} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold">{c.razao_social}</p>
                    <p className="text-xs text-muted-foreground">CNPJ {c.cnpj} · {c.cidade}/{c.estado}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.tipos_fornecimento.map((t) => {
                        const meta = TIPOS_FORNECIMENTO.find((x) => x.value === t);
                        return <Badge key={t} variant="secondary" className="text-[10px]">{meta?.label ?? t}</Badge>;
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-right text-muted-foreground">
                    <div>{c.email_login}</div>
                    <div>{new Date(c.criado_em).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="outline" onClick={() => setDetail(c)}>
                      <Eye className="w-4 h-4 mr-1" /> Detalhes
                    </Button>
                    {c.status === "pendente" && (
                      <>
                        <Button size="sm" onClick={() => aprovar(c)} disabled={acting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Check className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setReproveOf(c)} disabled={acting}>
                          <X className="w-4 h-4 mr-1" /> Reprovar
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detalhes */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.razao_social}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <Section title="Empresa">
                <Row k="CNPJ" v={detail.cnpj} />
                <Row k="Nome fantasia" v={detail.nome_fantasia} />
                <Row k="Tipos" v={detail.tipos_fornecimento.map((t) => TIPOS_FORNECIMENTO.find((x) => x.value === t)?.label ?? t).join(", ")} />
                <Row k="Telefone" v={detail.telefone} />
                <Row k="WhatsApp" v={detail.whatsapp} />
              </Section>
              <Section title="Endereço">
                <Row k="CEP" v={detail.cep} />
                <Row k="Endereço" v={`${detail.logradouro ?? ""}, ${detail.numero ?? ""} - ${detail.bairro ?? ""}`} />
                <Row k="Cidade/UF" v={`${detail.cidade ?? ""}/${detail.estado ?? ""}`} />
              </Section>
              <Section title="Bancário">
                <Row k="Banco" v={detail.banco} />
                <Row k="Agência" v={detail.agencia} />
                <Row k="Conta" v={`${detail.conta ?? ""} (${detail.tipo_conta ?? ""})`} />
                <Row k="PIX" v={`${detail.pix_chave ?? ""} (${detail.pix_tipo ?? ""})`} />
              </Section>
              <Section title="Responsável / Acesso">
                <Row k="Nome" v={detail.responsavel_nome} />
                <Row k="CPF" v={detail.responsavel_cpf} />
                <Row k="Cargo" v={detail.responsavel_cargo} />
                <Row k="E-mail login" v={detail.email_login} />
              </Section>
              {detail.status === "reprovado" && detail.motivo_reprovacao && (
                <Section title="Motivo da reprovação">
                  <p className="text-destructive">{detail.motivo_reprovacao}</p>
                </Section>
              )}
              {detail.status === "pendente" && (
                <DialogFooter className="gap-2 pt-2">
                  <Button variant="destructive" onClick={() => { setReproveOf(detail); setDetail(null); }} disabled={acting}>
                    <X className="w-4 h-4 mr-1" /> Reprovar
                  </Button>
                  <Button onClick={() => aprovar(detail)} disabled={acting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {acting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Aprovar
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reprovar */}
      <Dialog open={!!reproveOf} onOpenChange={(o) => { if (!o) { setReproveOf(null); setMotivo(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar {reproveOf?.razao_social}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Informe o motivo da reprovação. O fornecedor receberá uma notificação com este texto.</p>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} placeholder="Documentação incompleta, dados bancários inconsistentes, etc." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReproveOf(null); setMotivo(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReprove} disabled={acting}>
              {acting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{title}</p>
      <div className="space-y-0.5 pl-2 border-l-2 border-border">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground w-28 shrink-0">{k}:</span>
      <span>{v || "—"}</span>
    </div>
  );
}
