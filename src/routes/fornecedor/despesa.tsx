import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/fornecedor/despesa")({
  head: () => ({ meta: [{ title: "Lançar despesa — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <div className="p-6 max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-3">
            <Construction className="w-12 h-12 mx-auto text-accent" />
            <h2 className="text-lg font-semibold">Lançar manutenção / despesa</h2>
            <p className="text-sm text-muted-foreground">Serviço, valor, nota fiscal e fotos.</p>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  ),
});
