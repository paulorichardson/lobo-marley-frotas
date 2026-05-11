import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";
import logoUrl from "@/assets/lobo-marley-logo.svg";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Lobo Marley" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setRecoveryReady(true);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");
    if (password !== confirm) return toast.error("As senhas não conferem");
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao redefinir senha");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card/60 backdrop-blur p-2 ring-1 ring-primary/30">
            <img src={logoUrl} alt="Lobo Marley" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">Redefinir senha</h1>
        </div>

        <Card className="p-6 border-border/60 shadow-[var(--shadow-elegant)]">
          {!recoveryReady ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Para redefinir sua senha, abra o link enviado para o seu e-mail.
                Esta página só funciona quando acessada pelo link de recuperação.
              </p>
              <Button onClick={() => navigate({ to: "/login" })} variant="outline" className="w-full">
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar nova senha</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Salvar nova senha
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
