import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { CameraInput } from "@/components/CameraInput";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Fuel } from "lucide-react";

export const Route = createFileRoute("/motorista/abastecimento")({
    component: AbastecimentoPage,
});

const COMBUSTIVEIS = ["Gasolina", "Etanol", "Diesel", "Diesel S10", "GNV", "Flex"];

function AbastecimentoPage() {
    const { user, empresaId } = useAuth();
    const [kmAtual, setKmAtual] = useState("");
    const [litros, setLitros] = useState("");
    const [valorLitro, setValorLitro] = useState("");
    const [combustivel, setCombustivel] = useState("");
    const [posto, setPosto] = useState("");
    const [fotoHodometro, setFotoHodometro] = useState<File | null>(null);
    const [fotoComprovante, setFotoComprovante] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [kmAnterior, setKmAnterior] = useState<number>(0);
    const [veiculoId, setVeiculoId] = useState<string | null>(null);

  const total =
        litros && valorLitro
        ? (parseFloat(litros) * parseFloat(valorLitro)).toFixed(2)
          : "0.00";

  useEffect(() => {
        async function loadVeiculo() {
                if (!user) return;
                const { data } = await supabase
                  .from("perfis")
                  .select("veiculo_id, veiculos(km_atual)")
                  .eq("id", user.id)
                  .single();
                if (data?.veiculo_id) {
                          setVeiculoId(data.veiculo_id);
                          const km = (data.veiculos as { km_atual?: number })?.km_atual ?? 0;
                          setKmAnterior(km);
                }
        }
        loadVeiculo();
  }, [user]);

  async function uploadFoto(file: File, prefix: string) {
        const path = `abastecimentos/${user?.id}/${prefix}_${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("fotos").upload(path, file);
        if (error) throw error;
        return supabase.storage.from("fotos").getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!kmAtual) { toast.error("KM atual obrigatorio"); return; }
        if (Number(kmAtual) < kmAnterior) {
                toast.error(`KM deve ser >= ${kmAnterior} (km anterior)`);
                return;
        }
        if (!litros || !valorLitro) { toast.error("Litros e valor/litro obrigatorios"); return; }
        if (!combustivel) { toast.error("Selecione o combustivel"); return; }
        if (!fotoHodometro) { toast.error("Foto do hodometro obrigatoria"); return; }
        if (!fotoComprovante) { toast.error("Foto do comprovante obrigatoria"); return; }

      setLoading(true);
        try {
                const [urlHodo, urlComp] = await Promise.all([
                          uploadFoto(fotoHodometro, "hodometro"),
                          uploadFoto(fotoComprovante, "comprovante"),
                        ]);

          const { error } = await supabase.from("abastecimentos").insert({
                    motorista_id: user?.id,
                    veiculo_id: veiculoId,
                    empresa_id: empresaId,
                    km_atual: Number(kmAtual),
                    litros: Number(litros),
                    valor_litro: Number(valorLitro),
                    valor_total: Number(total),
                    tipo_combustivel: combustivel,
                    nome_posto: posto,
                    foto_hodometro: urlHodo,
                    foto_comprovante: urlComp,
          });
                if (error) throw error;
                toast.success("Abastecimento registrado!");
                setKmAtual(""); setLitros(""); setValorLitro(""); setPosto("");
                setFotoHodometro(null); setFotoComprovante(null);
        } catch (err: unknown) {
                toast.error("Erro ao registrar abastecimento");
        } finally {
                setLoading(false);
        }
  }

  return (
        <ProtectedRoute roles={["motorista"]}>
                <AppShell title="Registrar Abastecimento">
                        <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24">
                                  <div className="bg-primary/10 rounded-2xl p-4 text-center">
                                              <p className="text-sm text-muted-foreground">Total do Abastecimento</p>
                                              <p className="text-5xl font-extrabold text-primary mt-1">
                                                            R$ {total}
                                              </p>
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">KM Atual * (anterior: {kmAnterior})</Label>
                                              <Input
                                                              type="number"
                                                              value={kmAtual}
                                                              onChange={(e) => setKmAtual(e.target.value)}
                                                              placeholder={`Min: ${kmAnterior}`}
                                                              required
                                                              className="mt-1 text-lg h-12"
                                                            />
                                  </div>
                        
                                  <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                            <Label className="font-semibold">Litros *</Label>
                                                            <Input
                                                                              type="number"
                                                                              step="0.01"
                                                                              value={litros}
                                                                              onChange={(e) => setLitros(e.target.value)}
                                                                              placeholder="0.00"
                                                                              className="mt-1 text-lg h-12"
                                                                            />
                                              </div>
                                              <div>
                                                            <Label className="font-semibold">R$/Litro *</Label>
                                                            <Input
                                                                              type="number"
                                                                              step="0.001"
                                                                              value={valorLitro}
                                                                              onChange={(e) => setValorLitro(e.target.value)}
                                                                              placeholder="0.000"
                                                                              className="mt-1 text-lg h-12"
                                                                            />
                                              </div>
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Combustivel *</Label>
                                              <Select value={combustivel} onValueChange={setCombustivel}>
                                                            <SelectTrigger className="mt-1 h-12">
                                                                            <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              {COMBUSTIVEIS.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                                                            </SelectContent>
                                              </Select>
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Nome do Posto</Label>
                                              <Input
                                                              value={posto}
                                                              onChange={(e) => setPosto(e.target.value)}
                                                              placeholder="Ex: Posto Shell Centro"
                                                              className="mt-1"
                                                            />
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Foto do Hodometro *</Label>
                                              <CameraInput label="Tirar foto do hodometro" onChange={setFotoHodometro} required />
                                  </div>
                        
                                  <div>
                                              <Label className="font-semibold">Foto do Comprovante *</Label>
                                              <CameraInput label="Tirar foto do comprovante" onChange={setFotoComprovante} required />
                                  </div>
                        
                                  <Button type="submit" className="w-full h-14 text-lg font-bold" disabled={loading}>
                                              <Fuel className="mr-2" />
                                    {loading ? "Registrando..." : "Registrar Abastecimento"}
                                  </Button>
        </form>
      </AppShell>
    </ProtectedRoute>
  );
}
