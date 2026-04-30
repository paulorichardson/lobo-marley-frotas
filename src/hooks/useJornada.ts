import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  cor: string | null;
  km_atual: number;
  status: string;
  foto_principal_url: string | null;
}

export interface Viagem {
  id: string;
  veiculo_id: string;
  motorista_id: string;
  data_saida: string;
  data_chegada: string | null;
  km_saida: number | null;
  km_chegada: number | null;
  km_percorrido: number | null;
  destino: string | null;
  finalidade: string | null;
}

/** Viagem ativa = sem data_chegada. */
export function useJornadaAtiva() {
  const { user } = useAuth();
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: vg } = await supabase
        .from("viagens")
        .select("*")
        .eq("motorista_id", user.id)
        .is("data_chegada", null)
        .order("data_saida", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setViagem(vg as any);
      if (vg) {
        const { data: vc } = await supabase
          .from("veiculos")
          .select("id,placa,modelo,marca,cor,km_atual,status,foto_principal_url")
          .eq("id", (vg as any).veiculo_id)
          .maybeSingle();
        if (!cancelled) setVeiculo(vc as any);
      } else {
        setVeiculo(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, reload]);

  return { viagem, veiculo, loading, refresh: () => setReload((n) => n + 1) };
}
