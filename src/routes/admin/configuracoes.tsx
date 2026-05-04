import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, ShieldCheck, Building2, Pencil, Trash2, Loader2, Save } from "lucide-react";
import { FornecedoresAdmin } from "@/components/admin/FornecedoresAdmin";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "gestor_frota" | "fornecedor" | "motorista";

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
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
  const { user } = useAuth();
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<UsuarioRow | null>(null);
  const [excluindo, setExcluindo] = useState<UsuarioRow | null>(null);
  const [excluindoLoad, setExcluindoLoad] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data: perfis } = await supabase
      .from("perfis")
      .select("id, nome, email, telefone, ativo")
      .order("nome");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, AppRole>();
    roles?.forEach((r: any) => map.set(r.user_id, r.role));
    setUsers((perfis ?? []).map((p: any) => ({ ...p, role: map.get(p.id) ?? "motorista" })));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function alterarRole(userId: string, novaRole: AppRole) {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: novaRole });
    if (insErr) return toast.error(insErr.message);
    toast.success("Perfil atualizado");
    carregar();
  }

  async function confirmarExcluir() {
    if (!excluindo) return;
    setExcluindoLoad(true);
    const { data, error } = await supabase.functions.invoke("excluir-usuario", {
      body: { user_id: excluindo.id },
    });
    setExcluindoLoad(false);
    if (error || (data as any)?.error) {
      return toast.error(error?.message || (data as any)?.error || "Erro ao excluir");
    }
    toast.success("Usuário excluído");
    setExcluindo(null);
    carregar();
  }

  const filtrados = users.filter((u) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="w-7 h-7 text-accent" />
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gestão de usuários e fornecedores</p>
        </div>
      </header>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios"><Users className="w-4 h-4 mr-1.5" /> Usuários</TabsTrigger>
          <TabsTrigger value="fornecedores"><Building2 className="w-4 h-4 mr-1.5" /> Fornecedores</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 flex-wrap">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium">Usuários ({filtrados.length})</p>
              <Input
                placeholder="Buscar por nome ou e-mail"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 w-64 ml-auto"
              />
              <Button size="sm" variant="ghost" onClick={carregar}>Atualizar</Button>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <div className="divide-y divide-border">
                {filtrados.map((u) => (
                  <div key={u.id} className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}{u.telefone ? ` · ${u.telefone}` : ""}
                      </p>
                    </div>
                    <Badge variant={u.ativo ? "default" : "secondary"} className="text-[10px]">
                      {u.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Select value={u.role} onValueChange={(v) => alterarRole(u.id, v as AppRole)}>
                      <SelectTrigger className="w-[170px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="gestor_frota">Gestor de Frota</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => setEditando(u)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setExcluindo(u)}
                      disabled={u.id === user?.id}
                      title={u.id === user?.id ? "Você não pode excluir a si mesmo" : "Excluir"}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {filtrados.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    Nenhum usuário encontrado.
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="fornecedores">
          <FornecedoresAdmin />
        </TabsContent>
      </Tabs>

      {/* Editar */}
      <EditarUsuarioDialog
        usuario={editando}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); carregar(); }}
      />

      {/* Excluir */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{excluindo?.nome}</strong> ({excluindo?.email}) será removido
              permanentemente do sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindoLoad}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarExcluir(); }}
              disabled={excluindoLoad}
              className="bg-destructive hover:bg-destructive/90"
            >
              {excluindoLoad && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditarUsuarioDialog({
  usuario, onClose, onSaved,
}: {
  usuario: UsuarioRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({ nome: "", telefone: "", ativo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (usuario) {
      setF({ nome: usuario.nome ?? "", telefone: usuario.telefone ?? "", ativo: usuario.ativo });
    }
  }, [usuario]);

  async function salvar() {
    if (!usuario) return;
    if (!f.nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const { error } = await supabase
      .from("perfis")
      .update({ nome: f.nome.trim(), telefone: f.telefone || null, ativo: f.ativo })
      .eq("id", usuario.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Usuário atualizado");
    onSaved();
  }

  return (
    <Dialog open={!!usuario} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>E-mail</Label>
            <Input value={usuario?.email ?? ""} disabled />
          </div>
          <div>
            <Label>Nome *</Label>
            <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={f.ativo ? "ativo" : "inativo"}
              onValueChange={(v) => setF({ ...f, ativo: v === "ativo" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo (bloqueado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
