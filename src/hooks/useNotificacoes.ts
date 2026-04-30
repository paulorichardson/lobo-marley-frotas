import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link: string | null;
  criado_em: string;
}

export function useNotificacoes() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("para_id", user.id)
        .order("criado_em", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setItems((data ?? []) as any);
        setLoading(false);
      }
    })();

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes", filter: `para_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new as any, ...prev]),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificacoes", filter: `para_id=eq.${user.id}` },
        (payload) =>
          setItems((prev) => prev.map((n) => (n.id === (payload.new as any).id ? (payload.new as any) : n))),
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user]);

  const naoLidas = items.filter((n) => !n.lida).length;

  async function marcarLida(id: string) {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  }
  async function marcarTodasLidas() {
    if (!user) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("para_id", user.id)
      .eq("lida", false);
  }

  return { items, loading, naoLidas, marcarLida, marcarTodasLidas };
}
