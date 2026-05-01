import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TipoFornecimento = "posto" | "oficina" | "pecas" | "guincho" | "outros";

export function useFornecedorTipos() {
  const { user, hasRole } = useAuth();
  const [tipos, setTipos] = useState<TipoFornecimento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !hasRole("fornecedor")) {
      setTipos([]);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("fornecedores_cadastro")
        .select("tipos_fornecimento")
        .eq("user_id", user.id)
        .maybeSingle();
      setTipos(((data?.tipos_fornecimento as string[]) ?? []) as TipoFornecimento[]);
      setLoading(false);
    })();
  }, [user, hasRole]);

  return {
    tipos,
    loading,
    isPosto: tipos.includes("posto"),
    isOficina: tipos.includes("oficina"),
    isPecas: tipos.includes("pecas"),
  };
}
