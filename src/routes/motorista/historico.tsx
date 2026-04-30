import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, History, ClipboardCheck, Fuel, Wrench, Camera } from "lucide-react";

export const Route = createFileRoute("/motorista/historico")({
  head: () => ({ meta: [{ title: "Meu Histórico — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <Historico />
      </AppShell>
    </ProtectedRoute>
  ),
});

interface Item { tipo: string; data: string; titulo: string; subtitulo: string; }

function Historico() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [vg, ck, ab] = await Promise.all([
        supabase.from("viagens").select("id,data_saida,data_chegada,km_percorrido,destino").eq("motorista_id", user.id).order("data_saida", { ascending: false }).limit(30),
        supabase.from("checklists").select("id,data_hora,tipo,status").eq("motorista_id", user.id).order("data_hora", { ascending: false }).limit(30),
        supabase.from("abastecimentos").select("id,data_hora,litros,valor_total,posto").eq("motorista_id", user.id).order("data_hora", { ascending: false }).limit(30),
      ]);

      const all: Item[] = [];
      (vg.data ?? []).forEach((v: any) => all.push({
        tipo: "viagem",
        data: v.data_saida,
        titulo: v.data_chegada ? `Viagem — ${v.km_percorrido ?? 0} km` : "Viagem em andamento",
        subtitulo: v.destino ?? "",
      }));
      (ck.data ?? []).forEach((c: any) => all.push({
        tipo: "checklist",
        data: c.data_hora,
        titulo: `Checklist ${c.tipo}`,
        subtitulo: c.status,
      }));
      (ab.data ?? []).forEach((a: any) => all.push({
        tipo: "abastecimento",
        data: a.data_hora,
        titulo: `Abastecimento — ${a.litros}L`,
        subtitulo: a.posto ?? "",
      }));

      all.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setItems(all);
      setLoading(false);
    })();
  }, [user]);

  const ICONS: Record<string, any> = { viagem: ClipboardCheck, checklist: ClipboardCheck, abastecimento: Fuel, manutencao: Wrench, foto: Camera };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/motorista"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <h1 className="font-semibold flex items-center gap-2"><History className="w-5 h-5" /> Meu histórico</h1>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Sem registros ainda.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => {
            const Icon = ICONS[it.tipo] ?? History;
            return (
              <Card key={i} className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.titulo}</p>
                  {it.subtitulo && <p className="text-xs text-muted-foreground truncate">{it.subtitulo}</p>}
                </div>
                <p className="text-[10px] text-muted-foreground">{new Date(it.data).toLocaleDateString("pt-BR")}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
