import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/lib/notify";

export function useVeiculos() {
    const { empresaId } = useAuth();
    const queryClient = useQueryClient();

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
        mutationFn: async (payload: Record<string, unknown>) => {
                const { data, error } = await supabase
                  .from("veiculos")
                  .insert({ ...payload, empresa_id: empresaId })
                  .select()
                  .single();
                if (error) throw error;
                return data;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["veiculos", empresaId] });
                toast.success("Veiculo salvo com sucesso!");
        },
        onError: () => toast.error("Erro ao salvar veiculo"),
  });

  const updateMutation = useMutation({
        mutationFn: async ({ id, ...payload }: Record<string, unknown>) => {
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
                queryClient.invalidateQueries({ queryKey: ["veiculos", empresaId] });
                toast.success("Veiculo atualizado!");
        },
        onError: () => toast.error("Erro ao atualizar veiculo"),
  });

  const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
                const { error } = await supabase.from("veiculos").delete().eq("id", id);
                if (error) throw error;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["veiculos", empresaId] });
                toast.success("Veiculo removido!");
        },
        onError: () => toast.error("Erro ao remover veiculo"),
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
