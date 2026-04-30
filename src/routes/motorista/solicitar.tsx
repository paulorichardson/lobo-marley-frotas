import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { EmBreve } from "./checklist";

export const Route = createFileRoute("/motorista/solicitar")({
  head: () => ({ meta: [{ title: "Solicitar manutenção — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <EmBreve titulo="Solicitar manutenção" descricao="Descreva o problema, urgência e envie foto." />
      </AppShell>
    </ProtectedRoute>
  ),
});
