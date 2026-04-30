import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, homeForRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Truck, Loader2 } from "lucide-react";
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

function LoginPage() {
  const { user, primaryRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] shadow-[var(--shadow-glow)]">
            <Truck className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lobo Marley</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestão de Frotas</p>
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
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {mode === "login" ? (
                <>
                  Ainda não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-accent hover:underline font-medium"
                  >
                    Cadastre-se
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-accent hover:underline font-medium"
                  >
                    Entre aqui
                  </button>
                </>
              )}
            </p>
          </form>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground/70">
          Novos cadastros entram como Motorista. O administrador define os demais perfis.
        </p>
      </div>
    </div>
  );
}
