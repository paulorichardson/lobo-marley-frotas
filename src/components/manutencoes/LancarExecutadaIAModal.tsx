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
interface Fornecedor { id: string; user_id: string | null; razao_social: string; nome_fantasia: string | null; cnpj: string | null; }

type PecaLocal = PecaExtraida & { veiculo_id?: string };

const TIPOS = [
  "Mecânica / Motor", "Elétrica", "Pneu / Suspensão", "Funilaria / Pintura",
  "Ar-condicionado", "Troca de peças", "Revisão / Preventiva", "Diagnóstico", "Outros",
];

function matchVeiculoByHint(hint: string | null | undefined, veiculos: Veiculo[]): Veiculo | undefined {
  if (!hint) return undefined;
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const h = norm(hint);
  if (!h) return undefined;
  // Match exato pela placa normalizada, ou prefixo/substring
  return veiculos.find((v) => {
    const p = norm(v.placa);
    return p === h || p.includes(h) || h.includes(p);
  });
}

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
  const autoRegForn = useServerFn(autoRegistrarFornecedor);

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
  const [pecas, setPecas] = useState<PecaLocal[]>([]);
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
        supabase.from("fornecedores_cadastro").select("id, user_id, razao_social, nome_fantasia, cnpj").eq("status", "aprovado"),
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
      // Pré-atribui veículo por hint da IA quando bater com uma placa da frota
      const pecasComVeic: PecaLocal[] = (res.pecas ?? []).map((p) => {
        const v = matchVeiculoByHint(p.veiculo_hint, veiculos);
        return { ...p, veiculo_id: v?.id };
      });
      setPecas(pecasComVeic);

      // Aviso se a IA identificou múltiplos veículos
      if (res.veiculos_mencionados.length > 1) {
        const naoCasados = res.veiculos_mencionados.filter((h) => !matchVeiculoByHint(h, veiculos));
        if (naoCasados.length > 0) {
          toast.info(`IA identificou múltiplos veículos: ${res.veiculos_mencionados.join(", ")}. ${naoCasados.length} não foi(ram) casado(s) com a frota — atribua manualmente em cada peça.`);
        } else {
          toast.info(`IA distribuiu peças entre ${res.veiculos_mencionados.length} veículos — revise as atribuições abaixo.`);
        }
      }

      // Tenta casar fornecedor por CNPJ e depois por nome
      const cnpjIA = (res.fornecedor_cnpj || "").replace(/\D/g, "");
      let matched: Fornecedor | undefined;
      if (cnpjIA.length === 14) {
        matched = fornecedores.find((f) => (f.cnpj || "").replace(/\D/g, "") === cnpjIA);
      }
      if (!matched && res.fornecedor_nome) {
        const alvo = res.fornecedor_nome.toLowerCase();
        matched = fornecedores.find((f) => {
          const nome = (f.nome_fantasia || f.razao_social || "").toLowerCase();
          return nome && (nome.includes(alvo) || alvo.includes(nome));
        });
      }
      if (matched) {
        setFornecedorId(matched.id);
      } else if (res.fornecedor_nome) {
        setOficinaNome(res.fornecedor_nome);
        toast.info(`Fornecedor "${res.fornecedor_nome}" não está cadastrado — será cadastrado automaticamente ao salvar.`);
      }
      toast.success("Nota analisada com IA");
    } catch (e: any) {
      toast.error(e.message || "Falha ao analisar PDF");
    } finally {
      setAnalisando(false);
    }
  }

  function addPeca() { setPecas((p) => [...p, { descricao: "", quantidade: 1, valor_unitario: 0 }]); }
  function updPeca(i: number, patch: Partial<PecaLocal>) {
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

      let fornecedorUserId: string | null = fornecedorId !== "__externo"
        ? fornecedores.find((f) => f.id === fornecedorId)?.user_id ?? null
        : null;
      let nomeFornecedor: string | null = fornecedorId !== "__externo"
        ? fornecedores.find((f) => f.id === fornecedorId)?.razao_social ?? null
        : oficinaNome;

      // Auto-cadastro do fornecedor se veio da IA e não foi selecionado manualmente
      if (fornecedorId === "__externo" && extraido?.fornecedor_nome && oficinaNome.trim()) {
        try {
          const novo = await autoRegForn({
            data: {
              razao_social: oficinaNome.trim(),
              cnpj: extraido.fornecedor_cnpj,
              telefone: extraido.fornecedor_telefone,
              email: extraido.fornecedor_email,
              endereco: extraido.fornecedor_endereco,
              cidade: extraido.fornecedor_cidade,
              estado: extraido.fornecedor_estado,
              cep: extraido.fornecedor_cep,
            },
          });
          fornecedorUserId = novo.user_id;
          nomeFornecedor = novo.razao_social;
          if (novo.criado) toast.success(`Fornecedor "${novo.razao_social}" cadastrado automaticamente`);
        } catch (e: any) {
          console.error("auto-registro fornecedor falhou", e);
          toast.warning("Não foi possível cadastrar o fornecedor automaticamente — seguindo como oficina externa");
        }
      }

      const dataISO = new Date(dataExec + "T12:00:00").toISOString();
      const valorTotalNota = Number(valorTotal);
      const maoTotal = valorMaoObra ? Number(valorMaoObra) : 0;

      // Distribuição das peças por veículo (default = veículo principal)
      const pecasValidas = pecas.filter((p) => p.descricao.trim());
      const grupos = new Map<string, PecaLocal[]>();
      for (const p of pecasValidas) {
        const vid = p.veiculo_id || veiculoId;
        if (!grupos.has(vid)) grupos.set(vid, []);
        grupos.get(vid)!.push(p);
      }
      // Se não há peças, cria um único grupo com o veículo principal
      if (grupos.size === 0) grupos.set(veiculoId, []);

      const somaPecas = pecasValidas.reduce((s, p) => s + (Number(p.quantidade) || 1) * (Number(p.valor_unitario) || 0), 0);

      const veiculosEnvolvidos = Array.from(grupos.keys());
      const isMulti = veiculosEnvolvidos.length > 1;

      let criadas = 0;
      for (const [vid, itens] of grupos) {
        const somaGrupo = itens.reduce((s, p) => s + (Number(p.quantidade) || 1) * (Number(p.valor_unitario) || 0), 0);
        // Rateio: se houver múltiplos veículos, proporciona valor total e mão de obra pela soma de peças; senão usa valores digitados
        let valorGrupo: number;
        let maoGrupo: number;
        if (isMulti && somaPecas > 0) {
          const razao = somaGrupo / somaPecas;
          valorGrupo = Number((valorTotalNota * razao).toFixed(2));
          maoGrupo = Number((maoTotal * razao).toFixed(2));
        } else {
          valorGrupo = valorTotalNota;
          maoGrupo = maoTotal;
        }

        const placaTxt = veiculos.find((v) => v.id === vid)?.placa ?? "";
        const descGrupo = isMulti ? `[${placaTxt}] ${descricao}` : descricao;

        const { data: mIns, error } = await supabase.from("manutencoes").insert({
          veiculo_id: vid,
          empresa_id: empresaId,
          solicitado_por: user.id,
          aprovado_por: user.id,
          aprovado_nome: "Lançamento IA (NF)",
          tipo,
          descricao: descGrupo,
          servico_executado: descGrupo,
          status: "Concluída",
          prioridade: "Normal",
          data_solicitacao: dataISO,
          data_aprovacao: dataISO,
          data_inicio: dataISO,
          data_conclusao: dataISO,
          km_na_manutencao: vid === veiculoId && km ? Number(km) : null,
          valor_final: valorGrupo,
          valor_mao_obra: maoGrupo,
          custo_fornecedor: valorGrupo,
          oficina_nome: nomeFornecedor,
          fornecedor_id: fornecedorUserId,
          nota_fiscal: numeroNf || null,
          comprovante_url: comprovanteUrl,
          observacoes: `[Lançamento via IA a partir de NF${isMulti ? ` — rateado entre ${veiculosEnvolvidos.length} veículos` : ""}]${obs ? " " + obs : ""}`,
          confirmada_pelo_solicitante: true,
          exigir_orcamento: false,
          enviado_para_rede: false,
        } as any).select("id").single();
        if (error) throw error;

        // Peças do grupo
        if (mIns?.id && itens.length > 0) {
          const rows = itens.map((p) => ({
            manutencao_id: mIns.id,
            descricao: p.descricao,
            quantidade: Number(p.quantidade) || 1,
            valor_unitario: Number(p.valor_unitario) || 0,
          }));
          await supabase.from("manutencao_pecas").insert(rows);
        }

        // Despesa por veículo
        if (criarDespesa) {
          await supabase.from("despesas").insert({
            empresa_id: empresaId,
            veiculo_id: vid,
            data_despesa: dataExec,
            tipo: "Manutenção",
            descricao: `NF ${numeroNf || "s/n"} — ${nomeFornecedor || ""} — ${descGrupo}`.slice(0, 250),
            valor: valorGrupo,
            comprovante_url: comprovanteUrl,
            registrado_por: user.id,
          } as any);
        }

        // KM só no veículo principal
        if (vid === veiculoId && km) {
          const v = veiculos.find((x) => x.id === vid);
          if (v && Number(km) > (v.km_atual ?? 0)) {
            await supabase.from("veiculos").update({ km_atual: Number(km) }).eq("id", vid);
          }
        }
        criadas++;
      }

      toast.success(isMulti
        ? `${criadas} manutenções registradas a partir da NF (rateio entre veículos)`
        : "Manutenção registrada a partir da NF");
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
              {extraido.veiculos_mencionados.length > 0 && (
                <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-xs">
                  <strong className="text-accent">IA identificou {extraido.veiculos_mencionados.length} veículo(s) na nota:</strong>{" "}
                  {extraido.veiculos_mencionados.join(" · ")}
                  {extraido.veiculos_mencionados.length > 1 && (
                    <p className="mt-1 text-muted-foreground">
                      Cada peça abaixo pode ser atribuída a um veículo diferente. O valor total e a mão de obra serão rateados proporcionalmente e uma manutenção será criada por veículo.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Veículo principal *</Label>
                  <Select value={veiculoId} onValueChange={setVeiculoId}>
                    <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent>
                      {veiculos.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Usado como padrão para peças sem veículo atribuído.</p>
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
                    {pecas.map((p, i) => {
                      const vidAtual = p.veiculo_id || veiculoId;
                      const hintNaoCasado = p.veiculo_hint && !matchVeiculoByHint(p.veiculo_hint, veiculos);
                      return (
                        <div key={i} className="space-y-1 border border-border rounded-md p-2">
                          <div className="grid grid-cols-[1fr_70px_100px_36px] gap-2 items-center">
                            <Input value={p.descricao} onChange={(e) => updPeca(i, { descricao: e.target.value })} placeholder="Descrição" />
                            <Input type="number" step="0.01" value={p.quantidade} onChange={(e) => updPeca(i, { quantidade: Number(e.target.value) })} />
                            <Input type="number" step="0.01" value={p.valor_unitario} onChange={(e) => updPeca(i, { valor_unitario: Number(e.target.value) })} placeholder="Valor un." />
                            <Button size="icon" variant="ghost" onClick={() => rmPeca(i)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground min-w-fit">Veículo:</span>
                            <Select value={vidAtual} onValueChange={(v) => updPeca(i, { veiculo_id: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {veiculos.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {p.veiculo_hint && (
                              <span className={`text-[11px] ${hintNaoCasado ? "text-amber-600" : "text-muted-foreground"}`}>
                                IA: "{p.veiculo_hint}"{hintNaoCasado ? " (não casou com frota)" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
