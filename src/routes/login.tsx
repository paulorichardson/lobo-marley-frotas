import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, homeForRole, type AppRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, Briefcase, Wrench, User, FlaskConical } from "lucide-react";
import logoUrl from "@/assets/lobo-marley-logo.svg";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Lobo Marley Frotas" },
      { name: "description", content: "Acesse sua conta no sistema Lobo Marley Gestão de Frotas." },
    ],
  }),
  component: LoginPage,
});

const DEMO_USERS: { role: AppRole; email: string; password: string; label: string; icon: any }[] = [
  { role: "admin", email: "admin@lobomar.io", password: "Lobomar@2024", label: "Admin", icon: Shield },
  { role: "gestor_frota", email: "gestor@lobomar.io", password: "Lobomar@2024", label: "Gestor de Frota", icon: Briefcase },
  { role: "fornecedor", email: "fornecedor@lobomar.io", password: "Lobomar@2024", label: "Fornecedor", icon: Wrench },
  { role: "motorista", email: "motorista@lobomar.io", password: "Lobomar@2024", label: "Motorista", icon: User },
];

function LoginPage() {
  const { user, primaryRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showDemo, setShowDemo] = useState(false);
  const [demoUnlocked, setDemoUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("demo") === "1") return true;
    return localStorage.getItem("lm_demo_unlocked") === "1";
  });
  const [tapCount, setTapCount] = useState(0);
  function handleSecretTap() {
    setTapCount((c) => {
      const n = c + 1;
      if (n >= 5) {
        setDemoUnlocked(true);
        localStorage.setItem("lm_demo_unlocked", "1");
        toast.success("Modo demo desbloqueado");
        return 0;
      }
      return n;
    });
    setTimeout(() => setTapCount(0), 1500);
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  if (!authLoading && user) {
    return <Navigate to={homeForRole(primaryRole)} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome: nome || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo!");
        navigate({ to: "/" });
      }
    } catch (err: any) {
      const msg = err?.message ?? "Erro desconhecido";
      if (msg.toLowerCase().includes("invalid login")) {
        toast.error("E-mail ou senha incorretos");
      } else if (msg.toLowerCase().includes("already registered")) {
        toast.error("Este e-mail já está cadastrado");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function ensureSeeded() {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-users", { body: {} });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error("Falha ao preparar usuários demo");
    } finally {
      setSeeding(false);
    }
  }

  async function loginAs(u: typeof DEMO_USERS[number]) {
    setDemoLoading(u.email);
    try {
      let { error } = await supabase.auth.signInWithPassword({ email: u.email, password: u.password });
      if (error) {
        // tentar criar via seed e logar de novo
        toast.message("Preparando usuários demo...");
        await ensureSeeded();
        const r = await supabase.auth.signInWithPassword({ email: u.email, password: u.password });
        if (r.error) throw r.error;
      }
      toast.success(`Entrando como ${u.label}`);
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao entrar como demo");
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-card/60 backdrop-blur p-2 shadow-[var(--shadow-glow)] ring-1 ring-primary/30">
            <img src={logoUrl} alt="Lobo Marley" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-wide">LOBO MARLEY</h1>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mt-1">Gestão de Frotas</p>
          </div>
        </div>

        <Card className="p-6 border-border/60 shadow-[var(--shadow-elegant)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold">
              {mode === "login" ? "Entrar na sua conta" : "Criar nova conta"}
            </h2>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required autoComplete="email" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {mode === "login" ? (
                <>Ainda não tem conta?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="text-accent hover:underline font-medium">Cadastre-se</button>
                </>
              ) : (
                <>Já tem conta?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-accent hover:underline font-medium">Entre aqui</button>
                </>
              )}
            </p>
          </form>
        </Card>

        {/* Demo (oculto — desbloqueia com 5 cliques no rodapé secreto ou ?demo=1) */}
        {demoUnlocked && (
          <Card className="p-4 border-accent/30 bg-card/60 backdrop-blur space-y-3">
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-accent hover:opacity-90"
            >
              <FlaskConical className="w-4 h-4" />
              🧪 {showDemo ? "Ocultar acesso demo" : "Acessar como Demo"}
            </button>

            {showDemo && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-[11px] text-muted-foreground">
                  Clique em um perfil para entrar instantaneamente. Os usuários demo são criados automaticamente.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.map((u) => {
                    const Icon = u.icon;
                    const busy = demoLoading === u.email;
                    return (
                      <Button
                        key={u.email}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loginAs(u)}
                        disabled={!!demoLoading || seeding}
                        className="h-auto py-2.5 flex flex-col gap-1"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                        <span className="text-xs font-medium">{u.label}</span>
                      </Button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground/80 bg-secondary/40 rounded p-2 leading-relaxed font-mono">
                  admin@lobomar.io · gestor@lobomar.io<br />
                  fornecedor@lobomar.io · motorista@lobomar.io<br />
                  senha: <span className="text-accent">Lobomar@2024</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setDemoUnlocked(false); setShowDemo(false); localStorage.removeItem("lm_demo_unlocked"); }}
                  className="w-full text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
                >
                  ocultar novamente
                </button>
              </div>
            )}
          </Card>
        )}

        <p className="text-[11px] text-center text-muted-foreground/70">
          Novos cadastros entram como Motorista. O administrador define os demais perfis.
        </p>

        <Card className="p-4 bg-accent/5 border-accent/30 text-center space-y-2">
          <p className="text-sm font-semibold">É uma oficina, posto ou fornecedor?</p>
          <p className="text-xs text-muted-foreground">Cadastre sua empresa e seja credenciado pela Lobo Marley.</p>
          <a
            href="/credenciamento"
            className="inline-block text-sm font-semibold text-accent hover:underline"
          >
            🤝 Seja um Fornecedor Credenciado →
          </a>
        </Card>

        {/* Gatilho secreto: 5 cliques para desbloquear demo */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <button
            type="button"
            onClick={handleSecretTap}
            aria-label="Desbloquear demo"
            className="w-8 h-8 rounded-full border border-dashed border-accent/40 text-accent/70 hover:border-accent hover:text-accent flex items-center justify-center text-sm transition"
          >
            ●
          </button>
          <span className="text-[9px] text-muted-foreground/50 tracking-wider uppercase">
            {tapCount > 0 ? `${tapCount}/5` : "ponto secreto"}
          </span>
        </div>
      </div>
    </div>
  );
}
