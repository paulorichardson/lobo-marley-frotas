import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/lobo-marley-logo.svg";
import {
  maskCNPJ, maskCEP, maskCPF, maskPhone,
  isValidCNPJ, isValidCPF, isValidEmail,
  lookupCNPJ, lookupCEP, passwordStrength,
  BANCOS_BR, TIPOS_FORNECIMENTO,
} from "@/lib/br-validators";

export const Route = createFileRoute("/credenciamento")({
  head: () => ({
    meta: [
      { title: "Seja um Fornecedor Credenciado — Lobo Marley" },
      { name: "description", content: "Cadastre sua empresa e comece a fornecer para a frota da Lobo Marley." },
      { property: "og:title", content: "Seja um Fornecedor Credenciado — Lobo Marley" },
      { property: "og:description", content: "Postos, oficinas, casas de peças e parceiros logísticos: cadastre-se em poucos minutos." },
    ],
  }),
  component: CredenciamentoPage,
});

interface FormData {
  // 1
  razao_social: string; nome_fantasia: string; cnpj: string;
  tipos_fornecimento: string[]; telefone: string; whatsapp: string;
  // 2
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; estado: string;
  // 3
  banco: string; agencia: string; conta: string; tipo_conta: string;
  pix_chave: string; pix_tipo: string;
  // 4
  email_login: string; senha: string; senha_confirma: string;
  responsavel_nome: string; responsavel_cpf: string; responsavel_cargo: string;
  // 5
  aceitou_termos: boolean; aceitou_dados_bancarios: boolean;
}

const EMPTY: FormData = {
  razao_social: "", nome_fantasia: "", cnpj: "", tipos_fornecimento: [],
  telefone: "", whatsapp: "",
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "",
  banco: "", agencia: "", conta: "", tipo_conta: "", pix_chave: "", pix_tipo: "",
  email_login: "", senha: "", senha_confirma: "",
  responsavel_nome: "", responsavel_cpf: "", responsavel_cargo: "",
  aceitou_termos: false, aceitou_dados_bancarios: false,
};

const STEPS = ["Empresa", "Endereço", "Bancário", "Acesso", "Termos"];

function CredenciamentoPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setData((d) => ({ ...d, [k]: v }));

  const pwStrength = useMemo(() => passwordStrength(data.senha), [data.senha]);

  async function onCnpjBlur() {
    if (!isValidCNPJ(data.cnpj)) return;
    setCnpjLoading(true);
    const r = await lookupCNPJ(data.cnpj);
    setCnpjLoading(false);
    if (r) {
      setData((d) => ({
        ...d,
        razao_social: d.razao_social || r.razao_social || "",
        nome_fantasia: d.nome_fantasia || r.nome_fantasia || "",
        telefone: d.telefone || (r.ddd_telefone_1 ? maskPhone(r.ddd_telefone_1) : ""),
        cep: d.cep || (r.cep ? maskCEP(r.cep) : ""),
        logradouro: d.logradouro || r.logradouro || "",
        numero: d.numero || r.numero || "",
        complemento: d.complemento || r.complemento || "",
        bairro: d.bairro || r.bairro || "",
        cidade: d.cidade || r.municipio || "",
        estado: d.estado || r.uf || "",
      }));
      toast.success("Dados do CNPJ preenchidos automaticamente");
    } else {
      toast.warning("CNPJ não encontrado — preencha manualmente");
    }
  }

  async function onCepBlur() {
    if (data.cep.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    const r = await lookupCEP(data.cep);
    setCepLoading(false);
    if (r) {
      setData((d) => ({
        ...d,
        logradouro: r.street || d.logradouro,
        bairro: r.neighborhood || d.bairro,
        cidade: r.city || d.cidade,
        estado: r.state || d.estado,
      }));
    }
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!data.razao_social.trim()) return "Razão social obrigatória";
      if (!isValidCNPJ(data.cnpj)) return "CNPJ inválido";
      if (data.tipos_fornecimento.length === 0) return "Selecione ao menos um tipo de fornecimento";
    }
    if (s === 1) {
      if (data.cep.replace(/\D/g, "").length !== 8) return "CEP inválido";
      if (!data.logradouro.trim() || !data.numero.trim() || !data.cidade.trim() || !data.estado.trim()) return "Preencha o endereço completo";
    }
    if (s === 2) {
      if (!data.banco) return "Selecione o banco";
      if (!data.agencia.trim() || !data.conta.trim() || !data.tipo_conta) return "Preencha agência, conta e tipo";
    }
    if (s === 3) {
      if (!isValidEmail(data.email_login)) return "E-mail inválido";
      if (data.senha.length < 8) return "Senha deve ter pelo menos 8 caracteres";
      if (data.senha !== data.senha_confirma) return "Senhas não conferem";
      if (!data.responsavel_nome.trim()) return "Nome do responsável obrigatório";
      if (data.responsavel_cpf && !isValidCPF(data.responsavel_cpf)) return "CPF do responsável inválido";
    }
    if (s === 4) {
      if (!data.aceitou_termos || !data.aceitou_dados_bancarios) return "Aceite os termos para continuar";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  async function submit() {
    for (let i = 0; i <= 4; i++) {
      const err = validateStep(i);
      if (err) { setStep(i); toast.error(err); return; }
    }
    setSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("submit-credenciamento", {
        body: {
          razao_social: data.razao_social.trim(),
          nome_fantasia: data.nome_fantasia.trim() || null,
          cnpj: data.cnpj,
          tipos_fornecimento: data.tipos_fornecimento,
          telefone: data.telefone || null,
          whatsapp: data.whatsapp || null,
          cep: data.cep || null,
          logradouro: data.logradouro || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta: data.conta || null,
          tipo_conta: data.tipo_conta || null,
          pix_chave: data.pix_chave || null,
          pix_tipo: data.pix_tipo || null,
          responsavel_nome: data.responsavel_nome.trim(),
          responsavel_cpf: data.responsavel_cpf || null,
          responsavel_cargo: data.responsavel_cargo || null,
          email_login: data.email_login.trim(),
          senha: data.senha,
          aceitou_termos: data.aceitou_termos,
          aceitou_dados_bancarios: data.aceitou_dados_bancarios,
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message || "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-accent" />
          <h1 className="text-2xl font-bold">Solicitação enviada!</h1>
          <p className="text-muted-foreground">
            Aguarde a aprovação da Lobo Marley. Você receberá um e-mail quando sua conta for aprovada.
          </p>
          <Link to="/login" className="inline-block text-accent hover:underline font-medium">
            ← Voltar para o login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar border-b border-sidebar-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoUrl} alt="Lobo Marley" className="w-10 h-10 rounded-md object-contain bg-background/40 p-1" />
          <div className="flex-1">
            <p className="font-bold text-sidebar-foreground tracking-wide">LOBO MARLEY</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Credenciamento de Fornecedores</p>
          </div>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
            Já sou credenciado →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Seja um Fornecedor Credenciado</h1>
          <p className="text-muted-foreground">Cadastre sua empresa e comece a fornecer para nossa frota</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex items-center gap-1.5 ${i <= step ? "text-accent font-semibold" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i < step ? "bg-accent text-accent-foreground" : i === step ? "bg-accent/20 text-accent border border-accent" : "bg-secondary"}`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-[var(--primary-glow)] transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <Card className="p-5 md:p-7 space-y-5">
          {step === 0 && <Step1 data={data} set={set} onCnpjBlur={onCnpjBlur} cnpjLoading={cnpjLoading} />}
          {step === 1 && <Step2 data={data} set={set} onCepBlur={onCepBlur} cepLoading={cepLoading} />}
          {step === 2 && <Step3 data={data} set={set} />}
          {step === 3 && <Step4 data={data} set={set} pwStrength={pwStrength} />}
          {step === 4 && <Step5 data={data} set={set} />}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={prev} disabled={step === 0 || submitting}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>
                Avançar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={submitting} size="lg">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                📤 Enviar Solicitação
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

/* --- Steps --- */

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Step1({ data, set, onCnpjBlur, cnpjLoading }: any) {
  function toggleTipo(v: string) {
    const cur: string[] = data.tipos_fornecimento;
    set("tipos_fornecimento", cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">1. Dados da Empresa</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="CNPJ *">
          <div className="relative">
            <Input
              value={data.cnpj}
              onChange={(e) => set("cnpj", maskCNPJ(e.target.value))}
              onBlur={onCnpjBlur}
              placeholder="00.000.000/0000-00"
            />
            {cnpjLoading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-accent" />}
          </div>
        </Field>
        <Field label="Razão Social *">
          <Input value={data.razao_social} onChange={(e) => set("razao_social", e.target.value)} placeholder="Empresa LTDA" />
        </Field>
      </div>
      <Field label="Nome Fantasia">
        <Input value={data.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
      </Field>
      <Field label="Tipo de Fornecimento *" hint="Selecione um ou mais">
        <div className="grid sm:grid-cols-2 gap-2">
          {TIPOS_FORNECIMENTO.map((t) => {
            const active = data.tipos_fornecimento.includes(t.value);
            return (
              <button
                type="button"
                key={t.value}
                onClick={() => toggleTipo(t.value)}
                className={`text-left text-sm px-3 py-2.5 rounded-md border transition-colors ${active ? "border-accent bg-accent/10 text-foreground" : "border-border hover:border-accent/50"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Telefone Comercial">
          <Input value={data.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(11) 0000-0000" />
        </Field>
        <Field label="WhatsApp">
          <Input value={data.whatsapp} onChange={(e) => set("whatsapp", maskPhone(e.target.value))} placeholder="(11) 90000-0000" />
        </Field>
      </div>
    </div>
  );
}

function Step2({ data, set, onCepBlur, cepLoading }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">2. Endereço</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="CEP *" hint="Endereço preenchido automaticamente">
          <div className="relative">
            <Input value={data.cep} onChange={(e) => set("cep", maskCEP(e.target.value))} onBlur={onCepBlur} placeholder="00000-000" />
            {cepLoading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-accent" />}
          </div>
        </Field>
        <Field label="Cidade *">
          <Input value={data.cidade} onChange={(e) => set("cidade", e.target.value)} />
        </Field>
        <Field label="Estado *">
          <Input value={data.estado} onChange={(e) => set("estado", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
        </Field>
      </div>
      <div className="grid md:grid-cols-[1fr_120px_1fr] gap-4">
        <Field label="Logradouro *">
          <Input value={data.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
        </Field>
        <Field label="Número *">
          <Input value={data.numero} onChange={(e) => set("numero", e.target.value)} />
        </Field>
        <Field label="Complemento">
          <Input value={data.complemento} onChange={(e) => set("complemento", e.target.value)} />
        </Field>
      </div>
      <Field label="Bairro">
        <Input value={data.bairro} onChange={(e) => set("bairro", e.target.value)} />
      </Field>
    </div>
  );
}

function Step3({ data, set }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">3. Dados Bancários</h2>
      <Field label="Banco *">
        <Select value={data.banco} onValueChange={(v) => set("banco", v)}>
          <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
          <SelectContent>
            {BANCOS_BR.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Agência *">
          <Input value={data.agencia} onChange={(e) => set("agencia", e.target.value)} />
        </Field>
        <Field label="Conta *">
          <Input value={data.conta} onChange={(e) => set("conta", e.target.value)} />
        </Field>
        <Field label="Tipo *">
          <Select value={data.tipo_conta} onValueChange={(v) => set("tipo_conta", v)}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corrente">Corrente</SelectItem>
              <SelectItem value="poupanca">Poupança</SelectItem>
              <SelectItem value="pj">PJ</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid md:grid-cols-[180px_1fr] gap-4">
        <Field label="Tipo da chave PIX">
          <Select value={data.pix_tipo} onValueChange={(v) => set("pix_tipo", v)}>
            <SelectTrigger><SelectValue placeholder="Tipo PIX" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
              <SelectItem value="aleatoria">Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Chave PIX">
          <Input value={data.pix_chave} onChange={(e) => set("pix_chave", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function Step4({ data, set, pwStrength }: any) {
  const colors = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">4. Acesso ao Sistema</h2>
      <Field label="E-mail de login *">
        <Input type="email" value={data.email_login} onChange={(e) => set("email_login", e.target.value)} />
      </Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Senha *" hint="Mínimo 8 caracteres">
          <Input type="password" value={data.senha} onChange={(e) => set("senha", e.target.value)} />
          {data.senha && (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full transition-all ${colors[pwStrength.score]}`} style={{ width: `${(pwStrength.score / 4) * 100}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground">{pwStrength.label}</span>
            </div>
          )}
        </Field>
        <Field label="Confirmar senha *">
          <Input type="password" value={data.senha_confirma} onChange={(e) => set("senha_confirma", e.target.value)} />
        </Field>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome do responsável *">
          <Input value={data.responsavel_nome} onChange={(e) => set("responsavel_nome", e.target.value)} />
        </Field>
        <Field label="CPF do responsável">
          <Input value={data.responsavel_cpf} onChange={(e) => set("responsavel_cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" />
        </Field>
      </div>
      <Field label="Cargo">
        <Input value={data.responsavel_cargo} onChange={(e) => set("responsavel_cargo", e.target.value)} placeholder="Sócio, Gerente, etc." />
      </Field>
    </div>
  );
}

function Step5({ data, set }: any) {
  const tipos = TIPOS_FORNECIMENTO
    .filter((t) => data.tipos_fornecimento.includes(t.value))
    .map((t) => t.label).join(", ");
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">5. Termos e Confirmação</h2>

      <Card className="bg-secondary/40 border-border p-4 space-y-2">
        <p className="text-sm font-medium">Resumo do cadastro</p>
        <dl className="text-xs space-y-1 text-muted-foreground">
          <div><span className="text-foreground font-medium">Empresa:</span> {data.razao_social} — {data.cnpj}</div>
          <div><span className="text-foreground font-medium">Tipos:</span> {tipos || "—"}</div>
          <div><span className="text-foreground font-medium">Endereço:</span> {data.logradouro}, {data.numero} — {data.cidade}/{data.estado}</div>
          <div><span className="text-foreground font-medium">Banco:</span> {data.banco} · Ag {data.agencia} · CC {data.conta}</div>
          <div><span className="text-foreground font-medium">Login:</span> {data.email_login}</div>
          <div><span className="text-foreground font-medium">Responsável:</span> {data.responsavel_nome}</div>
        </dl>
      </Card>

      <Field label="Termos de Credenciamento">
        <Textarea
          readOnly
          rows={6}
          value="Os termos completos serão inseridos em breve. Ao aceitar, você concorda com as políticas de fornecimento da Lobo Marley Gestão de Frotas, incluindo critérios de qualidade, prazos de pagamento e responsabilidades sobre os serviços prestados."
        />
      </Field>

      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox
          checked={data.aceitou_termos}
          onCheckedChange={(v) => set("aceitou_termos", Boolean(v))}
        />
        <span className="text-sm">Li e aceito os <strong>Termos de Credenciamento</strong></span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox
          checked={data.aceitou_dados_bancarios}
          onCheckedChange={(v) => set("aceitou_dados_bancarios", Boolean(v))}
        />
        <span className="text-sm">Autorizo o uso dos dados bancários para fins de pagamento</span>
      </label>
    </div>
  );
}
