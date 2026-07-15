import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Save, Building2 } from "lucide-react";

export const Route = createFileRoute("/admin/fornecedores")({
  component: FornecedoresPage,
  head: () => ({
    meta: [{ title: "Fornecedores — Lobo Marley" }],
  }),
});

type Fornecedor = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  telefone: string | null;
  whatsapp: string | null;
  email_login: string;
  responsavel_nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  status: string;
  tipos_fornecimento: string[];
};

const PIX_TIPOS = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

function FornecedoresPage() {
  const [list, setList] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { pix_chave: string; pix_tipo: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fornecedores_cadastro")
      .select("id,razao_social,nome_fantasia,cnpj,telefone,whatsapp,email_login,responsavel_nome,banco,agencia,conta,tipo_conta,pix_chave,pix_tipo,status,tipos_fornecimento")
      .order("razao_social", { ascending: true });
    if (error) toast.error("Erro ao carregar fornecedores");
    else setList((data ?? []) as Fornecedor[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const setDraft = (id: string, patch: Partial<{ pix_chave: string; pix_tipo: string }>) => {
    const current = drafts[id] ?? {
      pix_chave: list.find(f => f.id === id)?.pix_chave ?? "",
      pix_tipo: list.find(f => f.id === id)?.pix_tipo ?? "",
    };
    setDrafts({ ...drafts, [id]: { ...current, ...patch } });
  };

  const salvarPix = async (f: Fornecedor) => {
    const d = drafts[f.id];
    if (!d) return;
    setSavingId(f.id);
    const { error } = await supabase
      .from("fornecedores_cadastro")
      .update({ pix_chave: d.pix_chave || null, pix_tipo: d.pix_tipo || null })
      .eq("id", f.id);
    setSavingId(null);
    if (error) { toast.error("Falha ao salvar PIX"); return; }
    toast.success("Chave PIX atualizada");
    setDrafts(prev => {
      const next = { ...prev }; delete next[f.id]; return next;
    });
    await load();
  };

  const filtrada = list.filter(f => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [f.razao_social, f.nome_fantasia, f.cnpj, f.email_login, f.responsavel_nome]
      .filter(Boolean).some(v => (v as string).toLowerCase().includes(q));
  });

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-2xl font-bold">Fornecedores</h1>
            <p className="text-sm text-muted-foreground">Cadastro completo e chave PIX de pagamento</p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Buscar por razão social, CNPJ, responsável..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtrada.length === 0 ? (
          <p className="text-muted-foreground">Nenhum fornecedor encontrado.</p>
        ) : (
          <div className="space-y-3">
            {filtrada.map((f) => {
              const draft = drafts[f.id];
              const dirty = !!draft && (
                (draft.pix_chave ?? "") !== (f.pix_chave ?? "") ||
                (draft.pix_tipo ?? "") !== (f.pix_tipo ?? "")
              );
              return (
                <Card key={f.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{f.nome_fantasia || f.razao_social}</h3>
                        <Badge variant={f.status === "aprovado" ? "default" : "secondary"}>{f.status}</Badge>
                        {f.tipos_fornecimento?.map(t => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{f.razao_social} · CNPJ {f.cnpj}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável</p>
                      <p>{f.responsavel_nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contato</p>
                      <p>{f.whatsapp || f.telefone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="truncate">{f.email_login}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p>{f.banco || "—"} {f.agencia && `· Ag. ${f.agencia}`} {f.conta && `· CC ${f.conta}`}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-border p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chave PIX de pagamento</p>
                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2 items-end">
                      <div>
                        <label className="text-xs text-muted-foreground">Tipo</label>
                        <Select
                          value={draft?.pix_tipo ?? f.pix_tipo ?? ""}
                          onValueChange={(v) => setDraft(f.id, { pix_tipo: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>
                            {PIX_TIPOS.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Chave</label>
                        <Input
                          value={draft?.pix_chave ?? f.pix_chave ?? ""}
                          onChange={(e) => setDraft(f.id, { pix_chave: e.target.value })}
                          placeholder="Digite a chave PIX"
                        />
                      </div>
                      <Button
                        onClick={() => salvarPix(f)}
                        disabled={!dirty || savingId === f.id}
                        size="sm"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {savingId === f.id ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
