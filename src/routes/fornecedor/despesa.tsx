import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CameraInput } from "@/components/CameraInput";
import { VeiculoPlacaSearch, type VeiculoBusca } from "@/components/fornecedor/VeiculoPlacaSearch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wrench, Loader2, Save, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import { notifyEmpresaGestores } from "@/lib/notify";

export const Route = createFileRoute("/fornecedor/despesa")({
  head: () => ({ meta: [{ title: "Lançar despesa — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <DespesaPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const TIPOS = ["Serviço", "Peça", "Manutenção", "Multa", "Outros"];
const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DespesaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<VeiculoBusca | null>(null);
  const [tipo, setTipo] = useState("Serviço");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const [nfNumero, setNfNumero] = useState("");
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [foto1, setFoto1] = useState<File | null>(null);
  const [foto2, setFoto2] = useState<File | null>(null);
  const [aprovadoNome, setAprovadoNome] = useState("");
  const [modo, setModo] = useState<"executado" | "orcamento">("executado");
  const [validade, setValidade] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  function reset() {
    setVeiculo(null); setTipo("Serviço"); setDescricao(""); setValor("");
    setNfNumero(""); setNfFile(null); setFoto1(null); setFoto2(null);
    setAprovadoNome(""); setModo("executado"); setValidade(""); setObs("");
    setSucesso(false);
  }

  async function salvar() {
    if (!user) return;
    if (!veiculo) return toast.error("Selecione o veículo");
    if (!descricao.trim()) return toast.error("Descrição obrigatória");
    const v = parseFloat(valor.replace(",", ".")) || 0;
    if (v <= 0) return toast.error("Valor inválido");

    setSaving(true);
    try {
      let nfUrl: string | null = null;
      if (nfFile) {
        const ext = nfFile.type === "application/pdf" ? "pdf" : "jpg";
        nfUrl = await uploadFile("comprovantes", `despesa/${user.id}/nf`, nfFile, ext);
      }
      const fotosUrls: string[] = [];
      for (const f of [foto1, foto2]) {
        if (f) fotosUrls.push(await uploadFile("comprovantes", `despesa/${user.id}/fotos`, f));
      }

      const isOrc = modo === "orcamento";
      const status = isOrc ? "Orçamento" : "Concluída";

      const { data: manut, error } = await supabase
        .from("manutencoes")
        .insert({
          veiculo_id: veiculo.id,
          fornecedor_id: user.id,
          empresa_id: veiculo.empresa_id ?? null,
          tipo,
          status,
          prioridade: "Normal",
          descricao,
          servico_executado: isOrc ? null : descricao,
          data_inicio: isOrc ? null : new Date(data).toISOString(),
          data_conclusao: isOrc ? null : new Date(data).toISOString(),
          valor_previsto: isOrc ? v : null,
          valor_final: isOrc ? null : v,
          comprovante_url: nfUrl,
          nota_fiscal: nfNumero || null,
          aprovado_nome: aprovadoNome || null,
          observacoes: [obs, fotosUrls.length ? `Fotos: ${fotosUrls.join(", ")}` : null]
            .filter(Boolean).join(" | ") || null,
          validade_orcamento: isOrc && validade ? validade : null,
          data_solicitacao: new Date().toISOString(),
        })
        .select().single();
      if (error) throw error;

      if (veiculo.empresa_id) {
        await notifyEmpresaGestores({
          empresaId: veiculo.empresa_id,
          titulo: isOrc ? "Novo orçamento recebido" : "Despesa lançada",
          mensagem: `${veiculo.placa} • ${tipo} • ${BRL(v)}`,
          tipo: isOrc ? "info" : "sucesso",
          link: "/gestor/manutencoes",
        });
      }
      void manut;
      setSucesso(true);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (sucesso) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <Card className="p-6 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          <h2 className="text-xl font-bold">Lançamento registrado</h2>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/fornecedor" })}>Início</Button>
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
          <Wrench className="w-6 h-6" /> Lançar despesa / serviço
        </h1>
        <p className="text-sm text-muted-foreground">Para fornecedores não-posto</p>
      </header>

      <Card className="p-4">
        <Label className="mb-2 block">Veículo</Label>
        <VeiculoPlacaSearch selected={veiculo} onSelect={setVeiculo} required />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do serviço</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Descrição detalhada *</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
          </div>
          <div>
            <Label>Valor total (R$) *</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label>Nº NF (opcional)</Label>
            <Input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} maxLength={50} />
          </div>
          <div className="col-span-2">
            <Label>Aprovado por (responsável)</Label>
            <Input value={aprovadoNome} onChange={(e) => setAprovadoNome(e.target.value)} placeholder="Nome de quem aprovou" />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <Label className="flex items-center gap-2"><FileText className="w-4 h-4" /> Nota fiscal (PDF ou foto)</Label>
        <input
          type="file" accept="image/*,application/pdf"
          onChange={(e) => setNfFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        {nfFile && <p className="text-xs text-muted-foreground">📎 {nfFile.name}</p>}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <CameraInput label="Foto serviço 1" onChange={setFoto1} />
          <CameraInput label="Foto serviço 2" onChange={setFoto2} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>Status</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={modo === "executado" ? "default" : "outline"}
            onClick={() => setModo("executado")}
          >
            ✅ Serviço executado
          </Button>
          <Button
            type="button"
            variant={modo === "orcamento" ? "default" : "outline"}
            onClick={() => setModo("orcamento")}
          >
            📤 Enviar orçamento
          </Button>
        </div>
        {modo === "orcamento" && (
          <div>
            <Label>Validade do orçamento</Label>
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Observações gerais</Label>
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
        </div>
      </Card>

      <Button size="lg" className="w-full h-14 text-base font-bold" onClick={salvar} disabled={saving}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
        SALVAR LANÇAMENTO
      </Button>
    </div>
  );
}
