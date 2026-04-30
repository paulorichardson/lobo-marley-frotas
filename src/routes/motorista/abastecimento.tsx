import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { EmBreve } from "./checklist";

export const Route = createFileRoute("/motorista/abastecimento")({
  head: () => ({ meta: [{ title: "Abastecimento — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <EmBreve titulo="Registrar abastecimento" descricao="Litros, valor, posto e foto do comprovante." />
      </AppShell>
    </ProtectedRoute>
  ),
});
