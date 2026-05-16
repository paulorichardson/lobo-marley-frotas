import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, homeForRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Truck, Loader2, ShieldCheck, Gauge, DollarSign, BarChart3,
  CheckCircle2, Wrench, Fuel, ClipboardCheck, FileText, Wallet,
  Users, Bell, UserPlus, Settings2, TrendingUp, Heart, Menu, X,
} from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/lobo-marley-logo.svg";
import heroImg from "@/assets/hero-frota.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lobo Marley — Gestão de Frotas para quem move o Brasil" },
      { name: "description", content: "Plataforma completa de gestão de frotas públicas e privadas: controle, manutenções, abastecimentos, relatórios e rede credenciada." },
      { property: "og:title", content: "Lobo Marley — Gestão de Frotas" },
      { property: "og:description", content: "Mais controle, economia, segurança e eficiência em uma única solução." },
    ],
  }),
  component: LandingPage,
});

const NAV = [
  { label: "Início", href: "#inicio" },
  { label: "Soluções", href: "#vantagens" },
  { label: "Vantagens", href: "#beneficios" },
  { label: "Funcionalidades", href: "#vantagens" },
  { label: "Para fornecedores", href: "#fornecedor" },
  { label: "Contato", href: "#footer" },
];

const VANTAGENS = [
  { icon: Truck, title: "Controle de Veículos", desc: "Cadastre, organize e acompanhe todos os veículos da sua frota em tempo real." },
  { icon: Wrench, title: "Manutenções Inteligentes", desc: "Gestão completa de OS, preventivas, corretivas, histórico, custos e fornecedores." },
  { icon: Fuel, title: "Abastecimentos", desc: "Registro de abastecimentos com controle de combustível, consumo e relatórios detalhados." },
  { icon: ClipboardCheck, title: "Checklists e Inspeções", desc: "Checklists digitais, fotos, assinatura e acompanhamento de pendências em tempo real." },
  { icon: FileText, title: "Relatórios Completos", desc: "Relatórios gerenciais, financeiros e operacionais para melhor tomada de decisão." },
  { icon: Wallet, title: "Gestão Financeira", desc: "Controle de contratos, saldos, custos, faturamentos e desempenho da frota." },
  { icon: Users, title: "Gestão de Usuários", desc: "Acesso por perfis: Admin, Gestor, Motorista e Fornecedor com total segurança." },
  { icon: Bell, title: "Alertas e Notificações", desc: "Receba alertas de vencimentos, manutenções, documentos e muito mais." },
];

const PASSOS = [
  { n: 1, icon: UserPlus, title: "Faça seu cadastro", desc: "Crie sua conta e configure sua empresa em poucos minutos." },
  { n: 2, icon: Truck, title: "Cadastre sua frota", desc: "Adicione seus veículos, motoristas e fornecedores de forma organizada." },
  { n: 3, icon: Settings2, title: "Gerencie e acompanhe", desc: "Acompanhe manutenções, abastecimentos, custos e relatórios em tempo real." },
  { n: 4, icon: TrendingUp, title: "Tome melhores decisões", desc: "Use os dados e relatórios para reduzir custos e aumentar a eficiência." },
];

const BENEFICIOS = [
  { icon: ShieldCheck, title: "100%", sub: "Sistema seguro", desc: "Dados protegidos e acesso por perfil" },
  { icon: Gauge, title: "Mais controle", sub: "", desc: "Acompanhe tudo em tempo real" },
  { icon: DollarSign, title: "Menos custos", sub: "", desc: "Reduza desperdícios e aumente a eficiência" },
  { icon: BarChart3, title: "Decisões inteligentes", sub: "", desc: "Relatórios completos para melhor gestão" },
];

function LandingPage() {
  const { user, primaryRole, loading: authLoading } = useAuth();
  if (!authLoading && user) return <Navigate to={homeForRole(primaryRole)} />;
  return <LandingContent />;
}

function LandingContent() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo!");
      navigate({ to: "/" });
    } catch (err: any) {
      const msg = err?.message ?? "Erro";
      toast.error(msg.toLowerCase().includes("invalid login") ? "E-mail ou senha incorretos" : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="#inicio" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Lobo Marley" className="w-10 h-10" />
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">LOBO MARLEY</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Gestão de Frotas</div>
            </div>
          </a>
          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex">
              <Button size="sm" className="shadow-[var(--shadow-glow)]">Fazer login</Button>
            </Link>
            <button
              className="lg:hidden p-2 text-foreground"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur">
            <div className="px-4 py-3 flex flex-col gap-1">
              {NAV.map((n) => (
                <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} className="py-2 text-sm text-muted-foreground hover:text-foreground">
                  {n.label}
                </a>
              ))}
              <Link to="/login" className="mt-2">
                <Button size="sm" className="w-full">Fazer login</Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* HERO + LOGIN */}
      <section id="inicio" className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImg})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          {/* Texto */}
          <div className="order-2 lg:order-1 space-y-6">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-primary/15 text-primary border border-primary/30">
              Sistema completo e inteligente
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              Gestão de Frotas<br />
              <span className="text-primary">para quem move</span><br />
              o Brasil.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl">
              O Lobo Marley é a plataforma completa para gestão de frotas públicas e privadas. Mais controle, economia, segurança e eficiência em uma única solução.
            </p>
            <ul className="space-y-2.5">
              {[
                "Controle total da sua frota",
                "Redução de custos operacionais",
                "Manutenção preventiva inteligente",
                "Relatórios completos e em tempo real",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm sm:text-base">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Login + Credenciamento */}
          <div className="order-1 lg:order-2 space-y-4">
            <Card className="p-6 border-border/60 shadow-[var(--shadow-elegant)] bg-card/90 backdrop-blur">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-card p-1.5 ring-1 ring-primary/30">
                  <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Acessar sistema</h2>
                  <p className="text-xs text-muted-foreground">Entre na sua conta para continuar</p>
                </div>
              </div>
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Entrar
                </Button>
                <div className="text-center space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) return toast.error("Informe seu e-mail acima primeiro");
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Enviamos um link de redefinição");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Ainda não tem conta?{" "}
                    <Link to="/login" className="text-primary hover:underline font-medium">Cadastre-se</Link>
                  </p>
                </div>
              </form>
            </Card>

            <Card id="fornecedor" className="p-5 bg-primary/5 border-primary/30 text-center space-y-2.5">
              <h3 className="text-sm font-semibold">É oficina, autopeças ou prestador automotivo?</h3>
              <p className="text-xs text-muted-foreground">Faça parte da nossa rede credenciada e aumente suas oportunidades.</p>
              <Link to="/credenciamento">
                <Button variant="default" size="sm" className="w-full">
                  <Heart className="w-4 h-4 mr-2" />Quero me credenciar
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* BARRA DE BENEFÍCIOS */}
      <section id="beneficios" className="relative -mt-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border border-primary/30 p-5 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-5 backdrop-blur">
            {BENEFICIOS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold leading-tight">{b.title}</div>
                  {b.sub && <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">{b.sub}</div>}
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VANTAGENS */}
      <section id="vantagens" className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold">Vantagens do Lobo Marley</h2>
            <p className="text-muted-foreground mt-2">Tudo o que você precisa para uma gestão de frota moderna e eficiente.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VANTAGENS.map((v) => (
              <Card key={v.title} className="p-5 hover:border-primary/50 hover:shadow-[var(--shadow-glow)] transition-all duration-300 group">
                <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center mb-3 group-hover:bg-primary/25 transition-colors">
                  <v.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{v.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-16 sm:py-20 bg-secondary/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold">Como funciona</h2>
            <p className="text-muted-foreground mt-2">Simples, rápido e eficiente em 4 passos.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {PASSOS.map((p) => (
              <div key={p.n} className="text-center relative">
                <div className="relative inline-flex flex-col items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm mb-3 shadow-[var(--shadow-glow)]">
                    {p.n}
                  </div>
                  <div className="w-16 h-16 rounded-2xl border-2 border-primary/30 flex items-center justify-center">
                    <p.icon className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1.5">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed px-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl p-6 sm:p-10 border border-primary/30 flex flex-col sm:flex-row items-center justify-between gap-5"
            style={{ background: "var(--gradient-hero)" }}>
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="" className="w-14 h-14 hidden sm:block" />
              <div>
                <h3 className="text-xl sm:text-2xl font-bold">Pronto para transformar a gestão da sua frota?</h3>
                <p className="text-sm text-muted-foreground mt-1">Junte-se a centenas de empresas que já confiam no Lobo Marley.</p>
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-1.5 flex-shrink-0">
              <Link to="/login">
                <Button size="lg" className="shadow-[var(--shadow-glow)]">Começar agora</Button>
              </Link>
              <p className="text-[11px] text-muted-foreground">É rápido, fácil e seguro!</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="footer" className="border-t border-border/50 bg-secondary/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <img src={logoUrl} alt="" className="w-9 h-9" />
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-wide">LOBO MARLEY</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Gestão de Frotas</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Tecnologia e inteligência para transformar a gestão da sua frota e levar seu negócio mais longe.
            </p>
          </div>
          <FooterCol title="Soluções" links={["Gestão de Frotas", "Manutenções", "Abastecimentos", "Relatórios", "Gestão Financeira"]} />
          <FooterCol title="Empresa" links={["Sobre nós", "Vantagens", "Funcionalidades", "Contato", "Política de Privacidade"]} />
          <FooterCol title="Suporte" links={["Central de Ajuda", "Fale Conosco", "Termos de Uso"]} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>© {new Date().getFullYear()} Lobo Marley Gestão de Frotas. Todos os direitos reservados.</p>
          <p>Desenvolvido com <Heart className="inline w-3 h-3 text-primary fill-primary" /> para quem move o Brasil.</p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
