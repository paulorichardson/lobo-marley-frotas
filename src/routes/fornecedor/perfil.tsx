import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, User as UserIcon, Building2, Landmark, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { maskCEP, maskPhone, BANCOS_BR } from "@/lib/br-validators";
import { notifyAdmins } from "@/lib/notify";

export const Route = createFileRoute("/fornecedor/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Fornecedor" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <PerfilFornecedor />
      </AppShell>
    </ProtectedRoute>
  ),
});

type Cad = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email_login: string;
  telefone: string | null;
  whatsapp: string | null;
  cep: string | null; logradouro: string | null; numero: string | null;
  complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null;
  banco: string | null; agencia: string | null; conta: string | null; tipo_conta: string | null;
  pix_chave: string | null; pix_tipo: string | null;
  responsavel_nome: string; responsavel_cargo: string | null;
  status: "pendente" | "aprovado" | "reprovado";
  tipos_fornecimento: string[];
};

const BANK_FIELDS: (keyof Cad)[] = ["banco", "agencia", "conta", "tipo_conta", "pix_chave", "pix_tipo"];

function PerfilFornecedor() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cad, setCad] = useState<Cad | null>(null);
  const [orig, setOrig] = useState<Cad | null>(null);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fornecedores_cadastro")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("Cadastro não encontrado");
      return;
    }
    setCad(data as Cad);
    setOrig(data as Cad);
  }

  function set<K extends keyof Cad>(k: K, v: Cad[K]) {
    setCad((c) => (c ? { ...c, [k]: v } : c));
  }

  function bankChanged(): boolean {
    if (!cad || !orig) return false;
    return BANK_FIELDS.some((f) => (cad[f] ?? "") !== (orig[f] ?? ""));
  }

  async function save() {
    if (!cad || !user) return;
    if (!cad.responsavel_nome.trim()) {
      toast.error("Nome do responsável é obrigatório");
      return;
    }
    setSaving(true);
    const bankWasChanged = bankChanged();
    const { error } = await supabase
      .from("fornecedores_cadastro")
      .update({
        nome_fantasia: cad.nome_fantasia,
        telefone: cad.telefone,
        whatsapp: cad.whatsapp,
        cep: cad.cep, logradouro: cad.logradouro, numero: cad.numero,
        complemento: cad.complemento, bairro: cad.bairro, cidade: cad.cidade, estado: cad.estado,
        banco: cad.banco, agencia: cad.agencia, conta: cad.conta, tipo_conta: cad.tipo_conta,
        pix_chave: cad.pix_chave, pix_tipo: cad.pix_tipo,
        responsavel_nome: cad.responsavel_nome, responsavel_cargo: cad.responsavel_cargo,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil atualizado");

    if (bankWasChanged) {
      await notifyAdmins({
        titulo: "Dados bancários alterados",
        mensagem: `${cad.razao_social} (CNPJ ${cad.cnpj}) atualizou os dados bancários/PIX.`,
        tipo: "alerta",
        link: "/admin/financeiro/fornecedores",
      });
      toast.message("Admin notificado da alteração bancária");
    }
    setOrig(cad);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!cad) return null;

  const statusBadge =
    cad.status === "aprovado"
      ? { label: "Aprovado", cls: "bg-emerald-600/15 text-emerald-500" }
      : cad.status === "pendente"
        ? { label: "Pendente", cls: "bg-amber-600/15 text-amber-500" }
        : { label: "Reprovado", cls: "bg-destructive/15 text-destructive" };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Mantenha seus dados atualizados. Alterações bancárias notificam o administrador.
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Empresa (read-only) */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" /> Empresa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Razão social" value={cad.razao_social} readOnly />
          <Field label="CNPJ" value={cad.cnpj} readOnly />
          <div>
            <Label>Nome fantasia</Label>
            <Input value={cad.nome_fantasia ?? ""} onChange={(e) => set("nome_fantasia", e.target.value)} />
          </div>
          <Field label="E-mail de login" value={cad.email_login} readOnly />
          <div>
            <Label>Telefone</Label>
            <Input value={cad.telefone ?? ""} onChange={(e) => set("telefone", maskPhone(e.target.value))} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={cad.whatsapp ?? ""} onChange={(e) => set("whatsapp", maskPhone(e.target.value))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {cad.tipos_fornecimento.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      </Card>

      {/* Endereço */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-accent" /> Endereço
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>CEP</Label>
            <Input value={cad.cep ?? ""} onChange={(e) => set("cep", maskCEP(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <Label>Logradouro</Label>
            <Input value={cad.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} />
          </div>
          <div>
            <Label>Número</Label>
            <Input value={cad.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Complemento</Label>
            <Input value={cad.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={cad.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={cad.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={cad.estado ?? ""} maxLength={2} onChange={(e) => set("estado", e.target.value.toUpperCase())} />
          </div>
        </div>
      </Card>

      {/* Bancário */}
      <Card className="p-5 space-y-4 border-amber-500/30">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4 text-accent" /> Dados bancários
          </h2>
          {bankChanged() && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              Alterações serão notificadas ao admin
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Banco</Label>
            <Select value={cad.banco ?? ""} onValueChange={(v) => set("banco", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
              <SelectContent>
                {BANCOS_BR.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de conta</Label>
            <Select value={cad.tipo_conta ?? ""} onValueChange={(v) => set("tipo_conta", v)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Agência</Label>
            <Input value={cad.agencia ?? ""} onChange={(e) => set("agencia", e.target.value)} />
          </div>
          <div>
            <Label>Conta</Label>
            <Input value={cad.conta ?? ""} onChange={(e) => set("conta", e.target.value)} />
          </div>
          <div>
            <Label>Tipo PIX</Label>
            <Select value={cad.pix_tipo ?? ""} onValueChange={(v) => set("pix_tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Tipo da chave" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chave PIX</Label>
            <Input value={cad.pix_chave ?? ""} onChange={(e) => set("pix_chave", e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Responsável */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-accent" /> Responsável
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={cad.responsavel_nome} onChange={(e) => set("responsavel_nome", e.target.value)} />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={cad.responsavel_cargo ?? ""} onChange={(e) => set("responsavel_cargo", e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-20 md:bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} readOnly={readOnly} className={readOnly ? "bg-muted/40" : ""} />
    </div>
  );
}
