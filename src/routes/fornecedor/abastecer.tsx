import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CameraInput } from "@/components/CameraInput";
import { VeiculoPlacaSearch, type VeiculoBusca } from "@/components/fornecedor/VeiculoPlacaSearch";
import { Truck, Package, Fuel, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import { notifyEmpresaGestores } from "@/lib/notify";

export const Route = createFileRoute("/fornecedor/abastecer")({
  head: () => ({ meta: [{ title: "Registrar Abastecimento — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <AbastecerPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const COMBUSTIVEIS = [
  "Gasolina Comum", "Gasolina Aditivada", "Diesel S10",
  "Diesel Comum", "GNV", "Arla 32", "Etanol", "Outros",
];

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AbastecerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tipoAlvo, setTipoAlvo] = useState<"veiculo" | "outro">("veiculo");
  const [veiculo, setVeiculo] = useState<VeiculoBusca | null>(null);
  const [descricaoBem, setDescricaoBem] = useState("");

  const [dataHora, setDataHora] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [combustivel, setCombustivel] = useState("Diesel S10");
  const [km, setKm] = useState<string>("");
  const [litros, setLitros] = useState<string>("");
  const [valorLitro, setValorLitro] = useState<string>("");
  const [bomba, setBomba] = useState("");
  const [motoristaPresente, setMotoristaPresente] = useState("");
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [postoNome, setPostoNome] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [fotoHodometro, setFotoHodometro] = useState<File | null>(null);
  const [fotoComprovante, setFotoComprovante] = useState<File | null>(null);
  const [fotoVeiculo, setFotoVeiculo] = useState<File | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<{ valor: number; placa: string } | null>(null);

  // Pré-preencher nome do posto a partir do cadastro
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("fornecedores_cadastro")
        .select("nome_fantasia, razao_social")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPostoNome(data.nome_fantasia || data.razao_social);
    })();
  }, [user]);

  const total = useMemo(() => {
    const l = parseFloat(litros.replace(",", "."));
    const v = parseFloat(valorLitro.replace(",", "."));
    if (isNaN(l) || isNaN(v)) return 0;
    return l * v;
  }, [litros, valorLitro]);

  function reset() {
    setVeiculo(null);
    setDescricaoBem("");
    setKm("");
    setLitros("");
    setValorLitro("");
    setBomba("");
    setMotoristaPresente("");
    setAutorizadoPor("");
    setObservacoes("");
    setFotoHodometro(null);
    setFotoComprovante(null);
    setFotoVeiculo(null);
    setSucesso(null);
  }

  async function salvar() {
    if (!user) return;
    if (tipoAlvo === "veiculo" && !veiculo) {
      toast.error("Selecione o veículo");
      return;
    }
    if (tipoAlvo === "outro" && !descricaoBem.trim()) {
      toast.error("Descreva o bem abastecido");
      return;
    }
    const l = parseFloat(litros.replace(",", "."));
    const v = parseFloat(valorLitro.replace(",", "."));
    if (!l || !v) {
      toast.error("Informe litros e valor por litro");
      return;
    }
    if (tipoAlvo === "veiculo") {
      const kmNum = parseFloat(km.replace(",", "."));
      if (!kmNum) {
        toast.error("Informe o KM atual do veículo");
        return;
      }
      if (veiculo && kmNum < Number(veiculo.km_atual)) {
        toast.error(`KM informado (${kmNum}) é menor que o último registrado (${veiculo.km_atual})`);
        return;
      }
    }
    if (!fotoHodometro && tipoAlvo === "veiculo") {
      toast.error("Foto do hodômetro é obrigatória");
      return;
    }
    if (!fotoComprovante) {
      toast.error("Foto do comprovante é obrigatória");
      return;
    }

    setSalvando(true);
    try {
      const prefix = `abastecimento/${user.id}`;
      const [hodoUrl, compUrl, veicUrl] = await Promise.all([
        fotoHodometro ? uploadFile("comprovantes", `${prefix}/hodometro`, fotoHodometro) : Promise.resolve(null),
        uploadFile("comprovantes", `${prefix}/comprovante`, fotoComprovante),
        fotoVeiculo ? uploadFile("comprovantes", `${prefix}/veiculo`, fotoVeiculo) : Promise.resolve(null),
      ]);

      const obs = [
        observacoes,
        bomba ? `Bomba: ${bomba}` : null,
        motoristaPresente ? `Motorista presente: ${motoristaPresente}` : null,
        autorizadoPor ? `Autorizado por: ${autorizadoPor}` : null,
        hodoUrl ? `Hodômetro: ${hodoUrl}` : null,
        veicUrl ? `Veículo: ${veicUrl}` : null,
        tipoAlvo === "outro" ? `Bem: ${descricaoBem}` : null,
      ].filter(Boolean).join(" | ");

      const empresaId = veiculo?.empresa_id ?? null;

      const { error } = await supabase.from("abastecimentos").insert({
        veiculo_id: veiculo?.id, // pode ser null se for "outro" — RLS pode bloquear; tratamos abaixo
        fornecedor_id: user.id,
        motorista_id: veiculo?.motorista_id ?? null,
        empresa_id: empresaId,
        data_hora: new Date(dataHora).toISOString(),
        combustivel,
        litros: l,
        valor_litro: v,
        valor_total: total,
        km_atual: tipoAlvo === "veiculo" ? parseFloat(km.replace(",", ".")) : 0,
        posto: postoNome,
        comprovante_url: compUrl,
        observacoes: obs || null,
      } as any);

      if (error) throw error;

      // Notifica gestores
      if (empresaId) {
        await notifyEmpresaGestores({
          empresaId,
          titulo: "Novo abastecimento",
          mensagem: `${BRL(total)} • ${l}L • ${veiculo?.placa ?? descricaoBem}`,
          tipo: "info",
        });
      }

      setSucesso({ valor: total, placa: veiculo?.placa ?? descricaoBem });
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSalvando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <Card className="p-6 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          <h2 className="text-xl font-bold">Abastecimento registrado!</h2>
          <p className="text-sm text-muted-foreground">{sucesso.placa}</p>
          <p className="text-3xl font-bold">{BRL(sucesso.valor)}</p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/fornecedor" })}>
              Voltar
            </Button>
            <Button onClick={reset}>Registrar outro</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-32">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Fuel className="w-6 h-6" /> Registrar Abastecimento
        </h1>
        <p className="text-sm text-muted-foreground">{postoNome}</p>
      </header>

      {/* Tipo do alvo */}
      <Card className="p-4">
        <Label className="mb-2 block">O que será abastecido?</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={tipoAlvo === "veiculo" ? "default" : "outline"}
            className="h-16"
            onClick={() => setTipoAlvo("veiculo")}
          >
            <Truck className="w-5 h-5 mr-2" /> Veículo da Frota
          </Button>
          <Button
            type="button"
            variant={tipoAlvo === "outro" ? "default" : "outline"}
            className="h-16"
            onClick={() => setTipoAlvo("outro")}
          >
            <Package className="w-5 h-5 mr-2" /> Outros Bens
          </Button>
        </div>

        <div className="mt-4">
          {tipoAlvo === "veiculo" ? (
            <VeiculoPlacaSearch selected={veiculo} onSelect={setVeiculo} required />
          ) : (
            <div>
              <Label>Descrição do bem *</Label>
              <Input
                value={descricaoBem}
                onChange={(e) => setDescricaoBem(e.target.value)}
                placeholder="Ex: Gerador 15kVA, Motoniveladora..."
                maxLength={200}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Dados do abastecimento */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
          </div>
          <div>
            <Label>Combustível</Label>
            <Select value={combustivel} onValueChange={setCombustivel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMBUSTIVEIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tipoAlvo === "veiculo" && (
          <div>
            <Label>KM atual *</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder={veiculo ? `Mínimo: ${veiculo.km_atual}` : "Hodômetro"}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Litros *</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.001"
              value={litros}
              onChange={(e) => setLitros(e.target.value)}
              placeholder="45,230"
            />
          </div>
          <div>
            <Label>R$ por litro *</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.001"
              value={valorLitro}
              onChange={(e) => setValorLitro(e.target.value)}
              placeholder="5,890"
            />
          </div>
        </div>

        {/* Total destacado */}
        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-3xl md:text-4xl font-bold text-primary">{BRL(total)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Bomba/Bico</Label>
            <Input value={bomba} onChange={(e) => setBomba(e.target.value)} placeholder="Opcional" maxLength={20} />
          </div>
          <div>
            <Label>Motorista presente</Label>
            <Input
              value={motoristaPresente}
              onChange={(e) => setMotoristaPresente(e.target.value)}
              placeholder="Nome"
              maxLength={100}
            />
          </div>
        </div>

        <div>
          <Label>Autorizado por</Label>
          <Input
            value={autorizadoPor}
            onChange={(e) => setAutorizadoPor(e.target.value)}
            placeholder="Nome / cargo"
            maxLength={100}
          />
        </div>
      </Card>

      {/* Fotos */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Fotos</h3>
        <div className="grid grid-cols-2 gap-3">
          {tipoAlvo === "veiculo" && (
            <CameraInput label="Hodômetro *" required onChange={setFotoHodometro} />
          )}
          <CameraInput label="Comprovante *" required onChange={setFotoComprovante} />
          <CameraInput label="Veículo (opcional)" onChange={setFotoVeiculo} />
        </div>
      </Card>

      <div>
        <Label>Observações</Label>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="fixed md:static bottom-20 md:bottom-auto left-0 right-0 p-4 md:p-0 bg-background md:bg-transparent border-t md:border-0 z-30">
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Fuel className="w-5 h-5 mr-2" />}
          REGISTRAR ABASTECIMENTO
        </Button>
      </div>
    </div>
  );
}
