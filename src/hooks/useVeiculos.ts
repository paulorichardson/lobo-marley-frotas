import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export function useVeiculos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["veiculos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("veiculos")
        .select("*, veiculo_fotos(*), perfis(id, nome)")
        .eq("empresa_id", empresaId)
        .order("placa");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: TablesInsert<"veiculos">) => {
      const { data, error } = await supabase
        .from("veiculos")
        .insert({ ...payload, empresa_id: empresaId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["veiculos", empresaId] });
      toast.success("Veículo salvo com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar veículo"),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string } & TablesUpdate<"veiculos">) => {
      const { id, ...payload } = args;
      const { data, error } = await supabase
        .from("veiculos")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["veiculos", empresaId] });
      toast.success("Veículo atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar veículo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("veiculos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["veiculos", empresaId] });
      toast.success("Veículo removido!");
    },
    onError: () => toast.error("Erro ao remover veículo"),
  });

  return {
    veiculos: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
  };
}
