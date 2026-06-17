import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraInput } from "@/components/CameraInput";
import { uploadFile } from "@/lib/upload";
import { toast } from "sonner";
import { Loader2, ClipboardCheck } from "lucide-react";

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  km_atual: number;
}

interface Fornecedor {
  id: string;
  user_id: string | null;
  razao_social: string;
  nome_fantasia: string | null;
}

const TIPOS = [
  "Mecânica / Motor",
  "Elétrica",
  "Pneu / Suspensão",
  "Funilaria / Pintura",
  "Ar-condicionado",
  "Troca de peças",
  "Revisão / Preventiva",
  "Diagnóstico",
  "Outros",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function LancarExecutadaModal({ open, onClose, onCreated }: Props) {
  const { user, empresaId } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const [veiculoId, setVeiculoId] = useState("");
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [servicoExecutado, setServicoExecutado] = useState("");
  const [dataExecucao, setDataExecucao] = useState(() => new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState("");
  const [fornecedorId, setFornecedorId] = useState<string>("__externo");
  const [oficinaNome, setOficinaNome] = useState("");
  const [valorFinal, setValorFinal] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [obs, setObs] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setVeiculoId(""); setTipo(""); setDescricao(""); setServicoExecutado("");
    setDataExecucao(new Date().toISOString().slice(0, 10));
    setKm(""); setFornecedorId("__externo"); setOficinaNome("");
    setValorFinal(""); setNotaFiscal(""); setObs(""); setComprovante(null);

    (async () => {
      const [{ data: vs }, { data: fs }] = await Promise.all([
        supabase.from("veiculos").select("id, placa, modelo, marca, km_atual").order("placa"),
        supabase
          .from("fornecedores_cadastro")
          .select("id, user_id, razao_social, nome_fantasia")
          .eq("status", "aprovado"),
      ]);
      setVeiculos((vs ?? []) as any);
      setFornecedores((fs ?? []) as any);
    })();
  }, [open]);

  useEffect(() => {
    const v = veiculos.find((x) => x.id === veiculoId);
    if (v && !km) setKm(String(v.km_atual ?? ""));
  }, [veiculoId, veiculos]);

  function valido() {
    return (
      veiculoId &&
      tipo &&
      descricao.trim().length >= 3 &&
      dataExecucao &&
      valorFinal &&
      (fornecedorId !== "__externo" || oficinaNome.trim().length >= 2)
    );
  }

  async function salvar() {
    if (!user || !empresaId) { toast.error("Sessão inválida"); return; }
    if (!valido()) { toast.error("Preencha os campos obrigatórios"); return; }
    setSubmitting(true);
    try {
      let comprovanteUrl: string | null = null;
      if (comprovante) {
        try {
          const ext = comprovante.name.split(".").pop()?.toLowerCase() || "jpg";
          comprovanteUrl = await uploadFile("comprovantes", `manutencao/${veiculoId}`, comprovante, ext);
        } catch (e) {
          console.error("upload comprovante", e);
        }
      }

      const fornecedorUserId =
        fornecedorId !== "__externo"
          ? fornecedores.find((f) => f.id === fornecedorId)?.user_id ?? null
          : null;
      const nomeFornecedor =
        fornecedorId !== "__externo"
          ? fornecedores.find((f) => f.id === fornecedorId)?.razao_social ?? null
          : oficinaNome;

      const dataISO = new Date(dataExecucao + "T12:00:00").toISOString();
      const valor = Number(valorFinal);

      const payload: any = {
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        solicitado_por: user.id,
        aprovado_por: user.id,
        aprovado_nome: "Lançamento direto",
        tipo,
        descricao,
        servico_executado: servicoExecutado || descricao,
        status: "Concluída",
        prioridade: "Normal",
        data_solicitacao: dataISO,
        data_aprovacao: dataISO,
        data_inicio: dataISO,
        data_conclusao: dataISO,
        km_na_manutencao: km ? Number(km) : null,
        valor_final: valor,
        valor_mao_obra: valor,
        custo_fornecedor: valor,
        oficina_nome: nomeFornecedor,
        fornecedor_id: fornecedorUserId,
        nota_fiscal: notaFiscal || null,
        comprovante_url: comprovanteUrl,
        observacoes: obs ? `[Lançamento de manutenção já executada] ${obs}` : "[Lançamento de manutenção já executada]",
        confirmada_pelo_solicitante: true,
        exigir_orcamento: false,
        enviado_para_rede: false,
      };

      const { error } = await supabase.from("manutencoes").insert(payload);
      if (error) throw error;

      // Atualiza KM do veículo se for maior
      if (km) {
        const v = veiculos.find((x) => x.id === veiculoId);
        if (v && Number(km) > (v.km_atual ?? 0)) {
          await supabase.from("veiculos").update({ km_atual: Number(km) }).eq("id", veiculoId);
        }
      }

      toast.success("Manutenção registrada no histórico");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" /> Lançar Manutenção Já Executada
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Registre um serviço que já foi executado por uma oficina externa, sem passar pelo fluxo de orçamento.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Veículo *</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue placeholder="Escolha um veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de serviço *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data da execução *</Label>
              <Input type="date" value={dataExecucao} onChange={(e) => setDataExecucao(e.target.value)} />
            </div>

            <div>
              <Label>KM na manutenção</Label>
              <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label>Descrição do problema *</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Ex.: Troca de pastilhas de freio dianteiras" />
          </div>

          <div>
            <Label>Serviço executado / peças aplicadas</Label>
            <Textarea value={servicoExecutado} onChange={(e) => setServicoExecutado(e.target.value)} rows={2} placeholder="Detalhes do que foi feito" />
          </div>

          <div>
            <Label>Fornecedor / Oficina *</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__externo">Oficina externa (digitar nome)</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fornecedorId === "__externo" && (
              <Input
                className="mt-2"
                value={oficinaNome}
                onChange={(e) => setOficinaNome(e.target.value)}
                placeholder="Nome da oficina/prestador"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Valor pago (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={valorFinal}
                onChange={(e) => setValorFinal(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Nº da nota fiscal</Label>
              <Input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} placeholder="NF / Recibo" />
            </div>
          </div>

          <div>
            <Label>Comprovante / NF (foto ou PDF)</Label>
            <CameraInput label="Anexar comprovante" onChange={setComprovante} />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={salvar} disabled={submitting || !valido()}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar no histórico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
