import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useJornada } from "@/hooks/useJornada";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation, Clock, Gauge } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/motorista/viagem")({
    component: ViagemPage,
});

function ViagemPage() {
    const { user, empresaId } = useAuth();
    const { jornadaAtiva, refetch } = useJornada();
    const viagemAtiva = jornadaAtiva?.viagem_atual ?? null;

  const [destino, setDestino] = useState("");
    const [finalidade, setFinalidade] = useState("");
    const [kmSaida, setKmSaida] = useState("");
    const [kmChegada, setKmChegada] = useState("");
    const [loading, setLoading] = useState(false);

  const kmPercorrido =
        kmChegada && viagemAtiva?.km_saida
        ? Math.max(0, Number(kmChegada) - Number(viagemAtiva.km_saida))
          : 0;

  async function iniciarViagem(e: React.FormEvent) {
        e.preventDefault();
        if (!destino.trim()) { toast.error("Destino obrigatorio"); return; }
        if (!kmSaida) { toast.error("KM de saida obrigatorio"); return; }

      setLoading(true);
        try {
                const { error } = await supabase.from("viagens").insert({
                          motorista_id: user?.id,
                          empresa_id: empresaId,
                          destino,
                          finalidade,
                          km_saida: Number(kmSaida),
                          status: "em_andamento",
                          hora_saida: new Date().toISOString(),
                });
                if (error) throw error;
                toast.success("Viagem iniciada!");
                refetch();
        } catch (err: unknown) {
                toast.error("Erro ao iniciar viagem");
        } finally {
                setLoading(false);
        }
  }

  async function encerrarViagem(e: React.FormEvent) {
        e.preventDefault();
        if (!kmChegada) { toast.error("KM de chegada obrigatorio"); return; }
        if (viagemAtiva?.km_saida && Number(kmChegada) < Number(viagemAtiva.km_saida)) {
                toast.error("KM de chegada deve ser maior que o KM de saida");
                return;
        }
        if (!viagemAtiva?.id) return;

      setLoading(true);
        try {
                const { error } = await supabase
                  .from("viagens")
                  .update({
                              km_chegada: Number(kmChegada),
                              km_percorrido: kmPercorrido,
                              status: "concluida",
                              hora_chegada: new Date().toISOString(),
                  })
                  .eq("id", viagemAtiva.id);
                if (error) throw error;
                toast.success("Viagem encerrada! " + kmPercorrido + " km percorridos.");
                refetch();
                setKmChegada("");
        } catch (err: unknown) {
                toast.error("Erro ao encerrar viagem");
        } finally {
                setLoading(false);
        }
  }

  return (
        <ProtectedRoute roles={["motorista"]}>
                <AppShell title="Controle de Viagem">
                        <div className="p-4 pb-24">
                          {!viagemAtiva ? (
                      <form onSubmit={iniciarViagem} className="space-y-5">
                                    <div className="bg-muted rounded-2xl p-4 text-center">
                                                    <Navigation size={40} className="mx-auto text-muted-foreground mb-2" />
                                                    <p className="text-muted-foreground">Nenhuma viagem em andamento</p>p>
                                    </div>div>
                      
                                    <div>
                                                    <Label className="font-semibold">Destino *</Label>Label>
                                                    <Input
                                                                        value={destino}
                                                                        onChange={(e) => setDestino(e.target.value)}
                                                                        placeholder="Ex: Sao Paulo - SP"
                                                                        required
                                                                        className="mt-1 h-12"
                                                                      />
                                    </div>div>
                      
                                    <div>
                                                    <Label className="font-semibold">Finalidade</Label>Label>
                                                    <Input
                                                                        value={finalidade}
                                                                        onChange={(e) => setFinalidade(e.target.value)}
                                                                        placeholder="Ex: Entrega de mercadoria"
                                                                        className="mt-1 h-12"
                                                                      />
                                    </div>div>
                      
                                    <div>
                                                    <Label className="font-semibold">KM de Saida *</Label>Label>
                                                    <Input
                                                                        type="number"
                                                                        value={kmSaida}
                                                                        onChange={(e) => setKmSaida(e.target.value)}
                                                                        placeholder="Ex: 45230"
                                                                        required
                                                                        className="mt-1 text-lg h-12"
                                                                      />
                                    </div>div>
                      
                                    <Button
                                                      type="submit"
                                                      className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
                                                      disabled={loading}
                                                    >
                                                    <Navigation className="mr-2" />
                                      {loading ? "Iniciando..." : "Iniciar Viagem"}
                                    </Button>Button>
                      </form>form>
                    ) : (
                      <form onSubmit={encerrarViagem} className="space-y-5">
                                    <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-5 space-y-3">
                                                    <div className="flex items-center gap-2 text-green-700 font-bold text-lg">
                                                                      <Navigation size={22} />
                                                                      Viagem em andamento
                                                    </div>div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                      <MapPin size={16} />
                                                                      <span className="font-semibold">Destino:</span>span>
                                                      {viagemAtiva.destino}
                                                    </div>div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                      <Clock size={16} />
                                                                      <span className="font-semibold">Saida:</span>span>
                                                      {viagemAtiva.hora_saida
                                                                            ? format(new Date(viagemAtiva.hora_saida), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                                                            : "-"}
                                                    </div>div>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                      <Gauge size={16} />
                                                                      <span className="font-semibold">KM saida:</span>span>
                                                      {viagemAtiva.km_saida}
                                                    </div>div>
                                    </div>div>
                      
                                    <div>
                                                    <Label className="font-semibold">KM de Chegada *</Label>Label>
                                                    <Input
                                                                        type="number"
                                                                        value={kmChegada}
                                                                        onChange={(e) => setKmChegada(e.target.value)}
                                                                        placeholder={`Min: ${viagemAtiva.km_saida}`}
                                                                        required
                                                                        className="mt-1 text-lg h-12"
                                                                      />
                                    </div>div>
                      
                        {kmPercorrido > 0 && (
                                        <div className="bg-primary/10 rounded-xl p-4 text-center">
                                                          <p className="text-sm text-muted-foreground">KM percorrido</p>p>
                                                          <p className="text-4xl font-extrabold text-primary">{kmPercorrido} km</p>p>
                                        </div>div>
                                    )}
                      
                                    <Button
                                                      type="submit"
                                                      className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700"
                                                      disabled={loading}
                                                    >
                                      {loading ? "Encerrando..." : "Encerrar Viagem"}
                                    </Button>Button>
                      </form>form>
                                  )}
                        </div>div>
                </AppShell>AppShell>
        </ProtectedRoute>ProtectedRoute>
      );
}</AppShell>
