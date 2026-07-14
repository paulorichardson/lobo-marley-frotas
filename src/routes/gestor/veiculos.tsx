import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/gestor/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  ),
});
