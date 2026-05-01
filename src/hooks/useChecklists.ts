import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/lib/notify";

export function useChecklists(filtroStatus?: string) {
    const { empresaId } = useAuth();
    const queryClient = useQueryClient();

  const query = useQuery({
        queryKey: ["checklists", empresaId, filtroStatus],
        queryFn: async () => {
                if (!empresaId) return [];
                let q = supabase
                  .from("checklists")
                  .select("*, perfis(id, nome), veiculos(id, placa, modelo)")
                  .eq("empresa_id", empresaId)
                  .order("criado_em", { ascending: false });
                if (filtroStatus) q = q.eq("status", filtroStatus);
                const { data, error } = await q;
                if (error) throw error;
                return data ?? [];
        },
        enabled: !!empresaId,
  });

  const createMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
                const { data, error } = await supabase
                  .from("checklists")
                  .insert({ ...payload, empresa_id: empresaId })
                  .select()
                  .single();
                if (error) throw error;
                return data;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["checklists", empresaId] });
                toast.success("Checklist registrado!");
        },
        onError: () => toast.error("Erro ao salvar checklist"),
  });

  return {
        checklists: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
  };
}

export function useAbastecimentos(dataInicio?: string, dataFim?: string) {
    const { empresaId } = useAuth();
    const queryClient = useQueryClient();

  const query = useQuery({
        queryKey: ["abastecimentos", empresaId, dataInicio, dataFim],
        queryFn: async () => {
                if (!empresaId) return [];
                let q = supabase
                  .from("abastecimentos")
                  .select("*, veiculos(id, placa, modelo), perfis(id, nome)")
                  .eq("empresa_id", empresaId)
                  .order("criado_em", { ascending: false });
                if (dataInicio) q = q.gte("criado_em", dataInicio);
                if (dataFim) q = q.lte("criado_em", dataFim);
                const { data, error } = await q;
                if (error) throw error;
                return data ?? [];
        },
        enabled: !!empresaId,
  });

  const createMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
                const { data, error } = await supabase
                  .from("abastecimentos")
                  .insert({ ...payload, empresa_id: empresaId })
                  .select()
                  .single();
                if (error) throw error;
                return data;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["abastecimentos", empresaId] });
                toast.success("Abastecimento registrado!");
        },
        onError: () => toast.error("Erro ao registrar abastecimento"),
  });

  return {
        abastecimentos: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
  };
}

export function useManutencoes() {
    const { empresaId } = useAuth();
    const queryClient = useQueryClient();

  const query = useQuery({
        queryKey: ["manutencoes", empresaId],
        queryFn: async () => {
                if (!empresaId) return [];
                const { data, error } = await supabase
                  .from("manutencoes")
                  .select("*, manutencao_pecas(*), veiculos(id, placa, modelo)")
                  .eq("empresa_id", empresaId)
                  .order("criado_em", { ascending: false });
                if (error) throw error;
                return data ?? [];
        },
        enabled: !!empresaId,
  });

  const createMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
                const { data, error } = await supabase
                  .from("manutencoes")
                  .insert({ ...payload, empresa_id: empresaId })
                  .select()
                  .single();
                if (error) throw error;
                return data;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["manutencoes", empresaId] });
                toast.success("Manutencao salva!");
        },
        onError: () => toast.error("Erro ao salvar manutencao"),
  });

  const updateMutation = useMutation({
        mutationFn: async ({ id, ...payload }: Record<string, unknown>) => {
                const { data, error } = await supabase
                  .from("manutencoes")
                  .update(payload)
                  .eq("id", id)
                  .select()
                  .single();
                if (error) throw error;
                return data;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["manutencoes", empresaId] });
                toast.success("Manutencao atualizada!");
        },
        onError: () => toast.error("Erro ao atualizar manutencao"),
  });

  return {
        manutencoes: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
        create: createMutation.mutateAsync,
        update: updateMutation.mutateAsync,
  };
}

export function useFornecedores(apenasAprovados = false) {
    const { empresaId } = useAuth();

  const query = useQuery({
        queryKey: ["fornecedores", empresaId, apenasAprovados],
        queryFn: async () => {
                if (!empresaId) return [];
                let q = supabase
                  .from("fornecedores_cadastro")
                  .select("*")
                  .eq("empresa_id", empresaId)
                  .order("razao_social");
                if (apenasAprovados) q = q.eq("aprovado", true);
                const { data, error } = await q;
                if (error) throw error;
                return data ?? [];
        },
        enabled: !!empresaId,
  });

  return {
        fornecedores: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
  };
}
