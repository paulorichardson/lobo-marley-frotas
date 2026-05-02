import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { CameraInput } from "@/components/CameraInput";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/motorista/abastecimento")({
  component: () => (
    <ProtectedRoute roles={["motorista"]}>
      <AppShell>
        <AbastecimentoPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const COMBUSTIVEIS = ["Gasolina", "Etanol", "Diesel", "Diesel S10", "GNV", "Flex"];

function AbastecimentoPage() {
  const { user, empresaId } = useAuth();
  const [kmAtual, setKmAtual] = useState("");
  const [litros, setLitros] = useState("");
  const [valorLitro, setValorLitro] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [posto, setPosto] = useState("");
  const [fotoComprovante, setFotoComprovante] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [kmAnterior, setKmAnterior] = useState<number>(0);
  const [veiculoId, setVeiculoId] = useState<string | null>(null);

  const total =
    litros && valorLitro
      ? (parseFloat(litros) * parseFloat(valorLitro)).toFixed(2)
      : "0.00";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("veiculos")
      .select("id, km_atual")
      .eq("motorista_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setVeiculoId(data.id);
          setKmAnterior(Number(data.km_atual ?? 0));
        }
      });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !empresaId) return toast.error("Sessão sem empresa vinculada");
    if (!veiculoId) return toast.error("Nenhum veículo vinculado");
    if (!kmAtual) return toast.error("KM atual obrigatório");
    if (Number(kmAtual) < kmAnterior) {
      return toast.error(`KM deve ser ≥ ${kmAnterior} (km anterior)`);
    }
    if (!litros || !valorLitro) return toast.error("Litros e valor/litro obrigatórios");
    if (!combustivel) return toast.error("Selecione o combustível");
    if (!fotoComprovante) return toast.error("Foto do comprovante obrigatória");

    setLoading(true);
    try {
      const path = `${user.id}/${Date.now()}_comprovante.jpg`;
      const { error: upErr } = await supabase.storage
        .from("comprovantes")
        .upload(path, fotoComprovante);
      if (upErr) throw upErr;
      const compUrl = supabase.storage
        .from("comprovantes")
        .getPublicUrl(path).data.publicUrl;

      const { error } = await supabase.from("abastecimentos").insert({
        motorista_id: user.id,
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        km_atual: Number(kmAtual),
        litros: Number(litros),
        valor_litro: Number(valorLitro),
        valor_total: Number(total),
        combustivel,
        posto: posto || null,
        comprovante_url: compUrl,
      });
      if (error) throw error;

      toast.success("Abastecimento registrado!");
      setKmAtual(""); setLitros(""); setValorLitro(""); setPosto("");
      setFotoComprovante(null);
      setKmAnterior(Number(kmAtual));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar abastecimento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-24 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Registrar abastecimento</h1>

      <div>
        <Label className="font-semibold">KM atual *</Label>
        <Input
          type="number"
          value={kmAtual}
          onChange={(e) => setKmAtual(e.target.value)}
          placeholder={kmAnterior ? `Min: ${kmAnterior}` : "Ex: 45230"}
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
            required
            className="mt-1 h-12"
          />
        </div>
        <div>
          <Label className="font-semibold">R$ / Litro *</Label>
          <Input
            type="number"
            step="0.001"
            value={valorLitro}
            onChange={(e) => setValorLitro(e.target.value)}
            required
            className="mt-1 h-12"
          />
        </div>
      </div>

      <div className="bg-primary/10 rounded-xl p-4 text-center">
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="text-3xl font-extrabold text-primary">
          R$ {Number(total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div>
        <Label className="font-semibold">Combustível *</Label>
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
        <Label className="font-semibold">Posto</Label>
        <Input
          value={posto}
          onChange={(e) => setPosto(e.target.value)}
          placeholder="Ex: Shell Av. Paulista"
          className="mt-1 h-12"
        />
      </div>

      <div>
        <Label className="font-semibold">Foto do comprovante *</Label>
        <CameraInput label="Tirar foto do cupom" onChange={setFotoComprovante} required />
      </div>

      <Button
        type="submit"
        className="w-full h-14 text-lg font-bold"
        disabled={loading || !veiculoId}
      >
        {loading ? "Salvando..." : "Registrar abastecimento"}
      </Button>
    </form>
  );
}
