import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CreditCard, Eye, Wallet, Receipt } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/financeiro/fornecedores")({
  head: () => ({ meta: [{ title: "Financeiro Fornecedores — Lobo Marley" }] }),
  component: FinanceiroFornecedoresPage,
});

type Servico = {
  id: string;
  tipo: "manutencao" | "abastecimento" | "despesa";
  descricao: string;
  data: string;
  valor: number;
  pago: number;
  saldo: number;
};

type FornecedorRow = {
  id: string;
  nome: string;
  email: string;
  tipos: string[];
  total: number;
  pago: number;
  saldo: number;
  servicos: Servico[];
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroFornecedoresPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FornecedorRow[]>([]);
  const [busca, setBusca] = useState("");
  const [periodoIni, setPeriodoIni] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodoFim, setPeriodoFim] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );

  const [verServicos, setVerServicos] = useState<FornecedorRow | null>(null);
  const [pagar, setPagar] = useState<FornecedorRow | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      // 1. Fornecedores aprovados
      const { data: cads, error: e1 } = await supabase
        .from("fornecedores_cadastro")
        .select("user_id, razao_social, nome_fantasia, email_login, tipos_fornecimento")
        .eq("status", "aprovado");
      if (e1) throw e1;

      const fornecedores = (cads ?? []).filter((c) => c.user_id);
      if (fornecedores.length === 0) {
        setRows([]);
        return;
      }
      const ids = fornecedores.map((f) => f.user_id as string);

      const dataIni = `${periodoIni}T00:00:00`;
      const dataFim = `${periodoFim}T23:59:59`;

      // 2. Manutenções concluídas
      const { data: manuts } = await supabase
        .from("manutencoes")
        .select("id, fornecedor_id, descricao, valor_final, data_conclusao")
        .in("fornecedor_id", ids)
        .eq("status", "Concluída")
        .gte("data_conclusao", dataIni)
        .lte("data_conclusao", dataFim);

      // 3. Abastecimentos
      const { data: abasts } = await supabase
        .from("abastecimentos")
        .select("id, fornecedor_id, posto, valor_total, data_hora, litros")
        .in("fornecedor_id", ids)
        .gte("data_hora", dataIni)
        .lte("data_hora", dataFim);

      // 4. Despesas lançadas pelo fornecedor
      const { data: despesas } = await supabase
        .from("despesas")
        .select("id, lancado_por, descricao, tipo, valor, data_despesa")
        .in("lancado_por", ids)
        .gte("data_despesa", periodoIni)
        .lte("data_despesa", periodoFim);

      // 5. Pagamentos já feitos (itens) — buscar todos itens dos pagamentos do período do fornecedor
      const allServicoIds = [
        ...(manuts ?? []).map((m) => m.id),
        ...(abasts ?? []).map((a) => a.id),
        ...(despesas ?? []).map((d) => d.id),
      ];
      const pagosPorServico = new Map<string, number>();
      if (allServicoIds.length > 0) {
        const { data: itens } = await supabase
          .from("pagamento_itens")
          .select("servico_id, valor_aplicado")
          .in("servico_id", allServicoIds);
        for (const it of itens ?? []) {
          pagosPorServico.set(
            it.servico_id,
            (pagosPorServico.get(it.servico_id) ?? 0) + Number(it.valor_aplicado),
          );
        }
      }

      const result: FornecedorRow[] = fornecedores.map((f) => {
        const servicos: Servico[] = [];

        for (const m of manuts ?? []) {
          if (m.fornecedor_id !== f.user_id) continue;
          const valor = Number(m.valor_final ?? 0);
          const pago = pagosPorServico.get(m.id) ?? 0;
          servicos.push({
            id: m.id,
            tipo: "manutencao",
            descricao: `Manutenção: ${m.descricao}`,
            data: m.data_conclusao ?? "",
            valor,
            pago,
            saldo: Math.max(0, valor - pago),
          });
        }
        for (const a of abasts ?? []) {
          if (a.fornecedor_id !== f.user_id) continue;
          const valor = Number(a.valor_total ?? 0);
          const pago = pagosPorServico.get(a.id) ?? 0;
          servicos.push({
            id: a.id,
            tipo: "abastecimento",
            descricao: `Abastecimento ${a.posto ?? ""} (${a.litros}L)`,
            data: a.data_hora ?? "",
            valor,
            pago,
            saldo: Math.max(0, valor - pago),
          });
        }
        for (const d of despesas ?? []) {
          if (d.lancado_por !== f.user_id) continue;
          const valor = Number(d.valor ?? 0);
          const pago = pagosPorServico.get(d.id) ?? 0;
          servicos.push({
            id: d.id,
            tipo: "despesa",
            descricao: `Despesa ${d.tipo}: ${d.descricao ?? ""}`,
            data: d.data_despesa ?? "",
            valor,
            pago,
            saldo: Math.max(0, valor - pago),
          });
        }

        const total = servicos.reduce((s, x) => s + x.valor, 0);
        const pago = servicos.reduce((s, x) => s + x.pago, 0);
        return {
          id: f.user_id as string,
          nome: f.nome_fantasia || f.razao_social,
          email: f.email_login,
          tipos: f.tipos_fornecimento ?? [],
          total,
          pago,
          saldo: Math.max(0, total - pago),
          servicos: servicos.sort((a, b) => (b.data > a.data ? 1 : -1)),
        };
      });

      setRows(result);
    } catch (err: any) {
      toast.error("Erro ao carregar dados", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoIni, periodoFim]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [rows, busca]);

  const totais = useMemo(
    () => ({
      total: rows.reduce((s, r) => s + r.total, 0),
      pago: rows.reduce((s, r) => s + r.pago, 0),
      saldo: rows.reduce((s, r) => s + r.saldo, 0),
    }),
    [rows],
  );

  return (
    <ProtectedRoute roles={["admin"]}>
      <AppShell>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Financeiro — Fornecedores</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe valores devidos, pagos e em aberto por fornecedor.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Receipt className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total no período</p>
                  <p className="text-xl font-bold">{BRL(totais.total)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Wallet className="w-8 h-8 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Já pago</p>
                  <p className="text-xl font-bold text-emerald-600">{BRL(totais.pago)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Saldo a pagar</p>
                  <p className={`text-xl font-bold ${totais.saldo > 0 ? "text-destructive" : ""}`}>
                    {BRL(totais.saldo)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4 space-y-3">
            <Input
              placeholder="Buscar fornecedor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="max-w-sm"
            />
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtradas.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum fornecedor com lançamentos no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.nome}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.tipos.slice(0, 2).map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{BRL(r.total)}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600">{BRL(r.pago)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${r.saldo > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {BRL(r.saldo)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setVerServicos(r)}>
                              <Eye className="w-4 h-4 mr-1" /> Ver Serviços
                            </Button>
                            <Button size="sm" disabled={r.saldo <= 0} onClick={() => setPagar(r)}>
                              <CreditCard className="w-4 h-4 mr-1" /> Registrar Pagamento
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* Drawer Ver Serviços */}
        <Sheet open={!!verServicos} onOpenChange={(o) => !o && setVerServicos(null)}>
          <SheetContent className="sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Serviços — {verServicos?.nome}</SheetTitle>
              <SheetDescription>Lançamentos do período com status de pagamento.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              {verServicos && verServicos.servicos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem lançamentos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verServicos?.servicos.map((s) => {
                      const status =
                        s.saldo === 0 ? "Pago" : s.pago > 0 ? "Parcial" : "Em aberto";
                      const variant =
                        s.saldo === 0 ? "default" : s.pago > 0 ? "secondary" : "destructive";
                      return (
                        <TableRow key={`${s.tipo}-${s.id}`}>
                          <TableCell className="text-sm">{s.descricao}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {s.data ? new Date(s.data).toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{BRL(s.valor)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{BRL(s.pago)}</TableCell>
                          <TableCell>
                            <Badge variant={variant as any}>{status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Modal Registrar Pagamento */}
        {pagar && (
          <RegistrarPagamentoDialog
            fornecedor={pagar}
            adminId={user?.id ?? ""}
            onClose={() => setPagar(null)}
            onSuccess={() => {
              setPagar(null);
              carregar();
            }}
          />
        )}
      </AppShell>
    </ProtectedRoute>
  );
}

function RegistrarPagamentoDialog({
  fornecedor,
  adminId,
  onClose,
  onSuccess,
}: {
  fornecedor: FornecedorRow;
  adminId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const emAberto = fornecedor.servicos.filter((s) => s.saldo > 0);
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(emAberto.map((s) => `${s.tipo}::${s.id}`)),
  );
  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [forma, setForma] = useState<string>("PIX");
  const [observacoes, setObservacoes] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const itensSel = emAberto.filter((s) => selecionados.has(`${s.tipo}::${s.id}`));
  const valorTotal = itensSel.reduce((sum, s) => sum + s.saldo, 0);

  function toggle(key: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function salvar() {
    if (itensSel.length === 0) {
      toast.error("Selecione ao menos um serviço");
      return;
    }
    setSalvando(true);
    try {
      let comprovante_url: string | null = null;
      if (comprovante) {
        comprovante_url = await uploadFile(
          "comprovantes",
          `pagamentos/${fornecedor.id}`,
          comprovante,
          comprovante.name.split(".").pop() || "pdf",
        );
      }

      const { data: pag, error: e1 } = await supabase
        .from("pagamentos_fornecedor")
        .insert({
          fornecedor_id: fornecedor.id,
          valor: valorTotal,
          data_pagamento: dataPagamento,
          forma_pagamento: forma,
          comprovante_url,
          observacoes: observacoes || null,
          pago_por: adminId,
        })
        .select()
        .single();
      if (e1) throw e1;

      const itens = itensSel.map((s) => ({
        pagamento_id: pag.id,
        tipo_servico: s.tipo,
        servico_id: s.id,
        valor_aplicado: s.saldo,
      }));
      const { error: e2 } = await supabase.from("pagamento_itens").insert(itens);
      if (e2) throw e2;

      // Notificação ao fornecedor
      await supabase.from("notificacoes").insert({
        para_id: fornecedor.id,
        titulo: "Pagamento recebido",
        mensagem: `Você recebeu ${BRL(valorTotal)} via ${forma}.`,
        tipo: "sucesso",
      });

      toast.success("Pagamento registrado");
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento — {fornecedor.nome}</DialogTitle>
          <DialogDescription>
            Selecione os serviços que serão quitados com este pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-md max-h-60 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emAberto.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum serviço em aberto.
                    </TableCell>
                  </TableRow>
                ) : (
                  emAberto.map((s) => {
                    const key = `${s.tipo}::${s.id}`;
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox
                            checked={selecionados.has(key)}
                            onCheckedChange={() => toggle(key)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.descricao}
                          <div className="text-xs text-muted-foreground">
                            {s.data ? new Date(s.data).toLocaleDateString("pt-BR") : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{BRL(s.saldo)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
            <div>
              <Label>Forma</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TED">TED</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Comprovante (opcional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-md bg-muted">
            <span className="text-sm">Total a pagar</span>
            <span className="text-lg font-bold">{BRL(valorTotal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || valorTotal <= 0}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
