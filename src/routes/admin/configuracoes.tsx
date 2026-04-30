import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, ShieldCheck } from "lucide-react";

type AppRole = "admin" | "gestor_frota" | "fornecedor" | "motorista";

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  role: AppRole;
}

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <Configuracoes />
      </AppShell>
    </ProtectedRoute>
  ),
});

function Configuracoes() {
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const { data: perfis } = await supabase.from("perfis").select("id, nome, email, ativo");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, AppRole>();
    roles?.forEach((r: any) => map.set(r.user_id, r.role));
    setUsers((perfis ?? []).map((p: any) => ({ ...p, role: map.get(p.id) ?? "motorista" })));
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alterarRole(userId: string, novaRole: AppRole) {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: novaRole });
    if (insErr) {
      toast.error(insErr.message);
      return;
    }
    toast.success("Perfil atualizado");
    carregar();
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-accent" />
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground">Defina o perfil de cada usuário do sistema</p>
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="font-medium">Usuários cadastrados ({users.length})</p>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={carregar}>
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <Badge variant={u.ativo ? "default" : "secondary"} className="text-[10px]">
                  {u.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <Select value={u.role} onValueChange={(v) => alterarRole(u.id, v as AppRole)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorista">Motorista</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="gestor_frota">Gestor de Frota</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Nenhum usuário cadastrado ainda.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
