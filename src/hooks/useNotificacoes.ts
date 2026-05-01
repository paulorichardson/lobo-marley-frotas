import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useNotificacoes() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

  const query = useQuery({
        queryKey: ["notificacoes", user?.id],
        queryFn: async () => {
                if (!user) return [];
                const { data, error } = await supabase
                  .from("notificacoes")
                  .select("*")
                  .eq("para_id", user.id)
                  .order("criado_em", { ascending: false })
                  .limit(50);
                if (error) throw error;
                return data ?? [];
        },
        enabled: !!user,
  });

  const naoLidas = query.data?.filter((n) => !n.lida).length ?? 0;

  const marcarLidaMutation = useMutation({
        mutationFn: async (id: string) => {
                const { error } = await supabase
                  .from("notificacoes")
                  .update({ lida: true })
                  .eq("id", id);
                if (error) throw error;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["notificacoes", user?.id] });
        },
  });

  const marcarTodasLidasMutation = useMutation({
        mutationFn: async () => {
                if (!user) return;
                const { error } = await supabase
                  .from("notificacoes")
                  .update({ lida: true })
                  .eq("para_id", user.id)
                  .eq("lida", false);
                if (error) throw error;
        },
        onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["notificacoes", user?.id] });
        },
  });

  return {
        notificacoes: query.data ?? [],
        naoLidas,
        isLoading: query.isLoading,
        refetch: query.refetch,
        marcarLida: marcarLidaMutation.mutateAsync,
        marcarTodasLidas: marcarTodasLidasMutation.mutateAsync,
  };
}
