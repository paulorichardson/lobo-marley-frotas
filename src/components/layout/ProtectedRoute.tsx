import { Navigate } from "@tanstack/react-router";
import { useAuth, homeForRole, type AppRole } from "@/hooks/useAuth";
import { Truck } from "lucide-react";

export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: AppRole[];
  children: React.ReactNode;
}) {
  const { user, primaryRole, hasAnyRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-[var(--primary-glow)] flex items-center justify-center animate-pulse">
            <Truck className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (roles && !hasAnyRole(roles)) {
    return <Navigate to={homeForRole(primaryRole)} />;
  }

  return <>{children}</>;
}
