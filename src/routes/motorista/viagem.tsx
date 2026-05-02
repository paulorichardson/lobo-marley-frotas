import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useJornadaAtiva } from "@/hooks/useJornada";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation, Clock, Gauge } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/motorista/viagem")({
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <ViagemPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

function ViagemPage() {
  const { user, empresaId } = useAuth();
  const { viagem, refresh } = useJornadaAtiva();
  const [veiculoId, setVeiculoId] = useState<string | null>(null);

  const [destino, setDestino] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [kmSaida, setKmSaida] = useState("");
  const [kmChegada, setKmChegada] = useState("");
  const [loading, setLoading] = useState(false);

  const kmPercorrido =
    kmChegada && viagem?.km_saida
      ? Math.max(0, Number(kmChegada) - Number(viagem.km_saida))
      : 0;

  // Veículo do motorista (para iniciar nova viagem)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("veiculos")
      .select("id, km_atual")
      .eq("motorista_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          setVeiculoId(data.id);
          if (!kmSaida) setKmSaida(String(data.km_atual ?? ""));
        }
      });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciarViagem(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !empresaId) return toast.error("Sessão sem empresa vinculada");
    if (!veiculoId) return toast.error("Nenhum veículo vinculado");
    if (!destino.trim()) return toast.error("Destino obrigatório");
    if (!kmSaida) return toast.error("KM de saída obrigatório");

    setLoading(true);
    try {
      const { error } = await supabase.from("viagens").insert({
        motorista_id: user.id,
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        destino,
        finalidade: finalidade || null,
        km_saida: Number(kmSaida),
        data_saida: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Viagem iniciada!");
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar viagem");
    } finally {
      setLoading(false);
    }
  }

  async function encerrarViagem(e: React.FormEvent) {
    e.preventDefault();
    if (!viagem?.id) return;
    if (!kmChegada) return toast.error("KM de chegada obrigatório");
    if (viagem.km_saida && Number(kmChegada) < Number(viagem.km_saida)) {
      return toast.error("KM de chegada deve ser maior que o KM de saída");
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("viagens")
        .update({
          km_chegada: Number(kmChegada),
          km_percorrido: kmPercorrido,
          data_chegada: new Date().toISOString(),
        })
        .eq("id", viagem.id);
      if (error) throw error;
      toast.success(`Viagem encerrada! ${kmPercorrido} km percorridos.`);
      refresh();
      setKmChegada("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao encerrar viagem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Controle de viagem</h1>

      {!viagem ? (
        <form onSubmit={iniciarViagem} className="space-y-5">
          <div className="bg-muted rounded-2xl p-4 text-center">
            <Navigation size={40} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhuma viagem em andamento</p>
          </div>

          <div>
            <Label className="font-semibold">Destino *</Label>
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex: São Paulo - SP"
              required
              className="mt-1 h-12"
            />
          </div>

          <div>
            <Label className="font-semibold">Finalidade</Label>
            <Input
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              placeholder="Ex: Entrega de mercadoria"
              className="mt-1 h-12"
            />
          </div>

          <div>
            <Label className="font-semibold">KM de saída *</Label>
            <Input
              type="number"
              value={kmSaida}
              onChange={(e) => setKmSaida(e.target.value)}
              placeholder="Ex: 45230"
              required
              className="mt-1 text-lg h-12"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
            disabled={loading || !veiculoId}
          >
            <Navigation className="mr-2" />
            {loading ? "Iniciando..." : "Iniciar viagem"}
          </Button>
        </form>
      ) : (
        <form onSubmit={encerrarViagem} className="space-y-5">
          <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-lg">
              <Navigation size={22} /> Viagem em andamento
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} />
              <span className="font-semibold">Destino:</span> {viagem.destino}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} />
              <span className="font-semibold">Saída:</span>{" "}
              {viagem.data_saida
                ? format(new Date(viagem.data_saida), "dd/MM/yyyy HH:mm", { locale: ptBR })
                : "-"}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Gauge size={16} />
              <span className="font-semibold">KM saída:</span> {viagem.km_saida}
            </div>
          </div>

          <div>
            <Label className="font-semibold">KM de chegada *</Label>
            <Input
              type="number"
              value={kmChegada}
              onChange={(e) => setKmChegada(e.target.value)}
              placeholder={`Min: ${viagem.km_saida}`}
              required
              className="mt-1 text-lg h-12"
            />
          </div>

          {kmPercorrido > 0 && (
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">KM percorrido</p>
              <p className="text-4xl font-extrabold text-primary">{kmPercorrido} km</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700"
            disabled={loading}
          >
            {loading ? "Encerrando..." : "Encerrar viagem"}
          </Button>
        </form>
      )}
    </div>
  );
}
