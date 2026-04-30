import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth, homeForRole, type AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Truck, LayoutDashboard, ClipboardCheck, Fuel, Wrench, LogOut, Map, FileText, Users, Settings, Receipt, Camera, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/relatorios", label: "Relatórios", icon: FileText },
    { to: "/admin/financeiro", label: "Financeiro", icon: Receipt },
    { to: "/admin/configuracoes", label: "Config", icon: Settings },
  ],
  gestor_frota: [
    { to: "/gestor", label: "Dashboard", icon: LayoutDashboard },
    { to: "/gestor/veiculos", label: "Veículos", icon: Truck },
    { to: "/gestor/motoristas", label: "Motoristas", icon: Users },
    { to: "/gestor/manutencoes", label: "Manutenções", icon: Wrench },
  ],
  fornecedor: [
    { to: "/fornecedor", label: "Início", icon: LayoutDashboard },
    { to: "/fornecedor/abastecimento", label: "Abastecer", icon: Fuel },
    { to: "/fornecedor/despesa", label: "Despesa", icon: Receipt },
  ],
  motorista: [
    { to: "/motorista", label: "Início", icon: LayoutDashboard },
    { to: "/motorista/foto", label: "Foto", icon: Camera },
    { to: "/motorista/historico", label: "Histórico", icon: History },
    { to: "/motorista/solicitar", label: "Manutenção", icon: Wrench },
  ],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, primaryRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user || !primaryRole) return <>{children}</>;

  const items = NAV_BY_ROLE[primaryRole];

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-[var(--primary-glow)] flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground leading-tight">Lobo Marley</p>
            <p className="text-xs text-muted-foreground">Gestão de Frotas</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to ||
              (item.to !== homeForRole(primaryRole) && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-muted-foreground">Conectado como</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.email}</p>
            <p className="text-xs text-accent capitalize">{primaryRole.replace("_", " ")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="md:hidden bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-[var(--primary-glow)] flex items-center justify-center">
            <Truck className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground">Lobo Marley</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 pb-20 md:pb-0 overflow-auto">{children}</main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-50">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to ||
              (item.to !== homeForRole(primaryRole) && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 gap-1 transition-colors",
                  active ? "text-accent" : "text-sidebar-foreground/60"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
