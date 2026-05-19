import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardCheck, FileText, ArrowLeft } from "lucide-react";
import { imprimirLaudo } from "@/lib/laudo-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/gestor/laudos/")({
  head: () => ({ meta: [{ title: "Laudos de Vistoria — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin", "gestor_frota"]}>
      <AppShell>
        <ListaLaudos />
      </AppShell>
    </ProtectedRoute>
  ),
});

const TIPO_BADGE: Record<string, string> = {
  periodica: "bg-blue-600",
  entrega: "bg-green-600",
  devolucao: "bg-amber-600",
  sinistro: "bg-red-600",
};

function ListaLaudos() {
  const { empresaId } = useAuth();
  const [laudos, setLaudos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    if (!empresaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("laudos_vistoria")
      .select("*, veiculo:veiculos(placa, marca, modelo, cor, chassi, renavam)")
      .eq("empresa_id", empresaId)
      .order("data_vistoria", { ascending: false });
    setLaudos(data ?? []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [empresaId]);

  async function reimprimir(l: any) {
    try {
      const signed = async (p: string | null) =>
        p ? (await supabase.storage.from("laudos-fotos").createSignedUrl(p, 3600)).data?.signedUrl ?? "" : "";
      const fotosUrls = await Promise.all(
        (l.fotos ?? []).map(async (f: any) => ({ legenda: f.legenda ?? f.slot ?? "", url: await signed(f.path) })),
      );
      const [sv, sr] = await Promise.all([
        signed(l.assinatura_vistoriador_path),
        signed(l.assinatura_responsavel_path),
      ]);
      imprimirLaudo({
        numero: l.id.slice(0, 8).toUpperCase(),
        tipo: l.tipo,
        data: l.data_vistoria,
        local: l.local_vistoria,
        km: l.km_registrado,
        empresa_nome: null,
        vistoriador_nome: null,
        responsavel_nome: l.responsavel_nome,
        responsavel_documento: l.responsavel_documento,
        veiculo: l.veiculo ?? { placa: "—", marca: "—", modelo: "—" },
        checklist: l.checklist ?? {},
        avarias: l.avarias ?? [],
        fotos: fotosUrls.filter((f) => f.url),
        observacoes: l.observacoes,
        assinatura_vistoriador_url: sv,
        assinatura_responsavel_url: sr || null,
      });
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/gestor"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> Laudos de Vistoria
          </h1>
        </div>
        <Button asChild>
          <Link to="/gestor/laudos/novo"><Plus className="w-4 h-4 mr-2" />Novo Laudo</Link>
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
      ) : laudos.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum laudo registrado ainda.</p>
          <Button asChild><Link to="/gestor/laudos/novo">Criar primeiro laudo</Link></Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {laudos.map((l) => {
            const ckProb = Object.values(l.checklist ?? {}).filter((v) => v === "problema").length;
            const nAvarias = (l.avarias ?? []).length;
            return (
              <Card key={l.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={TIPO_BADGE[l.tipo] ?? "bg-gray-500"}>{l.tipo}</Badge>
                    <span className="font-mono font-bold">{l.veiculo?.placa ?? "—"}</span>
                    <span className="text-sm text-muted-foreground">{l.veiculo?.marca} {l.veiculo?.modelo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(l.data_vistoria).toLocaleString("pt-BR")} · KM {l.km_registrado ?? "—"}
                    {l.local_vistoria ? ` · ${l.local_vistoria}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {nAvarias > 0 && <Badge variant="destructive">{nAvarias} avaria(s)</Badge>}
                  {ckProb > 0 && <Badge className="bg-red-600">{ckProb} problema(s)</Badge>}
                </div>
                <Button size="sm" variant="outline" onClick={() => reimprimir(l)}>
                  <FileText className="w-4 h-4 mr-1" />PDF
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
