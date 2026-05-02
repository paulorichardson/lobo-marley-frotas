import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Receipt, DollarSign, TrendingUp, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Lobo Marley" }] }),
  component: () => (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <FinanceiroPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const BRL = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ResumoEmpresa {
  empresa_id: string;
  razao_social: string;
  abastecimentos: number;
  manutencoes: number;
  despesas: number;
  total: number;
}
interface ResumoFornecedor {
  fornecedor_id: string;
  nome: string;
  tipos: string[];
  servicos_total: number;
  pago: number;
  saldo: number;
}

function FinanceiroPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aReceber, setAReceber] = useState(0);
  const [recebido, setRecebido] = useState(0);
  const [aPagar, setAPagar] = useState(0);
  const [serie, setSerie] = useState<{ mes: string; receita: number; pago: number }[]>([]);
  const [empresas, setEmpresas] = useState<ResumoEmpresa[]>([]);
  const [fornecedores, setFornecedores] = useState<ResumoFornecedor[]>([]);
  const [gerarOpen, setGerarOpen] = useState<ResumoEmpresa | null>(null);
  const [pagarOpen, setPagarOpen] = useState<ResumoFornecedor | null>(null);

  async function carregar() {
    setLoading(true);
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

    // KPIs faturas
    const [{ data: emitidas }, { data: pagas }] = await Promise.all([
      supabase.from("faturas").select("valor_total").in("status", ["emitida"]),
      supabase.from("faturas").select("valor_total")
        .eq("status", "paga").gte("data_pagamento", inicioMes),
    ]);
    setAReceber((emitidas ?? []).reduce((s, f) => s + Number(f.valor_total || 0), 0));
    setRecebido((pagas ?? []).reduce((s, f) => s + Number(f.valor_total || 0), 0));

    // a pagar fornecedor: manutencoes concluídas - pagamentos
    const { data: manut } = await supabase
      .from("manutencoes")
      .select("id, fornecedor_id, valor_final, status, data_conclusao")
      .eq("status", "Concluída");
    const totalServicos = (manut ?? []).reduce((s, m) => s + Number(m.valor_final || 0), 0);
    const { data: pagamentos } = await supabase.from("pagamentos_fornecedor").select("valor, fornecedor_id, data_pagamento");
    const totalPago = (pagamentos ?? []).reduce((s, p) => s + Number(p.valor || 0), 0);
    setAPagar(Math.max(0, totalServicos - totalPago));

    // série últimos 6 meses
    const meses: { mes: string; receita: number; pago: number; ts: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short" }),
        receita: 0, pago: 0,
        ts: d.getTime(),
      });
    }
    (pagas ?? []).forEach((f: any) => { /* já filtrado mês corrente apenas, ok */ });
    // Receita 6m: refaz consulta
    const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1).toISOString();
    const { data: fat6 } = await supabase
      .from("faturas").select("valor_total, data_pagamento")
      .eq("status", "paga").gte("data_pagamento", seisMesesAtras);
    (fat6 ?? []).forEach((f: any) => {
      if (!f.data_pagamento) return;
      const d = new Date(f.data_pagamento);
      const slot = meses.find((m) => {
        const md = new Date(m.ts);
        return md.getMonth() === d.getMonth() && md.getFullYear() === d.getFullYear();
      });
      if (slot) slot.receita += Number(f.valor_total || 0);
    });
    (pagamentos ?? []).forEach((p: any) => {
      if (!p.data_pagamento) return;
      const d = new Date(p.data_pagamento);
      const slot = meses.find((m) => {
        const md = new Date(m.ts);
        return md.getMonth() === d.getMonth() && md.getFullYear() === d.getFullYear();
      });
      if (slot) slot.pago += Number(p.valor || 0);
    });
    setSerie(meses.map(({ mes, receita, pago }) => ({ mes, receita, pago })));

    // Resumo por empresa (mês)
    const { data: emps } = await supabase.from("empresas").select("id, razao_social");
    const resumoEmp: ResumoEmpresa[] = [];
    await Promise.all((emps ?? []).map(async (e) => {
      const [a, m, d] = await Promise.all([
        supabase.from("abastecimentos").select("valor_total")
          .eq("empresa_id", e.id).gte("data_hora", inicioMes),
        supabase.from("manutencoes").select("valor_final")
          .eq("empresa_id", e.id).gte("data_conclusao", inicioMes),
        supabase.from("despesas").select("valor")
          .eq("empresa_id", e.id).gte("data_despesa", inicioMes.slice(0, 10)),
      ]);
      const va = (a.data ?? []).reduce((s, x) => s + Number(x.valor_total || 0), 0);
      const vm = (m.data ?? []).reduce((s, x) => s + Number(x.valor_final || 0), 0);
      const vd = (d.data ?? []).reduce((s, x) => s + Number(x.valor || 0), 0);
      resumoEmp.push({
        empresa_id: e.id, razao_social: e.razao_social,
        abastecimentos: va, manutencoes: vm, despesas: vd,
        total: va + vm + vd,
      });
    }));
    setEmpresas(resumoEmp);

    // Fornecedores
    const fornAg: Record<string, ResumoFornecedor> = {};
    (manut ?? []).forEach((mm: any) => {
      if (!mm.fornecedor_id) return;
      if (!fornAg[mm.fornecedor_id]) {
        fornAg[mm.fornecedor_id] = {
          fornecedor_id: mm.fornecedor_id, nome: "", tipos: [],
          servicos_total: 0, pago: 0, saldo: 0,
        };
      }
      fornAg[mm.fornecedor_id].servicos_total += Number(mm.valor_final || 0);
    });
    (pagamentos ?? []).forEach((p: any) => {
      if (!p.fornecedor_id) return;
      if (!fornAg[p.fornecedor_id]) {
        fornAg[p.fornecedor_id] = {
          fornecedor_id: p.fornecedor_id, nome: "", tipos: [],
          servicos_total: 0, pago: 0, saldo: 0,
        };
      }
      fornAg[p.fornecedor_id].pago += Number(p.valor || 0);
    });
    const ids = Object.keys(fornAg);
    if (ids.length) {
      const { data: cads } = await supabase.from("fornecedores_cadastro")
        .select("user_id, razao_social, nome_fantasia, tipos_fornecimento")
        .in("user_id", ids);
      (cads ?? []).forEach((c: any) => {
        if (fornAg[c.user_id]) {
          fornAg[c.user_id].nome = c.nome_fantasia || c.razao_social;
          fornAg[c.user_id].tipos = c.tipos_fornecimento ?? [];
        }
      });
    }
    Object.values(fornAg).forEach((f) => { f.saldo = Math.max(0, f.servicos_total - f.pago); });
    setFornecedores(Object.values(fornAg).filter((f) => f.saldo > 0));

    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const margem = useMemo(() => recebido - (serie.reduce((s, m) => s + m.pago, 0)), [recebido, serie]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Receipt className="w-7 h-7 text-accent" />
        <div>
          <h1 className="text-2xl font-bold">Financeiro consolidado</h1>
          <p className="text-sm text-muted-foreground">Receitas vs. pagamentos a fornecedores</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI titulo="A receber" valor={aReceber} icon={<DollarSign />} cor="text-amber-500" />
        <KPI titulo="Recebido (mês)" valor={recebido} icon={<TrendingUp />} cor="text-emerald-500" />
        <KPI titulo="A pagar fornecedores" valor={aPagar} icon={<DollarSign />} cor="text-rose-500" />
        <KPI titulo="Margem (mês)" valor={margem} icon={<TrendingUp />} cor={margem >= 0 ? "text-emerald-500" : "text-rose-500"} />
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Receita vs Pagamentos (6 meses)</h2>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => BRL(v)} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" />
              <Bar dataKey="pago" name="Pago" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Clientes — resumo do mês</h2>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Abast.</TableHead>
                <TableHead className="text-right">Manut.</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {empresas.map((e) => (
                  <TableRow key={e.empresa_id}>
                    <TableCell className="font-medium">{e.razao_social}</TableCell>
                    <TableCell className="text-right">{BRL(e.abastecimentos)}</TableCell>
                    <TableCell className="text-right">{BRL(e.manutencoes)}</TableCell>
                    <TableCell className="text-right">{BRL(e.despesas)}</TableCell>
                    <TableCell className="text-right font-semibold">{BRL(e.total)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setGerarOpen(e)} disabled={e.total === 0}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> Gerar fatura
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Fornecedores — a pagar</h2>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : fornecedores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem saldos pendentes.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Tipos</TableHead>
                <TableHead className="text-right">Serviços</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fornecedores.map((f) => (
                  <TableRow key={f.fornecedor_id}>
                    <TableCell className="font-medium">{f.nome || f.fornecedor_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {f.tipos.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{BRL(f.servicos_total)}</TableCell>
                    <TableCell className="text-right">{BRL(f.pago)}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-500">{BRL(f.saldo)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setPagarOpen(f)}>Registrar pagamento</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {gerarOpen && (
        <GerarFaturaDialog
          empresa={gerarOpen}
          criadoPor={user?.id ?? null}
          onClose={() => setGerarOpen(null)}
          onSaved={() => { setGerarOpen(null); carregar(); }}
        />
      )}
      {pagarOpen && (
        <PagamentoDialog
          fornecedor={pagarOpen}
          pagoPor={user?.id ?? null}
          onClose={() => setPagarOpen(null)}
          onSaved={() => { setPagarOpen(null); carregar(); }}
        />
      )}
    </div>
  );
}

function KPI({ titulo, valor, icon, cor }: {
  titulo: string; valor: number; icon: React.ReactNode; cor: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase text-muted-foreground">{titulo}</p>
        <div className={cor}>{icon}</div>
      </div>
      <p className="text-xl md:text-2xl font-bold">{BRL(valor)}</p>
    </Card>
  );
}

function GerarFaturaDialog({ empresa, criadoPor, onClose, onSaved }: {
  empresa: ResumoEmpresa; criadoPor: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [taxa, setTaxa] = useState("10");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const taxaNum = parseFloat(taxa.replace(",", ".")) || 0;
  const valorTaxa = (empresa.total * taxaNum) / 100;
  const total = empresa.total + valorTaxa;

  async function salvar() {
    setSaving(true);
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { error } = await supabase.from("faturas").insert({
      empresa_id: empresa.empresa_id,
      periodo_inicio: inicio,
      periodo_fim: fim,
      valor_abastecimentos: empresa.abastecimentos,
      valor_servicos: empresa.manutencoes,
      valor_despesas: empresa.despesas,
      taxa_gestao_percentual: taxaNum,
      valor_taxa: valorTaxa,
      valor_total: total,
      status: "emitida",
      data_emissao: new Date().toISOString(),
      observacoes: obs || null,
      criado_por: criadoPor,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fatura emitida");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar fatura — {empresa.razao_social}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Card className="p-2 text-center"><p className="text-xs text-muted-foreground">Abast.</p><p className="font-semibold">{BRL(empresa.abastecimentos)}</p></Card>
            <Card className="p-2 text-center"><p className="text-xs text-muted-foreground">Manut.</p><p className="font-semibold">{BRL(empresa.manutencoes)}</p></Card>
            <Card className="p-2 text-center"><p className="text-xs text-muted-foreground">Desp.</p><p className="font-semibold">{BRL(empresa.despesas)}</p></Card>
          </div>
          <div>
            <Label>Taxa de gestão (%)</Label>
            <Input type="number" step="0.1" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div className="bg-primary/10 rounded p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Total da fatura</p>
            <p className="text-3xl font-bold text-primary">{BRL(total)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Emitir fatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagamentoDialog({ fornecedor, pagoPor, onClose, onSaved }: {
  fornecedor: ResumoFornecedor; pagoPor: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [valor, setValor] = useState(String(fornecedor.saldo.toFixed(2)));
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("PIX");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    const v = parseFloat(valor.replace(",", ".")) || 0;
    if (v <= 0) return toast.error("Valor inválido");
    setSaving(true);
    const { error } = await supabase.from("pagamentos_fornecedor").insert({
      fornecedor_id: fornecedor.fornecedor_id,
      valor: v,
      data_pagamento: data,
      forma_pagamento: forma,
      observacoes: obs || null,
      pago_por: pagoPor,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pagar {fornecedor.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Saldo atual: <strong>{BRL(fornecedor.saldo)}</strong></p>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div>
            <Label>Forma</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="TED">TED</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
