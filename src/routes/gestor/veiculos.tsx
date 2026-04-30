import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/gestor/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <div className="p-6 max-w-3xl mx-auto">
          <Card className="p-8 text-center space-y-3">
            <Construction className="w-12 h-12 mx-auto text-accent" />
            <h2 className="text-lg font-semibold">Cadastro de Veículos</h2>
            <p className="text-sm text-muted-foreground">
              Lista, formulário, upload de fotos e documentos. Próxima iteração.
            </p>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  ),
});
