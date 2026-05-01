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
import { CameraInput } from "@/components/CameraInput";
import { VeiculoPlacaSearch, type VeiculoBusca } from "@/components/fornecedor/VeiculoPlacaSearch";
import { PecasEditor, type Peca } from "@/components/fornecedor/PecasEditor";
import { Package, Loader2, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import { notifyEmpresaGestores } from "@/lib/notify";

export const Route = createFileRoute("/fornecedor/lancar-pecas")({
  head: () => ({ meta: [{ title: "Lançar Peças — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <LancarPecasPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function LancarPecasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [veiculo, setVeiculo] = useState<VeiculoBusca | null>(null);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [desconto, setDesconto] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [nfNumero, setNfNumero] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fotoNF, setFotoNF] = useState<File | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const totalPecas = useMemo(
    () => pecas.reduce((s, p) => s + p.quantidade * p.valor_unitario, 0),
    [pecas],
  );
  const total = useMemo(() => {
    const d = parseFloat(desconto.replace(",", ".")) || 0;
    return Math.max(0, totalPecas - d);
  }, [totalPecas, desconto]);

  function reset() {
    setVeiculo(null);
    setPecas([]);
    setDesconto("");
    setNfNumero("");
    setObservacoes("");
    setFotoNF(null);
    setSucesso(null);
  }

  async function salvar() {
    if (!user) return;
    if (!veiculo) {
      toast.error("Selecione o veículo");
      return;
    }
    const validas = pecas.filter((p) => p.descricao.trim() && p.quantidade > 0);
    if (validas.length === 0) {
      toast.error("Adicione pelo menos uma peça");
      return;
    }
    if (!fotoNF) {
      toast.error("Anexe a nota fiscal");
      return;
    }

    setSalvando(true);
    try {
      const nfUrl = await uploadFile("comprovantes", `pecas/${user.id}/nf`, fotoNF);

      const descricaoFinal = `Venda de peças — ${veiculo.placa}`;
      const obs = [
        observacoes,
        nfNumero ? `NF: ${nfNumero}` : null,
        `Itens: ${validas.length}`,
      ].filter(Boolean).join(" | ");

      const { data: manut, error } = await supabase
        .from("manutencoes")
        .insert({
          veiculo_id: veiculo.id,
          fornecedor_id: user.id,
          empresa_id: veiculo.empresa_id ?? null,
          tipo: "Troca de Peça",
          status: "Concluída",
          prioridade: "Normal",
          descricao: descricaoFinal,
          diagnostico: "Fornecimento de peças",
          data_inicio: new Date(data).toISOString(),
          data_conclusao: new Date(data).toISOString(),
          valor_final: total,
          desconto: parseFloat(desconto.replace(",", ".")) || null,
          comprovante_url: nfUrl,
          nota_fiscal: nfNumero || null,
          observacoes: obs || null,
          data_solicitacao: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      const itens = validas.map((p) => ({
        manutencao_id: manut.id,
        descricao: p.descricao,
        quantidade: p.quantidade,
        valor_unitario: p.valor_unitario,
      }));
      const { error: e2 } = await supabase.from("manutencao_pecas").insert(itens);
      if (e2) throw e2;

      if (veiculo.empresa_id) {
        await notifyEmpresaGestores({
          empresaId: veiculo.empresa_id,
          titulo: "Peças fornecidas",
          mensagem: `${veiculo.placa} • ${validas.length} item(ns) • ${BRL(total)}`,
          tipo: "info",
        });
      }

      setSucesso(`${validas.length} peça(s) registrada(s)`);
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
          <h2 className="text-xl font-bold">{sucesso}</h2>
          <p className="text-3xl font-bold">{BRL(total)}</p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/fornecedor" })}>
              Início
            </Button>
            <Button onClick={reset}>Novo lançamento</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6" /> Lançar Peças
        </h1>
        <p className="text-sm text-muted-foreground">
          Venda direta de peças para um veículo da rede.
        </p>
      </header>

      <Card className="p-4">
        <Label className="mb-2 block">Veículo destino</Label>
        <VeiculoPlacaSearch selected={veiculo} onSelect={setVeiculo} required />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Nº Nota Fiscal</Label>
            <Input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} maxLength={50} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>Peças vendidas *</Label>
        <PecasEditor pecas={pecas} onChange={setPecas} />
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div>
            <Label>Subtotal</Label>
            <p className="text-lg font-semibold">{BRL(totalPecas)}</p>
          </div>
          <div>
            <Label>Desconto (R$)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
            />
          </div>
        </div>
        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-3xl md:text-4xl font-bold text-primary">{BRL(total)}</p>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <CameraInput label="Nota fiscal *" required onChange={setFotoNF} />
        <div>
          <Label>Observações</Label>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>
      </Card>

      <Button
        size="lg"
        className="w-full h-14 text-base font-bold"
        onClick={salvar}
        disabled={salvando}
      >
        {salvando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
        REGISTRAR VENDA DE PEÇAS
      </Button>
    </div>
  );
}
