import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/motorista/checklist")({
  head: () => ({ meta: [{ title: "Checklist — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <EmBreve titulo="Checklist do veículo" descricao="Itens, foto do hodômetro e assinatura digital." />
      </AppShell>
    </ProtectedRoute>
  ),
});

export function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Card className="p-8 text-center space-y-3">
        <Construction className="w-12 h-12 mx-auto text-accent" />
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <p className="text-xs text-muted-foreground/70 pt-2">
          Esta tela será implementada na próxima iteração.
        </p>
      </Card>
    </div>
  );
}
