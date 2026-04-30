import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/fornecedor/abastecimento")({
  head: () => ({ meta: [{ title: "Lançar abastecimento — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <div className="p-6 max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-3">
            <Construction className="w-12 h-12 mx-auto text-accent" />
            <h2 className="text-lg font-semibold">Lançar abastecimento</h2>
            <p className="text-sm text-muted-foreground">
              Busca por placa, km, litros, valor e upload de comprovante.
            </p>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  ),
});
