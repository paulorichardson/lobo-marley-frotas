import { Navigate } from "@tanstack/react-router";
import React from "react";
import { useAuth, type AppRole } from "@/hooks/useAuth";

const roleRedirects: Record<AppRole, string> = {
  admin: "/admin",
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

  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    const redirectTo =
      primaryRole && roleRedirects[primaryRole]
        ? roleRedirects[primaryRole]
        : "/login";
    return <Navigate to={redirectTo as never} />;
  }

  return <>{children}</>;
}
