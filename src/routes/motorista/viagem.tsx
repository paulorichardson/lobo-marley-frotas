import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { EmBreve } from "./checklist";

export const Route = createFileRoute("/motorista/viagem")({
  head: () => ({ meta: [{ title: "Viagem — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <EmBreve titulo="Iniciar / Encerrar viagem" descricao="Registre destino, finalidade e km percorridos." />
      </AppShell>
    </ProtectedRoute>
  ),
});
