import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor_frota" | "fornecedor" | "motorista";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener primeiro
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer pra evitar deadlock
        setTimeout(() => fetchRoles(session.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    // Depois session atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }

  const primaryRole: AppRole | null =
    roles.find((r) => r === "admin") ??
    roles.find((r) => r === "gestor_frota") ??
    roles.find((r) => r === "fornecedor") ??
    roles.find((r) => r === "motorista") ??
    null;

  return {
    user,
    roles,
    primaryRole,
    loading,
    hasRole: (r: AppRole) => roles.includes(r),
    hasAnyRole: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
    signOut: () => supabase.auth.signOut(),
  };
}

export function homeForRole(role: AppRole | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "gestor_frota":
      return "/gestor";
    case "fornecedor":
      return "/fornecedor";
    case "motorista":
      return "/motorista";
    default:
      return "/login";
  }
}
