import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, Check, Info, AlertTriangle, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/motorista/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista", "admin", "gestor_frota", "fornecedor"]}>
      <AppShell>
        <Notificacoes />
      </AppShell>
    </ProtectedRoute>
  ),
});

function Notificacoes() {
  const { items, loading, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/motorista"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="font-semibold flex items-center gap-2"><Bell className="w-5 h-5" /> Notificações</h1>
          <p className="text-xs text-muted-foreground">{naoLidas} não lida{naoLidas === 1 ? "" : "s"}</p>
        </div>
        {naoLidas > 0 && (
          <Button variant="outline" size="sm" onClick={marcarTodasLidas}>
            <CheckCheck className="w-4 h-4 mr-1" /> Marcar tudo
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-10">Carregando...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto opacity-40 mb-2" />
          Nenhuma notificação ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = n.tipo === "warning" ? AlertTriangle : Info;
            return (
              <Card key={n.id} className={`p-3 flex gap-3 ${!n.lida ? "border-accent/40 bg-accent/5" : ""}`}>
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${n.tipo === "warning" ? "text-warning" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.titulo}</p>
                  <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.criado_em).toLocaleString("pt-BR")}</p>
                </div>
                {!n.lida && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => marcarLida(n.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
