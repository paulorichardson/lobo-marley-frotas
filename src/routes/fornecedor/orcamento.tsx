import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { PecasEditor, type Peca } from "@/components/fornecedor/PecasEditor";
import { FileSpreadsheet, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import { notifyEmpresaGestores } from "@/lib/notify";

export const Route = createFileRoute("/fornecedor/orcamento")({
  head: () => ({ meta: [{ title: "Novo Orçamento — Lobo Marley" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    solicitacaoId: typeof s.solicitacaoId === "string" ? s.solicitacaoId : undefined,
  }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <OrcamentoPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const TIPOS_SERVICO = [
  "Preventiva", "Corretiva", "Troca de Peça", "Funilaria/Pintura",
  "Elétrica", "Pneu/Balanceamento", "Diagnóstico", "Outros",
];

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function OrcamentoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<VeiculoBusca | null>(null);
  const [tipoServico, setTipoServico] = useState("Corretiva");
  const [diagnostico, setDiagnostico] = useState("");
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [maoObra, setMaoObra] = useState("");
  const [validade, setValidade] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [pdf, setPdf] = useState<File | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const totalPecas = useMemo(
    () => pecas.reduce((s, p) => s + p.quantidade * p.valor_unitario, 0),
    [pecas],
  );
  const total = useMemo(() => {
    const mo = parseFloat(maoObra.replace(",", ".")) || 0;
    return totalPecas + mo;
  }, [totalPecas, maoObra]);

  async function enviar() {
    if (!user) return;
    if (!veiculo) { toast.error("Selecione o veículo"); return; }
    if (!diagnostico.trim()) { toast.error("Descreva o problema"); return; }
    if (!validade) { toast.error("Informe a validade"); return; }
    if (!pdf) { toast.error("Anexe o orçamento (PDF)"); return; }
    if (total <= 0) { toast.error("Total deve ser maior que zero"); return; }

    setSalvando(true);
    try {
      const prefix = `manutencao/${user.id}`;
      const [pdfUrl, fotoUrl] = await Promise.all([
        uploadFile("comprovantes", `${prefix}/orcamento-pdf`, pdf, pdf.name.split(".").pop() || "pdf"),
        foto ? uploadFile("comprovantes", `${prefix}/foto`, foto) : Promise.resolve(null),
      ]);

      const { data: manut, error } = await supabase
        .from("manutencoes")
        .insert({
          veiculo_id: veiculo.id,
          fornecedor_id: user.id,
          empresa_id: veiculo.empresa_id,
          tipo: tipoServico,
          status: "Aguardando Aprovação",
          prioridade: "Normal",
          descricao: `${tipoServico} — ${veiculo.placa}`,
          diagnostico,
          valor_previsto: total,
          valor_mao_obra: parseFloat(maoObra.replace(",", ".")) || null,
          validade_orcamento: validade,
          comprovante_url: pdfUrl,
          observacoes: [observacoes, fotoUrl ? `Foto: ${fotoUrl}` : null].filter(Boolean).join(" | ") || null,
          data_solicitacao: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (pecas.length > 0) {
        const itens = pecas
          .filter((p) => p.descricao.trim() && p.quantidade > 0)
          .map((p) => ({
            manutencao_id: manut.id,
            descricao: p.descricao,
            quantidade: p.quantidade,
            valor_unitario: p.valor_unitario,
          }));
        if (itens.length > 0) {
          await supabase.from("manutencao_pecas").insert(itens);
        }
      }

      if (veiculo.empresa_id) {
        await notifyEmpresaGestores({
          empresaId: veiculo.empresa_id,
          titulo: "Novo orçamento aguardando aprovação",
          mensagem: `${veiculo.placa} • ${BRL(total)} • Validade ${new Date(validade).toLocaleDateString("pt-BR")}`,
          tipo: "alerta",
        });
      }

      setSucesso(true);
    } catch (err: any) {
      toast.error("Erro ao enviar", { description: err.message });
    } finally {
      setSalvando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <Card className="p-6 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          <h2 className="text-xl font-bold">Orçamento enviado!</h2>
          <p className="text-sm text-muted-foreground">O gestor receberá notificação para aprovar.</p>
          <p className="text-2xl font-bold">{BRL(total)}</p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/fornecedor" })}>Início</Button>
            <Button onClick={() => navigate({ to: "/fornecedor/historico" })}>Ver histórico</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6" /> Novo Orçamento
        </h1>
        <p className="text-sm text-muted-foreground">Versão simplificada para envio rápido.</p>
      </header>

      <Card className="p-4 space-y-3">
        <VeiculoPlacaSearch selected={veiculo} onSelect={setVeiculo} required />
        <div>
          <Label>Tipo de serviço</Label>
          <Select value={tipoServico} onValueChange={setTipoServico}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_SERVICO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Descrição do problema *</Label>
          <Textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={3} maxLength={1000} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>Peças</Label>
        <PecasEditor pecas={pecas} onChange={setPecas} />
        <div>
          <Label>Mão de obra (R$)</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={maoObra} onChange={(e) => setMaoObra(e.target.value)} />
        </div>
        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase">Total do orçamento</p>
          <p className="text-3xl font-bold text-primary">{BRL(total)}</p>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <Label>Validade *</Label>
          <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
        </div>
        <div>
          <Label>Anexo do orçamento (PDF) *</Label>
          <Input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          />
        </div>
        <CameraInput label="Foto do problema/veículo (opcional)" onChange={setFoto} />
        <div>
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={500} />
        </div>
      </Card>

      <Button onClick={enviar} disabled={salvando} className="w-full h-14 text-base font-bold">
        {salvando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
        ENVIAR ORÇAMENTO
      </Button>
    </div>
  );
}
