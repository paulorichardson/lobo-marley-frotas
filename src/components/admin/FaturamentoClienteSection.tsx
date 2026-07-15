import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText, Printer, Wallet, Loader2, Receipt, Plus, Building2, Sparkles, Copy, ClipboardCopy,
} from "lucide-react";
import { imprimirFatura, baixarFaturaPDF } from "@/lib/fatura-pdf";
import { useAuth } from "@/hooks/useAuth";
import { EnviarNotasFiscaisModal } from "./EnviarNotasFiscaisModal";

const BRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type OS = {
  id: string;
  numero_os: string | null;
  nota_fiscal: string | null;
  descricao: string;
  oficina_nome: string | null;
  fornecedor_externo_id: string | null;
  valor_final: number;
  valor_liquido_faturavel: number | null;
  custo_fornecedor: number | null;
  data_conclusao: string | null;
  fatura_id: string | null;
  veiculo: { placa: string; marca: string; modelo: string; setor: string | null } | null;
};
type ForExterno = {
  id: string; nome: string; cnpj: string | null;
  banco: string | null; agencia: string | null; conta: string | null;
  pix_chave: string | null; pix_tipo: string | null;
};
type Pagamento = {
  id: string; valor: number; data_pagamento: string;
  forma_pagamento: string; fornecedor_externo_id: string | null;
  manutencao_id: string | null; observacoes: string | null;
};
type Fatura = {
  id: string; numero_fatura: string | null; numero_nf: string | null;
  serie_nf: string | null; periodo_inicio: string; periodo_fim: string;
  valor_total: number; status: string; data_emissao: string | null;
  data_pagamento: string | null; manutencao_ids: string[] | null;
};

export function FaturamentoClienteSection({ empresa }: { empresa: any }) {
  const { user } = useAuth();
  const empresaId = empresa.id as string;
  const [loading, setLoading] = useState(true);
  const [oss, setOss] = useState<OS[]>([]);
  const [fornecedores, setFornecedores] = useState<ForExterno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);

  const [periodoIni, setPeriodoIni] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 2); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodoFim, setPeriodoFim] = useState(() => new Date().toISOString().slice(0, 10));

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [gerarOpen, setGerarOpen] = useState<"fatura" | "nf" | null>(null);
  const [pagarForn, setPagarForn] = useState<ForExterno | null>(null);
  const [novoForn, setNovoForn] = useState(false);
  const [importarNFs, setImportarNFs] = useState(false);
  const [filtroSetor, setFiltroSetor] = useState<string>("__all__");
  const [textoNFSe, setTextoNFSe] = useState<{ fatura: Fatura; setor: string; texto: string } | null>(null);
  const [gerandoTexto, setGerandoTexto] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [m, f, p, fat] = await Promise.all([
        supabase.from("manutencoes")
          .select("id, numero_os, nota_fiscal, descricao, oficina_nome, fornecedor_externo_id, valor_final, valor_liquido_faturavel, custo_fornecedor, data_conclusao, fatura_id, veiculo:veiculos(placa,marca,modelo,setor)")
          .eq("empresa_id", empresaId)
          .eq("status", "Concluída")
          .gte("data_conclusao", `${periodoIni}T00:00:00`)
          .lte("data_conclusao", `${periodoFim}T23:59:59`)
          .order("data_conclusao", { ascending: false }),
        supabase.from("fornecedores_externos").select("*").eq("ativo", true).order("nome"),
        supabase.from("pagamentos_fornecedor")
          .select("id, valor, data_pagamento, forma_pagamento, fornecedor_externo_id, manutencao_id, observacoes")
          .eq("empresa_id", empresaId),
        supabase.from("faturas")
          .select("id, numero_fatura, numero_nf, serie_nf, periodo_inicio, periodo_fim, valor_total, status, data_emissao, data_pagamento, manutencao_ids")
          .eq("empresa_id", empresaId)
          .order("criado_em", { ascending: false }),
      ]);
      if (m.error) throw m.error;
      setOss((m.data ?? []) as any);
      setFornecedores((f.data ?? []) as any);
      setPagamentos((p.data ?? []) as any);
      setFaturas((fat.data ?? []) as any);
    } catch (e: any) {
      toast.error("Erro ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [empresaId, periodoIni, periodoFim]);

  // Aggregations
  const totaisPorFornecedor = useMemo(() => {
    const map = new Map<string, { servicos: number; pago: number; oss: number; nome: string }>();
    for (const o of oss) {
      const fid = o.fornecedor_externo_id;
      if (!fid) continue;
      const f = map.get(fid) ?? { servicos: 0, pago: 0, oss: 0, nome: o.oficina_nome ?? "" };
      f.servicos += Number(o.custo_fornecedor ?? o.valor_final ?? 0);
      f.oss += 1;
      map.set(fid, f);
    }
    for (const p of pagamentos) {
      if (!p.fornecedor_externo_id) continue;
      const f = map.get(p.fornecedor_externo_id);
      if (f) f.pago += Number(p.valor);
    }
    for (const f of fornecedores) {
      const e = map.get(f.id);
      if (e) e.nome = f.nome;
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v, saldo: Math.max(0, v.servicos - v.pago) }));
  }, [oss, pagamentos, fornecedores]);

  const setoresDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const o of oss) {
      const set = (o.veiculo?.setor ?? "").trim();
      s.add(set || "Sem setor");
    }
    return Array.from(s).sort();
  }, [oss]);

  const ossFiltradas = useMemo(() => {
    if (filtroSetor === "__all__") return oss;
    return oss.filter((o) => {
      const set = (o.veiculo?.setor ?? "").trim() || "Sem setor";
      return set === filtroSetor;
    });
  }, [oss, filtroSetor]);

  const totalSelecionado = useMemo(
    () => oss.filter((o) => selecionadas.has(o.id)).reduce((s, o) => s + Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0), 0),
    [oss, selecionadas],
  );

  function toggle(id: string) {
    setSelecionadas((p) => {
      const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  }
  function toggleTodas() {
    const disponiveis = ossFiltradas.filter((o) => !o.fatura_id);
    const todasSelecionadas = disponiveis.length > 0 && disponiveis.every((o) => selecionadas.has(o.id));
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (todasSelecionadas) {
        disponiveis.forEach((o) => n.delete(o.id));
      } else {
        disponiveis.forEach((o) => n.add(o.id));
      }
      return n;
    });
  }

  async function gerarDocumento(tipo: "fatura" | "nf", taxa: number, numNf: string, serie: string, obs: string) {
    const ids = Array.from(selecionadas);
    if (ids.length === 0) { toast.error("Selecione ao menos uma OS"); return; }
    const itensSel = oss.filter((o) => ids.includes(o.id));

    // Agrupa por setor/secretaria — gera 1 fatura por setor
    const grupos = new Map<string, typeof itensSel>();
    for (const o of itensSel) {
      const setor = (o.veiculo?.setor ?? "Sem setor").trim() || "Sem setor";
      if (!grupos.has(setor)) grupos.set(setor, []);
      grupos.get(setor)!.push(o);
    }

    const setores = Array.from(grupos.keys());
    if (setores.length > 1) {
      toast.info(`Gerando ${setores.length} faturas — uma para cada secretaria/setor`);
    }

    let geradas = 0;
    for (const [setor, itens] of grupos.entries()) {
      const idsSetor = itens.map((o) => o.id);
      const valorServicos = itens.reduce((s, o) => s + Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0), 0);
      const valorTaxa = (valorServicos * taxa) / 100;
      const total = valorServicos + valorTaxa;
      const obsSetor = [obs?.trim(), `Setor: ${setor}`].filter(Boolean).join(" · ");

      const { data: fat, error } = await supabase.from("faturas").insert({
        empresa_id: empresaId,
        periodo_inicio: periodoIni,
        periodo_fim: periodoFim,
        valor_servicos: valorServicos,
        valor_taxa: valorTaxa,
        taxa_gestao_percentual: taxa,
        valor_total: total,
        status: "emitida",
        data_emissao: new Date().toISOString(),
        numero_nf: tipo === "nf" ? (numNf || null) : null,
        serie_nf: tipo === "nf" ? (serie || null) : null,
        manutencao_ids: idsSetor,
        observacoes: obsSetor,
        criado_por: user?.id ?? null,
      }).select("*").single();

      if (error) { toast.error(`Erro no setor ${setor}: ${error.message}`); continue; }

      await supabase.from("manutencoes").update({ fatura_id: fat.id }).in("id", idsSetor);
      geradas++;

      imprimirFatura({
        tipo,
        numero_fatura: fat.numero_fatura,
        numero_nf: fat.numero_nf,
        serie_nf: fat.serie_nf,
        data_emissao: fat.data_emissao,
        periodo_inicio: periodoIni,
        periodo_fim: periodoFim,
        setor,
        empresa: {
          nome: empresa.razao_social,
          cnpj: empresa.cnpj,
          cidade: empresa.cidade,
          estado: empresa.estado,
        },
        itens: itens.map((o) => ({
          data: o.data_conclusao ?? "",
          numero_os: o.numero_os,
          veiculo: o.veiculo ? `${o.veiculo.placa}` : "—",
          oficina: o.oficina_nome ?? "—",
          descricao: o.descricao,
          valor: Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0),
        })),
        valor_servicos: valorServicos,
        taxa_gestao_percentual: taxa,
        valor_taxa: valorTaxa,
        valor_total: total,
        observacoes: obsSetor,
      });
    }

    if (geradas > 0) {
      toast.success(`${geradas} ${tipo === "nf" ? "NF(s)" : "fatura(s)"} emitida(s)`);
    }
    setSelecionadas(new Set());
    setGerarOpen(null);
    carregar();
  }

  function imprimirFaturaExistente(f: Fatura) {
    const ids = f.manutencao_ids ?? [];
    const itens = oss.filter((o) => ids.includes(o.id));
    const setores = Array.from(new Set(itens.map((o) => o.veiculo?.setor).filter(Boolean))) as string[];
    imprimirFatura({
      tipo: f.numero_nf ? "nf" : "fatura",
      numero_fatura: f.numero_fatura,
      numero_nf: f.numero_nf,
      serie_nf: f.serie_nf,
      data_emissao: f.data_emissao,
      periodo_inicio: f.periodo_inicio,
      periodo_fim: f.periodo_fim,
      setor: setores.join(", ") || null,
      empresa: { nome: empresa.razao_social, cnpj: empresa.cnpj, cidade: empresa.cidade, estado: empresa.estado },
      itens: itens.map((o) => ({
        data: o.data_conclusao ?? "",
        numero_os: o.numero_os,
        veiculo: o.veiculo ? o.veiculo.placa : "—",
        oficina: o.oficina_nome ?? "—",
        descricao: o.descricao,
        valor: Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0),
      })),
      valor_servicos: Number(f.valor_total),
      valor_total: Number(f.valor_total),
    });
  }

  async function gerarTextoNFSe(f: Fatura) {
    setGerandoTexto(f.id);
    try {
      const ids = f.manutencao_ids ?? [];
      if (ids.length === 0) {
        toast.error("Fatura sem OSs vinculadas");
        return;
      }
      const { data, error } = await supabase
        .from("manutencoes")
        .select("numero_os, descricao, data_conclusao, valor_final, valor_liquido_faturavel, oficina_nome, nota_fiscal, veiculo:veiculos(placa, marca, modelo, setor)")
        .in("id", ids)
        .order("data_conclusao", { ascending: true });
      if (error) throw error;

      const itens = (data ?? []) as any[];
      const setores = Array.from(new Set(itens.map((o) => (o.veiculo?.setor ?? "").trim()).filter(Boolean)));
      const setorLabel = setores.length === 1 ? setores[0] : (setores.join(" / ") || "—");

      const compIni = new Date(f.periodo_inicio).toLocaleDateString("pt-BR");
      const compFim = new Date(f.periodo_fim).toLocaleDateString("pt-BR");

      const linhas: string[] = [];
      linhas.push(`Prestação de serviços de gestão e intermediação de manutenção de frota de veículos referente ao período de ${compIni} a ${compFim}${setorLabel && setorLabel !== "—" ? ` — Secretaria/Setor: ${setorLabel}` : ""}.`);
      linhas.push("");
      linhas.push(`Tomador: ${empresa.razao_social}${empresa.cnpj ? ` — CNPJ ${empresa.cnpj}` : ""}.`);
      linhas.push("");
      linhas.push(`Discriminação dos serviços (${itens.length} OS):`);
      for (const o of itens) {
        const dt = o.data_conclusao ? new Date(o.data_conclusao).toLocaleDateString("pt-BR") : "—";
        const veic = o.veiculo ? `${o.veiculo.placa}${o.veiculo.marca ? ` (${o.veiculo.marca} ${o.veiculo.modelo ?? ""})`.trim() + ")" : ""}` : "—";
        const valor = Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0);
        const nf = o.nota_fiscal ? ` — NF ${o.nota_fiscal}` : "";
        const of = o.oficina_nome ? ` — ${o.oficina_nome}` : "";
        linhas.push(`• OS ${o.numero_os ?? "—"} · ${dt} · ${veic}${of}${nf}: ${o.descricao ?? ""} — ${BRL(valor)}`);
      }
      linhas.push("");
      linhas.push(`VALOR TOTAL DA NOTA: ${BRL(Number(f.valor_total))}.`);
      if (f.numero_fatura) linhas.push(`Referente à Fatura Interna nº ${f.numero_fatura}.`);

      setTextoNFSe({ fatura: f, setor: setorLabel, texto: linhas.join("\n") });
    } catch (e: any) {
      toast.error(`Erro ao gerar texto: ${e.message ?? e}`);
    } finally {
      setGerandoTexto(null);
    }
  }

  async function marcarFaturaPaga(id: string) {
    const { error } = await supabase.from("faturas")
      .update({ status: "paga", data_pagamento: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Fatura paga"); carregar(); }
  }

  async function gerarRascunho() {
    const ids = Array.from(selecionadas);
    if (ids.length === 0) { toast.error("Selecione ao menos uma OS"); return; }
    const itensSel = oss.filter((o) => ids.includes(o.id));

    const grupos = new Map<string, typeof itensSel>();
    for (const o of itensSel) {
      const setor = (o.veiculo?.setor ?? "Sem setor").trim() || "Sem setor";
      if (!grupos.has(setor)) grupos.set(setor, []);
      grupos.get(setor)!.push(o);
    }

    toast.loading(`Gerando ${grupos.size} rascunho(s) em PDF...`, { id: "rascunho" });
    try {
      for (const [setor, itens] of grupos.entries()) {
        const valorServicos = itens.reduce((s, o) => s + Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0), 0);
        await baixarFaturaPDF({
          tipo: "fatura",
          numero_fatura: null,
          data_emissao: new Date().toISOString(),
          periodo_inicio: periodoIni,
          periodo_fim: periodoFim,
          setor,
          status: "rascunho",
          empresa: {
            nome: empresa.razao_social,
            cnpj: empresa.cnpj,
            cidade: empresa.cidade,
            estado: empresa.estado,
          },
          itens: itens.map((o) => ({
            data: o.data_conclusao ?? "",
            numero_os: o.numero_os,
            veiculo: o.veiculo ? `${o.veiculo.placa}` : "—",
            oficina: o.oficina_nome ?? "—",
            descricao: o.descricao,
            valor: Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0),
          })),
          valor_servicos: valorServicos,
          valor_total: valorServicos,
          observacoes: "*** RASCUNHO — CONFERIR ANTES DE EMITIR — NÃO POSSUI VALIDADE FISCAL ***",
        });
      }
      toast.success(`${grupos.size} rascunho(s) baixado(s) em PDF`, { id: "rascunho" });
    } catch (e: any) {
      toast.error(`Erro ao gerar PDF: ${e.message ?? e}`, { id: "rascunho" });
    }
  }



  return (
    <div className="space-y-4">
      {/* Período */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
        </div>
        <div className="min-w-[200px]">
          <Label className="text-xs">Setor / Secretaria</Label>
          <Select value={filtroSetor} onValueChange={setFiltroSetor}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os setores</SelectItem>
              {setoresDisponiveis.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="default" onClick={() => setImportarNFs(true)} className="bg-gradient-to-r from-primary to-primary/80">
            <Sparkles className="w-4 h-4 mr-1" /> Importar NFs (IA)
          </Button>
          <Button variant="outline" onClick={() => setNovoForn(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo fornecedor
          </Button>
        </div>
      </Card>

      <EnviarNotasFiscaisModal
        open={importarNFs}
        onOpenChange={setImportarNFs}
        empresaId={empresaId}
        onSaved={carregar}
      />

      {/* OSs */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4" /> Ordens de Serviço Concluídas</h3>
            <p className="text-xs text-muted-foreground">Selecione as OSs e gere a fatura ou NF para o cliente.</p>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant="secondary">Selecionado: {BRL(totalSelecionado)}</Badge>
            <Button size="sm" variant="secondary" onClick={gerarRascunho} disabled={selecionadas.size === 0}>
              <Printer className="w-4 h-4 mr-1" /> Gerar Rascunho
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGerarOpen("fatura")} disabled={selecionadas.size === 0}>
              <FileText className="w-4 h-4 mr-1" /> Gerar Fatura
            </Button>
            <Button size="sm" onClick={() => setGerarOpen("nf")} disabled={selecionadas.size === 0}>
              <FileText className="w-4 h-4 mr-1" /> Gerar NF
            </Button>
          </div>
        </div>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={ossFiltradas.filter((o) => !o.fatura_id).length > 0 && ossFiltradas.filter((o) => !o.fatura_id).every((o) => selecionadas.has(o.id))}
                    onCheckedChange={toggleTodas}
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Oficina</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ossFiltradas.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sem OSs no período{filtroSetor !== "__all__" ? ` para o setor "${filtroSetor}"` : ""}.</TableCell></TableRow>
                ) : ossFiltradas.map((o) => (
                  <TableRow key={o.id} className={o.fatura_id ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox
                        disabled={!!o.fatura_id}
                        checked={selecionadas.has(o.id)}
                        onCheckedChange={() => toggle(o.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {o.data_conclusao ? new Date(o.data_conclusao).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{o.numero_os ?? "—"}</TableCell>
                    <TableCell className="text-xs">{o.veiculo ? `${o.veiculo.placa}` : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {o.veiculo?.setor ? <Badge variant="outline" className="text-[10px]">{o.veiculo.setor}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{o.oficina_nome ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate" title={o.descricao}>{o.descricao}</TableCell>
                    <TableCell className="text-right font-mono">{BRL(Number(o.valor_liquido_faturavel ?? o.valor_final ?? 0))}</TableCell>
                    <TableCell>
                      {o.fatura_id
                        ? <Badge variant="default" className="text-[10px]">Faturada</Badge>
                        : <Badge variant="outline" className="text-[10px]">Pendente</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Faturas emitidas */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Faturas/NF emitidas</h3>
        {faturas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma fatura emitida ainda.</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Número</TableHead>
              <TableHead>NF</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {faturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.numero_fatura ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{f.numero_nf ? `${f.numero_nf}${f.serie_nf ? `/${f.serie_nf}` : ""}` : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(f.periodo_inicio).toLocaleDateString("pt-BR")} a {new Date(f.periodo_fim).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-mono">{BRL(Number(f.valor_total))}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "paga" ? "default" : "secondary"} className="text-[10px]">{f.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="default" onClick={() => gerarTextoNFSe(f)} disabled={gerandoTexto === f.id} title="Gerar texto para a NFS-e do site da prefeitura">
                        {gerandoTexto === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCopy className="w-3.5 h-3.5 mr-1" />}
                        Texto NFS-e
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => imprimirFaturaExistente(f)}>
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      {f.status !== "paga" && (
                        <Button size="sm" variant="outline" onClick={() => marcarFaturaPaga(f.id)}>
                          Marcar paga
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Fornecedores externos & pagamentos */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Fornecedores externos — controle de pagamentos</h3>
        {totaisPorFornecedor.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma OS com fornecedor externo vinculado no período.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-center">OSs</TableHead>
              <TableHead className="text-right">Custo serviços</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {totaisPorFornecedor.map((f) => {
                const forn = fornecedores.find((x) => x.id === f.id);
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="font-medium">{f.nome}</div>
                      {forn && <div className="text-[10px] text-muted-foreground">{forn.banco} · AG {forn.agencia} · CC {forn.conta} · PIX {forn.pix_chave}</div>}
                    </TableCell>
                    <TableCell className="text-center">{f.oss}</TableCell>
                    <TableCell className="text-right font-mono">{BRL(f.servicos)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{BRL(f.pago)}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${f.saldo > 0 ? "text-destructive" : ""}`}>{BRL(f.saldo)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" disabled={!forn || f.saldo <= 0} onClick={() => forn && setPagarForn(forn)}>
                        <Wallet className="w-3.5 h-3.5 mr-1" /> Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {gerarOpen && (
        <GerarDocDialog
          tipo={gerarOpen}
          valorBase={totalSelecionado}
          qtd={selecionadas.size}
          onClose={() => setGerarOpen(null)}
          onConfirm={gerarDocumento}
        />
      )}
      {pagarForn && (
        <PagarFornecedorDialog
          fornecedor={pagarForn}
          empresaId={empresaId}
          pagoPor={user?.id ?? null}
          oss={oss.filter((o) => o.fornecedor_externo_id === pagarForn.id)}
          pagamentos={pagamentos.filter((p) => p.fornecedor_externo_id === pagarForn.id)}
          onClose={() => setPagarForn(null)}
          onSaved={() => { setPagarForn(null); carregar(); }}
        />
      )}
      {novoForn && (
        <NovoFornecedorDialog
          onClose={() => setNovoForn(false)}
          onSaved={() => { setNovoForn(false); carregar(); }}
        />
      )}
      {textoNFSe && (
        <Dialog open onOpenChange={(o) => !o && setTextoNFSe(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Texto para NFS-e — Fatura {textoNFSe.fatura.numero_fatura ?? "—"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Cole este texto no campo <b>Discriminação dos Serviços</b> ao emitir a NFS-e no site da prefeitura.
                {textoNFSe.setor && textoNFSe.setor !== "—" && <> Setor/Secretaria: <b>{textoNFSe.setor}</b>.</>}
              </div>
              <Textarea
                rows={18}
                value={textoNFSe.texto}
                readOnly
                className="font-mono text-xs whitespace-pre"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="text-xs text-muted-foreground">
                Valor total da NF: <b>{BRL(Number(textoNFSe.fatura.valor_total))}</b>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTextoNFSe(null)}>Fechar</Button>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(textoNFSe.texto);
                    toast.success("Texto copiado para a área de transferência");
                  } catch {
                    toast.error("Não foi possível copiar — selecione manualmente");
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-1" /> Copiar texto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function GerarDocDialog({ tipo, valorBase, qtd, onClose, onConfirm }: {
  tipo: "fatura" | "nf"; valorBase: number; qtd: number;
  onClose: () => void;
  onConfirm: (tipo: "fatura" | "nf", taxa: number, numNf: string, serie: string, obs: string) => void;
}) {
  const [taxa, setTaxa] = useState("0");
  const [numNf, setNumNf] = useState("");
  const [serie, setSerie] = useState("1");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const taxaNum = parseFloat(taxa.replace(",", ".")) || 0;
  const valorTaxa = (valorBase * taxaNum) / 100;
  const total = valorBase + valorTaxa;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tipo === "nf" ? "Emitir Nota Fiscal" : "Emitir Fatura"} ({qtd} OS)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {tipo === "nf" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Número da NF</Label>
                <Input value={numNf} onChange={(e) => setNumNf(e.target.value)} placeholder="Ex.: 000123" />
              </div>
              <div>
                <Label>Série</Label>
                <Input value={serie} onChange={(e) => setSerie(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <Label>Taxa de gestão (%)</Label>
            <Input type="number" step="0.1" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div className="bg-primary/10 rounded p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">Total da {tipo === "nf" ? "NF" : "fatura"}</p>
            <p className="text-2xl font-bold text-primary">{BRL(total)}</p>
            <p className="text-[10px] text-muted-foreground">Serviços {BRL(valorBase)} + Taxa {BRL(valorTaxa)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={async () => { setSaving(true); await onConfirm(tipo, taxaNum, numNf, serie, obs); setSaving(false); }} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Emitir e imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagarFornecedorDialog({ fornecedor, empresaId, pagoPor, oss, pagamentos, onClose, onSaved }: {
  fornecedor: ForExterno; empresaId: string; pagoPor: string | null;
  oss: OS[]; pagamentos: Pagamento[];
  onClose: () => void; onSaved: () => void;
}) {
  const ossComSaldo = oss.map((o) => {
    const pago = pagamentos.filter((p) => p.manutencao_id === o.id).reduce((s, p) => s + Number(p.valor), 0);
    const custo = Number(o.custo_fornecedor ?? o.valor_final ?? 0);
    return { ...o, custo, pago, saldo: Math.max(0, custo - pago) };
  }).filter((o) => o.saldo > 0);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set(ossComSaldo.map((o) => o.id)));
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("PIX");
  const [doc, setDoc] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const itensSel = ossComSaldo.filter((o) => selecionadas.has(o.id));
  const total = itensSel.reduce((s, o) => s + o.saldo, 0);

  async function salvar() {
    if (itensSel.length === 0) { toast.error("Selecione ao menos uma OS"); return; }
    setSaving(true);
    try {
      const rows = itensSel.map((o) => ({
        fornecedor_externo_id: fornecedor.id,
        empresa_id: empresaId,
        manutencao_id: o.id,
        valor: o.saldo,
        data_pagamento: data,
        forma_pagamento: forma,
        numero_documento: doc || null,
        observacoes: obs || `Pagamento OS ${o.numero_os ?? ""}`.trim(),
        pago_por: pagoPor,
      }));
      const { error } = await supabase.from("pagamentos_fornecedor").insert(rows);
      if (error) throw error;
      toast.success(`${itensSel.length} pagamento(s) registrado(s)`);
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pagar — {fornecedor.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Card className="p-2 text-xs bg-muted">
            {fornecedor.banco} · AG {fornecedor.agencia} · CC {fornecedor.conta} · PIX ({fornecedor.pix_tipo}): {fornecedor.pix_chave}
          </Card>
          <div className="max-h-64 overflow-y-auto border rounded">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>OS</TableHead>
                <TableHead>NF</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ossComSaldo.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Checkbox
                        checked={selecionadas.has(o.id)}
                        onCheckedChange={() => {
                          setSelecionadas((p) => {
                            const n = new Set(p); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{o.numero_os ?? "—"}</TableCell>
                    <TableCell className="text-xs">{o.nota_fiscal}</TableCell>
                    <TableCell className="text-right font-mono">{BRL(o.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Forma</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TED">TED</SelectItem>
                  <SelectItem value="DOC">DOC</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Documento</Label>
              <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Comprov./TED" />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div className="bg-emerald-500/10 rounded p-3 text-center">
            <p className="text-xs text-muted-foreground">Total a pagar</p>
            <p className="text-2xl font-bold text-emerald-600">{BRL(total)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || itensSel.length === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Registrar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoFornecedorDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    nome: "", cnpj: "", telefone: "", responsavel: "",
    banco: "", agencia: "", conta: "", pix_chave: "", pix_tipo: "CNPJ",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!f.nome) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase.from("fornecedores_externos").insert(f);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Fornecedor cadastrado"); onSaved(); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo fornecedor externo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome / Razão *</Label>
            <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
          </div>
          <div>
            <Label>Banco</Label>
            <Input value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} />
          </div>
          <div>
            <Label>Agência</Label>
            <Input value={f.agencia} onChange={(e) => setF({ ...f, agencia: e.target.value })} />
          </div>
          <div>
            <Label>Conta</Label>
            <Input value={f.conta} onChange={(e) => setF({ ...f, conta: e.target.value })} />
          </div>
          <div>
            <Label>PIX (tipo)</Label>
            <Select value={f.pix_tipo} onValueChange={(v) => setF({ ...f, pix_tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="E-mail">E-mail</SelectItem>
                <SelectItem value="Telefone">Telefone</SelectItem>
                <SelectItem value="Aleatória">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Chave PIX</Label>
            <Input value={f.pix_chave} onChange={(e) => setF({ ...f, pix_chave: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
