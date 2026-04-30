import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/gestor/manutencoes")({
  head: () => ({ meta: [{ title: "Manutenções — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <div className="p-6 max-w-3xl mx-auto">
          <Card className="p-8 text-center space-y-3">
            <Construction className="w-12 h-12 mx-auto text-accent" />
            <h2 className="text-lg font-semibold">Aprovação de manutenções</h2>
            <p className="text-sm text-muted-foreground">Solicitações pendentes e histórico de aprovações.</p>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  ),
});
