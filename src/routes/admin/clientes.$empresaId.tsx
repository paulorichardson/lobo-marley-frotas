import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, ArrowLeft, Loader2, FileSignature, Save } from "lucide-react";
import { toast } from "sonner";
import { ContratoFinanceiroSection } from "@/components/admin/ContratoFinanceiroSection";
import { ContratoAnexosSection } from "@/components/admin/ContratoAnexosSection";

export const Route = createFileRoute("/admin/clientes/$empresaId")({
  head: () => ({ meta: [{ title: "Cliente — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <ClienteDetalhe />
      </AppShell>
    </ProtectedRoute>
  ),
});

function ClienteDetalhe() {
  const { empresaId } = Route.useParams();
  const [empresa, setEmpresa] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const [e, u, v] = await Promise.all([
      supabase.from("empresas").select("*").eq("id", empresaId).maybeSingle(),
      supabase.from("perfis").select("id, nome, email, ativo").eq("empresa_id", empresaId),
      supabase.from("veiculos").select("id, placa, marca, modelo, status").eq("empresa_id", empresaId),
    ]);
    setEmpresa(e.data);
    setUsuarios(u.data ?? []);
    setVeiculos(v.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  async function alternarStatus() {
    if (!empresa) return;
    const novo = empresa.status === "ativo" ? "suspenso" : "ativo";
    setActing(true);
    const { error } = await supabase.from("empresas").update({ status: novo }).eq("id", empresa.id);
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success(`Cliente ${novo === "ativo" ? "reativado" : "suspenso"}`);
    load();
  }

  if (loading) {
    return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }
  if (!empresa) {
    return <div className="p-8 text-sm text-muted-foreground">Cliente não encontrado.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/clientes"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
      </Button>

      <header className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {empresa.logo_url
            ? <img src={empresa.logo_url} alt={empresa.razao_social} className="w-full h-full object-cover" />
            : <Building2 className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{empresa.nome_fantasia || empresa.razao_social}</h1>
          <p className="text-sm text-muted-foreground">
            {empresa.cnpj ?? "Sem CNPJ"} · {empresa.cidade ?? "—"}/{empresa.estado ?? ""}
          </p>
          <div className="flex gap-2 mt-2">
            <Badge variant={empresa.status === "ativo" ? "default" : "secondary"}>
              {empresa.status === "ativo" ? "Ativo" : "Suspenso"}
            </Badge>
            <Badge variant="outline">{empresa.plano}</Badge>
          </div>
        </div>
        <Button
          variant={empresa.status === "ativo" ? "destructive" : "default"}
          onClick={alternarStatus}
          disabled={acting}
        >
          {empresa.status === "ativo" ? "Suspender" : "Reativar"}
        </Button>
      </header>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários ({usuarios.length})</TabsTrigger>
          <TabsTrigger value="veiculos">Veículos ({veiculos.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="contrato">
            <FileSignature className="w-3.5 h-3.5 mr-1" /> Contrato
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <DadosClienteEditor empresa={empresa} onSaved={load} />
        </TabsContent>

        <TabsContent value="usuarios">
          <Card className="divide-y">
            {usuarios.length === 0
              ? <div className="p-6 text-sm text-muted-foreground text-center">Nenhum usuário.</div>
              : usuarios.map((u) => (
                <div key={u.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{u.nome}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
              ))}
          </Card>
        </TabsContent>

        <TabsContent value="veiculos">
          <Card className="divide-y">
            {veiculos.length === 0
              ? <div className="p-6 text-sm text-muted-foreground text-center">Nenhum veículo.</div>
              : veiculos.map((v) => (
                <div key={v.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{v.placa}</p>
                    <p className="text-xs text-muted-foreground">{v.marca} {v.modelo}</p>
                  </div>
                  <Badge variant="outline">{v.status}</Badge>
                </div>
              ))}
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card className="p-4 space-y-2 text-sm">
            <Row k="Plano" v={empresa.plano} />
            <Row k="Valor mensal" v={empresa.valor_mensal ? `R$ ${Number(empresa.valor_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} />
            <Row k="Início" v={empresa.data_inicio} />
            <Row k="Vencimento" v={empresa.data_vencimento} />
            <Row k="Observações" v={empresa.observacoes} />
          </Card>
        </TabsContent>

        <TabsContent value="contrato" className="space-y-4">
          <ContratoFinanceiroSection empresaId={empresaId} />
          <ContratoAnexosSection empresaId={empresaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const PLANOS = [
  { value: "basico", label: "Básico" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

function DadosClienteEditor({ empresa, onSaved }: { empresa: any; onSaved: () => void }) {
  const [f, setF] = useState({
    razao_social: empresa.razao_social ?? "",
    nome_fantasia: empresa.nome_fantasia ?? "",
    cnpj: empresa.cnpj ?? "",
    cidade: empresa.cidade ?? "",
    estado: empresa.estado ?? "",
    status: empresa.status ?? "ativo",
    plano: empresa.plano ?? "basico",
    email: empresa.email ?? "",
    telefone: empresa.telefone ?? "",
    observacoes: empresa.observacoes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    const { error } = await supabase.from("empresas").update(f).eq("id", empresa.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
    onSaved();
  }

  function cancelar() {
    setF({
      razao_social: empresa.razao_social ?? "",
      nome_fantasia: empresa.nome_fantasia ?? "",
      cnpj: empresa.cnpj ?? "",
      cidade: empresa.cidade ?? "",
      estado: empresa.estado ?? "",
      status: empresa.status ?? "ativo",
      plano: empresa.plano ?? "basico",
      email: empresa.email ?? "",
      telefone: empresa.telefone ?? "",
      observacoes: empresa.observacoes ?? "",
    });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Razão social *</Label>
          <Input value={f.razao_social} onChange={(e) => setF({ ...f, razao_social: e.target.value })} />
        </div>
        <div>
          <Label>Nome fantasia</Label>
          <Input value={f.nome_fantasia} onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })} />
        </div>
        <div>
          <Label>CNPJ</Label>
          <Input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} />
        </div>
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <div>
            <Label>Cidade</Label>
            <Input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} />
          </div>
          <div>
            <Label>UF</Label>
            <Input maxLength={2} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="suspenso">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Plano</Label>
          <Select value={f.plano} onValueChange={(v) => setF({ ...f, plano: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLANOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>E-mail principal</Label>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea rows={3} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={cancelar} disabled={saving}>Cancelar</Button>
        <Button onClick={salvar} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar alterações
        </Button>
      </div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{k}:</span>
      <span>{v || "—"}</span>
    </div>
  );
}
