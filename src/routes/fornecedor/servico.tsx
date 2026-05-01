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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CameraInput } from "@/components/CameraInput";
import { VeiculoPlacaSearch, type VeiculoBusca } from "@/components/fornecedor/VeiculoPlacaSearch";
import { PecasEditor, type Peca } from "@/components/fornecedor/PecasEditor";
import {
  ChecklistServico,
  TIPOS_SERVICO_CHAVES,
  type TipoServicoChave,
} from "@/components/fornecedor/ChecklistServico";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { Wrench, Truck, Cog, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import { notifyEmpresaGestores } from "@/lib/notify";

export const Route = createFileRoute("/fornecedor/servico")({
  head: () => ({ meta: [{ title: "Novo Serviço — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["fornecedor"]}>
      <AppShell>
        <ServicoPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const TIPO_LABEL: Record<TipoServicoChave, string> = {
  motor: "Motor",
  freio: "Freios",
  suspensao: "Suspensão",
  eletrica: "Elétrica",
  troca_oleo: "Troca de Óleo",
  pneus: "Pneus/Balanceamento",
  diagnostico: "Diagnóstico",
  funilaria: "Funilaria/Pintura",
  outros: "Outros",
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ServicoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [tipoEquip, setTipoEquip] = useState<"veiculo" | "maquina" | "implemento" | "outros">("veiculo");
  const [veiculo, setVeiculo] = useState<VeiculoBusca | null>(null);
  const [equipDesc, setEquipDesc] = useState("");
  const [patrimonio, setPatrimonio] = useState("");

  // Step 2
  const [tipoServico, setTipoServico] = useState("Corretiva");
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataConclusao, setDataConclusao] = useState("");
  const [kmEntrada, setKmEntrada] = useState("");
  const [osNumero, setOsNumero] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [servicoExecutado, setServicoExecutado] = useState("");

  // Step 3
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [maoObra, setMaoObra] = useState<string>("");
  const [desconto, setDesconto] = useState<string>("");

  // Step 4
  const [modo, setModo] = useState<"orcamento" | "executado">("orcamento");
  const [aprovadoNome, setAprovadoNome] = useState("");
  const [dataAprovacao, setDataAprovacao] = useState("");
  const [validade, setValidade] = useState("");
  const [fotoOrcamento, setFotoOrcamento] = useState<File | null>(null);
  const [fotoNF, setFotoNF] = useState<File | null>(null);
  const [fotoEquip, setFotoEquip] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const totalPecas = useMemo(
    () => pecas.reduce((s, p) => s + p.quantidade * p.valor_unitario, 0),
    [pecas],
  );
  const total = useMemo(() => {
    const mo = parseFloat(maoObra.replace(",", ".")) || 0;
    const d = parseFloat(desconto.replace(",", ".")) || 0;
    return Math.max(0, totalPecas + mo - d);
  }, [totalPecas, maoObra, desconto]);

  function validarStep(s: number): boolean {
    if (s === 1) {
      if (tipoEquip === "veiculo" && !veiculo) {
        toast.error("Selecione o veículo"); return false;
      }
      if (tipoEquip !== "veiculo" && !equipDesc.trim()) {
        toast.error("Descreva o equipamento"); return false;
      }
    }
    if (s === 2) {
      if (!diagnostico.trim()) {
        toast.error("Diagnóstico é obrigatório"); return false;
      }
    }
    return true;
  }

  function next() {
    if (validarStep(step)) setStep((s) => Math.min(4, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function salvar() {
    if (!user) return;
    if (!validarStep(1) || !validarStep(2)) return;
    if (modo === "orcamento" && !validade) {
      toast.error("Informe a validade do orçamento"); return;
    }
    if (modo === "executado" && !fotoNF) {
      toast.error("Nota fiscal é obrigatória para serviço executado"); return;
    }

    setSalvando(true);
    try {
      const prefix = `manutencao/${user.id}`;
      const [orcUrl, nfUrl, equipUrl] = await Promise.all([
        fotoOrcamento ? uploadFile("comprovantes", `${prefix}/orcamento`, fotoOrcamento) : Promise.resolve(null),
        fotoNF ? uploadFile("comprovantes", `${prefix}/nf`, fotoNF) : Promise.resolve(null),
        fotoEquip ? uploadFile("comprovantes", `${prefix}/equip`, fotoEquip) : Promise.resolve(null),
      ]);

      const status = modo === "orcamento" ? "Aguardando Aprovação" : "Concluída";
      const empresaId = veiculo?.empresa_id ?? null;

      const descricaoFinal = tipoEquip === "veiculo"
        ? `${tipoServico} — ${veiculo?.placa}`
        : `${tipoServico} — ${equipDesc}${patrimonio ? ` (${patrimonio})` : ""}`;

      const obs = [
        observacoes,
        osNumero ? `OS: ${osNumero}` : null,
        equipUrl ? `Equip foto: ${equipUrl}` : null,
        nfUrl ? `NF: ${nfUrl}` : null,
        modo === "executado" && aprovadoNome ? `Aprovado: ${aprovadoNome}` : null,
        tipoEquip !== "veiculo" ? `Equipamento: ${equipDesc}` : null,
      ].filter(Boolean).join(" | ");

      const { data: manut, error } = await supabase
        .from("manutencoes")
        .insert({
          veiculo_id: veiculo?.id ?? null,
          fornecedor_id: user.id,
          empresa_id: empresaId,
          tipo: tipoServico,
          status,
          prioridade: "Normal",
          descricao: descricaoFinal,
          diagnostico,
          servico_executado: servicoExecutado || null,
          os_oficina: osNumero || null,
          data_inicio: new Date(dataEntrada).toISOString(),
          data_conclusao: modo === "executado" && dataConclusao
            ? new Date(dataConclusao).toISOString()
            : null,
          km_na_manutencao: kmEntrada ? parseFloat(kmEntrada) : null,
          valor_previsto: modo === "orcamento" ? total : null,
          valor_final: modo === "executado" ? total : null,
          valor_mao_obra: parseFloat(maoObra.replace(",", ".")) || null,
          desconto: parseFloat(desconto.replace(",", ".")) || null,
          validade_orcamento: modo === "orcamento" ? validade : null,
          aprovado_nome: modo === "executado" ? aprovadoNome || null : null,
          data_aprovacao: modo === "executado" && dataAprovacao
            ? new Date(dataAprovacao).toISOString() : null,
          comprovante_url: orcUrl || nfUrl || null,
          observacoes: obs || null,
          data_solicitacao: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Inserir peças
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
          const { error: e2 } = await supabase.from("manutencao_pecas").insert(itens);
          if (e2) throw e2;
        }
      }

      // Notificar gestores
      if (empresaId) {
        await notifyEmpresaGestores({
          empresaId,
          titulo: modo === "orcamento" ? "Novo orçamento aguardando aprovação" : "Serviço concluído",
          mensagem: `${descricaoFinal} • ${BRL(total)}`,
          tipo: modo === "orcamento" ? "alerta" : "info",
        });
      }

      setSucesso(modo === "orcamento" ? "Orçamento enviado para aprovação!" : "Serviço registrado!");
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
    <div className="p-4 max-w-3xl mx-auto space-y-4 pb-24">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="w-6 h-6" /> Novo Serviço
        </h1>
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Etapa {step} de 4 — {["Equipamento", "Dados do serviço", "Peças e valores", "Aprovação"][step - 1]}
        </p>
      </header>

      {step === 1 && (
        <Card className="p-4 space-y-3">
          <Label>Tipo de equipamento</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { v: "veiculo", l: "Veículo", i: Truck },
              { v: "maquina", l: "Máquina", i: Cog },
              { v: "implemento", l: "Implemento", i: Cog },
              { v: "outros", l: "Outros", i: Cog },
            ].map((o) => {
              const I = o.i;
              return (
                <Button
                  key={o.v}
                  type="button"
                  variant={tipoEquip === o.v ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => setTipoEquip(o.v as any)}
                >
                  <I className="w-5 h-5" />
                  <span className="text-xs">{o.l}</span>
                </Button>
              );
            })}
          </div>
          <div className="pt-2">
            {tipoEquip === "veiculo" ? (
              <VeiculoPlacaSearch selected={veiculo} onSelect={setVeiculo} required />
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Descrição do equipamento *</Label>
                  <Input value={equipDesc} onChange={(e) => setEquipDesc(e.target.value)} maxLength={150} />
                </div>
                <div>
                  <Label>Patrimônio / Identificação</Label>
                  <Input value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} maxLength={50} />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-4 space-y-3">
          <div>
            <Label>Tipo de serviço</Label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_SERVICO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data entrada</Label>
              <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
            </div>
            <div>
              <Label>Data conclusão</Label>
              <Input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>KM entrada</Label>
              <Input type="number" inputMode="decimal" value={kmEntrada} onChange={(e) => setKmEntrada(e.target.value)} />
            </div>
            <div>
              <Label>Nº OS</Label>
              <Input value={osNumero} onChange={(e) => setOsNumero(e.target.value)} maxLength={50} />
            </div>
          </div>
          <div>
            <Label>Diagnóstico / problema *</Label>
            <Textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={3} maxLength={1000} />
          </div>
          <div>
            <Label>Serviço executado</Label>
            <Textarea value={servicoExecutado} onChange={(e) => setServicoExecutado(e.target.value)} rows={3} maxLength={1000} />
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-4 space-y-3">
          <Label>Peças utilizadas</Label>
          <PecasEditor pecas={pecas} onChange={setPecas} />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <Label>Mão de obra (R$)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={maoObra} onChange={(e) => setMaoObra(e.target.value)} />
            </div>
            <div>
              <Label>Desconto (R$)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </div>
          </div>
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Total</p>
            <p className="text-3xl md:text-4xl font-bold text-primary">{BRL(total)}</p>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-4 space-y-3">
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as any)}>
            <Label className="flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="orcamento" className="mt-0.5" />
              <div>
                <p className="font-semibold">📤 Enviar como Orçamento</p>
                <p className="text-xs text-muted-foreground">Aguarda aprovação do gestor antes de executar.</p>
              </div>
            </Label>
            <Label className="flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="executado" className="mt-0.5" />
              <div>
                <p className="font-semibold">✅ Serviço já executado e aprovado</p>
                <p className="text-xs text-muted-foreground">Registra como concluído.</p>
              </div>
            </Label>
          </RadioGroup>

          {modo === "orcamento" ? (
            <div>
              <Label>Validade do orçamento *</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Aprovado por</Label>
                <Input value={aprovadoNome} onChange={(e) => setAprovadoNome(e.target.value)} placeholder="Nome + cargo" maxLength={100} />
              </div>
              <div>
                <Label>Data aprovação</Label>
                <Input type="date" value={dataAprovacao} onChange={(e) => setDataAprovacao(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <CameraInput label="Foto equipamento" onChange={setFotoEquip} />
            <CameraInput label={modo === "orcamento" ? "PDF/Foto orçamento" : "Nota fiscal *"} required={modo === "executado"} onChange={modo === "orcamento" ? setFotoOrcamento : setFotoNF} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={500} />
          </div>
        </Card>
      )}

      {/* Navegação */}
      <div className="flex gap-2">
        {step > 1 && (
          <Button type="button" variant="outline" onClick={prev} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        )}
        {step < 4 ? (
          <Button type="button" onClick={next} className="flex-1">
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={salvar} disabled={salvando} className="flex-1 h-12 text-base font-bold">
            {salvando ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : modo === "orcamento" ? <Send className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {modo === "orcamento" ? "ENVIAR PARA APROVAÇÃO" : "SALVAR SERVIÇO"}
          </Button>
        )}
      </div>
    </div>
  );
}
