import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { parseNotaFiscalIA, type NfExtraida, type PecaExtraida } from "@/lib/nf-ia.functions";
import { autoRegistrarFornecedor } from "@/lib/fornecedor-auto.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadFile } from "@/lib/upload";
import { toast } from "sonner";
import { Loader2, Sparkles, FileText, Trash2, Plus } from "lucide-react";

interface Veiculo { id: string; placa: string; modelo: string; marca: string; km_atual: number; }
interface Fornecedor { id: string; user_id: string | null; razao_social: string; nome_fantasia: string | null; }

const TIPOS = [
  "Mecânica / Motor", "Elétrica", "Pneu / Suspensão", "Funilaria / Pintura",
  "Ar-condicionado", "Troca de peças", "Revisão / Preventiva", "Diagnóstico", "Outros",
];

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function LancarExecutadaIAModal({ open, onClose, onCreated }: Props) {
  const { user, empresaId } = useAuth();
  const parseIA = useServerFn(parseNotaFiscalIA);

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [extraido, setExtraido] = useState<NfExtraida | null>(null);

  // Form editável (pré-preenchido pela IA)
  const [veiculoId, setVeiculoId] = useState("");
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataExec, setDataExec] = useState(() => new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState("");
  const [fornecedorId, setFornecedorId] = useState("__externo");
  const [oficinaNome, setOficinaNome] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorMaoObra, setValorMaoObra] = useState("");
  const [numeroNf, setNumeroNf] = useState("");
  const [obs, setObs] = useState("");
  const [pecas, setPecas] = useState<PecaExtraida[]>([]);
  const [criarDespesa, setCriarDespesa] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFile(null); setExtraido(null);
    setVeiculoId(""); setTipo(""); setDescricao("");
    setDataExec(new Date().toISOString().slice(0, 10));
    setKm(""); setFornecedorId("__externo"); setOficinaNome("");
    setValorTotal(""); setValorMaoObra(""); setNumeroNf(""); setObs("");
    setPecas([]); setCriarDespesa(true);

    (async () => {
      const [{ data: vs }, { data: fs }] = await Promise.all([
        supabase.from("veiculos").select("id, placa, modelo, marca, km_atual").order("placa"),
        supabase.from("fornecedores_cadastro").select("id, user_id, razao_social, nome_fantasia").eq("status", "aprovado"),
      ]);
      setVeiculos((vs ?? []) as any);
      setFornecedores((fs ?? []) as any);
    })();
  }, [open]);

  async function analisar() {
    if (!file) { toast.error("Selecione um PDF da nota fiscal"); return; }
    setAnalisando(true);
    try {
      const b64 = await fileToBase64(file);
      const placasConhecidas = veiculos.map((v) => v.placa);
      const res = await parseIA({
        data: { pdfBase64: b64, mimeType: file.type || "application/pdf", placasConhecidas },
      });
      setExtraido(res);

      // Pré-preenche campos
      if (res.placa) {
        const v = veiculos.find((x) => x.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === res.placa);
        if (v) { setVeiculoId(v.id); if (!km) setKm(String(v.km_atual ?? "")); }
      }
      if (res.tipo_servico && TIPOS.includes(res.tipo_servico)) setTipo(res.tipo_servico);
      if (res.descricao) setDescricao(res.descricao);
      if (res.data_emissao) setDataExec(res.data_emissao);
      if (res.valor_total != null) setValorTotal(String(res.valor_total));
      if (res.valor_mao_obra != null) setValorMaoObra(String(res.valor_mao_obra));
      if (res.numero_nf) setNumeroNf(res.numero_nf);
      if (res.observacoes) setObs(res.observacoes);
      setPecas(res.pecas ?? []);

      // Tenta casar fornecedor por nome
      if (res.fornecedor_nome) {
        const alvo = res.fornecedor_nome.toLowerCase();
        const f = fornecedores.find((f) => {
          const nome = (f.nome_fantasia || f.razao_social || "").toLowerCase();
          return nome && (nome.includes(alvo) || alvo.includes(nome));
        });
        if (f) setFornecedorId(f.id);
        else setOficinaNome(res.fornecedor_nome);
      }
      toast.success("Nota analisada com IA");
    } catch (e: any) {
      toast.error(e.message || "Falha ao analisar PDF");
    } finally {
      setAnalisando(false);
    }
  }

  function addPeca() { setPecas((p) => [...p, { descricao: "", quantidade: 1, valor_unitario: 0 }]); }
  function updPeca(i: number, patch: Partial<PecaExtraida>) {
    setPecas((p) => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  }
  function rmPeca(i: number) { setPecas((p) => p.filter((_, idx) => idx !== i)); }

  function valido() {
    return veiculoId && tipo && descricao.trim().length >= 3 && dataExec && valorTotal &&
      (fornecedorId !== "__externo" || oficinaNome.trim().length >= 2);
  }

  async function salvar() {
    if (!user || !empresaId) { toast.error("Sessão inválida"); return; }
    if (!valido()) { toast.error("Preencha os campos obrigatórios"); return; }
    setSalvando(true);
    try {
      let comprovanteUrl: string | null = null;
      if (file) {
        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
          comprovanteUrl = await uploadFile("comprovantes", `manutencao/${veiculoId}`, file, ext);
        } catch (e) { console.error(e); }
      }

      const fornecedorUserId = fornecedorId !== "__externo"
        ? fornecedores.find((f) => f.id === fornecedorId)?.user_id ?? null
        : null;
      const nomeFornecedor = fornecedorId !== "__externo"
        ? fornecedores.find((f) => f.id === fornecedorId)?.razao_social ?? null
        : oficinaNome;

      const dataISO = new Date(dataExec + "T12:00:00").toISOString();
      const valor = Number(valorTotal);
      const mao = valorMaoObra ? Number(valorMaoObra) : 0;

      const { data: mIns, error } = await supabase.from("manutencoes").insert({
        veiculo_id: veiculoId,
        empresa_id: empresaId,
        solicitado_por: user.id,
        aprovado_por: user.id,
        aprovado_nome: "Lançamento IA (NF)",
        tipo,
        descricao,
        servico_executado: descricao,
        status: "Concluída",
        prioridade: "Normal",
        data_solicitacao: dataISO,
        data_aprovacao: dataISO,
        data_inicio: dataISO,
        data_conclusao: dataISO,
        km_na_manutencao: km ? Number(km) : null,
        valor_final: valor,
        valor_mao_obra: mao,
        custo_fornecedor: valor,
        oficina_nome: nomeFornecedor,
        fornecedor_id: fornecedorUserId,
        nota_fiscal: numeroNf || null,
        comprovante_url: comprovanteUrl,
        observacoes: `[Lançamento via IA a partir de NF]${obs ? " " + obs : ""}`,
        confirmada_pelo_solicitante: true,
        exigir_orcamento: false,
        enviado_para_rede: false,
      } as any).select("id").single();
      if (error) throw error;

      // Peças
      if (mIns?.id && pecas.length > 0) {
        const rows = pecas
          .filter((p) => p.descricao.trim())
          .map((p) => ({
            manutencao_id: mIns.id,
            descricao: p.descricao,
            quantidade: Number(p.quantidade) || 1,
            valor_unitario: Number(p.valor_unitario) || 0,
          }));
        if (rows.length) await supabase.from("manutencao_pecas").insert(rows);
      }

      // Despesa
      if (criarDespesa) {
        await supabase.from("despesas").insert({
          empresa_id: empresaId,
          veiculo_id: veiculoId,
          data_despesa: dataExec,
          tipo: "Manutenção",
          descricao: `NF ${numeroNf || "s/n"} — ${nomeFornecedor || ""} — ${descricao}`.slice(0, 250),
          valor,
          comprovante_url: comprovanteUrl,
          registrado_por: user.id,
        } as any);
      }

      // KM
      if (km) {
        const v = veiculos.find((x) => x.id === veiculoId);
        if (v && Number(km) > (v.km_atual ?? 0)) {
          await supabase.from("veiculos").update({ km_atual: Number(km) }).eq("id", veiculoId);
        }
      }

      toast.success("Manutenção registrada a partir da NF");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" /> Lançar Executada por IA
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Anexe o PDF da nota fiscal — a IA identifica veículo, fornecedor, peças e valores. Revise antes de salvar.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-3">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
            <Button size="sm" onClick={analisar} disabled={!file || analisando}>
              {analisando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {analisando ? "Analisando..." : "Analisar com IA"}
            </Button>
          </div>

          {extraido && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Veículo *</Label>
                  <Select value={veiculoId} onValueChange={setVeiculoId}>
                    <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent>
                      {veiculos.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {extraido.placa && !veiculoId && (
                    <p className="text-xs text-amber-600 mt-1">IA sugere placa "{extraido.placa}" mas não encontrei na frota.</p>
                  )}
                </div>
                <div>
                  <Label>Tipo de serviço *</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data da execução *</Label>
                  <Input type="date" value={dataExec} onChange={(e) => setDataExec(e.target.value)} />
                </div>
                <div>
                  <Label>KM na manutenção</Label>
                  <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Descrição *</Label>
                <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>

              <div>
                <Label>Fornecedor / Oficina *</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__externo">Oficina externa (digitar nome)</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fornecedorId === "__externo" && (
                  <Input className="mt-2" value={oficinaNome} onChange={(e) => setOficinaNome(e.target.value)} placeholder="Nome da oficina" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Valor total (R$) *</Label>
                  <Input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
                </div>
                <div>
                  <Label>Mão de obra (R$)</Label>
                  <Input type="number" step="0.01" value={valorMaoObra} onChange={(e) => setValorMaoObra(e.target.value)} />
                </div>
                <div>
                  <Label>Nº NF</Label>
                  <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Peças ({pecas.length})</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addPeca}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {pecas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma peça extraída.</p>
                ) : (
                  <div className="space-y-2">
                    {pecas.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_110px_40px] gap-2 items-center">
                        <Input value={p.descricao} onChange={(e) => updPeca(i, { descricao: e.target.value })} placeholder="Descrição" />
                        <Input type="number" step="0.01" value={p.quantidade} onChange={(e) => updPeca(i, { quantidade: Number(e.target.value) })} />
                        <Input type="number" step="0.01" value={p.valor_unitario} onChange={(e) => updPeca(i, { valor_unitario: Number(e.target.value) })} placeholder="Valor un." />
                        <Button size="icon" variant="ghost" onClick={() => rmPeca(i)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={criarDespesa} onChange={(e) => setCriarDespesa(e.target.checked)} />
                Criar também um lançamento em Despesas
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={!extraido || salvando || !valido()}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar manutenção + despesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
