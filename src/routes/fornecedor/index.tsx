import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Fuel, Receipt, Wrench } from "lucide-react";

export const Route = createFileRoute("/fornecedor/")({
  head: () => ({ meta: [{ title: "Fornecedor — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <FornecedorDashboard />
      </AppShell>
    </ProtectedRoute>
  ),
});

function FornecedorDashboard() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Lançar despesas</h1>
        <p className="text-sm text-muted-foreground">Selecione o tipo de lançamento</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Big to="/fornecedor/abastecimento" icon={Fuel} label="Abastecimento" desc="Litros, valor por litro e comprovante" />
        <Big to="/fornecedor/despesa" icon={Wrench} label="Manutenção / Despesa" desc="Serviço, peça, multa, etc." />
      </div>

      <Card className="p-6 text-center">
        <Receipt className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold mb-1">Histórico de lançamentos em breve</h3>
        <p className="text-sm text-muted-foreground">
          Acompanhe seus lançamentos recentes e status das manutenções.
        </p>
      </Card>
    </div>
  );
}

function Big({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:border-accent/60 transition-colors active:scale-[0.99]"
    >
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-[var(--primary-glow)] flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-primary-foreground" />
      </div>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
    </Link>
  );
}
