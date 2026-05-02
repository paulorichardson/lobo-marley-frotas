import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------
 * Checklists
 * ------------------------------------------------------------------ */
export function useChecklists(filtroStatus?: string) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

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
    mutationFn: async (payload: TablesInsert<"checklists">) => {
      const { data, error } = await supabase
        .from("checklists")
        .insert({ ...payload, empresa_id: empresaId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists", empresaId] });
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

/* ------------------------------------------------------------------
 * Abastecimentos
 * ------------------------------------------------------------------ */
export function useAbastecimentos(dataInicio?: string, dataFim?: string) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["abastecimentos", empresaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresaId) return [];
      let q = supabase
        .from("abastecimentos")
        .select("*, veiculos(id, placa, modelo), perfis!abastecimentos_motorista_id_fkey(id, nome)")
        .eq("empresa_id", empresaId)
        .order("data_hora", { ascending: false });
      if (dataInicio) q = q.gte("data_hora", dataInicio);
      if (dataFim) q = q.lte("data_hora", dataFim);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: TablesInsert<"abastecimentos">) => {
      const { data, error } = await supabase
        .from("abastecimentos")
        .insert({ ...payload, empresa_id: empresaId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["abastecimentos", empresaId] });
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

/* ------------------------------------------------------------------
 * Manutenções
 * ------------------------------------------------------------------ */
export function useManutencoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

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
    mutationFn: async (payload: TablesInsert<"manutencoes">) => {
      const { data, error } = await supabase
        .from("manutencoes")
        .insert({ ...payload, empresa_id: empresaId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manutencoes", empresaId] });
      toast.success("Manutenção salva!");
    },
    onError: () => toast.error("Erro ao salvar manutenção"),
  });

  const updateMutation = useMutation({
    mutationFn: async (
      args: { id: string } & TablesUpdate<"manutencoes">,
    ) => {
      const { id, ...payload } = args;
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
      qc.invalidateQueries({ queryKey: ["manutencoes", empresaId] });
      toast.success("Manutenção atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar manutenção"),
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

/* ------------------------------------------------------------------
 * Fornecedores (cadastro global, sem coluna empresa_id na tabela)
 * ------------------------------------------------------------------ */
export function useFornecedores(apenasAprovados = false) {
  const query = useQuery({
    queryKey: ["fornecedores", apenasAprovados],
    queryFn: async () => {
      let q = supabase
        .from("fornecedores_cadastro")
        .select("*")
        .order("razao_social");
      if (apenasAprovados) q = q.eq("status", "aprovado");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return {
    fornecedores: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
