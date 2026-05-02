import { Navigate } from "@tanstack/react-router";
import React from "react";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin_saas" | "gestor_frota" | "fornecedor" | "motorista";

const roleRedirects: Record<string, string> = {
  admin_saas: "/admin",
  gestor_frota: "/gestor",
  fornecedor: "/fornecedor",
  motorista: "/motorista",
};

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && roles.length > 0) {
    const hasRequiredRole = hasAnyRole(roles);
    if (!hasRequiredRole) {
      const redirectTo =
        primaryRole && roleRedirects[primaryRole]
          ? (roleRedirects[primaryRole] as string)
          : "/login";
      return <Navigate to={redirectTo as never} />;
    }
  }

  return <>{children}</>;
}
