import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { Plus, Loader2, Building2, Pencil, Trash2, Car, Search, Check } from "lucide-react";
import { toast } from "sonner";
import {
  maskCNPJ, maskCEP, maskPhone, isValidCNPJ, lookupCNPJ, lookupCEP,
} from "@/lib/br-validators";

const TIPOS = [
  { value: "secretaria", label: "Secretaria" },
  { value: "fundo", label: "Fundo" },
  { value: "orgao", label: "Órgão" },
  { value: "autarquia", label: "Autarquia" },
  { value: "departamento", label: "Departamento" },
];

interface Unidade {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: string;
  sigla: string | null;
  cnpj: string | null;
  faturamento_separado: boolean;
  ativo: boolean;
  responsavel_nome: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Veiculo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  unidade_id: string | null;
}

export function UnidadesSection({ empresaId }: { empresaId: string }) {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);

  async function load() {
    setLoading(true);
    const [u, v] = await Promise.all([
      supabase.from("unidades").select("*").eq("empresa_id", empresaId).order("nome"),
      supabase.from("veiculos").select("id, placa, marca, modelo, unidade_id").eq("empresa_id", empresaId).order("placa"),
    ]);
    if (u.error) toast.error(u.error.message);
    setUnidades((u.data ?? []) as Unidade[]);
    setVeiculos((v.data ?? []) as Veiculo[]);
    const c: Record<string, number> = {};
    (v.data ?? []).forEach((veic: any) => {
      if (veic.unidade_id) c[veic.unidade_id] = (c[veic.unidade_id] ?? 0) + 1;
    });
    setCounts(c);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  async function excluir(u: Unidade) {
    if (!confirm(`Excluir a unidade "${u.nome}"? Os veículos vinculados ficarão sem unidade.`)) return;
    const { error } = await supabase.from("unidades").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Unidade excluída");
    load();
  }

  const semUnidade = veiculos.filter((v) => !v.unidade_id).length;

  return (
    <Tabs defaultValue="lista" className="space-y-4">
      <TabsList>
        <TabsTrigger value="lista">
          <Building2 className="w-3.5 h-3.5 mr-1" /> Unidades ({unidades.length})
        </TabsTrigger>
        <TabsTrigger value="veiculos">
          <Car className="w-3.5 h-3.5 mr-1" /> Vincular veículos
          {semUnidade > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">{semUnidade}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="lista" className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Secretarias, fundos e órgãos vinculados à prefeitura.
          </p>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova unidade</Button>
            </DialogTrigger>
            <UnidadeDialog
              empresaId={empresaId}
              unidade={null}
              onSaved={() => { setOpenNew(false); load(); }}
            />
          </Dialog>
        </div>

        {loading ? (
          <Card className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
        ) : unidades.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma unidade cadastrada. Adicione as secretarias e fundos desta prefeitura.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {unidades.map((u) => (
              <Card key={u.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{u.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.sigla ? `${u.sigla} · ` : ""}{TIPOS.find((t) => t.value === u.tipo)?.label ?? u.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.cnpj || "Sem CNPJ próprio"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => excluir(u)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={u.ativo ? "default" : "secondary"} className="text-[10px]">
                    {u.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                  {u.faturamento_separado && (
                    <Badge variant="outline" className="text-[10px]">Fatura própria</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    <Car className="w-3 h-3 mr-1" /> {counts[u.id] ?? 0} veículos
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        {editing && (
          <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
            <UnidadeDialog
              empresaId={empresaId}
              unidade={editing}
              onSaved={() => { setEditing(null); load(); }}
            />
          </Dialog>
        )}
      </TabsContent>

      <TabsContent value="veiculos">
        <VincularVeiculos
          veiculos={veiculos}
          unidades={unidades}
          onSaved={load}
        />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================
// DIALOG DE UNIDADE (criar/editar)
// ============================================================
function UnidadeDialog({
  empresaId, unidade, onSaved,
}: { empresaId: string; unidade: Unidade | null; onSaved: () => void }) {
  const isEdit = !!unidade;
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [f, setF] = useState<any>({
    nome: (unidade as any)?.nome ?? "",
    tipo: unidade?.tipo ?? "secretaria",
    sigla: (unidade as any)?.sigla ?? "",
    cnpj: (unidade as any)?.cnpj ?? "",
    inscricao_estadual: (unidade as any)?.inscricao_estadual ?? "",
    email: (unidade as any)?.email ?? "",
    telefone: (unidade as any)?.telefone ?? "",
    responsavel_nome: (unidade as any)?.responsavel_nome ?? "",
    responsavel_cargo: (unidade as any)?.responsavel_cargo ?? "",
    responsavel_telefone: (unidade as any)?.responsavel_telefone ?? "",
    responsavel_email: (unidade as any)?.responsavel_email ?? "",
    cep: (unidade as any)?.cep ?? "",
    logradouro: (unidade as any)?.logradouro ?? "",
    numero: (unidade as any)?.numero ?? "",
    complemento: (unidade as any)?.complemento ?? "",
    bairro: (unidade as any)?.bairro ?? "",
    cidade: (unidade as any)?.cidade ?? "",
    estado: (unidade as any)?.estado ?? "",
    faturamento_separado: unidade?.faturamento_separado ?? false,
    ativo: unidade?.ativo ?? true,
    observacoes: (unidade as any)?.observacoes ?? "",
  });

  async function buscarCnpj() {
    if (!isValidCNPJ(f.cnpj)) return toast.error("CNPJ inválido");
    setCnpjLoading(true);
    const data = await lookupCNPJ(f.cnpj);
    setCnpjLoading(false);
    if (!data) return toast.error("CNPJ não encontrado");
    setF((p: any) => ({
      ...p,
      nome: p.nome || data.razao_social || "",
      telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : p.telefone,
      cep: data.cep ? maskCEP(data.cep) : p.cep,
      logradouro: data.logradouro ?? p.logradouro,
      numero: data.numero ?? p.numero,
      bairro: data.bairro ?? p.bairro,
      cidade: data.municipio ?? p.cidade,
      estado: data.uf ?? p.estado,
      faturamento_separado: true,
    }));
    toast.success("Dados preenchidos");
  }

  async function buscarCep() {
    setCepLoading(true);
    const data = await lookupCEP(f.cep);
    setCepLoading(false);
    if (!data) return toast.error("CEP não encontrado");
    setF((p: any) => ({
      ...p,
      logradouro: data.street ?? p.logradouro,
      bairro: data.neighborhood ?? p.bairro,
      cidade: data.city ?? p.cidade,
      estado: data.state ?? p.estado,
    }));
  }

  async function salvar() {
    if (!f.nome.trim()) return toast.error("Nome obrigatório");
    if (f.cnpj && !isValidCNPJ(f.cnpj)) return toast.error("CNPJ inválido");
    setSaving(true);
    const payload = { ...f, empresa_id: empresaId };
    const { error } = isEdit
      ? await supabase.from("unidades").update(payload).eq("id", unidade!.id)
      : await supabase.from("unidades").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Unidade atualizada" : "Unidade criada");
    onSaved();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar unidade" : "Nova unidade"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })}
              placeholder="Ex: Secretaria Municipal de Saúde" />
          </div>
          <div>
            <Label>Sigla</Label>
            <Input value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value })} placeholder="SMS" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>CNPJ próprio (opcional)</Label>
            <div className="flex gap-2">
              <Input value={f.cnpj}
                onChange={(e) => setF({ ...f, cnpj: maskCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00" />
              <Button type="button" variant="outline" onClick={buscarCnpj} disabled={cnpjLoading || !f.cnpj}>
                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm p-2 rounded bg-muted/40">
          <input type="checkbox" checked={f.faturamento_separado}
            onChange={(e) => setF({ ...f, faturamento_separado: e.target.checked })} />
          <span>
            <strong>Fatura própria</strong> — esta unidade recebe fatura separada
            (marque quando ela tiver CNPJ próprio, como Educação, Saúde, Assistência Social).
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: maskPhone(e.target.value) })} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={f.responsavel_nome}
              onChange={(e) => setF({ ...f, responsavel_nome: e.target.value })} />
          </div>
          <div>
            <Label>Cargo do responsável</Label>
            <Input value={f.responsavel_cargo}
              onChange={(e) => setF({ ...f, responsavel_cargo: e.target.value })} />
          </div>
          <div>
            <Label>Telefone do responsável</Label>
            <Input value={f.responsavel_telefone}
              onChange={(e) => setF({ ...f, responsavel_telefone: maskPhone(e.target.value) })} />
          </div>
          <div>
            <Label>E-mail do responsável</Label>
            <Input type="email" value={f.responsavel_email}
              onChange={(e) => setF({ ...f, responsavel_email: e.target.value })} />
          </div>
        </div>

        <div>
          <Label>CEP</Label>
          <div className="flex gap-2">
            <Input value={f.cep}
              onChange={(e) => setF({ ...f, cep: maskCEP(e.target.value) })}
              onBlur={() => f.cep.replace(/\D/g, "").length === 8 && buscarCep()} />
            <Button type="button" variant="outline" onClick={buscarCep} disabled={cepLoading}>
              {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Logradouro</Label>
            <Input value={f.logradouro} onChange={(e) => setF({ ...f, logradouro: e.target.value })} />
          </div>
          <div>
            <Label>Número</Label>
            <Input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} />
          </div>
          <div>
            <Label>UF</Label>
            <Input maxLength={2} value={f.estado}
              onChange={(e) => setF({ ...f, estado: e.target.value.toUpperCase() })} />
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea rows={2} value={f.observacoes}
            onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.ativo}
            onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
          Unidade ativa
        </label>
      </div>
      <DialogFooter>
        <Button onClick={salvar} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Criar unidade"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================================
// VINCULAÇÃO EM MASSA DE VEÍCULOS
// ============================================================
function VincularVeiculos({
  veiculos, unidades, onSaved,
}: { veiculos: Veiculo[]; unidades: Unidade[]; onSaved: () => void }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sem" | "com">("todos");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [alvo, setAlvo] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const filtrados = veiculos.filter((v) => {
    if (filtro === "sem" && v.unidade_id) return false;
    if (filtro === "com" && !v.unidade_id) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return v.placa.toLowerCase().includes(q) ||
      v.marca.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    const s = new Set(selecionados);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelecionados(s);
  }
  function toggleTodos() {
    if (selecionados.size === filtrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((v) => v.id)));
    }
  }

  async function aplicar() {
    if (selecionados.size === 0) return toast.error("Selecione ao menos um veículo");
    if (!alvo) return toast.error("Selecione a unidade de destino");
    setSaving(true);
    const unidadeId = alvo === "__none__" ? null : alvo;
    const { error } = await supabase.from("veiculos")
      .update({ unidade_id: unidadeId })
      .in("id", Array.from(selecionados));
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${selecionados.size} veículo(s) atualizado(s)`);
    setSelecionados(new Set());
    setAlvo("");
    onSaved();
  }

  const mapU = new Map(unidades.map((u) => [u.id, u]));

  if (unidades.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Cadastre pelo menos uma unidade antes de vincular veículos.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap gap-2 items-center sticky top-0 z-10 bg-card">
        <Input placeholder="Buscar placa, marca ou modelo..."
          value={busca} onChange={(e) => setBusca(e.target.value)} className="w-64" />
        <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos ({veiculos.length})</SelectItem>
            <SelectItem value="sem">Sem unidade ({veiculos.filter((v) => !v.unidade_id).length})</SelectItem>
            <SelectItem value="com">Com unidade ({veiculos.filter((v) => v.unidade_id).length})</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">
            {selecionados.size} selecionado(s)
          </span>
          <Select value={alvo} onValueChange={setAlvo}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Vincular à unidade..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Remover vínculo —</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.sigla ? `${u.sigla} — ${u.nome}` : u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={aplicar} disabled={saving || selecionados.size === 0 || !alvo}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Aplicar
          </Button>
        </div>
      </Card>

      <Card className="divide-y">
        <div className="p-2 flex items-center gap-2 bg-muted/40 text-xs">
          <input type="checkbox"
            checked={filtrados.length > 0 && selecionados.size === filtrados.length}
            onChange={toggleTodos} />
          <span>Selecionar todos ({filtrados.length})</span>
        </div>
        {filtrados.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum veículo.</div>
        ) : filtrados.map((v) => {
          const u = v.unidade_id ? mapU.get(v.unidade_id) : null;
          return (
            <label key={v.id} className="p-2 flex items-center gap-3 hover:bg-accent/10 cursor-pointer">
              <input type="checkbox"
                checked={selecionados.has(v.id)}
                onChange={() => toggle(v.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{v.placa}</p>
                <p className="text-xs text-muted-foreground truncate">{v.marca} {v.modelo}</p>
              </div>
              {u ? (
                <Badge variant="outline" className="text-[10px]">
                  {u.sigla || u.nome}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Sem unidade</Badge>
              )}
            </label>
          );
        })}
      </Card>
    </div>
  );
}
