import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

function EmBreve({ t, d }: { t: string; d: string }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card className="p-8 text-center space-y-3">
        <Construction className="w-12 h-12 mx-auto text-accent" />
        <h2 className="text-lg font-semibold">{t}</h2>
        <p className="text-sm text-muted-foreground">{d}</p>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/admin/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <EmBreve t="Relatórios" d="Custo por veículo, consumo e histórico de manutenções." />
      </AppShell>
    </ProtectedRoute>
  ),
});
