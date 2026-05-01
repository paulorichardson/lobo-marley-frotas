import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
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
import { Building2, Plus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  maskCNPJ, maskCEP, maskCPF, maskPhone,
  isValidCNPJ, lookupCNPJ, lookupCEP,
} from "@/lib/br-validators";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Lobo Marley" },
      { name: "description", content: "Gestão das empresas clientes da plataforma." },
    ],
  }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <ClientesPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  plano: string;
  status: string;
  logo_url: string | null;
  valor_mensal: number | null;
}

interface Counts { veiculos: number; usuarios: number }

const PLANOS = [
  { value: "basico", label: "Básico (até 20 veículos)", limite: 20 },
  { value: "pro", label: "Pro (até 100 veículos)", limite: 100 },
  { value: "enterprise", label: "Enterprise (ilimitado)", limite: null },
];

function ClientesPage() {
  const [items, setItems] = useState<Empresa[]>([]);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "suspenso">("todos");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");
  const [openNew, setOpenNew] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("empresas")
      .select("id, razao_social, nome_fantasia, cnpj, cidade, estado, plano, status, logo_url, valor_mensal")
      .order("criado_em", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setItems(data ?? []);

    // contagens em paralelo
    const c: Record<string, Counts> = {};
    await Promise.all((data ?? []).map(async (e) => {
      const [v, u] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("empresa_id", e.id),
        supabase.from("perfis").select("id", { count: "exact", head: true }).eq("empresa_id", e.id),
      ]);
      c[e.id] = { veiculos: v.count ?? 0, usuarios: u.count ?? 0 };
    }));
    setCounts(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((e) => {
    if (filtroStatus !== "todos" && e.status !== filtroStatus) return false;
    if (filtroPlano !== "todos" && e.plano !== filtroPlano) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-accent" />
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Empresas que contratam a plataforma</p>
          </div>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Cadastrar novo cliente</Button>
          </DialogTrigger>
          <NovoClienteDialog onCreated={() => { setOpenNew(false); load(); }} />
        </Dialog>
      </header>

      <div className="flex gap-3 flex-wrap">
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="suspenso">Suspensos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPlano} onValueChange={setFiltroPlano}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os planos</SelectItem>
            {PLANOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground self-center">
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => {
            const cs = counts[e.id] ?? { veiculos: 0, usuarios: 0 };
            const plano = PLANOS.find((p) => p.value === e.plano);
            return (
              <Card key={e.id} className="p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {e.logo_url
                      ? <img src={e.logo_url} alt={e.razao_social} className="w-full h-full object-cover" />
                      : <Building2 className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{e.nome_fantasia || e.razao_social}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.cnpj || "Sem CNPJ"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.cidade ? `${e.cidade}/${e.estado ?? ""}` : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={e.status === "ativo" ? "default" : "secondary"} className="text-[10px]">
                    {e.status === "ativo" ? "Ativo" : "Suspenso"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {plano?.label.split(" ")[0] ?? e.plano}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-border">
                  <div>
                    <p className="text-lg font-bold">{cs.veiculos}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Veículos</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{cs.usuarios}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Usuários</p>
                  </div>
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/admin/clientes/$empresaId" params={{ empresaId: e.id }}>
                    Ver detalhes
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// MODAL DE NOVO CLIENTE (3 STEPS)
// =====================================================================
function NovoClienteDialog({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [empresa, setEmpresa] = useState({
    razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "",
    telefone: "", email: "", site: "",
    plano: "basico" as string,
    data_inicio: "", data_vencimento: "", valor_mensal: "",
    observacoes: "",
    cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "",
  });
  const [gestor, setGestor] = useState({
    nome: "", cpf: "", cargo: "", telefone: "",
    email: "", senha: "", senha2: "", enviarEmail: true,
  });

  async function buscarCnpj() {
    if (!isValidCNPJ(empresa.cnpj)) return toast.error("CNPJ inválido");
    setCnpjLoading(true);
    const data = await lookupCNPJ(empresa.cnpj);
    setCnpjLoading(false);
    if (!data) return toast.error("CNPJ não encontrado");
    setEmpresa((p) => ({
      ...p,
      razao_social: data.razao_social ?? p.razao_social,
      nome_fantasia: data.nome_fantasia ?? p.nome_fantasia,
      email: data.email ?? p.email,
      telefone: data.telefone ?? p.telefone,
      cep: data.cep ? maskCEP(data.cep) : p.cep,
      logradouro: data.logradouro ?? p.logradouro,
      numero: data.numero ?? p.numero,
      complemento: data.complemento ?? p.complemento,
      bairro: data.bairro ?? p.bairro,
      cidade: data.municipio ?? p.cidade,
      estado: data.uf ?? p.estado,
    }));
    toast.success("Dados preenchidos pelo CNPJ");
  }

  async function buscarCep() {
    setCepLoading(true);
    const data = await lookupCEP(empresa.cep);
    setCepLoading(false);
    if (!data) return toast.error("CEP não encontrado");
    setEmpresa((p) => ({
      ...p,
      logradouro: data.street ?? p.logradouro,
      bairro: data.neighborhood ?? p.bairro,
      cidade: data.city ?? p.cidade,
      estado: data.state ?? p.estado,
    }));
  }

  function validateStep1() {
    if (!empresa.razao_social.trim()) return "Razão social obrigatória";
    if (empresa.cnpj && !isValidCNPJ(empresa.cnpj)) return "CNPJ inválido";
    return null;
  }
  function validateStep3() {
    if (!gestor.nome.trim()) return "Nome do gestor obrigatório";
    if (!gestor.email.includes("@")) return "E-mail do gestor inválido";
    if (gestor.senha.length < 8) return "Senha deve ter pelo menos 8 caracteres";
    if (gestor.senha !== gestor.senha2) return "Senhas não conferem";
    return null;
  }

  async function salvar() {
    const err = validateStep3();
    if (err) return toast.error(err);
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("criar-cliente-empresa", {
      body: {
        empresa: {
          razao_social: empresa.razao_social.trim(),
          nome_fantasia: empresa.nome_fantasia || null,
          cnpj: empresa.cnpj || null,
          inscricao_estadual: empresa.inscricao_estadual || null,
          email: empresa.email || null,
          telefone: empresa.telefone || null,
          site: empresa.site || null,
          plano: empresa.plano,
          limite_veiculos: PLANOS.find((p) => p.value === empresa.plano)?.limite ?? null,
          data_inicio: empresa.data_inicio || null,
          data_vencimento: empresa.data_vencimento || null,
          valor_mensal: empresa.valor_mensal ? Number(empresa.valor_mensal) : null,
          observacoes: empresa.observacoes || null,
          cep: empresa.cep || null,
          logradouro: empresa.logradouro || null,
          numero: empresa.numero || null,
          complemento: empresa.complemento || null,
          bairro: empresa.bairro || null,
          cidade: empresa.cidade || null,
          estado: empresa.estado || null,
        },
        gestor: {
          nome: gestor.nome.trim(),
          email: gestor.email.trim().toLowerCase(),
          senha: gestor.senha,
          telefone: gestor.telefone || null,
        },
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      return toast.error(error?.message || (data as any)?.error || "Erro ao cadastrar");
    }
    toast.success("Cliente cadastrado com sucesso");
    onCreated();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo cliente — etapa {step} de 3</DialogTitle>
      </DialogHeader>

      {/* progress */}
      <div className="flex gap-2 mb-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input
                value={empresa.cnpj}
                onChange={(e) => setEmpresa({ ...empresa, cnpj: maskCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
              />
              <Button type="button" variant="outline" onClick={buscarCnpj} disabled={cnpjLoading}>
                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Razão social *</Label>
              <Input value={empresa.razao_social}
                onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })} />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input value={empresa.nome_fantasia}
                onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })} />
            </div>
            <div>
              <Label>Inscrição estadual</Label>
              <Input value={empresa.inscricao_estadual}
                onChange={(e) => setEmpresa({ ...empresa, inscricao_estadual: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={empresa.telefone}
                onChange={(e) => setEmpresa({ ...empresa, telefone: maskPhone(e.target.value) })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={empresa.email}
                onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} />
            </div>
            <div>
              <Label>Site</Label>
              <Input value={empresa.site}
                onChange={(e) => setEmpresa({ ...empresa, site: e.target.value })} />
            </div>
            <div>
              <Label>Plano contratado</Label>
              <Select value={empresa.plano} onValueChange={(v) => setEmpresa({ ...empresa, plano: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor mensal (R$)</Label>
              <Input type="number" step="0.01" value={empresa.valor_mensal}
                onChange={(e) => setEmpresa({ ...empresa, valor_mensal: e.target.value })} />
            </div>
            <div>
              <Label>Início do contrato</Label>
              <Input type="date" value={empresa.data_inicio}
                onChange={(e) => setEmpresa({ ...empresa, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={empresa.data_vencimento}
                onChange={(e) => setEmpresa({ ...empresa, data_vencimento: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações contratuais</Label>
            <Textarea rows={3} value={empresa.observacoes}
              onChange={(e) => setEmpresa({ ...empresa, observacoes: e.target.value })} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input value={empresa.cep}
                onChange={(e) => setEmpresa({ ...empresa, cep: maskCEP(e.target.value) })}
                onBlur={() => empresa.cep.replace(/\D/g, "").length === 8 && buscarCep()} />
              <Button type="button" variant="outline" onClick={buscarCep} disabled={cepLoading}>
                {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Logradouro</Label>
              <Input value={empresa.logradouro}
                onChange={(e) => setEmpresa({ ...empresa, logradouro: e.target.value })} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={empresa.numero}
                onChange={(e) => setEmpresa({ ...empresa, numero: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Complemento</Label>
              <Input value={empresa.complemento}
                onChange={(e) => setEmpresa({ ...empresa, complemento: e.target.value })} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={empresa.bairro}
                onChange={(e) => setEmpresa({ ...empresa, bairro: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input value={empresa.cidade}
                onChange={(e) => setEmpresa({ ...empresa, cidade: e.target.value })} />
            </div>
            <div>
              <Label>UF</Label>
              <Input maxLength={2} value={empresa.estado}
                onChange={(e) => setEmpresa({ ...empresa, estado: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Este será o gestor principal da empresa. Receberá acesso ao painel /gestor.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={gestor.nome} onChange={(e) => setGestor({ ...gestor, nome: e.target.value })} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={gestor.cpf}
                onChange={(e) => setGestor({ ...gestor, cpf: maskCPF(e.target.value) })} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={gestor.cargo}
                onChange={(e) => setGestor({ ...gestor, cargo: e.target.value })} />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input value={gestor.telefone}
                onChange={(e) => setGestor({ ...gestor, telefone: maskPhone(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <Label>E-mail de login *</Label>
              <Input type="email" value={gestor.email}
                onChange={(e) => setGestor({ ...gestor, email: e.target.value })} />
            </div>
            <div>
              <Label>Senha inicial *</Label>
              <Input type="password" value={gestor.senha}
                onChange={(e) => setGestor({ ...gestor, senha: e.target.value })} />
            </div>
            <div>
              <Label>Confirmar senha *</Label>
              <Input type="password" value={gestor.senha2}
                onChange={(e) => setGestor({ ...gestor, senha2: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={gestor.enviarEmail}
              onChange={(e) => setGestor({ ...gestor, enviarEmail: e.target.checked })} />
            Enviar credenciais por e-mail (em breve)
          </label>
        </div>
      )}

      <DialogFooter className="gap-2">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>
            Voltar
          </Button>
        )}
        {step < 3 && (
          <Button onClick={() => {
            if (step === 1) {
              const e = validateStep1();
              if (e) return toast.error(e);
            }
            setStep(step + 1);
          }}>Próximo</Button>
        )}
        {step === 3 && (
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Cadastrar cliente
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
