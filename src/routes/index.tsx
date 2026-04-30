import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth, homeForRole } from "@/hooks/useAuth";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, primaryRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-[var(--primary-glow)] flex items-center justify-center animate-pulse">
          <Truck className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    );
  }

  return <Navigate to={user ? homeForRole(primaryRole) : "/login"} />;
}
