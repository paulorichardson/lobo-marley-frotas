import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CameraInput } from "@/components/CameraInput";
import { Fuel, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/abastecer/$veiculoId")({
  head: () => ({ meta: [{ title: "Registrar Abastecimento — Lobo Marley" }] }),
  component: AbastecerPublico,
});

const COMBUSTIVEIS = [
  "Gasolina Comum", "Gasolina Aditivada", "Diesel S10",
  "Diesel Comum", "GNV", "Arla 32", "Etanol",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const FN = `${SUPABASE_URL}/functions/v1/abastecimento-publico`;

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AbastecerPublico() {
  const { veiculoId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [veiculo, setVeiculo] = useState<any>(null);
  const [empresa, setEmpresa] = useState<any>(null);

  const [cnpj, setCnpj] = useState("");
  const [combustivel, setCombustivel] = useState("Diesel S10");
  const [km, setKm] = useState("");
  const [litros, setLitros] = useState("");
  const [valorLitro, setValorLitro] = useState("");
  const [posto, setPosto] = useState("");
  const [motoristaNome, setMotoristaNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [hodometro, setHodometro] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<{ valor: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${FN}?veiculo_id=${veiculoId}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Erro");
        setVeiculo(j.veiculo);
        setEmpresa(j.empresa);
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [veiculoId]);

  const total = useMemo(() => {
    const l = parseFloat(litros.replace(",", "."));
    const v = parseFloat(valorLitro.replace(",", "."));
    return isNaN(l) || isNaN(v) ? 0 : l * v;
  }, [litros, valorLitro]);

  async function enviar() {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) return toast.error("CNPJ inválido");
    const l = parseFloat(litros.replace(",", "."));
    const v = parseFloat(valorLitro.replace(",", "."));
    const k = parseFloat(km.replace(",", "."));
    if (!l || !v || !k) return toast.error("Preencha litros, valor e KM");
    if (k < Number(veiculo.km_atual)) {
      return toast.error(`KM deve ser ≥ ${veiculo.km_atual}`);
    }
    if (!comprovante) return toast.error("Foto do comprovante obrigatória");
    if (!hodometro) return toast.error("Foto do hodômetro obrigatória");

    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append("veiculo_id", veiculoId);
      fd.append("fornecedor_cnpj", cnpjLimpo);
      fd.append("data_hora", new Date().toISOString());
      fd.append("combustivel", combustivel);
      fd.append("litros", String(l));
      fd.append("valor_litro", String(v));
      fd.append("km_atual", String(k));
      fd.append("posto", posto);
      fd.append("motorista_nome", motoristaNome);
      fd.append("observacoes", observacoes);
      fd.append("comprovante", comprovante);
      fd.append("hodometro", hodometro);

      const r = await fetch(FN, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao enviar");
      setSucesso({ valor: j.total });
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !veiculo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">Veículo não encontrado</h1>
          <p className="text-sm text-muted-foreground">{erro}</p>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="p-6 max-w-md text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          <h1 className="text-2xl font-bold">Abastecimento registrado!</h1>
          <p className="text-3xl font-bold text-primary">{BRL(sucesso.valor)}</p>
          <p className="text-sm text-muted-foreground">
            {veiculo.placa} • {veiculo.modelo}
          </p>
          <p className="text-xs text-muted-foreground">
            O gestor da frota foi notificado.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24 max-w-md mx-auto space-y-4">
      <header className="text-center pt-2">
        <h1 className="text-xl font-bold flex items-center justify-center gap-2">
          <Fuel className="w-6 h-6 text-primary" /> Abastecimento Rápido
        </h1>
        <p className="text-xs text-muted-foreground">via QR Code</p>
      </header>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <p className="text-xs uppercase text-muted-foreground">Veículo</p>
        <p className="text-2xl font-bold">{veiculo.placa}</p>
        <p className="text-sm">{veiculo.marca} {veiculo.modelo}</p>
        {empresa && (
          <p className="text-xs text-muted-foreground mt-1">
            {empresa.nome_fantasia || empresa.razao_social}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          KM atual: {Number(veiculo.km_atual).toLocaleString("pt-BR")}
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <Label>CNPJ do posto *</Label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use o CNPJ cadastrado na plataforma.
          </p>
        </div>

        <div>
          <Label>Nome do posto</Label>
          <Input value={posto} onChange={(e) => setPosto(e.target.value)} placeholder="Opcional" />
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

        <div>
          <Label>KM atual *</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder={`Mínimo: ${veiculo.km_atual}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Litros *</Label>
            <Input
              type="number" inputMode="decimal" step="0.001"
              value={litros} onChange={(e) => setLitros(e.target.value)}
              placeholder="45,230"
            />
          </div>
          <div>
            <Label>R$ / litro *</Label>
            <Input
              type="number" inputMode="decimal" step="0.001"
              value={valorLitro} onChange={(e) => setValorLitro(e.target.value)}
              placeholder="5,890"
            />
          </div>
        </div>

        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-3xl font-bold text-primary">{BRL(total)}</p>
        </div>

        <div>
          <Label>Motorista presente</Label>
          <Input
            value={motoristaNome}
            onChange={(e) => setMotoristaNome(e.target.value)}
            placeholder="Nome (opcional)"
          />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Fotos obrigatórias</h3>
        <CameraInput label="Hodômetro *" required onChange={setHodometro} />
        <CameraInput label="Comprovante *" required onChange={setComprovante} />
      </Card>

      <div>
        <Label>Observações</Label>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
      </div>

      <Button
        size="lg"
        className="w-full h-14 text-base font-bold"
        onClick={enviar}
        disabled={salvando}
      >
        {salvando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Fuel className="w-5 h-5 mr-2" />}
        REGISTRAR ABASTECIMENTO
      </Button>
    </div>
  );
}
